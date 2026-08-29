import { createHash } from "node:crypto";
import {
  type DecisionPolicySnapshot,
  deriveDecisionPolicy,
} from "@procurement/decision";
import type {
  CommercialNoteInterpretation,
  ConfirmedNegotiationPolicy,
} from "./ports/negotiation.js";

const BASE_WEIGHTS = {
  cost: "0.45",
  quality: "0.25",
  lead: "0.20",
  payment: "0.10",
} as const;
const BASE_BODY = { version: "decision-policy-v1", weights: BASE_WEIGHTS };
const BASE_POLICY: DecisionPolicySnapshot = {
  ...BASE_BODY,
  hash: createHash("sha256").update(JSON.stringify(BASE_BODY)).digest("hex"),
};

const weightsFor = (
  priority: CommercialNoteInterpretation["primaryPriority"],
) => {
  if (priority === "lead_time")
    return { ...BASE_WEIGHTS, cost: "0.30", lead: "0.35" };
  if (priority === "cost")
    return { ...BASE_WEIGHTS, cost: "0.55", lead: "0.10" };
  if (priority === "quality")
    return {
      ...BASE_WEIGHTS,
      cost: "0.35",
      quality: "0.40",
      lead: "0.15",
    };
  if (priority === "payment_terms")
    return {
      ...BASE_WEIGHTS,
      cost: "0.35",
      lead: "0.15",
      payment: "0.25",
    };

  return BASE_WEIGHTS;
};

export const defaultCommercialNoteInterpretation =
  (): CommercialNoteInterpretation => ({
    primaryPriority: null,
    hardMaxLeadDays: null,
    summary:
      "No commercial note was provided; the standard buying policy applies.",
    warnings: [],
    source: "default",
  });

export const deriveNegotiationPolicy = (
  interpretation: CommercialNoteInterpretation,
): ConfirmedNegotiationPolicy => {
  const weights = weightsFor(interpretation.primaryPriority);
  const noteConstraintIds = [
    ...(interpretation.primaryPriority
      ? [`ai-priority:${interpretation.primaryPriority}`]
      : []),
    ...(interpretation.hardMaxLeadDays
      ? [`ai-hard-max-lead:${interpretation.hardMaxLeadDays}`]
      : []),
  ];
  const policy = noteConstraintIds.length
    ? deriveDecisionPolicy(BASE_POLICY, {
        weights,
        ...(interpretation.hardMaxLeadDays
          ? { hardMaxLead: interpretation.hardMaxLeadDays }
          : {}),
        noteConstraintIds,
      })
    : BASE_POLICY;

  return {
    version: policy.version,
    hash: policy.hash,
    weights: policy.weights,
    ...(policy.hardMaxLead === undefined
      ? {}
      : { hardMaxLead: policy.hardMaxLead }),
    interpretation,
  };
};
