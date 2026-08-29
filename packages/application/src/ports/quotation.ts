import type { BrandId, QuotationState } from "@procurement/domain";
import type { TransactionContext } from "../core/transaction-context.js";

export type QuotationRecord = Readonly<{
  id: string;
  brandId: BrandId;
  state: QuotationState;
  version: number;
  objectKey: string;
  contentHash: string;
  catalogVersion: string;
  note: string | null;
}>;

export type NewQuotation = Omit<QuotationRecord, "version"> &
  Readonly<{ idempotencyKey: string }>;

export type QuotationTransition = Readonly<{
  brandId: BrandId;
  id: string;
  expectedVersion: number;
  nextState: QuotationState;
}>;

export interface QuotationRepository {
  findReservation(
    brandId: BrandId,
    idempotencyKey: string,
  ): Promise<QuotationRecord | null>;
  findByContentHash(
    brandId: BrandId,
    contentHash: string,
  ): Promise<QuotationRecord | null>;
  insert(
    transaction: TransactionContext,
    quotation: NewQuotation,
  ): Promise<QuotationRecord>;
  loadForUpdate(
    transaction: TransactionContext,
    brandId: BrandId,
    id: string,
  ): Promise<QuotationRecord | null>;
  transition(
    transaction: TransactionContext,
    transition: QuotationTransition,
  ): Promise<QuotationRecord>;
}
