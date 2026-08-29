import { z } from "zod";
import type { QueueName } from "./queue-names.js";
import type { QueuePayloadMap } from "./types.js";

const id = z.string().trim().min(1).max(128);
const correlationId = id;
const base = { brandId: id, correlationId } as const;

const quotationSchema = z
  .object({
    ...base,
    quotationId: id,
    objectKey: z.string().trim().min(1).max(1024),
  })
  .strict();

const negotiationSchema = z
  .object({
    ...base,
    negotiationId: id,
    supplierId: z.enum(["S1", "S2", "S3"]),
    round: z.union([z.literal(1), z.literal(2)]),
    expectedVersion: z.number().int().min(1).max(2_147_483_647),
  })
  .strict();

const matchingSchema = z
  .object({
    ...base,
    quotationId: id,
  })
  .strict();

const decisionSchema = z
  .object({
    ...base,
    negotiationId: id,
    expectedVersion: z.number().int().min(1).max(2_147_483_647),
  })
  .strict();

const persistedEnvelopeSchema = z
  .object({
    payload: z.unknown(),
    correlationId,
  })
  .strict();

export function parseJobData(
  queue: "match-candidates",
  data: unknown,
): QueuePayloadMap["match-candidates"];
export function parseJobData(
  queue: "preflight-quotation" | "parse-quotation",
  data: unknown,
): QueuePayloadMap[typeof queue];
export function parseJobData(
  queue: "negotiation-turn",
  data: unknown,
): QueuePayloadMap["negotiation-turn"];
export function parseJobData(
  queue: "decision-continuation",
  data: unknown,
): QueuePayloadMap["decision-continuation"];
export function parseJobData<K extends QueueName>(
  queue: K,
  data: unknown,
): QueuePayloadMap[K];
export function parseJobData(
  queue: QueueName,
  data: unknown,
): QueuePayloadMap[QueueName] {
  if (queue === "preflight-quotation" || queue === "parse-quotation")
    return quotationSchema.parse(data);
  if (queue === "match-candidates") return matchingSchema.parse(data);
  if (queue === "negotiation-turn") return negotiationSchema.parse(data);
  return decisionSchema.parse(data);
}

export const parsePersistedJob = <K extends QueueName>(
  queue: K,
  data: unknown,
): QueuePayloadMap[K] => {
  const envelope = persistedEnvelopeSchema.parse(data);
  const payload = parseJobData(queue, envelope.payload);
  if (payload.correlationId !== envelope.correlationId)
    throw new Error("persisted job correlation id does not match its payload");

  return payload;
};
