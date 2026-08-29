import { createHash } from "node:crypto";
import { Decimal } from "decimal.js";
import { exclusionReasons } from "./eligibility.js";
import { paretoOfferIds } from "./pareto.js";
import { rationaleFor } from "./rationale.js";
import { DEFAULT_WEIGHTS, score, serializeWeights } from "./scoring.js";
import { sensitivityCases } from "./sensitivity.js";
import { breakTie } from "./tie-break.js";
import type {
  Candidate,
  CandidateSnapshot,
  Criterion,
  DecisionInput,
  DecisionRecord,
  Evaluation,
  Weights,
} from "./types.js";
import { CRITERIA } from "./types.js";
import {
  normalizedValues,
  serializeValues,
  VALUE_FUNCTION_IDENTIFIERS,
} from "./value-functions.js";

const snapshot = (candidate: Candidate): CandidateSnapshot => ({
  offerId: candidate.offerId,
  supplierId: candidate.supplierId,
  totalMinor: candidate.totalMinor.toString(),
  quality: candidate.quality,
  leadTimeDays: candidate.leadTimeDays,
  preShipmentBps: candidate.preShipmentBps,
  policyValid: candidate.policyValid,
  currency: candidate.currency,
  capacityPercent: candidate.capacityPercent,
});

const select = (
  eligible: readonly Candidate[],
  baselineMinor: bigint,
  weights: Weights,
) =>
  breakTie(
    eligible
      .map((candidate) => ({
        candidate,
        score: score(normalizedValues(candidate, baselineMinor), weights),
      }))
      .sort((left, right) => right.score.comparedTo(left.score)),
  );

const validateInput = (
  input: DecisionInput,
  hardMaxLead: number | undefined,
) => {
  if (
    hardMaxLead !== undefined &&
    (!Number.isInteger(hardMaxLead) || hardMaxLead <= 0 || hardMaxLead > 55)
  )
    throw new Error("hardMaxLead must be an integer between 1 and 55");
  if (input.baselineMinor <= 0n)
    throw new Error("baselineMinor must be positive");
  if (
    new Set(input.candidates.map((candidate) => candidate.offerId)).size !==
    input.candidates.length
  )
    throw new Error("offerId values must be unique");
};

const policyFor = (input: DecisionInput, hardMaxLead: number | undefined) => {
  const weights: Weights = input.policySnapshot
    ? (Object.fromEntries(
        CRITERIA.map((criterion) => [
          criterion,
          new Decimal(input.policySnapshot!.weights[criterion]),
        ]),
      ) as Record<Criterion, Decimal>)
    : DEFAULT_WEIGHTS;
  const policyVersion =
    input.policySnapshot?.version ??
    input.policyVersion ??
    "decision-policy-v1";
  const policyHash =
    input.policySnapshot?.hash ??
    createHash("sha256")
      .update(
        JSON.stringify({
          policyVersion,
          weights: serializeWeights(weights),
          hardMaxLead,
        }),
      )
      .digest("hex");

  return {
    weights,
    policyVersion,
    policyHash,
    policySnapshot: input.policySnapshot ?? {
      version: policyVersion,
      hash: policyHash,
      weights: serializeWeights(weights),
      ...(hardMaxLead === undefined ? {} : { hardMaxLead }),
    },
  };
};

const evaluateOffers = (
  input: DecisionInput,
  effectiveInput: DecisionInput,
  weights: Weights,
) => {
  const reasons = new Map(
    input.candidates.map((candidate) => [
      candidate.offerId,
      exclusionReasons(candidate, effectiveInput),
    ]),
  );
  const eligible = input.candidates.filter(
    (candidate) => reasons.get(candidate.offerId)!.length === 0,
  );
  const paretoIds = paretoOfferIds(eligible);
  const offers: readonly Evaluation[] = input.candidates.map((candidate) => {
    const exclusions = reasons.get(candidate.offerId)!;
    const factual = {
      candidate: snapshot(candidate),
      offerId: candidate.offerId,
      totalMinor: candidate.totalMinor.toString(),
      quality: candidate.quality.toString(),
      leadTimeDays: candidate.leadTimeDays,
      preShipmentBps: candidate.preShipmentBps,
    };

    if (exclusions.length)
      return { ...factual, eligible: false, exclusionReasons: exclusions };

    const values = normalizedValues(candidate, input.baselineMinor);
    return {
      ...factual,
      eligible: true,
      exclusionReasons: [],
      normalized: serializeValues(values),
      score: score(values, weights).toFixed(12),
      paretoStatus: paretoIds.includes(candidate.offerId)
        ? "non_dominated"
        : "dominated",
    };
  });

  return { eligible, paretoIds, offers };
};

const sensitivityFor = (
  eligible: readonly Candidate[],
  baselineMinor: bigint,
  weights: Weights,
) =>
  sensitivityCases(weights, (variantWeights) => {
    const result = select(eligible, baselineMinor, variantWeights);
    return result.winner === undefined
      ? { recommendationStatus: result.status }
      : {
          winnerOfferId: result.winner.offerId,
          recommendationStatus: result.status,
        };
  });

export const decide = (input: DecisionInput): DecisionRecord => {
  const hardMaxLead = input.policySnapshot?.hardMaxLead ?? input.hardMaxLead;
  validateInput(input, hardMaxLead);
  const effectiveInput = {
    ...input,
    ...(hardMaxLead === undefined ? {} : { hardMaxLead }),
  };
  const { weights, policyVersion, policyHash, policySnapshot } = policyFor(
    input,
    hardMaxLead,
  );
  const { eligible, paretoIds, offers } = evaluateOffers(
    input,
    effectiveInput,
    weights,
  );
  const selection = select(eligible, input.baselineMinor, weights);
  const sensitivity = sensitivityFor(eligible, input.baselineMinor, weights);
  const winnerOfferId = selection.winner?.offerId;
  const bestCostMinor = (input.baselineMinor * 92n) / 100n;
  const worstCostMinor = (input.baselineMinor * 115n) / 100n;

  return {
    policyVersion,
    policyHash,
    policySnapshot,
    decisionVersion: "decision-engine-v2",
    inputs: {
      baselineMinor: input.baselineMinor.toString(),
      currency: input.currency,
      ...(hardMaxLead === undefined ? {} : { hardMaxLead }),
    },
    anchors: {
      cost: {
        best: "0.92*baseline",
        worst: "1.15*baseline",
        bestMinor: bestCostMinor.toString(),
        worstMinor: worstCostMinor.toString(),
      },
      quality: { best: "4.7", worst: "4.0" },
      lead: { best: "12", worst: "55" },
      payment: { best: "3000", worst: "10000" },
    },
    valueFunctions: VALUE_FUNCTION_IDENTIFIERS,
    weights: serializeWeights(weights),
    offers,
    paretoOfferIds: paretoIds,
    sensitivity,
    preferenceSensitive: sensitivity.some(
      (item) => item.winnerOfferId !== winnerOfferId,
    ),
    recommendationStatus: selection.status,
    ...(winnerOfferId === undefined ? {} : { winnerOfferId }),
    tieBreakTrace: selection.trace,
    warnings: eligible.length === 0 ? ["No eligible offer was scored."] : [],
    rationale: rationaleFor(selection.status, winnerOfferId, eligible.length),
  };
};
