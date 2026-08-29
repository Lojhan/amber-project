import { describe, expect, it } from "vitest";
import {
  asBrandId,
  asProductId,
  asQuotationId,
  baselineTotal,
  money,
  type OrderIntent,
  validateOrderIntent,
} from "../src/index.js";

const intent = (lines: OrderIntent["lines"]): OrderIntent => ({
  quotationId: asQuotationId("q"),
  brandId: asBrandId("valden"),
  currency: "USD",
  lines,
});
const line = {
  productId: asProductId("p"),
  quantity: 2n,
  baselineUnitPrice: money("USD", 100n),
};
describe("order intent", () => {
  it("totals integer money", () =>
    expect(baselineTotal(intent([line])).minor).toBe(200n));
  it("rejects empty, non-positive, mixed-currency, and duplicate lines", () => {
    const invalid: OrderIntent["lines"][] = [
      [],
      [{ ...line, quantity: 0n }],
      [{ ...line, baselineUnitPrice: money("EUR", 1n) }],
      [line, line],
    ];
    for (const lines of invalid) {
      expect(() => validateOrderIntent(intent(lines))).toThrow();
    }
  });
});
