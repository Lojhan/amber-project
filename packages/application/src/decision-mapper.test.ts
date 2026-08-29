import { asBrandId } from "@procurement/domain";
import { describe, expect, it } from "vitest";
import { makeDecision } from "./decision-mapper.js";

describe("makeDecision", () => {
  it("maps persisted application facts into a deterministic decision", () => {
    const result = makeDecision({
      negotiation: {
        id: "negotiation",
        brandId: asBrandId("brand"),
        quotationId: "quotation",
        state: "EVALUATED",
        version: 7,
        currency: "USD",
        policySnapshot: { version: "policy-v1" },
        lines: [
          {
            productId: "product",
            quantity: 10n,
            baselineUnitPriceMinor: 100n,
          },
        ],
      },
      baselineMinor: 1_000n,
      policySnapshot: {
        version: "policy-v1",
        hash: "a".repeat(64),
        weights: {
          cost: "0.4",
          quality: "0.25",
          lead: "0.2",
          payment: "0.15",
        },
      },
      offers: [
        {
          id: "offer-1",
          supplierId: "S1",
          totalMinor: 950n,
          leadTimeDays: 20,
          preShipmentBasisPoints: 3_000,
          capacityPercent: 100,
          fullOrderEligible: true,
        },
      ],
    });

    expect(result).toMatchObject({
      winnerOfferId: "offer-1",
      recommendationStatus: "recommended",
      policyVersion: "policy-v1",
    });
  });
});
