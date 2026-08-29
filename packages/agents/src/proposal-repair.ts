export type ProposalRepairFeedback = Readonly<{
  attempt: number;
  violations: readonly string[];
  instructions: readonly string[];
}>;

const instructionFor = (reason: string): string => {
  if (reason === "price-coverage")
    return "Copy every TRUSTED_POLICY.requiredLines entry exactly once. Do not omit, duplicate, or add product IDs.";
  if (reason === "price-currency")
    return "Use requiredCurrency and only product IDs copied verbatim from TRUSTED_POLICY.requiredLines.";
  if (reason === "round-price-policy")
    return "Keep every unitPriceMinor inside its required line's inclusive minimum and maximum bounds.";
  if (reason === "round-payment-policy" || reason === "payment-policy")
    return "Rebuild the payment schedule inside every TRUSTED_POLICY payment bound and make it total exactly 10,000 basis points.";
  if (reason === "round-lead-policy" || reason === "lead-policy")
    return "Choose leadTimeDays inside TRUSTED_POLICY.leadTimeDaysInclusive.";
  if (reason === "capacity-event-mismatch")
    return "Copy TRUSTED_POLICY.requiredCapacityPercent exactly.";
  if (reason === "supplier-identity")
    return "Copy TRUSTED_POLICY.requiredSupplierId exactly.";
  if (reason === "round-mismatch")
    return "Copy TRUSTED_POLICY.requiredRound exactly.";
  if (reason.startsWith("schema:"))
    return "Return one complete object matching the strict schema, including every required field.";
  if (reason === "incomplete_response")
    return "Return the complete proposal in one response; do not truncate the required line list.";
  if (reason === "model_refusal_or_empty_output")
    return "Return the requested commercial proposal unless a safety policy requires refusal.";

  return "Correct the stated deterministic validation violation while preserving every TRUSTED_POLICY requirement.";
};

export const proposalRepairFeedback = (
  attempt: number,
  violations: readonly string[],
): ProposalRepairFeedback => ({
  attempt,
  violations,
  instructions: [...new Set(violations.map(instructionFor))],
});
