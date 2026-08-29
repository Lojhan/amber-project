import {
  type Candidate,
  type DecisionPolicySnapshot,
  decide,
} from "@procurement/decision";
import type { JsonValue } from "./ports/json.js";
import type { DecisionInputs } from "./ports/negotiation.js";

const record = (value: JsonValue): Readonly<Record<string, JsonValue>> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid decision policy snapshot");

  return value as Readonly<Record<string, JsonValue>>;
};

const string = (value: JsonValue | undefined): string => {
  if (typeof value !== "string")
    throw new Error("invalid decision policy snapshot");

  return value;
};

const policy = (value: JsonValue): DecisionPolicySnapshot => {
  const source = record(value);
  const weights = record(source.weights ?? null);
  const hardMaxLead = source.hardMaxLead;

  if (
    hardMaxLead !== undefined &&
    (typeof hardMaxLead !== "number" ||
      !Number.isInteger(hardMaxLead) ||
      hardMaxLead <= 0)
  )
    throw new Error("invalid decision policy snapshot");

  const hash = string(source.hash);

  if (!/^[a-f0-9]{64}$/.test(hash))
    throw new Error("invalid decision policy snapshot");

  return {
    version: string(source.version),
    hash,
    weights: {
      cost: string(weights.cost),
      quality: string(weights.quality),
      lead: string(weights.lead),
      payment: string(weights.payment),
    },
    ...(hardMaxLead === undefined ? {} : { hardMaxLead }),
  };
};

const quality = (supplierId: Candidate["supplierId"]): number =>
  ({ S1: 4.0, S2: 4.7, S3: 4.0 })[supplierId];

const json = (value: unknown): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(json);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, json(item)]),
    );

  throw new Error("decision output is not JSON-safe");
};

export const makeDecision = (input: DecisionInputs): JsonValue =>
  json(
    decide({
      baselineMinor: input.baselineMinor,
      currency: input.negotiation.currency,
      policySnapshot: policy(input.policySnapshot),
      candidates: input.offers.map(
        (offer): Candidate => ({
          offerId: offer.id,
          supplierId: offer.supplierId,
          totalMinor: offer.totalMinor,
          quality: quality(offer.supplierId),
          leadTimeDays: offer.leadTimeDays,
          preShipmentBps: offer.preShipmentBasisPoints,
          policyValid: offer.fullOrderEligible && offer.capacityPercent === 100,
          currency: input.negotiation.currency,
          capacityPercent: offer.capacityPercent,
        }),
      ),
    }),
  );
