import type { Candidate, DecisionInput } from "./types.js";
export const exclusionReasons = (
  candidate: Candidate,
  input: DecisionInput,
): readonly string[] => {
  const reasons: string[] = [];
  if (!candidate.policyValid) reasons.push("policy_invalid");
  if (candidate.currency !== input.currency) reasons.push("currency_mismatch");
  if (candidate.capacityPercent !== 100) reasons.push("capacity_not_full");
  if (
    input.hardMaxLead !== undefined &&
    candidate.leadTimeDays > input.hardMaxLead
  )
    reasons.push("hard_lead_exceeded");
  return reasons;
};
