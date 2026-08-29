import type { ChallengeResetRepository } from "@procurement/application/ports";
import {
  auditLogs,
  domainEvents,
  matchDecisions,
  negotiations,
  negotiationTurns,
  offerLineFulfillments,
  offerLines,
  offers,
  orderIntentLines,
  orderIntents,
  parsedQuoteLines,
  projectionEvents,
  purchaseOrderCounters,
  purchaseOrderLines,
  purchaseOrders,
  quotationLineQuantities,
  quotationScenarioSelections,
  quotations,
  quoteCopilotMessages,
  quoteScenarios,
  recommendations,
} from "@procurement/db/schema";
import { eq } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";

/** Clears challenge-owned operational state while preserving the seeded catalog. */
export class DrizzleChallengeResetRepository
  implements ChallengeResetRepository
{
  constructor(private readonly unitOfWork: DrizzleUnitOfWork) {}

  async reset(
    transaction: Parameters<ChallengeResetRepository["reset"]>[0],
    brandId: Parameters<ChallengeResetRepository["reset"]>[1],
  ): Promise<readonly string[]> {
    const database = this.unitOfWork.databaseFor(transaction);
    const uploadedObjects = await database
      .select({ objectKey: quotations.objectKey })
      .from(quotations)
      .where(eq(quotations.brandId, brandId));

    await database
      .delete(projectionEvents)
      .where(eq(projectionEvents.brandId, brandId));
    await database
      .delete(domainEvents)
      .where(eq(domainEvents.brandId, brandId));
    await database.delete(auditLogs).where(eq(auditLogs.brandId, brandId));
    await database
      .delete(purchaseOrderLines)
      .where(eq(purchaseOrderLines.brandId, brandId));
    await database
      .delete(purchaseOrders)
      .where(eq(purchaseOrders.brandId, brandId));
    await database
      .delete(recommendations)
      .where(eq(recommendations.brandId, brandId));
    await database
      .delete(offerLineFulfillments)
      .where(eq(offerLineFulfillments.brandId, brandId));
    await database.delete(offerLines).where(eq(offerLines.brandId, brandId));
    await database
      .delete(negotiationTurns)
      .where(eq(negotiationTurns.brandId, brandId));
    await database.delete(offers).where(eq(offers.brandId, brandId));
    await database
      .delete(negotiations)
      .where(eq(negotiations.brandId, brandId));
    await database
      .delete(orderIntentLines)
      .where(eq(orderIntentLines.brandId, brandId));
    await database
      .delete(orderIntents)
      .where(eq(orderIntents.brandId, brandId));
    await database
      .delete(quotationLineQuantities)
      .where(eq(quotationLineQuantities.brandId, brandId));
    await database
      .delete(quoteCopilotMessages)
      .where(eq(quoteCopilotMessages.brandId, brandId));
    await database
      .delete(matchDecisions)
      .where(eq(matchDecisions.brandId, brandId));
    await database
      .delete(quotationScenarioSelections)
      .where(eq(quotationScenarioSelections.brandId, brandId));
    await database
      .delete(parsedQuoteLines)
      .where(eq(parsedQuoteLines.brandId, brandId));
    await database
      .delete(quoteScenarios)
      .where(eq(quoteScenarios.brandId, brandId));
    await database.delete(quotations).where(eq(quotations.brandId, brandId));
    await database
      .delete(purchaseOrderCounters)
      .where(eq(purchaseOrderCounters.brandId, brandId));

    return uploadedObjects.map(({ objectKey }) => objectKey);
  }
}
