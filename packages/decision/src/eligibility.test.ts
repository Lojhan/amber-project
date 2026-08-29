import { describe, expect, it } from "vitest";
import { decide } from "./decide.js";
import type { Candidate, DecisionInput } from "./types.js";

const offer = (overrides: Partial<Candidate> = {}): Candidate => ({
  offerId: "S1",
  supplierId: "S1",
  totalMinor: 1_000_000n,
  quality: 4.2,
  leadTimeDays: 30,
  preShipmentBps: 4000,
  policyValid: true,
  currency: "USD",
  capacityPercent: 100,
  ...overrides,
});
const input = (candidates: readonly Candidate[]): DecisionInput => ({
  baselineMinor: 1_000_000n,
  candidates,
  currency: "USD",
  hardMaxLead: 40,
});
describe("eligibility gate", () => {
  it("excludes every hard-constraint failure before scoring", () => {
    const record = decide(
      input([
        offer({ offerId: "policy", policyValid: false }),
        offer({ offerId: "currency", currency: "EUR" }),
        offer({ offerId: "capacity", supplierId: "S2", capacityPercent: 60 }),
        offer({ offerId: "lead", leadTimeDays: 41 }),
      ]),
    );
    expect(record.offers[0]!.exclusionReasons).toEqual(["policy_invalid"]);
    expect(record.offers[1]!.exclusionReasons).toEqual(["currency_mismatch"]);
    expect(record.offers[2]!.exclusionReasons).toEqual(["capacity_not_full"]);
    expect(record.offers[3]!.exclusionReasons).toEqual(["hard_lead_exceeded"]);
    expect(record.offers.every((item) => item.score === undefined)).toBe(true);
    expect(record.recommendationStatus).toBe("no_eligible_offer");
    const partialS2 = record.offers[2]!;
    expect(partialS2.candidate.supplierId).toBe("S2");
    expect(partialS2.candidate.currency).toBe("USD");
    expect(partialS2.candidate.capacityPercent).toBe(60);
    expect(partialS2.candidate.policyValid).toBe(true);
    expect(partialS2.candidate.preShipmentBps).toBe(4000);
    expect(partialS2.candidate.totalMinor).toBe("1000000");
    expect(record.anchors.cost.bestMinor).toBe("920000");
    expect(record.anchors.cost.worstMinor).toBe("1150000");
  });
  it("does not alter eligible scores when an excluded display offer is added", () => {
    const good = offer();
    const before = decide(input([good]));
    const after = decide(
      input([
        good,
        offer({ offerId: "S2", supplierId: "S2", capacityPercent: 60 }),
      ]),
    );
    expect(after.offers[0]!.score).toBe(before.offers[0]!.score);
    expect(after.winnerOfferId).toBe(before.winnerOfferId);
  });
});
