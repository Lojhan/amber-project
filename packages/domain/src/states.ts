import { DomainInvariantError } from "./errors.js";
export type QuotationState =
  | "UPLOADED"
  | "PARSING"
  | "INTERPRETATION_REQUIRED"
  | "REVIEW_REQUIRED"
  | "READY"
  | "REJECTED"
  | "PARSE_FAILED";
export type NegotiationState =
  | "DRAFT"
  | "ROUND_1_RUNNING"
  | "ROUND_1_COMPLETE"
  | "CAPACITY_EVENT_APPLIED"
  | "ROUND_2_RUNNING"
  | "EVALUATED"
  | "RECOMMENDED"
  | "PO_COMMITTED"
  | "FAILED";
const quotationTransitions: Readonly<
  Record<QuotationState, readonly QuotationState[]>
> = {
  UPLOADED: ["PARSING"],
  PARSING: [
    "INTERPRETATION_REQUIRED",
    "REVIEW_REQUIRED",
    "READY",
    "PARSE_FAILED",
  ],
  INTERPRETATION_REQUIRED: ["REVIEW_REQUIRED", "READY"],
  REVIEW_REQUIRED: ["INTERPRETATION_REQUIRED", "READY"],
  READY: [],
  REJECTED: [],
  PARSE_FAILED: [],
};
const negotiationTransitions: Readonly<
  Record<NegotiationState, readonly NegotiationState[]>
> = {
  DRAFT: ["ROUND_1_RUNNING", "FAILED"],
  ROUND_1_RUNNING: ["ROUND_1_COMPLETE", "FAILED"],
  ROUND_1_COMPLETE: ["CAPACITY_EVENT_APPLIED", "FAILED"],
  CAPACITY_EVENT_APPLIED: ["ROUND_2_RUNNING", "FAILED"],
  ROUND_2_RUNNING: ["EVALUATED", "FAILED"],
  EVALUATED: ["RECOMMENDED"],
  RECOMMENDED: ["PO_COMMITTED"],
  PO_COMMITTED: [],
  FAILED: [],
};
export const assertTransition = <T extends string>(
  map: Readonly<Record<T, readonly T[]>>,
  from: T,
  to: T,
): void => {
  if (!map[from].includes(to))
    throw new DomainInvariantError(
      "illegal-transition",
      `Cannot transition from ${from} to ${to}`,
    );
};

export const assertQuotationTransition = (
  from: QuotationState,
  to: QuotationState,
): void => assertTransition(quotationTransitions, from, to);

export const assertNegotiationTransition = (
  from: NegotiationState,
  to: NegotiationState,
): void => assertTransition(negotiationTransitions, from, to);
