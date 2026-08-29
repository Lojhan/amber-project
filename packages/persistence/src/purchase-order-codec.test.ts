import { describe, expect, it } from "vitest";
import {
  decodePurchaseOrderSnapshot,
  encodePurchaseOrderSnapshot,
} from "./purchase-order-codec.js";

const valid = () => ({
  brandId: "brand-1",
  negotiationId: "neg-1",
  recommendationId: "recommendation-1",
  catalogVersion: "cat-1",
  decisionVersion: "dec-1",
  eligible: true,
  orderIntent: {
    quotationId: "quote-1",
    currency: "USD",
    lines: [
      { productId: "sku-1", quantity: "2", baselineUnitPriceMinor: "100" },
    ],
  },
  selectedOffer: {
    id: "offer-1",
    supplierId: "S1",
    currency: "USD",
    leadTimeDays: 3,
    capacityPercent: 100,
    expiresAt: "2099-01-01T00:00:00.000Z",
    policyValid: true,
    lines: [{ productId: "sku-1", quantity: "2", unitPriceMinor: "90" }],
    paymentSchedule: [{ milestone: "PRE_SHIPMENT", percentBasisPoints: 10000 }],
  },
});

describe("purchase-order-codec", () => {
  it("decodes a valid persisted snapshot", () => {
    const decoded = decodePurchaseOrderSnapshot(
      valid(),
      "brand-1",
      "neg-1",
      "RECOMMENDED",
    );
    expect(decoded.selectedOffer.expiresAt).toBeInstanceOf(Date);
    expect(decoded.selectedOffer.lines[0]?.quantity).toBe(2n);
    expect(decoded.orderIntent.lines[0]?.baselineUnitPrice.minor).toBe(100n);
  });

  it("encodes domain values as JSON and round-trips them", () => {
    const decoded = decodePurchaseOrderSnapshot(
      valid(),
      "brand-1",
      "neg-1",
      "RECOMMENDED",
    );
    const encoded = encodePurchaseOrderSnapshot(decoded);

    expect(() => JSON.stringify(encoded)).not.toThrow();
    expect(decodePurchaseOrderSnapshot(encoded, "brand-1", "neg-1")).toEqual(
      decoded,
    );
  });

  it.each([
    ["non-object", null],
    ["cross-brand", { ...valid(), brandId: "other" }],
    [
      "bad currency",
      { ...valid(), orderIntent: { ...valid().orderIntent, currency: "GBP" } },
    ],
    [
      "bad date",
      {
        ...valid(),
        selectedOffer: { ...valid().selectedOffer, expiresAt: "nope" },
      },
    ],
    [
      "bad bigint",
      {
        ...valid(),
        orderIntent: {
          ...valid().orderIntent,
          lines: [{ ...valid().orderIntent.lines[0], quantity: "x" }],
        },
      },
    ],
    [
      "bad supplier",
      {
        ...valid(),
        selectedOffer: { ...valid().selectedOffer, supplierId: "S9" },
      },
    ],
    [
      "bad milestone",
      {
        ...valid(),
        selectedOffer: {
          ...valid().selectedOffer,
          paymentSchedule: [{ milestone: "NOPE", percentBasisPoints: 10000 }],
        },
      },
    ],
    [
      "bad payment sum",
      {
        ...valid(),
        selectedOffer: {
          ...valid().selectedOffer,
          paymentSchedule: [{ milestone: "ORDER", percentBasisPoints: 1 }],
        },
      },
    ],
    [
      "empty lines",
      { ...valid(), selectedOffer: { ...valid().selectedOffer, lines: [] } },
    ],
    [
      "mismatched lines",
      {
        ...valid(),
        selectedOffer: {
          ...valid().selectedOffer,
          lines: [{ productId: "sku-2", quantity: "2", unitPriceMinor: "90" }],
        },
      },
    ],
    [
      "false policy",
      {
        ...valid(),
        selectedOffer: { ...valid().selectedOffer, policyValid: false },
      },
    ],
  ])("rejects %s", (_label, value) => {
    expect(() =>
      decodePurchaseOrderSnapshot(value, "brand-1", "neg-1"),
    ).toThrow();
  });
});
