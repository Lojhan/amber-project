import type { CommercialReviewRepository } from "@procurement/application/ports";
import {
  parsedQuoteLines,
  quotationLineQuantities,
  quoteScenarios,
} from "@procurement/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";
import { loadLatestMatchDecisions } from "./latest-match-decisions.js";
import { commercialReviewReasons } from "./negotiation-codecs.js";

export class DrizzleCommercialReviewRepository
  implements CommercialReviewRepository
{
  constructor(private readonly unitOfWork: DrizzleUnitOfWork) {}

  async hasBlockers(
    transaction: Parameters<CommercialReviewRepository["hasBlockers"]>[0],
    brandId: Parameters<CommercialReviewRepository["hasBlockers"]>[1],
    scenarioId: string,
  ): Promise<boolean> {
    const database = this.unitOfWork.databaseFor(transaction);
    const lines = await database
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
    const decisions = await loadLatestMatchDecisions(
      database,
      brandId,
      lines.map((line) => line.id),
    );

    return lines.some(
      (line) =>
        !decisions.get(line.id)?.excluded &&
        commercialReviewReasons(line.candidates, line.requestedQuantity)
          .length > 0,
    );
  }

  async resolveQuantities(
    transaction: Parameters<CommercialReviewRepository["resolveQuantities"]>[0],
    input: Parameters<CommercialReviewRepository["resolveQuantities"]>[1],
  ): Promise<boolean> {
    const database = this.unitOfWork.databaseFor(transaction);
    const lineIds = input.lines.map((line) => line.parsedLineId);
    const existing = await database
      .select({ id: parsedQuoteLines.id })
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
          eq(parsedQuoteLines.brandId, input.brandId),
          eq(parsedQuoteLines.scenarioId, input.scenarioId),
          eq(quoteScenarios.quotationId, input.quotationId),
          inArray(parsedQuoteLines.id, lineIds),
        ),
      );
    if (existing.length !== lineIds.length) return false;

    await database
      .insert(quotationLineQuantities)
      .values(
        input.lines.map((line) => ({
          brandId: input.brandId,
          parsedLineId: line.parsedLineId,
          requestedQuantity: line.requestedQuantity,
          actorId: input.actorId,
        })),
      )
      .onConflictDoUpdate({
        target: [
          quotationLineQuantities.brandId,
          quotationLineQuantities.parsedLineId,
        ],
        set: {
          requestedQuantity: sql`excluded.requested_quantity`,
          actorId: sql`excluded.actor_id`,
          resolvedAt: sql`now()`,
        },
      });

    return true;
  }
}
