import { fileURLToPath } from "node:url";
import type {
  JsonValue,
  ParsedQuotation,
  WorkbookParser,
} from "@procurement/application/ports";
import { type IsolationResult, runParserIsolated } from "./isolation-runner.js";
import { parseIsolatedParsedQuote } from "./parsed-quote-schema.js";
import { preflightOOXML as runPreflightOOXML } from "./preflight.js";
import type { ParsedQuote, QuoteScenario } from "./types.js";

type Runner = (
  input: Uint8Array,
  options: Parameters<typeof runParserIsolated>[1],
) => Promise<IsolationResult>;

const child = fileURLToPath(new URL("./parser-child.ts", import.meta.url));

/**
 * Application-facing workbook parser. OOXML validation happens before spawning;
 * untrusted parser output is structurally bounded again in the parent process.
 */
export class IsolatedWorkbookParser implements WorkbookParser {
  constructor(
    private readonly runner: Runner = runParserIsolated,
    private readonly preflightOOXML = runPreflightOOXML,
  ) {}

  async preflight(
    bytes: Uint8Array,
  ): Promise<{ safe: boolean; reason?: string }> {
    const result = await this.preflightOOXML(bytes);
    return result.ok
      ? { safe: true }
      : { safe: false, reason: result.reason ?? "preflight_rejected" };
  }

  async parse(bytes: Uint8Array): Promise<ParsedQuotation> {
    const preflight = await this.preflightOOXML(bytes);
    if (!preflight.ok)
      throw new Error(
        `isolated parser preflight rejected: ${preflight.reason}`,
      );

    const outcome = await this.runner(bytes, {
      executable: process.execPath,
      arguments: ["--import", "tsx", child],
      timeoutMs: 30_000,
      maxInputBytes: 25 * 1024 * 1024,
      maxOutputBytes: 10 * 1024 * 1024,
    });
    if (!outcome.ok) throw new Error(`isolated parser ${outcome.code}`);
    return mapParsedQuote(this.readChildOutput(outcome.output));
  }

  private readChildOutput(output: Uint8Array): ParsedQuote {
    let envelope: unknown;
    try {
      envelope = JSON.parse(new TextDecoder().decode(output));
    } catch {
      throw new Error("isolated parser returned invalid JSON");
    }
    if (!isEnvelope(envelope))
      throw new Error("isolated parser returned invalid envelope");
    try {
      return parseIsolatedParsedQuote(envelope.result);
    } catch {
      throw new Error("isolated parser returned invalid envelope");
    }
  }
}

const isEnvelope = (
  value: unknown,
): value is Readonly<{ version: 1; result: unknown }> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (value as { version?: unknown }).version === 1 &&
  "result" in value;

export const requiresInterpretation = (parsed: ParsedQuote): boolean =>
  parsed.scenarios.length !== 1 ||
  parsed.scenarios.some((scenario) =>
    scenario.lines.some(
      (line) =>
        line.fieldRoleStatus === "ambiguous" ||
        line.quantityCandidates.length !== 1 ||
        line.unitPriceCandidates.length !== 1,
    ),
  );

export const mapParsedQuote = (parsed: ParsedQuote): ParsedQuotation => ({
  requiresInterpretation: requiresInterpretation(parsed),
  scenarios: parsed.scenarios.map((scenario) => mapScenario(scenario, parsed)),
});

const mapScenario = (
  scenario: QuoteScenario,
  parsed: ParsedQuote,
): ParsedQuotation["scenarios"][number] => ({
  sourceSheet: scenario.sourceRegions[0]?.sheet ?? "unknown",
  rationale:
    scenario.groupingReasons.map((reason) => reason.message).join("; ") ||
    `Parsed from ${scenario.sourceRegions[0]?.sheet ?? "workbook"}`,
  metadata: toJsonValue({
    parserVersion: parsed.parserVersion,
    sourceRegions: scenario.sourceRegions,
    groupingReasons: scenario.groupingReasons,
    confidence: scenario.confidence,
    label: scenario.label ?? null,
    metadata: scenario.metadata,
    warnings: parsed.warnings,
    sheets: parsed.sheets,
  }),
  lines: scenario.lines.map((line) => ({
    sourceEvidence: toJsonValue(line.evidence),
    normalizedCandidates: toJsonValue({
      ...(line.sku === undefined ? {} : { sku: line.sku }),
      ...(line.description === undefined
        ? {}
        : { description: line.description }),
      quantityCandidates: line.quantityCandidates,
      unitPriceCandidates: line.unitPriceCandidates,
      ...(line.lineTotal === undefined ? {} : { lineTotal: line.lineTotal }),
      tiers: line.tiers,
      fieldRoleStatus: line.fieldRoleStatus,
      confidence: line.confidence,
      warnings: line.warnings,
    }),
    rawValue: line.sku?.value ?? line.description?.value ?? null,
  })),
});

export const toJsonValue = (value: unknown): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("parser returned non-finite JSON number");
    return value;
  }
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "object") {
    const output: Record<string, JsonValue> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined)
        throw new Error("parser returned undefined JSON value");
      output[key] = toJsonValue(nested);
    }
    return output;
  }
  throw new Error("parser returned non-JSON value");
};
