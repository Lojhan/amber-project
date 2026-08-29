import { describe, expect, it } from "vitest";
import { decide } from "./decide.js";
import type { Candidate, DecisionInput } from "./types.js";

const offer = (
  offerId: string,
  overrides: Partial<Candidate> = {},
): Candidate => ({
  offerId,
  supplierId: "S1",
  totalMinor: 1_000_000n,
  quality: 4.3,
  leadTimeDays: 30,
  preShipmentBps: 5000,
  policyValid: true,
  currency: "USD",
  capacityPercent: 100,
  ...overrides,
});
const input = (candidates: readonly Candidate[]): DecisionInput => ({
  baselineMinor: 1_000_000n,
  candidates,
  currency: "USD",
});
describe("decision record", () => {
  it("is deterministic, immutable and fact-only", () => {
    const candidates = [
      offer("S1"),
      offer("S2", { supplierId: "S2", quality: 4.7, totalMinor: 1_060_000n }),
    ];
    const snapshot = structuredClone(candidates);
    const first = decide(input(candidates));
    const second = decide(input(candidates));
    expect(first).toEqual(second);
    expect(candidates).toEqual(snapshot);
    expect(first.valueFunctions.cost).toContain("baseline");
    expect(first.rationale).not.toContain("because the model");
    expect(
      first.sensitivity.every(
        (item) => item.recommendationStatus === "recommended",
      ),
    ).toBe(true);
  });
  it("tracks changed winners as preference-sensitive", () => {
    const record = decide(
      input([
        offer("cost", {
          totalMinor: 920_000n,
          quality: 4.0,
          leadTimeDays: 55,
          preShipmentBps: 10000,
        }),
        offer("quality", {
          totalMinor: 1_150_000n,
          quality: 4.7,
          leadTimeDays: 12,
          preShipmentBps: 3000,
        }),
      ]),
    );
    expect(record.sensitivity).toHaveLength(8);
    expect(typeof record.preferenceSensitive).toBe("boolean");
    expect(record.anchors.payment.best).toBe("3000");
  });
});
