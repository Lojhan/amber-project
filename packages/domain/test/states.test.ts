import { describe, expect, it } from "vitest";
import {
  assertNegotiationTransition,
  assertQuotationTransition,
} from "../src/index.js";

describe("state machines", () => {
  it.each([
    ["UPLOADED", "PARSING"],
    ["PARSING", "INTERPRETATION_REQUIRED"],
    ["PARSING", "REVIEW_REQUIRED"],
    ["PARSING", "READY"],
    ["PARSING", "PARSE_FAILED"],
    ["INTERPRETATION_REQUIRED", "REVIEW_REQUIRED"],
    ["INTERPRETATION_REQUIRED", "READY"],
    ["REVIEW_REQUIRED", "INTERPRETATION_REQUIRED"],
    ["REVIEW_REQUIRED", "READY"],
  ] as const)("permits quotation %s -> %s", (from, to) =>
    expect(() => assertQuotationTransition(from, to)).not.toThrow(),
  );
  it.each([
    ["DRAFT", "ROUND_1_RUNNING"],
    ["DRAFT", "FAILED"],
    ["ROUND_1_RUNNING", "ROUND_1_COMPLETE"],
    ["ROUND_1_COMPLETE", "CAPACITY_EVENT_APPLIED"],
    ["CAPACITY_EVENT_APPLIED", "ROUND_2_RUNNING"],
    ["ROUND_2_RUNNING", "EVALUATED"],
    ["EVALUATED", "RECOMMENDED"],
    ["RECOMMENDED", "PO_COMMITTED"],
  ] as const)("permits negotiation %s -> %s", (from, to) =>
    expect(() => assertNegotiationTransition(from, to)).not.toThrow(),
  );
  it.each([
    ["READY", "PARSING"],
    ["ROUND_1_COMPLETE", "ROUND_2_RUNNING"],
  ] as const)("rejects illegal transition %s -> %s", (from, to) => {
    const assertion =
      from === "READY"
        ? () => assertQuotationTransition(from, to as "PARSING")
        : () => assertNegotiationTransition(from, to as "ROUND_2_RUNNING");
    expect(assertion).toThrow("Cannot transition");
  });
});
