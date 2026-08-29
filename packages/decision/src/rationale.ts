import type { DecisionRecord } from "./types.js";
export const rationaleFor = (
  status: DecisionRecord["recommendationStatus"],
  winnerOfferId: string | undefined,
  eligibleCount: number,
): string => {
  if (status === "no_eligible_offer")
    return "No offer satisfies the recorded eligibility constraints.";
  if (status === "manual_selection_required")
    return `${eligibleCount} eligible offers remain tied after the recorded tie-break rules; manual selection is required.`;
  return `Offer ${winnerOfferId} is recommended from the recorded eligible offers using the recorded weighted value functions and tie-break trace.`;
};
