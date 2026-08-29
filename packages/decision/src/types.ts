import type { Decimal } from "decimal.js";

export const CRITERIA = ["cost", "quality", "lead", "payment"] as const;
export type Criterion = (typeof CRITERIA)[number];
export type SupplierId = "S1" | "S2" | "S3";
export type Candidate = Readonly<{
  offerId: string;
  supplierId: SupplierId;
  totalMinor: bigint;
  quality: number;
  leadTimeDays: number;
  preShipmentBps: number;
  policyValid: boolean;
  currency: string;
  capacityPercent: number;
}>;
export type DecisionInput = Readonly<{
  baselineMinor: bigint;
  candidates: readonly Candidate[];
  currency: string;
  hardMaxLead?: number;
  policyVersion?: string;
  policySnapshot?: DecisionPolicySnapshot;
}>;
export type Weights = Readonly<Record<Criterion, Decimal>>;
export type SerializedWeights = Readonly<Record<Criterion, string>>;
export type DecisionPolicySnapshot = Readonly<{
  version: string;
  hash: string;
  weights: SerializedWeights;
  hardMaxLead?: number;
  derivedFrom?: Readonly<{
    version: string;
    hash: string;
    noteConstraintIds: readonly string[];
  }>;
}>;
export type NormalizedValues = Readonly<Record<Criterion, string>>;
export type CandidateSnapshot = Readonly<{
  offerId: string;
  supplierId: SupplierId;
  totalMinor: string;
  quality: number;
  leadTimeDays: number;
  preShipmentBps: number;
  policyValid: boolean;
  currency: string;
  capacityPercent: number;
}>;
export type Evaluation = Readonly<{
  candidate: CandidateSnapshot;
  offerId: string;
  eligible: boolean;
  exclusionReasons: readonly string[];
  totalMinor: string;
  quality: string;
  leadTimeDays: number;
  preShipmentBps: number;
  normalized?: NormalizedValues;
  score?: string;
  paretoStatus?: "dominated" | "non_dominated";
}>;
export type SensitivityCase = Readonly<{
  criterion: Criterion;
  direction: "increase" | "decrease";
  weights: SerializedWeights;
  winnerOfferId?: string;
  recommendationStatus:
    | "recommended"
    | "manual_selection_required"
    | "no_eligible_offer";
}>;
export type DecisionRecord = Readonly<{
  policyVersion: string;
  policyHash: string;
  policySnapshot: DecisionPolicySnapshot;
  decisionVersion: string;
  inputs: Readonly<{
    baselineMinor: string;
    currency: string;
    hardMaxLead?: number;
  }>;
  anchors: Readonly<{
    cost: Readonly<{
      best: string;
      worst: string;
      bestMinor: string;
      worstMinor: string;
    }>;
    quality: Readonly<{ best: string; worst: string }>;
    lead: Readonly<{ best: string; worst: string }>;
    payment: Readonly<{ best: string; worst: string }>;
  }>;
  valueFunctions: Readonly<Record<Criterion, string>>;
  weights: SerializedWeights;
  offers: readonly Evaluation[];
  paretoOfferIds: readonly string[];
  sensitivity: readonly SensitivityCase[];
  preferenceSensitive: boolean;
  winnerOfferId?: string;
  recommendationStatus:
    | "recommended"
    | "manual_selection_required"
    | "no_eligible_offer";
  tieBreakTrace: readonly string[];
  warnings: readonly string[];
  rationale: string;
}>;
