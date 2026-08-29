import { describe, expect, it } from "vitest";
import { paretoOfferIds } from "./pareto.js";
import type { Candidate } from "./types.js";

const candidate = (
  offerId: string,
  totalMinor: bigint,
  quality: number,
  leadTimeDays: number,
  preShipmentBps: number,
): Candidate => ({
  offerId,
  supplierId: "S1",
  totalMinor,
  quality,
  leadTimeDays,
  preShipmentBps,
  policyValid: true,
  currency: "USD",
  capacityPercent: 100,
});
describe("pareto frontier", () => {
  it("removes strictly dominated offers but keeps equal offers", () => {
    const best = candidate("best", 1n, 4.7, 12, 3000);
    const worse = candidate("worse", 2n, 4.0, 20, 4000);
    const equal = candidate("equal", 1n, 4.7, 12, 3000);
    expect(paretoOfferIds([best, worse])).toEqual(["best"]);
    expect(paretoOfferIds([best, equal])).toEqual(["best", "equal"]);
  });
});
