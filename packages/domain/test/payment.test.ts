import { describe, expect, it } from "vitest";
import { preShipmentBurden, validatePaymentSchedule } from "../src/index.js";

describe("payment schedules", () => {
  it("rejects empty, incomplete, and excessive totals", () => {
    for (const schedule of [
      [],
      [{ milestone: "ORDER" as const, percentBasisPoints: 9_999 }],
      [{ milestone: "ORDER" as const, percentBasisPoints: 10_001 }],
    ]) {
      expect(() => validatePaymentSchedule(schedule)).toThrow();
    }
  });
  it.each([[-1], [1.5]])("rejects invalid percent %s", (percentBasisPoints) =>
    expect(() =>
      validatePaymentSchedule([
        { milestone: "ORDER", percentBasisPoints },
        {
          milestone: "DELIVERY",
          percentBasisPoints: 10_000 - percentBasisPoints,
        },
      ]),
    ).toThrow(),
  );
  it("calculates burden through pre-shipment", () =>
    expect(
      preShipmentBurden([
        { milestone: "ORDER", percentBasisPoints: 2_000 },
        { milestone: "PRE_SHIPMENT", percentBasisPoints: 4_000 },
        { milestone: "DELIVERY", percentBasisPoints: 4_000 },
      ]),
    ).toBe(6_000));
});
