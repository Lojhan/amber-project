import type { QuoteCopilotSuggestion } from "@procurement/application/ports";

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const copy = (value: Record<string, unknown>) =>
  typeof value.title === "string" && typeof value.explanation === "string"
    ? { title: value.title, explanation: value.explanation }
    : null;

const suggestion = (value: unknown): QuoteCopilotSuggestion | null => {
  const item = record(value);
  if (!item) return null;
  const shared = copy(item);
  if (!shared || typeof item.kind !== "string") return null;

  if (item.kind === "select_scenario" && typeof item.scenarioId === "string")
    return { ...shared, kind: item.kind, scenarioId: item.scenarioId };
  if (item.kind === "exclude_line" && typeof item.matchId === "string")
    return { ...shared, kind: item.kind, matchId: item.matchId };
  if (
    item.kind === "include_line" &&
    typeof item.matchId === "string" &&
    typeof item.productId === "string"
  )
    return {
      ...shared,
      kind: item.kind,
      matchId: item.matchId,
      productId: item.productId,
    };
  if (
    item.kind === "set_quantity" &&
    typeof item.lineId === "string" &&
    typeof item.quantity === "string"
  )
    return {
      ...shared,
      kind: item.kind,
      lineId: item.lineId,
      quantity: item.quantity,
    };

  return null;
};

export const decodeCopilotSuggestions = (
  value: unknown,
): readonly QuoteCopilotSuggestion[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const decoded = suggestion(item);
        return decoded ? [decoded] : [];
      })
    : [];
