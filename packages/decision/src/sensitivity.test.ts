import type { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "./scoring.js";
import { perturbedWeights, sensitivityCases } from "./sensitivity.js";
import type { Weights } from "./types.js";

const sum = (weights: Weights): Decimal =>
  weights.cost.add(weights.quality).add(weights.lead).add(weights.payment);
describe("sensitivity", () => {
  it("produces eight renormalized cases", () => {
    const cases = sensitivityCases(DEFAULT_WEIGHTS, () => ({
      winnerOfferId: "S1",
      recommendationStatus: "recommended",
    }));
    expect(cases).toHaveLength(8);
    expect(
      new Set(cases.map((item) => `${item.criterion}:${item.direction}`)).size,
    ).toBe(8);
    for (const criterion of ["cost", "quality", "lead", "payment"] as const) {
      for (const direction of ["increase", "decrease"] as const) {
        const weights = perturbedWeights(DEFAULT_WEIGHTS, criterion, direction);
        expect(sum(weights).toFixed(12)).toBe("1.000000000000");
        expect(weights[criterion].toString()).toBe(
          DEFAULT_WEIGHTS[criterion]
            .add(direction === "increase" ? "0.10" : "-0.10")
            .toString(),
        );
      }
    }
  });
  it("proportionally retains the relative share of unperturbed weights", () => {
    const weights = perturbedWeights(DEFAULT_WEIGHTS, "cost", "increase");
    expect(weights.quality.div(weights.lead).toFixed(12)).toBe(
      DEFAULT_WEIGHTS.quality.div(DEFAULT_WEIGHTS.lead).toFixed(12),
    );
    expect(weights.payment.div(weights.lead).toFixed(12)).toBe(
      DEFAULT_WEIGHTS.payment.div(DEFAULT_WEIGHTS.lead).toFixed(12),
    );
  });
});
