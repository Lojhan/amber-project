import type {
  NegotiationRepository,
  NegotiationStartFacts,
} from "@procurement/application/ports";
import {
  parsedQuoteLines,
  quotationLineQuantities,
  quotations,
  quoteScenarios,
} from "@procurement/db/schema";
import { and, eq } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";
import { loadLatestMatchDecisions } from "./latest-match-decisions.js";
import {
  commercialQuantity,
  commercialUnitPriceMinor,
} from "./negotiation-codecs.js";

export const loadStartFacts = async (
  unitOfWork: DrizzleUnitOfWork,
  transaction: Parameters<NegotiationRepository["loadStartFacts"]>[0],
  brandId: Parameters<NegotiationRepository["loadStartFacts"]>[1],
  quotationId: string,
  scenarioId: string,
): Promise<NegotiationStartFacts | null> => {
  const database = unitOfWork.databaseFor(transaction);
  const header = await database
    .select({ state: quotations.state, note: quotations.note })
    .from(quotations)
    .innerJoin(
      quoteScenarios,
      and(
        eq(quoteScenarios.brandId, quotations.brandId),
        eq(quoteScenarios.quotationId, quotations.id),
      ),
    )
    .where(
      and(
        eq(quotations.brandId, brandId),
        eq(quotations.id, quotationId),
        eq(quoteScenarios.id, scenarioId),
      ),
    )
    .limit(1);
  if (!header[0]) return null;
  const parsed = await database
    .select({
      id: parsedQuoteLines.id,
      candidates: parsedQuoteLines.normalizedCandidates,
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
    .where(
      and(
        eq(parsedQuoteLines.brandId, brandId),
        eq(parsedQuoteLines.scenarioId, scenarioId),
      ),
    );
  const latest = await loadLatestMatchDecisions(
    database,
    brandId,
    parsed.map((line) => line.id),
  );
  let unresolvedMatchCount = 0;
  const lines: NegotiationStartFacts["lines"][number][] = [];
  for (const line of parsed) {
    const decision = latest.get(line.id);
    const quantity =
      line.requestedQuantity ?? commercialQuantity(line.candidates);
    const baselineUnitPriceMinor = commercialUnitPriceMinor(
      line.candidates,
      quantity,
    );
    if (decision?.excluded) continue;
    if (!decision?.selectedProductId || !quantity || !baselineUnitPriceMinor) {
      unresolvedMatchCount += 1;
      continue;
    }
    lines.push({
      productId: decision.selectedProductId,
      quantity,
      baselineUnitPriceMinor,
    });
  }
  return {
    quotationState: header[0].state,
    quotationNote: header[0].note,
    currency: "USD",
    unresolvedMatchCount,
    lines,
  };
};
