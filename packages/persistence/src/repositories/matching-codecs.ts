import type { MatchResolution } from "@procurement/application/ports";

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const candidateField = (
  candidates: unknown,
  name: string,
): string | undefined => {
  const detail = asRecord(asRecord(candidates)[name]);
  return typeof detail.value === "string" ? detail.value : undefined;
};

export const selectedProductId = (
  resolution: MatchResolution,
  candidates: unknown,
): string | undefined => {
  if (resolution.action === "exclude") return undefined;
  if (resolution.selectedProductId) return resolution.selectedProductId;
  const list = asRecord(candidates).candidates;
  const productId = asRecord(
    Array.isArray(list) ? asRecord(list[0]).product : undefined,
  ).id;
  return typeof productId === "string" ? productId : undefined;
};
