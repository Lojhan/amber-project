import { Decimal } from "decimal.js";
import { serializeWeights } from "./scoring.js";
import {
  CRITERIA,
  type Criterion,
  type SensitivityCase,
  type Weights,
} from "./types.js";
export const perturbedWeights = (
  base: Weights,
  criterion: Criterion,
  direction: "increase" | "decrease",
): Weights => {
  const changed = base[criterion].add(
    direction === "increase" ? "0.10" : "-0.10",
  );
  const remaining = CRITERIA.filter((item) => item !== criterion);
  const oldRemaining = remaining.reduce(
    (total, item) => total.add(base[item]),
    new Decimal(0),
  );
  const targetRemaining = new Decimal(1).sub(changed);

  return {
    cost:
      criterion === "cost"
        ? changed
        : base.cost.mul(targetRemaining).div(oldRemaining),
    quality:
      criterion === "quality"
        ? changed
        : base.quality.mul(targetRemaining).div(oldRemaining),
    lead:
      criterion === "lead"
        ? changed
        : base.lead.mul(targetRemaining).div(oldRemaining),
    payment:
      criterion === "payment"
        ? changed
        : base.payment.mul(targetRemaining).div(oldRemaining),
  };
};

export const sensitivityCases = (
  base: Weights,
  winner: (weights: Weights) => Readonly<{
    winnerOfferId?: string;
    recommendationStatus: SensitivityCase["recommendationStatus"];
  }>,
): readonly SensitivityCase[] =>
  CRITERIA.flatMap((criterion) =>
    (["increase", "decrease"] as const).map((direction) => {
      const weights = perturbedWeights(base, criterion, direction);
      const result = winner(weights);

      return {
        criterion,
        direction,
        weights: serializeWeights(weights),
        ...(result.winnerOfferId === undefined
          ? {}
          : { winnerOfferId: result.winnerOfferId }),
        recommendationStatus: result.recommendationStatus,
      };
    }),
  );
