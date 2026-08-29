import type { BrandId, PaymentInstallment } from "@procurement/domain";
import type { JsonValue } from "./json.js";

export type QuotationView = Readonly<{
  id: string;
  status: string;
  currency?: string;
  selectedScenarioId?: string;
  negotiationId?: string;
  scenarios: readonly Readonly<{
    id: string;
    label: string;
    evidence?: string;
  }>[];
  matches: readonly Readonly<{
    id: string;
    lineId: string;
    scenarioId: string;
    label: string;
    matchReady: boolean;
    status?: string;
    selectedProductId?: string;
    requestedQuantity?: string;
    minimumOrderQuantity?: string;
    unitPriceMinor?: string;
    extendedTotalMinor?: string;
    sourceReference?: string;
    reviewReasons: readonly (
      | "missing_requested_quantity"
      | "no_price_for_requested_quantity"
      | "missing_unit_price"
      | "ambiguous_commercial_fields"
    )[];
    candidates: readonly Readonly<{
      productId: string;
      sku: string;
      name?: string;
      score: number;
    }>[];
  }>[];
}>;

export interface QuotationReadModel {
  get(brandId: BrandId, quotationId: string): Promise<QuotationView | null>;
}

export type NegotiationView = Readonly<{
  id: string;
  status: string;
  timeline: readonly Readonly<{
    actor: "brand" | "supplier" | "system";
    supplierId?: string;
    round?: number;
    status?: string;
    detail?: string;
  }>[];
  reducedCompetition: boolean;
  offers: readonly Readonly<{
    id: string;
    supplierId: string;
    round: number;
    leadTimeDays: number;
    capacityPercent: number;
    fullOrderEligible: boolean;
  }>[];
}>;

export interface NegotiationReadModel {
  get(brandId: BrandId, negotiationId: string): Promise<NegotiationView | null>;
}

export interface NegotiationPolicyReadModel {
  quotationNote(
    brandId: BrandId,
    quotationId: string,
    scenarioId: string,
  ): Promise<string | null | undefined>;
}

export type DecisionView = Readonly<{
  id: string;
  negotiationId: string;
  winnerOfferId: string | null;
  decisionRecord: JsonValue;
}>;

export interface DecisionReadModel {
  get(brandId: BrandId, negotiationId: string): Promise<DecisionView | null>;
}

export type PurchaseOrderSummary = Readonly<{
  id: string;
  number: string;
  negotiationId: string;
  supplierId: string;
  totalMinor: string;
  currency: string;
  issuedAt: string;
  status: "ISSUED";
}>;

export type PurchaseOrderDetail = PurchaseOrderSummary &
  Readonly<{
    supplierId: string;
    leadTimeDays: number;
    paymentSchedule: readonly PaymentInstallment[];
    issuedBy: string;
    lines: readonly Readonly<{
      sku: string;
      name: string | null;
      quantity: string;
      unitPriceMinor: string;
      extendedTotalMinor: string;
    }>[];
    audit: readonly Readonly<{
      type: string;
      actorId: string;
      at: string;
    }>[];
  }>;

export interface PurchaseOrderReadModel {
  list(brandId: BrandId): Promise<readonly PurchaseOrderSummary[]>;
  get(brandId: BrandId, id: string): Promise<PurchaseOrderDetail | null>;
}

export type ProjectionEvent = Readonly<{
  id: string;
  aggregateId: string;
  type: string;
  version: number;
  payload: JsonValue;
}>;

export interface ProjectionEventReadModel {
  since(
    brandId: BrandId,
    lastEventId?: string,
  ): Promise<readonly ProjectionEvent[]>;
}
