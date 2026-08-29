import type {
  BrandNegotiationResult,
  JsonValue,
  NegotiationConversationEntry,
  NegotiationTurn,
  SupplierProposalResult,
} from "./ports/index.js";

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const string = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const number = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const proposalTotal = (
  proposal: Record<string, unknown>,
): string | undefined => {
  if (!Array.isArray(proposal.lines)) return undefined;

  try {
    return proposal.lines
      .reduce((total, value) => {
        const line = record(value);
        const quantity = string(line?.quantity);
        const unitPrice = string(line?.unitPriceMinor);

        return quantity && unitPrice
          ? total + BigInt(quantity) * BigInt(unitPrice)
          : total;
      }, 0n)
      .toString();
  } catch {
    return undefined;
  }
};

const preShipmentBasisPoints = (proposal: Record<string, unknown>) =>
  Array.isArray(proposal.paymentSchedule)
    ? proposal.paymentSchedule.reduce((total, value) => {
        const installment = record(value);
        const milestone = string(installment?.milestone);
        const basisPoints = number(installment?.percentBasisPoints);

        return milestone !== "DELIVERY" && basisPoints
          ? total + basisPoints
          : total;
      }, 0)
    : undefined;

const commercialTerms = (proposal: Record<string, unknown>) => {
  const totalMinor = proposalTotal(proposal);
  const leadTimeDays = number(proposal.leadTimeDays);
  const capacityPercent = number(proposal.capacityPercent);
  const preShipment = preShipmentBasisPoints(proposal);

  return {
    ...(totalMinor ? { totalMinor } : {}),
    ...(leadTimeDays !== undefined ? { leadTimeDays } : {}),
    ...(capacityPercent !== undefined ? { capacityPercent } : {}),
    ...(preShipment !== undefined
      ? { preShipmentBasisPoints: preShipment }
      : {}),
  };
};

const conversationFromTurn = (
  turn: NegotiationTurn,
): readonly NegotiationConversationEntry[] => {
  const result = record(turn.result);
  const proposal = record(result?.proposal);
  const brandMessage = string(record(result?.brandMove)?.message);
  const supplierMessage = string(proposal?.message);

  if (!brandMessage && !supplierMessage) return [];

  return [
    {
      supplierId: turn.supplierId,
      round: turn.round,
      ...(brandMessage ? { brandMessage } : {}),
      ...(supplierMessage ? { supplierMessage } : {}),
      ...(proposal ? { commercialTerms: commercialTerms(proposal) } : {}),
    },
  ];
};

export const conversationFromTurns = (
  turns: readonly NegotiationTurn[],
): readonly NegotiationConversationEntry[] =>
  turns.flatMap(conversationFromTurn);

const jsonRecord = (value: JsonValue): Readonly<Record<string, JsonValue>> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, JsonValue>>)
    : {};

export const negotiationTurnResult = (
  brand: BrandNegotiationResult,
  supplier: SupplierProposalResult,
): JsonValue => ({
  ...jsonRecord(supplier.result),
  brandMove: brand.move,
});

export const negotiationProviderMetadata = (
  brand: BrandNegotiationResult,
  supplier: SupplierProposalResult,
): JsonValue => ({
  brand: brand.metadata,
  supplier: supplier.metadata,
});
