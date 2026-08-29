import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { breakTie } from "./tie-break.js";
import type { Candidate } from "./types.js";

const candidate = (
  offerId: string,
  totalMinor = 100n,
  leadTimeDays = 20,
  quality = 4,
): Candidate => ({
  offerId,
  supplierId: "S1",
  totalMinor,
  quality,
  leadTimeDays,
  preShipmentBps: 5000,
  policyValid: true,
  currency: "USD",
  capacityPercent: 100,
});
const item = (candidateValue: Candidate, value = "0.5") => ({
  candidate: candidateValue,
  score: new Decimal(value),
});
describe("tie-breaking", () => {
  it("applies score, cost, lead, quality, then manual selection", () => {
    expect(
      breakTie([item(candidate("score"), "0.6"), item(candidate("other"))])
        .winner?.offerId,
    ).toBe("score");
    expect(
      breakTie([item(candidate("cost", 99n)), item(candidate("other", 100n))])
        .winner?.offerId,
    ).toBe("cost");
    expect(
      breakTie([item(candidate("lead", 100n, 19)), item(candidate("other"))])
        .winner?.offerId,
    ).toBe("lead");
    expect(
      breakTie([
        item(candidate("quality", 100n, 20, 4.1)),
        item(candidate("other")),
      ]).winner?.offerId,
    ).toBe("quality");
    expect(breakTie([item(candidate("a")), item(candidate("b"))]).status).toBe(
      "manual_selection_required",
    );
    expect(breakTie([]).status).toBe("no_eligible_offer");
  });
});
