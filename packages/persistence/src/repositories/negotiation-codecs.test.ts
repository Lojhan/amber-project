import { describe, expect, it } from "vitest";
import {
  commercialQuantity,
  commercialUnitPriceMinor,
} from "./negotiation-codecs.js";

describe("commercial value decoding", () => {
  it("accepts one positive whole-unit quantity", () => {
    expect(
      commercialQuantity({ quantityCandidates: [{ value: "1200" }] }),
    ).toBe(1200n);
    expect(
      commercialQuantity({ quantityCandidates: [{ value: "1.5" }] }),
    ).toBeNull();
  });

  it.each([
    ["95", 9500n],
    ["19.99", 1999n],
    ["6.2", 620n],
  ])("converts %s dollars to exact minor units", (value, expected) => {
    expect(commercialUnitPriceMinor({ unitPriceCandidates: [{ value }] })).toBe(
      expected,
    );
  });

  it("rejects ambiguous or over-precise prices", () => {
    expect(
      commercialUnitPriceMinor({
        unitPriceCandidates: [{ value: "10" }, { value: "11" }],
      }),
    ).toBeNull();
    expect(
      commercialUnitPriceMinor({ unitPriceCandidates: [{ value: "1.005" }] }),
    ).toBeNull();
  });

  it("selects the best applicable price tier for the reviewed quantity", () => {
    const candidates = {
      tiers: [
        { minimumQuantity: 1000, unitPrice: { value: "25" } },
        { minimumQuantity: 5000, unitPrice: { value: "22" } },
      ],
      unitPriceCandidates: [{ value: "25" }],
    };

    expect(commercialUnitPriceMinor(candidates, 1000n)).toBe(2500n);
    expect(commercialUnitPriceMinor(candidates, 7000n)).toBe(2200n);
    expect(commercialUnitPriceMinor(candidates, 999n)).toBeNull();
  });
});
