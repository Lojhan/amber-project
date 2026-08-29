import { DomainInvariantError } from "./errors.js";
import type { Money } from "./money.js";
export const ACTIVE_BRAND_KEY = "valden" as const;
export const SUPPLIER_POLICY_VERSION = "supplier-policy-v1" as const;
export const DECISION_POLICY_VERSION = "decision-policy-v1" as const;
export const assertActiveBrandKey = (
  brandKey: string,
): typeof ACTIVE_BRAND_KEY => {
  if (brandKey !== ACTIVE_BRAND_KEY)
    throw new DomainInvariantError(
      "brand-forbidden",
      "Only the active Valden brand may create this order intent",
    );
  return ACTIVE_BRAND_KEY;
};
export type DecisionAnchors = Readonly<{
  baselineTotalMinor: bigint;
  costTargetMinor: bigint;
  costWorstMinor: bigint;
  qualityTarget: number;
  qualityWorst: number;
  leadTargetDays: number;
  leadWorstDays: number;
  paymentTargetBps: number;
  paymentWorstBps: number;
}>;
export const decisionAnchors = (baseline: Money): DecisionAnchors => {
  if (baseline.minor <= 0n)
    throw new DomainInvariantError(
      "baseline-positive",
      "Baseline total must be positive",
    );
  return {
    baselineTotalMinor: baseline.minor,
    costTargetMinor: (baseline.minor * 92n) / 100n,
    costWorstMinor: (baseline.minor * 115n) / 100n,
    qualityTarget: 4.7,
    qualityWorst: 4,
    leadTargetDays: 12,
    leadWorstDays: 55,
    paymentTargetBps: 3000,
    paymentWorstBps: 10000,
  };
};
export const DECISION_WEIGHTS_V1 = Object.freeze({
  cost: 0.45,
  quality: 0.25,
  lead: 0.2,
  payment: 0.1,
});
export const validateDecisionWeights = (
  weights: Readonly<Record<keyof typeof DECISION_WEIGHTS_V1, number>>,
): void => {
  const values = Object.values(weights);
  const total = values.reduce((sum, weight) => sum + weight, 0);

  if (
    values.some((weight) => !Number.isFinite(weight) || weight < 0) ||
    Math.abs(total - 1) > 1e-9
  )
    throw new DomainInvariantError(
      "decision-weights",
      "Decision weights must be non-negative and total exactly one",
    );
};
