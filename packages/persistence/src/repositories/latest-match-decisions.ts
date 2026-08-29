import type { DatabaseTransaction } from "@procurement/db";
import { matchDecisions } from "@procurement/db/schema";
import type { BrandId } from "@procurement/domain";
import { and, desc, eq, inArray } from "drizzle-orm";

export type LatestMatchDecision = Readonly<{
  selectedProductId: string | null;
  excluded: boolean;
}>;

export const loadLatestMatchDecisions = async (
  database: DatabaseTransaction,
  brandId: BrandId,
  lineIds: readonly string[],
): Promise<ReadonlyMap<string, LatestMatchDecision>> => {
  if (lineIds.length === 0) return new Map();

  const decisions = await database
    .select({
      parsedLineId: matchDecisions.parsedLineId,
      selectedProductId: matchDecisions.selectedProductId,
      excluded: matchDecisions.excluded,
    })
    .from(matchDecisions)
    .where(
      and(
        eq(matchDecisions.brandId, brandId),
        inArray(matchDecisions.parsedLineId, lineIds),
      ),
    )
    .orderBy(desc(matchDecisions.createdAt), desc(matchDecisions.id));
  const latest = new Map<string, LatestMatchDecision>();

  for (const decision of decisions)
    if (!latest.has(decision.parsedLineId))
      latest.set(decision.parsedLineId, decision);

  return latest;
};
