import { Decimal } from "decimal.js";
import type { Criterion, Weights } from "./types.js";
export const DEFAULT_WEIGHTS: Weights = {
  cost: new Decimal("0.45"),
  quality: new Decimal("0.25"),
  lead: new Decimal("0.20"),
  payment: new Decimal("0.10"),
};
export const serializeWeights = (
  weights: Weights,
): Record<Criterion, string> => ({
  cost: weights.cost.toFixed(12),
  quality: weights.quality.toFixed(12),
  lead: weights.lead.toFixed(12),
  payment: weights.payment.toFixed(12),
});

export const score = (
  values: Record<Criterion, Decimal>,
  weights: Weights,
): Decimal =>
  values.cost
    .mul(weights.cost)
    .add(values.quality.mul(weights.quality))
    .add(values.lead.mul(weights.lead))
    .add(values.payment.mul(weights.payment));
