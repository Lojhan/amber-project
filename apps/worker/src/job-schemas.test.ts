import { describe, expect, it } from "vitest";
import { parseJobData, parsePersistedJob } from "./job-schemas.js";

const quotation = {
  quotationId: "q",
  brandId: "b",
  objectKey: "b/q.xlsx",
  correlationId: "c",
};
const negotiation = {
  negotiationId: "n",
  brandId: "b",
  supplierId: "S1",
  round: 1,
  expectedVersion: 1,
  correlationId: "c",
};

describe("queue job schemas", () => {
  it("accepts valid quotation, negotiation, and decision jobs", () => {
    expect(parseJobData("preflight-quotation", quotation)).toEqual(quotation);
    expect(parseJobData("negotiation-turn", negotiation)).toEqual(negotiation);
    expect(
      parseJobData("decision-continuation", {
        negotiationId: "n",
        brandId: "b",
        expectedVersion: 1,
        correlationId: "c",
      }),
    ).toBeTruthy();
  });

  it.each([
    ["unknown quotation field", { ...quotation, extra: true }],
    ["missing object key", { ...quotation, objectKey: undefined }],
  ])("rejects %s", (_label, value) => {
    expect(() => parseJobData("preflight-quotation", value)).toThrow();
  });

  it("rejects an invalid negotiation round and negative version", () => {
    expect(() =>
      parseJobData("negotiation-turn", { ...negotiation, round: 3 }),
    ).toThrow();
    expect(() =>
      parseJobData("negotiation-turn", { ...negotiation, expectedVersion: -1 }),
    ).toThrow();
  });

  it("unwraps the pg-boss envelope and requires matching correlation ids", () => {
    expect(
      parsePersistedJob("preflight-quotation", {
        payload: quotation,
        correlationId: "c",
      }),
    ).toEqual(quotation);
    expect(() =>
      parsePersistedJob("preflight-quotation", {
        payload: quotation,
        correlationId: "different",
      }),
    ).toThrow("correlation id");
  });
});
