import type { ActorId, BrandId, Offer, OrderIntent } from "@procurement/domain";
import type { TransactionContext } from "../core/transaction-context.js";

export type PurchaseOrderSnapshot = Readonly<{
  brandId: BrandId;
  negotiationId: string;
  recommendationId: string;
  selectedOffer: Offer;
  orderIntent: OrderIntent;
  catalogVersion: string;
  decisionVersion: string;
  eligible: boolean;
  negotiationState: string;
}>;

export type PurchaseOrderRecord = Readonly<{
  id: string;
  brandId: BrandId;
  number: string;
  actorId: ActorId;
  idempotencyKey: string;
  requestDigest: string;
  previewDigest: string;
  totalMinor: bigint;
  snapshot: PurchaseOrderSnapshot;
}>;

export interface PurchaseOrderRepository {
  loadIssuableSnapshot(
    transaction: TransactionContext,
    brandId: BrandId,
    negotiationId: string,
  ): Promise<PurchaseOrderSnapshot | null>;
  findByIdempotency(
    transaction: TransactionContext,
    brandId: BrandId,
    idempotencyKey: string,
  ): Promise<PurchaseOrderRecord | null>;
  nextNumber(
    transaction: TransactionContext,
    brandId: BrandId,
  ): Promise<string>;
  insert(
    transaction: TransactionContext,
    record: PurchaseOrderRecord,
  ): Promise<boolean>;
  markNegotiationCommitted(
    transaction: TransactionContext,
    brandId: BrandId,
    negotiationId: string,
    expectedState: "RECOMMENDED",
  ): Promise<void>;
}
