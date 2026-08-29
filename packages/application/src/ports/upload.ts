import type { BrandId } from "@procurement/domain";
import type { TransactionContext } from "../core/transaction-context.js";
import type { JsonValue } from "./json.js";

export type QuotationJob = Readonly<{
  brandId: BrandId;
  quotationId: string;
  objectKey: string;
  correlationId: string;
}>;

export type ParseTarget = Readonly<{
  state: string;
  objectKey: string;
  contentHash: string;
  scenarioCount: number;
}>;

export type ParsedQuotation = Readonly<{
  /** True when structural alternatives or ambiguous field roles need human interpretation. */
  requiresInterpretation: boolean;
  scenarios: readonly Readonly<{
    sourceSheet: string;
    rationale: string;
    metadata: JsonValue;
    lines: readonly Readonly<{
      sourceEvidence: JsonValue;
      normalizedCandidates: JsonValue;
      rawValue: string | null;
    }>[];
  }>[];
}>;

export interface UploadRepository {
  loadParseTarget(job: QuotationJob): Promise<ParseTarget | null>;
  finishPreflight(
    transaction: TransactionContext,
    job: QuotationJob,
    safe: boolean,
    reason?: string,
  ): Promise<void>;
  persistParsedQuotation(
    transaction: TransactionContext,
    job: QuotationJob,
    quotation: ParsedQuotation,
  ): Promise<void>;
  markParseFailed(
    transaction: TransactionContext,
    job: QuotationJob,
    reason: string,
  ): Promise<void>;
  finishParse(
    transaction: TransactionContext,
    job: QuotationJob,
    nextState: "INTERPRETATION_REQUIRED" | "REVIEW_REQUIRED",
  ): Promise<void>;
}

export type WorkerFailure = Readonly<{
  jobId: string;
  queue: string;
  correlationId: string;
  code: string;
  message: string;
}>;

export interface WorkerExecutionRepository {
  claim(
    transaction: TransactionContext,
    idempotencyKey: string,
  ): Promise<boolean>;
  recordFailure(
    transaction: TransactionContext,
    failure: WorkerFailure,
  ): Promise<void>;
}
