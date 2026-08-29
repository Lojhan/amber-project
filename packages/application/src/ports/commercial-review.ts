import type { ActorId, BrandId } from "@procurement/domain";
import type { TransactionContext } from "../core/transaction-context.js";

export type RequestedQuantityResolution = Readonly<{
  parsedLineId: string;
  requestedQuantity: bigint;
}>;

export interface CommercialReviewRepository {
  hasBlockers(
    transaction: TransactionContext,
    brandId: BrandId,
    scenarioId: string,
  ): Promise<boolean>;
  resolveQuantities(
    transaction: TransactionContext,
    input: Readonly<{
      brandId: BrandId;
      quotationId: string;
      scenarioId: string;
      actorId: ActorId;
      lines: readonly RequestedQuantityResolution[];
    }>,
  ): Promise<boolean>;
}
