import type { DatabaseTransaction } from "@procurement/db";
import { parsedQuoteLines, quoteScenarios } from "@procurement/db/schema";
import type { BrandId } from "@procurement/domain";
import { and, eq } from "drizzle-orm";
import { loadLatestMatchDecisions } from "./latest-match-decisions.js";

export const loadMatchResolutionSummary = async (
  database: DatabaseTransaction,
  brandId: BrandId,
  quotationId: string,
  scenarioId: string,
): Promise<{ unresolved: number; included: number }> => {
  const lines = await database
    .select({
      id: parsedQuoteLines.id,
    })
    .from(parsedQuoteLines)
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
        eq(quoteScenarios.id, scenarioId),
      ),
    );
  if (lines.length === 0) return { unresolved: 0, included: 0 };

  const latestByLine = await loadLatestMatchDecisions(
    database,
    brandId,
    lines.map((line) => line.id),
  );

  let unresolved = 0;
  let included = 0;

  for (const line of lines) {
    const latest = latestByLine.get(line.id);

    if (!latest || (!latest.excluded && latest.selectedProductId === null))
      unresolved += 1;
    else if (!latest.excluded && latest.selectedProductId !== null)
      included += 1;
  }

  return { unresolved, included };
};
