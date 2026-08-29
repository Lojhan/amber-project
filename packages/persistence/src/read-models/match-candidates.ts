import type { QuotationView } from "@procurement/application/ports";

type Candidate = QuotationView["matches"][number]["candidates"][number];

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export const matchCandidates = (value: unknown): Candidate[] => {
  const candidates = record(value)?.candidates;
  if (!Array.isArray(candidates)) return [];

  return candidates.flatMap((value) => {
    const candidate = record(value);
    const product = record(candidate?.product);
    const productId = product?.id;
    const sku = product?.sku;
    const name = product?.name;
    const score = candidate?.score;

    if (
      typeof productId !== "string" ||
      typeof sku !== "string" ||
      typeof score !== "number" ||
      score < 0 ||
      score > 1
    )
      return [];

    return [
      {
        productId,
        sku,
        ...(typeof name === "string" ? { name } : {}),
        score,
      },
    ];
  });
};
