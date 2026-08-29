import { pgEnum } from "drizzle-orm/pg-core";

export const quotationState = pgEnum("quotation_state", [
  "UPLOADED",
  "PARSING",
  "INTERPRETATION_REQUIRED",
  "REVIEW_REQUIRED",
  "READY",
  "REJECTED",
  "PARSE_FAILED",
]);
export const negotiationState = pgEnum("negotiation_state", [
  "DRAFT",
  "ROUND_1_RUNNING",
  "ROUND_1_COMPLETE",
  "CAPACITY_EVENT_APPLIED",
  "ROUND_2_RUNNING",
  "EVALUATED",
  "RECOMMENDED",
  "PO_COMMITTED",
  "FAILED",
]);
