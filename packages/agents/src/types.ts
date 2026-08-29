import type { OfferProposal } from "@procurement/contracts";
import type { CurrencyCode } from "@procurement/domain";

export type SupplierId = "S1" | "S2" | "S3";
export type NegotiationRound = 1 | 2;
export type NegotiationLine = Readonly<{
  productId: string;
  quantity: string;
  baselineUnitPriceMinor: string;
}>;
export type NegotiationContext = Readonly<{
  round: NegotiationRound;
  currency: CurrencyCode;
  lines: readonly NegotiationLine[];
  quotationId: string;
  brandId: string;
  brandMessage?: string;
  priorConversation?: readonly Readonly<{
    supplierId: SupplierId;
    round: NegotiationRound;
    brandMessage?: string;
    supplierMessage?: string;
    commercialTerms?: Readonly<{
      totalMinor?: string;
      leadTimeDays?: number;
      capacityPercent?: number;
      preShipmentBasisPoints?: number;
    }>;
  }>[];
  untrustedData?: string;
}>;
export type RequestMetadata = Readonly<{
  requestId: string | null;
  requestIds: readonly string[];
  attemptCount: number;
  validationFailures: readonly string[];
  modelId: string;
  reasoningEffort: "medium" | "none";
  promptVersion: string;
  promptHash: string;
  schemaVersion: string;
  schemaHash: string;
  policyVersion: string;
  policyHash: string;
  contextVersion: string;
  contextHash: string;
  latencyMs: number;
  tokenUsage: Readonly<{
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  }>;
}>;
export type ModelResult =
  | Readonly<{
      status: "proposal";
      proposal: OfferProposal;
      metadata: RequestMetadata;
    }>
  | Readonly<{
      status: "refused" | "invalid" | "timeout" | "provider_error";
      reason: string;
      metadata: RequestMetadata;
    }>;
export interface NegotiationModel {
  propose(
    supplier: SupplierId,
    context: NegotiationContext,
  ): Promise<ModelResult>;
}
export type ParsedResponse = Readonly<{
  id?: string;
  status?: string;
  output_parsed?: unknown;
  usage?: unknown;
}>;
export interface ResponsesClient {
  readonly responses: {
    parse(
      request: unknown,
      options?: Readonly<{ signal?: AbortSignal }>,
    ): Promise<ParsedResponse>;
  };
}
