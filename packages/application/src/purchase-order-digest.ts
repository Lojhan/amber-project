import { multiplyMoney } from "@procurement/domain";
import type { PurchaseOrderSnapshot } from "./ports/purchase-order.js";

export const canonicalizeForDigest = (value: unknown): string => {
  if (typeof value === "bigint")
    return JSON.stringify({ $bigint: value.toString() });
  if (value instanceof Date)
    return JSON.stringify({ $date: value.toISOString() });
  if (Array.isArray(value))
    return `[${value.map(canonicalizeForDigest).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${canonicalizeForDigest(item)}`,
      );

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
};

export const purchaseOrderPreviewEvidence = (
  snapshot: PurchaseOrderSnapshot,
): string =>
  canonicalizeForDigest({
    brandId: snapshot.brandId,
    negotiationId: snapshot.negotiationId,
    offer: snapshot.selectedOffer,
    orderIntent: snapshot.orderIntent,
    catalogVersion: snapshot.catalogVersion,
    decisionVersion: snapshot.decisionVersion,
    eligible: snapshot.eligible,
    negotiationState: snapshot.negotiationState,
  });

export const purchaseOrderTotal = (snapshot: PurchaseOrderSnapshot): bigint =>
  snapshot.selectedOffer.lines.reduce(
    (total, line) => total + multiplyMoney(line.unitPrice, line.quantity).minor,
    0n,
  );
