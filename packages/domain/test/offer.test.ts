import { describe, expect, it } from "vitest";
import {
  asBrandId,
  asOfferId,
  asProductId,
  asQuotationId,
  money,
  type Offer,
  type OrderIntent,
  validateOfferCommercialFacts,
  validateOfferForIntent,
} from "../src/index.js";

const intent: OrderIntent = {
  quotationId: asQuotationId("q"),
  brandId: asBrandId("valden"),
  currency: "USD",
  lines: [
    {
      productId: asProductId("p"),
      quantity: 1n,
      baselineUnitPrice: money("USD", 100n),
    },
  ],
};
const valid = (): Offer => ({
  id: asOfferId("o"),
  supplierId: "S1",
  currency: "USD",
  leadTimeDays: 42,
  capacityPercent: 100,
  expiresAt: new Date("2030-01-01"),
  policyValid: true,
  lines: [
    { productId: asProductId("p"), quantity: 1n, unitPrice: money("USD", 90n) },
  ],
  paymentSchedule: [
    { milestone: "ORDER", percentBasisPoints: 2_000 },
    { milestone: "DELIVERY", percentBasisPoints: 8_000 },
  ],
});
describe("offer acceptance", () => {
  it("accepts a complete future full-capacity offer", () =>
    expect(() =>
      validateOfferForIntent(valid(), intent, new Date("2029-01-01")),
    ).not.toThrow());
  it("keeps an S2-like partial offer commercially valid but full-order ineligible", () => {
    const partial = {
      ...valid(),
      supplierId: "S2" as const,
      capacityPercent: 60,
    };
    expect(() =>
      validateOfferCommercialFacts(partial, intent, new Date("2029-01-01")),
    ).not.toThrow();
    expect(() =>
      validateOfferForIntent(partial, intent, new Date("2029-01-01")),
    ).toThrow("full order");
  });
  it.each([
    [(offer: Offer) => ({ ...offer, policyValid: false })],
    [(offer: Offer) => ({ ...offer, currency: "EUR" as const })],
    [(offer: Offer) => ({ ...offer, expiresAt: new Date("2029-01-01") })],
    [(offer: Offer) => ({ ...offer, capacityPercent: 60 })],
    [(offer: Offer) => ({ ...offer, lines: [] })],
  ])("rejects invalid offer boundary %#", (mutate) =>
    expect(() =>
      validateOfferForIntent(mutate(valid()), intent, new Date("2029-01-01")),
    ).toThrow(),
  );
});
