export type ParsedQuoteReviewFacts = Readonly<{
  scenarios: readonly Readonly<{
    lines: readonly Readonly<{
      quantityCandidates: readonly unknown[];
      fieldRoleStatus: "resolved" | "ambiguous";
    }>[];
  }>[];
}>;

export type ReviewGate = Readonly<{
  state: "READY" | "REVIEW_REQUIRED";
  reasons: readonly string[];
}>;

/** Derives the human-review gate from parser facts before catalog matching. */
export const reviewGateForParsedQuote = (
  quote: ParsedQuoteReviewFacts,
): ReviewGate => {
  const reasons = new Set<string>();

  if (quote.scenarios.length !== 1) reasons.add("scenario_choice_required");
  for (const scenario of quote.scenarios) {
    for (const line of scenario.lines) {
      if (!line.quantityCandidates.length)
        reasons.add("missing_requested_quantity");
      if (line.fieldRoleStatus === "ambiguous")
        reasons.add("field_role_conflict");
    }
  }

  return {
    state: reasons.size ? "REVIEW_REQUIRED" : "READY",
    reasons: [...reasons],
  };
};

export const assertScenarioChoice = (
  scenarioIds: readonly string[],
  selectedScenarioId: string | undefined,
): string => {
  if (scenarioIds.length > 1 && !selectedScenarioId)
    throw new Error("An explicit scenario choice is required");

  const selected = selectedScenarioId ?? scenarioIds[0];

  if (!selected || !scenarioIds.includes(selected))
    throw new Error("Selected scenario does not exist");

  return selected;
};
