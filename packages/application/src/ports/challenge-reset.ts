import type { BrandId } from "@procurement/domain";
import type { TransactionContext } from "../core/transaction-context.js";

export interface ChallengeResetRepository {
  reset(
    transaction: TransactionContext,
    brandId: BrandId,
  ): Promise<readonly string[]>;
}
