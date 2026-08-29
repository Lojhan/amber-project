import type { Candidate } from "./types.js";

const burden = (candidate: Candidate): number => candidate.preShipmentBps;
const dominates = (left: Candidate, right: Candidate): boolean =>
  left.totalMinor <= right.totalMinor &&
  left.quality >= right.quality &&
  left.leadTimeDays <= right.leadTimeDays &&
  burden(left) <= burden(right) &&
  (left.totalMinor < right.totalMinor ||
    left.quality > right.quality ||
    left.leadTimeDays < right.leadTimeDays ||
    burden(left) < burden(right));
export const paretoOfferIds = (
  eligible: readonly Candidate[],
): readonly string[] =>
  eligible
    .filter(
      (candidate) =>
        !eligible.some(
          (other) =>
            other.offerId !== candidate.offerId && dominates(other, candidate),
        ),
    )
    .map((candidate) => candidate.offerId);
