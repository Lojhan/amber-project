import type {
  JsonValue,
  NegotiationTurn,
} from "@procurement/application/ports";

type Proposal = Readonly<{
  supplierId: NegotiationTurn["supplierId"];
  round: 1 | 2;
  currency: string;
  leadTimeDays: number;
  capacityPercent: number;
  expiresAt: Date;
  paymentSchedule: JsonValue;
  lines: readonly Readonly<{
    productId: string;
    quantity: bigint;
    unitPriceMinor: bigint;
  }>[];
}>;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const positiveInteger = (value: unknown): bigint | null =>
  typeof value === "string" && /^\d+$/.test(value) && BigInt(value) > 0n
    ? BigInt(value)
    : null;

const singleCandidateValue = (
  value: unknown,
  key: "quantityCandidates" | "unitPriceCandidates",
): unknown => {
  const candidates = record(value)?.[key];
  if (!Array.isArray(candidates) || candidates.length !== 1) return null;
  return record(candidates[0])?.value;
};

export const commercialQuantity = (value: unknown): bigint | null =>
  positiveInteger(singleCandidateValue(value, "quantityCandidates"));

const moneyMinor = (value: unknown): bigint | null => {
  if (typeof value !== "string") return null;

  const amount = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!amount) return null;

  const minor =
    BigInt(amount[1] ?? "0") * 100n + BigInt((amount[2] ?? "").padEnd(2, "0"));
  return minor > 0n ? minor : null;
};

type PriceTier = Readonly<{ minimumQuantity: bigint; unitPriceMinor: bigint }>;

const priceTiers = (value: unknown): readonly PriceTier[] => {
  const tiers = record(value)?.tiers;
  if (!Array.isArray(tiers)) return [];

  return tiers.flatMap((tier) => {
    const entry = record(tier);
    const minimumQuantity =
      typeof entry?.minimumQuantity === "number" &&
      Number.isSafeInteger(entry.minimumQuantity) &&
      entry.minimumQuantity > 0
        ? BigInt(entry.minimumQuantity)
        : positiveInteger(entry?.minimumQuantity);
    const unitPriceMinor = moneyMinor(record(entry?.unitPrice)?.value);

    return minimumQuantity && unitPriceMinor
      ? [{ minimumQuantity, unitPriceMinor }]
      : [];
  });
};

export const minimumOrderQuantity = (value: unknown): bigint | null => {
  const tiers = priceTiers(value);
  if (tiers.length === 0) return null;

  return tiers.reduce(
    (minimum, tier) =>
      tier.minimumQuantity < minimum ? tier.minimumQuantity : minimum,
    tiers[0]!.minimumQuantity,
  );
};

export const commercialUnitPriceMinor = (
  value: unknown,
  requestedQuantity?: bigint | null,
): bigint | null => {
  if (requestedQuantity) {
    const applicable = priceTiers(value)
      .filter((tier) => tier.minimumQuantity <= requestedQuantity)
      .sort((left, right) =>
        left.minimumQuantity > right.minimumQuantity ? -1 : 1,
      )[0];
    if (priceTiers(value).length > 0) return applicable?.unitPriceMinor ?? null;
  }

  const candidate = singleCandidateValue(value, "unitPriceCandidates");
  if (typeof candidate !== "string") return null;
  return moneyMinor(candidate);
};

export type CommercialReviewReason =
  | "missing_requested_quantity"
  | "no_price_for_requested_quantity"
  | "missing_unit_price"
  | "ambiguous_commercial_fields";

export const commercialReviewReasons = (
  value: unknown,
  requestedQuantityOverride?: bigint | null,
): readonly CommercialReviewReason[] => {
  const quantity = requestedQuantityOverride ?? commercialQuantity(value);
  const reasons: CommercialReviewReason[] = [];

  if (!quantity) reasons.push("missing_requested_quantity");
  if (quantity && !commercialUnitPriceMinor(value, quantity))
    reasons.push("no_price_for_requested_quantity");
  if (!commercialUnitPriceMinor(value) && priceTiers(value).length === 0)
    reasons.push("missing_unit_price");
  if (record(value)?.fieldRoleStatus === "ambiguous")
    reasons.push("ambiguous_commercial_fields");

  return reasons;
};

export const supplier = (
  value: string,
): value is NegotiationTurn["supplierId"] =>
  value === "S1" || value === "S2" || value === "S3";

export const round = (value: number): value is 1 | 2 =>
  value === 1 || value === 2;

export const decodeProposal = (turn: NegotiationTurn): Proposal | null => {
  if (turn.status !== "proposal") return null;
  const proposal = record(record(turn.result)?.proposal);
  const supplierId = proposal?.supplierId;
  const proposalRound = proposal?.round;
  const expiresAt = proposal?.expiresAt;
  const lines = proposal?.lines;
  if (
    typeof supplierId !== "string" ||
    !supplier(supplierId) ||
    typeof proposalRound !== "number" ||
    !round(proposalRound) ||
    typeof proposal?.currency !== "string" ||
    typeof proposal.leadTimeDays !== "number" ||
    !Number.isInteger(proposal.leadTimeDays) ||
    proposal.leadTimeDays <= 0 ||
    typeof proposal.capacityPercent !== "number" ||
    !Number.isInteger(proposal.capacityPercent) ||
    proposal.capacityPercent < 0 ||
    proposal.capacityPercent > 100 ||
    typeof expiresAt !== "string" ||
    Number.isNaN(Date.parse(expiresAt)) ||
    !Array.isArray(proposal.paymentSchedule) ||
    !Array.isArray(lines) ||
    lines.length === 0
  )
    return null;
  const decodedLines = lines.map((line) => {
    const entry = record(line);
    const quantity = positiveInteger(entry?.quantity);
    const unitPriceMinor = positiveInteger(entry?.unitPriceMinor);
    return typeof entry?.productId === "string" && quantity && unitPriceMinor
      ? { productId: entry.productId, quantity, unitPriceMinor }
      : null;
  });
  if (decodedLines.some((line) => !line)) return null;
  return {
    supplierId,
    round: proposalRound,
    currency: proposal.currency,
    leadTimeDays: proposal.leadTimeDays,
    capacityPercent: proposal.capacityPercent,
    expiresAt: new Date(expiresAt),
    paymentSchedule: proposal.paymentSchedule as JsonValue,
    lines: decodedLines as Proposal["lines"],
  };
};

export const preShipmentBasisPoints = (schedule: unknown): number =>
  Array.isArray(schedule)
    ? schedule.reduce((total, installment) => {
        const entry = record(installment);
        return (entry?.milestone === "ORDER" ||
          entry?.milestone === "PRE_SHIPMENT") &&
          typeof entry.percentBasisPoints === "number"
          ? total + entry.percentBasisPoints
          : total;
      }, 0)
    : 0;
