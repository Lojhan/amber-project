import type { JsonValue } from "@procurement/application/ports";

export const json = (value: unknown): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(json);
  if (value && typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value)) out[k] = json(v);
    return out;
  }
  throw new TypeError("persisted value is not valid JSON");
};

export const stringField = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export const proposalMessage = (result: unknown): string | undefined =>
  stringField(record(record(result)?.proposal)?.message);

export const brandMoveMessage = (result: unknown): string | undefined =>
  stringField(record(record(result)?.brandMove)?.message);
