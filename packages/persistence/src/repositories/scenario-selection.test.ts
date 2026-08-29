import { describe, expect, it } from "vitest";
import { commercialReviewReasons } from "./negotiation-codecs.js";

const candidates = (overrides: Record<string, unknown> = {}) => ({
  quantityCandidates: [{ value: "10" }],
  unitPriceCandidates: [{ value: "25" }],
  fieldRoleStatus: "resolved",
  ...overrides,
});

describe("scenario interpretation review", () => {
  it("accepts exactly one quantity and unit-price candidate", () => {
    expect(commercialReviewReasons(candidates())).toEqual([]);
  });

  it("accepts a buyer-provided quantity when the workbook omitted it", () => {
    expect(
      commercialReviewReasons(candidates({ quantityCandidates: [] }), 1000n),
    ).toEqual([]);
  });

  it.each([
    ["missing quantity", { quantityCandidates: [] }],
    ["multiple quantities", { quantityCandidates: [{}, {}] }],
    ["missing unit price", { unitPriceCandidates: [] }],
    ["ambiguous field roles", { fieldRoleStatus: "ambiguous" }],
    ["malformed candidates", { quantityCandidates: null }],
  ])("blocks %s", (_label, overrides) => {
    expect(commercialReviewReasons(candidates(overrides))).not.toEqual([]);
  });
});
