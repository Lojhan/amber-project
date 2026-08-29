import type { BrandNegotiationContext } from "@procurement/application/ports";
import { asBrandId } from "@procurement/domain";
import { describe, expect, it } from "vitest";
import {
  commercialBaselineEvidence,
  conversationEvidence,
} from "./brand-negotiation-evidence.js";

const context: BrandNegotiationContext = {
  brandId: asBrandId("00000000-0000-4000-8000-000000000001"),
  quotationId: "00000000-0000-4000-8000-000000000002",
  supplierId: "S2",
  round: 2,
  currency: "USD",
  lines: [
    {
      productId: "00000000-0000-4000-8000-000000000003",
      quantity: 5_000n,
      baselineUnitPriceMinor: 80_139n,
    },
  ],
  policySnapshot: {},
  priorConversation: [
    {
      supplierId: "S2",
      round: 1,
      commercialTerms: { totalMinor: "400695000", leadTimeDays: 25 },
    },
  ],
};

describe("brand negotiation evidence", () => {
  it("provides exact display money alongside minor-unit evidence", () => {
    expect(commercialBaselineEvidence(context)).toMatchObject({
      currency: "USD",
      totalMinor: "400695000",
      totalDisplay: "USD 4,006,950.00",
      lines: [
        {
          baselineUnitPriceMinor: "80139",
          baselineUnitPriceDisplay: "USD 801.39",
          extendedTotalMinor: "400695000",
          extendedTotalDisplay: "USD 4,006,950.00",
        },
      ],
    });
    expect(conversationEvidence(context)[0]?.commercialTerms).toMatchObject({
      totalMinor: "400695000",
      totalDisplay: "USD 4,006,950.00",
    });
  });
});
