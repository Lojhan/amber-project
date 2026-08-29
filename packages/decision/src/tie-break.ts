import type { Decimal } from "decimal.js";
import type { Candidate } from "./types.js";
export type TieResult = Readonly<{
  winner?: Candidate;
  status: "recommended" | "manual_selection_required" | "no_eligible_offer";
  trace: readonly string[];
}>;
export const breakTie = (
  ranked: readonly Readonly<{ candidate: Candidate; score: Decimal }>[],
): TieResult => {
  if (!ranked.length)
    return { status: "no_eligible_offer", trace: ["no eligible offers"] };
  let tied = ranked.filter((item) => item.score.eq(ranked[0]!.score));
  if (tied.length === 1)
    return {
      winner: tied[0]!.candidate,
      status: "recommended",
      trace: ["highest weighted score"],
    };
  const lowestCost = tied.reduce(
    (best, item) =>
      item.candidate.totalMinor < best ? item.candidate.totalMinor : best,
    tied[0]!.candidate.totalMinor,
  );
  tied = tied.filter((item) => item.candidate.totalMinor === lowestCost);

  if (tied.length === 1)
    return {
      winner: tied[0]!.candidate,
      status: "recommended",
      trace: ["score tie", "lower total cost"],
    };
  const fastestLead = Math.min(
    ...tied.map((item) => item.candidate.leadTimeDays),
  );
  tied = tied.filter((item) => item.candidate.leadTimeDays === fastestLead);

  if (tied.length === 1)
    return {
      winner: tied[0]!.candidate,
      status: "recommended",
      trace: ["score tie", "cost tie", "lower lead time"],
    };
  const highestQuality = Math.max(
    ...tied.map((item) => item.candidate.quality),
  );
  tied = tied.filter((item) => item.candidate.quality === highestQuality);

  if (tied.length === 1)
    return {
      winner: tied[0]!.candidate,
      status: "recommended",
      trace: ["score tie", "cost tie", "lead tie", "higher quality"],
    };
  return {
    status: "manual_selection_required",
    trace: [
      "score tie",
      "cost tie",
      "lead tie",
      "quality tie",
      "manual selection required",
    ],
  };
};
