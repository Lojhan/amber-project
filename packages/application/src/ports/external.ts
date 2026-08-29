import type { ActorId, BrandId } from "@procurement/domain";
import type { JsonValue } from "./json.js";
import type { CatalogProduct } from "./matching.js";
import type {
  CommercialNoteInterpretation,
  ConfirmedNegotiationPolicy,
  NegotiationCommercialLine,
  NegotiationConversationEntry,
  SupplierId,
} from "./negotiation.js";
import type { ParsedQuotation } from "./upload.js";

export interface QuotationObjectStore {
  reserveUpload(
    input: Readonly<{
      brandId: BrandId;
      filename: string;
      contentHash: string;
    }>,
  ): Promise<
    Readonly<{
      key: string;
      url: string;
      headers: Readonly<Record<string, string>>;
    }>
  >;
  verifyUpload(
    input: Readonly<{
      brandId: BrandId;
      key: string;
      contentHash: string;
    }>,
  ): Promise<Readonly<{ size: number; contentType: string }>>;
  read(input: Readonly<{ brandId: BrandId; key: string }>): Promise<Uint8Array>;
  remove(input: Readonly<{ brandId: BrandId; key: string }>): Promise<void>;
}

export interface WorkbookParser {
  preflight(bytes: Uint8Array): Promise<
    Readonly<{
      safe: boolean;
      reason?: string;
    }>
  >;
  parse(bytes: Uint8Array): Promise<ParsedQuotation>;
}

export interface CatalogMatcher {
  match(
    input: Readonly<{
      rawSku: string;
      catalog: readonly CatalogProduct[];
      brandId: BrandId;
      corroboration: Readonly<{
        description?: string;
        color?: string;
        size?: string;
      }>;
    }>,
  ): Readonly<{
    candidates: JsonValue;
    selectedProductId?: string;
  }>;
}

export type SupplierProposalContext = Readonly<{
  brandId: BrandId;
  quotationId: string;
  supplierId: SupplierId;
  round: 1 | 2;
  currency: string;
  lines: readonly NegotiationCommercialLine[];
  brandMessage: string;
  priorConversation: readonly NegotiationConversationEntry[];
  untrustedData?: string;
}>;

export type SupplierProposalResult = Readonly<{
  status: "proposal" | "refused" | "invalid" | "timeout" | "provider_error";
  result: JsonValue;
  metadata: JsonValue;
}>;

export interface SupplierProposalModel {
  propose(context: SupplierProposalContext): Promise<SupplierProposalResult>;
}

export type BrandNegotiationMove = Readonly<{
  message: string;
  objectives: readonly Readonly<{
    dimension: "cost" | "quality" | "lead_time" | "payment_terms" | "capacity";
    target: string;
    rationale: string;
  }>[];
  leverage: readonly string[];
  mustHaves: readonly string[];
  source: "ai" | "fallback";
}>;

export type BrandNegotiationContext = Readonly<{
  brandId: BrandId;
  quotationId: string;
  supplierId: SupplierId;
  round: 1 | 2;
  currency: string;
  lines: readonly NegotiationCommercialLine[];
  policySnapshot: JsonValue;
  priorConversation: readonly NegotiationConversationEntry[];
  capacityChange?: Readonly<{
    supplierId: "S2";
    capacityPercent: 60;
  }>;
}>;

export type BrandNegotiationResult = Readonly<{
  move: BrandNegotiationMove;
  metadata: JsonValue;
}>;

export interface BrandNegotiationModel {
  plan(context: BrandNegotiationContext): Promise<BrandNegotiationResult>;
}

export interface CommercialNoteInterpreter {
  interpret(note: string | null): Promise<CommercialNoteInterpretation>;
}

export interface ConfirmationTokenService {
  issue(
    claims: Readonly<{
      digest: string;
      negotiationId: string;
      offerId: string;
      brandId: BrandId;
      actorId: ActorId;
    }>,
    now: Date,
  ): string;
  verify(
    token: string,
    claims: Readonly<{
      digest: string;
      negotiationId: string;
      offerId: string;
      brandId: BrandId;
      actorId: ActorId;
    }>,
    now: Date,
  ): boolean;

  issuePolicy(
    claims: Readonly<{
      quotationId: string;
      scenarioId: string;
      policy: ConfirmedNegotiationPolicy;
      brandId: BrandId;
      actorId: ActorId;
    }>,
    now: Date,
  ): string;

  verifyPolicy(
    token: string,
    expected: Readonly<{
      quotationId: string;
      scenarioId: string;
      policyHash: string;
      brandId: BrandId;
      actorId: ActorId;
    }>,
    now: Date,
  ): ConfirmedNegotiationPolicy | null;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface HashingService {
  sha256(value: string | Uint8Array): string;
}
