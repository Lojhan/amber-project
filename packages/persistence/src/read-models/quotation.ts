import type { QuotationReadModel } from "@procurement/application/ports";
import type { Database } from "@procurement/db/client";
import {
  matchDecisions,
  negotiations,
  parsedQuoteLines,
  quotationLineQuantities,
  quotationScenarioSelections,
  quotations,
  quoteScenarios,
} from "@procurement/db/schema";
import type { BrandId } from "@procurement/domain";
import { and, desc, eq } from "drizzle-orm";
import {
  commercialQuantity,
  commercialReviewReasons,
  commercialUnitPriceMinor,
  minimumOrderQuantity,
} from "../repositories/negotiation-codecs.js";
import { matchCandidates } from "./match-candidates.js";

const scenariosFor = (db: Database, brandId: BrandId, quotationId: string) =>
  db
    .select({
      id: quoteScenarios.id,
      label: quoteScenarios.sourceSheet,
      evidence: quoteScenarios.rationale,
    })
    .from(quoteScenarios)
    .where(
      and(
        eq(quoteScenarios.brandId, brandId),
        eq(quoteScenarios.quotationId, quotationId),
      ),
    )
    .orderBy(quoteScenarios.id);

const linesFor = (db: Database, brandId: BrandId, quotationId: string) =>
  db
    .selectDistinctOn([parsedQuoteLines.id], {
      line: parsedQuoteLines,
      decision: matchDecisions,
      requestedQuantity: quotationLineQuantities.requestedQuantity,
    })
    .from(parsedQuoteLines)
    .leftJoin(
      quotationLineQuantities,
      and(
        eq(quotationLineQuantities.brandId, parsedQuoteLines.brandId),
        eq(quotationLineQuantities.parsedLineId, parsedQuoteLines.id),
      ),
    )
    .leftJoin(
      matchDecisions,
      and(
        eq(matchDecisions.brandId, parsedQuoteLines.brandId),
        eq(matchDecisions.parsedLineId, parsedQuoteLines.id),
      ),
    )
    .innerJoin(
      quoteScenarios,
      and(
        eq(quoteScenarios.brandId, parsedQuoteLines.brandId),
        eq(quoteScenarios.id, parsedQuoteLines.scenarioId),
      ),
    )
    .where(
      and(
        eq(parsedQuoteLines.brandId, brandId),
        eq(quoteScenarios.quotationId, quotationId),
      ),
    )
    .orderBy(
      parsedQuoteLines.id,
      desc(matchDecisions.createdAt),
      desc(matchDecisions.id),
    );

const selectedScenarioFor = (
  db: Database,
  brandId: BrandId,
  quotationId: string,
) =>
  db
    .select({ scenarioId: quotationScenarioSelections.scenarioId })
    .from(quotationScenarioSelections)
    .where(
      and(
        eq(quotationScenarioSelections.brandId, brandId),
        eq(quotationScenarioSelections.quotationId, quotationId),
      ),
    )
    .limit(1);

const negotiationFor = (db: Database, brandId: BrandId, quotationId: string) =>
  db
    .select({ id: negotiations.id })
    .from(negotiations)
    .where(
      and(
        eq(negotiations.brandId, brandId),
        eq(negotiations.quotationId, quotationId),
      ),
    )
    .limit(1);

const sourceReference = (sheet: string, evidence: unknown): string => {
  if (Array.isArray(evidence)) {
    const addresses = evidence.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const address = (item as Record<string, unknown>).address;
      return typeof address === "string" ? [address] : [];
    });

    return addresses.length ? `${sheet} · ${addresses.join(", ")}` : sheet;
  }
  if (!evidence || typeof evidence !== "object") return sheet;

  const row = (evidence as Record<string, unknown>).row;
  return typeof row === "number" || typeof row === "string"
    ? `${sheet} · row ${row}`
    : sheet;
};

type LineRow = Awaited<ReturnType<typeof linesFor>>[number];
type ScenarioRow = Awaited<ReturnType<typeof scenariosFor>>[number];

const quotationLine = (
  { line, decision, requestedQuantity }: LineRow,
  scenarios: readonly ScenarioRow[],
) => {
  const quantity =
    requestedQuantity ?? commercialQuantity(line.normalizedCandidates);
  const minimum = minimumOrderQuantity(line.normalizedCandidates);
  const unitPrice = commercialUnitPriceMinor(
    line.normalizedCandidates,
    quantity,
  );
  const scenario = scenarios.find(({ id }) => id === line.scenarioId);

  return {
    id: decision?.id ?? line.id,
    lineId: line.id,
    scenarioId: line.scenarioId,
    label: typeof line.rawValue === "string" ? line.rawValue : line.id,
    matchReady: Boolean(decision),
    status: decision?.excluded
      ? "EXCLUDED"
      : decision?.selectedProductId
        ? "RESOLVED"
        : "PENDING",
    ...(decision?.selectedProductId
      ? { selectedProductId: decision.selectedProductId }
      : {}),
    ...(quantity ? { requestedQuantity: quantity.toString() } : {}),
    ...(minimum ? { minimumOrderQuantity: minimum.toString() } : {}),
    ...(unitPrice ? { unitPriceMinor: unitPrice.toString() } : {}),
    ...(unitPrice && quantity
      ? { extendedTotalMinor: (unitPrice * quantity).toString() }
      : {}),
    sourceReference: sourceReference(
      scenario?.label ?? "Workbook",
      line.sourceEvidence,
    ),
    reviewReasons: commercialReviewReasons(
      line.normalizedCandidates,
      requestedQuantity,
    ),
    candidates: matchCandidates(decision?.candidates),
  };
};

export class DrizzleQuotationReadModel implements QuotationReadModel {
  constructor(private readonly db: Database) {}

  async get(brandId: BrandId, quotationId: string) {
    const q = (
      await this.db
        .select({ id: quotations.id, status: quotations.state })
        .from(quotations)
        .where(
          and(eq(quotations.brandId, brandId), eq(quotations.id, quotationId)),
        )
        .limit(1)
    )[0];
    if (!q) return null;
    const [scenarios, lines, selection, negotiation] = await Promise.all([
      scenariosFor(this.db, brandId, quotationId),
      linesFor(this.db, brandId, quotationId),
      selectedScenarioFor(this.db, brandId, quotationId),
      negotiationFor(this.db, brandId, quotationId),
    ]);

    return {
      ...q,
      currency: "USD",
      ...(selection[0] ? { selectedScenarioId: selection[0].scenarioId } : {}),
      ...(negotiation[0] ? { negotiationId: negotiation[0].id } : {}),
      scenarios,
      matches: lines.map((line) => quotationLine(line, scenarios)),
    };
  }
}
