import type {
  BrandId,
  NegotiationState,
  QuotationState,
} from "@procurement/domain";
import type { TransactionContext } from "../core/transaction-context.js";
import type { JsonValue } from "./json.js";

export type SupplierId = "S1" | "S2" | "S3";

export type CommercialPriority =
  | "cost"
  | "quality"
  | "lead_time"
  | "payment_terms";

export type CommercialNoteInterpretation = Readonly<{
  primaryPriority: CommercialPriority | null;
  hardMaxLeadDays: number | null;
  summary: string;
  warnings: readonly string[];
  source: "ai" | "default";
}>;

export type ConfirmedNegotiationPolicy = Readonly<{
  version: string;
  hash: string;
  weights: Readonly<{
    cost: string;
    quality: string;
    lead: string;
    payment: string;
  }>;
  hardMaxLead?: number;
  interpretation: CommercialNoteInterpretation;
}>;

export type NegotiationCommercialLine = Readonly<{
  productId: string;
  quantity: bigint;
  baselineUnitPriceMinor: bigint;
}>;

export type NegotiationStartFacts = Readonly<{
  quotationState: QuotationState;
  quotationNote: string | null;
  currency: string;
  unresolvedMatchCount: number;
  lines: readonly NegotiationCommercialLine[];
}>;

export type NewOrderIntent = Readonly<{
  id: string;
  brandId: BrandId;
  quotationId: string;
  scenarioId: string;
  currency: string;
  lines: readonly NegotiationCommercialLine[];
}>;

export type NewNegotiation = Readonly<{
  id: string;
  brandId: BrandId;
  quotationId: string;
  orderIntentId: string;
  state: NegotiationState;
  policyVersion: string;
  policySnapshot: JsonValue;
  modelSnapshot: JsonValue;
  version: number;
}>;

export type NegotiationRun = Readonly<{
  id: string;
  brandId: BrandId;
  quotationId: string;
  state: NegotiationState;
  version: number;
  currency: string;
  policySnapshot: JsonValue;
  lines: readonly NegotiationCommercialLine[];
}>;

export type NegotiationTurn = Readonly<{
  key: string;
  supplierId: SupplierId;
  round: 1 | 2;
  status: string;
  result: JsonValue;
  providerMetadata: JsonValue;
}>;

export type NegotiationConversationEntry = Readonly<{
  supplierId: SupplierId;
  round: 1 | 2;
  brandMessage?: string;
  supplierMessage?: string;
  commercialTerms?: Readonly<{
    totalMinor?: string;
    leadTimeDays?: number;
    capacityPercent?: number;
    preShipmentBasisPoints?: number;
  }>;
}>;

export type NegotiationCapacityEvent = Readonly<{
  supplierId: "S2";
  fromPercent: 100;
  toPercent: 60;
}>;

export type NegotiationTransition = Readonly<{
  brandId: BrandId;
  id: string;
  expectedState: NegotiationState;
  expectedVersion: number;
  nextState: NegotiationState;
}>;

export type DecisionInputs = Readonly<{
  negotiation: NegotiationRun;
  baselineMinor: bigint;
  policySnapshot: JsonValue;
  offers: readonly Readonly<{
    id: string;
    supplierId: SupplierId;
    totalMinor: bigint;
    leadTimeDays: number;
    preShipmentBasisPoints: number;
    capacityPercent: number;
    fullOrderEligible: boolean;
  }>[];
}>;

export interface NegotiationRepository {
  loadStartFacts(
    transaction: TransactionContext,
    brandId: BrandId,
    quotationId: string,
    scenarioId: string,
  ): Promise<NegotiationStartFacts | null>;
  createOrderIntent(
    transaction: TransactionContext,
    intent: NewOrderIntent,
  ): Promise<void>;
  create(
    transaction: TransactionContext,
    negotiation: NewNegotiation,
  ): Promise<void>;
  loadRun(
    transaction: TransactionContext,
    brandId: BrandId,
    negotiationId: string,
  ): Promise<NegotiationRun | null>;
  listTurns(
    transaction: TransactionContext,
    brandId: BrandId,
    negotiationId: string,
  ): Promise<readonly NegotiationTurn[]>;
  appendTurn(
    transaction: TransactionContext,
    brandId: BrandId,
    negotiationId: string,
    turn: NegotiationTurn,
  ): Promise<boolean>;
  applyCapacityEvent(
    transaction: TransactionContext,
    brandId: BrandId,
    negotiationId: string,
    event: NegotiationCapacityEvent,
  ): Promise<boolean>;
  transition(
    transaction: TransactionContext,
    transition: NegotiationTransition,
  ): Promise<boolean>;
  loadDecisionInputs(
    transaction: TransactionContext,
    brandId: BrandId,
    negotiationId: string,
  ): Promise<DecisionInputs | null>;
  saveRecommendation(
    transaction: TransactionContext,
    brandId: BrandId,
    negotiationId: string,
    recommendation: JsonValue,
    winnerOfferId: string | null,
    policyVersion: string,
  ): Promise<void>;
}
