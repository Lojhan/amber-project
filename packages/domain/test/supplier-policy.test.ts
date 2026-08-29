import { describe, expect, it } from "vitest";
import {
  asBrandId,
  asOfferId,
  asProductId,
  asQuotationId,
  money,
  type Offer,
  type OrderIntent,
  SUPPLIER_POLICY_V1,
  validateOfferAgainstSupplierPolicy,
} from "../src/index.js";

const intent: OrderIntent = {
  quotationId: asQuotationId("q"),
  brandId: asBrandId("valden"),
  currency: "USD",
  lines: [
    {
      productId: asProductId("p"),
      quantity: 1n,
      baselineUnitPrice: money("USD", 10_000n),
    },
  ],
};
const offer = (
  supplierId: Offer["supplierId"],
  price: bigint,
  leadTimeDays: number,
  orderBps: number,
  preShipmentBps: number,
): Offer => ({
  id: asOfferId("o"),
  supplierId,
  currency: "USD",
  leadTimeDays,
  capacityPercent: 100,
  expiresAt: new Date("2030-01-01"),
  policyValid: true,
  lines: [
    {
      productId: asProductId("p"),
      quantity: 1n,
      unitPrice: money("USD", price),
    },
  ],
  paymentSchedule: [
    { milestone: "ORDER", percentBasisPoints: orderBps },
    {
      milestone: "PRE_SHIPMENT",
      percentBasisPoints: preShipmentBps - orderBps,
    },
    { milestone: "DELIVERY", percentBasisPoints: 10_000 - preShipmentBps },
  ],
});
describe("supplier policy", () => {
  it.each(
    Object.entries(SUPPLIER_POLICY_V1) as [
      Offer["supplierId"],
      (typeof SUPPLIER_POLICY_V1)[Offer["supplierId"]],
    ][],
  )(
    "accepts each supplier's inclusive boundaries: %s",
    (supplierId, policy) => {
      const [priceMin] = policy.priceMultiplierBasisPoints;
      const [leadMin] = policy.leadTimeDays;
      const [orderMin] = policy.orderPaymentBps;
      const [preMin] = policy.preShipmentPaymentBps;
      expect(() =>
        validateOfferAgainstSupplierPolicy(
          supplierId,
          intent,
          offer(supplierId, BigInt(priceMin), leadMin, orderMin, preMin),
        ),
      ).not.toThrow();
    },
  );
  it("rejects price, lead, and payment violations", () => {
    expect(() =>
      validateOfferAgainstSupplierPolicy(
        "S1",
        intent,
        offer("S1", 9_199n, 42, 2_000, 6_000),
      ),
    ).toThrow("Line price");
    expect(() =>
      validateOfferAgainstSupplierPolicy(
        "S1",
        intent,
        offer("S1", 9_200n, 41, 2_000, 6_000),
      ),
    ).toThrow("Lead time");
    expect(() =>
      validateOfferAgainstSupplierPolicy(
        "S1",
        intent,
        offer("S1", 9_200n, 42, 1_999, 6_000),
      ),
    ).toThrow("Payment schedule");
  });
  it("accepts an exact multiplier that lands between minor units", () => {
    const fractionalIntent: OrderIntent = {
      ...intent,
      lines: [
        {
          ...intent.lines[0]!,
          baselineUnitPrice: money("USD", 625n),
        },
      ],
    };

    expect(() =>
      validateOfferAgainstSupplierPolicy(
        "S2",
        fractionalIntent,
        offer("S2", 719n, 25, 4_000, 4_000),
      ),
    ).not.toThrow();
  });
});
