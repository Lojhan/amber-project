import { describe, expect, it } from "vitest";
import {
  IsolatedWorkbookParser,
  mapParsedQuote,
  requiresInterpretation,
} from "./isolated-workbook-parser.js";
import type { ParsedQuote } from "./types.js";

const parsed = (ambiguous = false): ParsedQuote => ({
  parserVersion: "test",
  warnings: [],
  sheets: [],
  scenarios: [
    {
      id: "s",
      sourceRegions: [
        {
          sheet: "Quote",
          startRow: 1,
          endRow: 1,
          startColumn: 1,
          endColumn: 1,
        },
      ],
      metadata: {},
      groupingReasons: [],
      confidence: 1,
      lines: [
        {
          evidence: [],
          quantityCandidates: [{ value: "1", evidence: [], confidence: 1 }],
          unitPriceCandidates: [{ value: "2", evidence: [], confidence: 1 }],
          tiers: [],
          fieldRoleStatus: ambiguous ? "ambiguous" : "resolved",
          confidence: 1,
          warnings: [],
        },
      ],
    },
  ],
});

const safePreflight = async () => ({
  ok: true,
  entries: [],
  expandedBytes: 0,
});

describe("IsolatedWorkbookParser", () => {
  it("rejects malformed child output in the parent process", async () => {
    const parser = new IsolatedWorkbookParser(
      async () => ({
        ok: true,
        output: new TextEncoder().encode('{"version":1,"result":{}}'),
      }),
      safePreflight,
    );
    await expect(parser.parse(new Uint8Array())).rejects.toThrow(
      "invalid envelope",
    );
  });

  it("surfaces isolation failures with the established parser error prefix", async () => {
    const parser = new IsolatedWorkbookParser(
      async () => ({ ok: false, code: "timeout" }),
      safePreflight,
    );
    await expect(parser.parse(new Uint8Array())).rejects.toThrow(
      "isolated parser timeout",
    );
  });

  it("preserves parser evidence and marks ambiguous fields for interpretation", () => {
    const quote = parsed(true);
    quote.scenarios[0]!.groupingReasons.push({
      code: "contiguous_quote_region",
      message: "Contiguous quote rows",
    });
    quote.scenarios[0]!.lines[0]!.sku = {
      value: "SKU-1",
      evidence: [],
      confidence: 1,
    };
    quote.scenarios[0]!.lines[0]!.evidence.push({
      sheet: "Quote",
      address: "A1",
      displayed: "sku",
      raw: "sku",
    });
    const mapped = mapParsedQuote(quote);
    expect(mapped.requiresInterpretation).toBe(true);
    expect(mapped.scenarios[0]?.lines[0]?.sourceEvidence).toEqual(
      quote.scenarios[0]?.lines[0]?.evidence,
    );
    expect(mapped.scenarios[0]?.metadata).toMatchObject({
      parserVersion: "test",
    });
    expect(mapped.scenarios[0]?.rationale).toBe("Contiguous quote rows");
    expect(mapped.scenarios[0]?.lines[0]?.rawValue).toBe("SKU-1");
  });

  it("requires interpretation for unresolved quantity candidates", () => {
    const quote = parsed();
    expect(requiresInterpretation(quote)).toBe(false);
    quote.scenarios[0]!.lines[0]!.quantityCandidates = [];
    expect(requiresInterpretation(quote)).toBe(true);
  });
});
