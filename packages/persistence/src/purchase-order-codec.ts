import type { PurchaseOrderSnapshot } from "@procurement/application";
import {
  asBrandId,
  asOfferId,
  asProductId,
  asQuotationId,
  money,
  type Offer,
  type OrderIntent,
  type PaymentMilestone,
  validateOfferCommercialFacts,
  validateOrderIntent,
  validatePaymentSchedule,
} from "@procurement/domain";

const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("persisted snapshot must be an object");
  return v as Record<string, unknown>;
};
const string = (v: unknown, name: string): string => {
  if (typeof v !== "string" || !v) throw new Error(`invalid persisted ${name}`);
  return v;
};
const bigintValue = (v: unknown, name: string): bigint => {
  const n = BigInt(string(v, name));
  if (n <= 0n) throw new Error(`persisted ${name} must be positive`);
  return n;
};
const decodeSchedule = (v: unknown) => {
  if (!Array.isArray(v) || v.length === 0)
    throw new Error("invalid payment schedule");
  const schedule = v.map((item) => {
    const x = object(item);
    const milestone = string(x.milestone, "milestone");

    if (
      !["ORDER", "PRE_SHIPMENT", "DELIVERY"].includes(milestone) ||
      !Number.isInteger(x.percentBasisPoints)
    )
      throw new Error("invalid payment installment");
    return {
      milestone: milestone as PaymentMilestone,
      percentBasisPoints: x.percentBasisPoints as number,
    };
  });
  validatePaymentSchedule(schedule);
  return schedule;
};

export const encodePurchaseOrderSnapshot = (
  snapshot: PurchaseOrderSnapshot,
) => ({
  brandId: snapshot.brandId,
  negotiationId: snapshot.negotiationId,
  recommendationId: snapshot.recommendationId,
  catalogVersion: snapshot.catalogVersion,
  decisionVersion: snapshot.decisionVersion,
  eligible: snapshot.eligible,
  negotiationState: snapshot.negotiationState,
  orderIntent: {
    quotationId: snapshot.orderIntent.quotationId,
    currency: snapshot.orderIntent.currency,
    lines: snapshot.orderIntent.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity.toString(),
      baselineUnitPriceMinor: line.baselineUnitPrice.minor.toString(),
    })),
  },
  selectedOffer: {
    id: snapshot.selectedOffer.id,
    supplierId: snapshot.selectedOffer.supplierId,
    currency: snapshot.selectedOffer.currency,
    leadTimeDays: snapshot.selectedOffer.leadTimeDays,
    capacityPercent: snapshot.selectedOffer.capacityPercent,
    expiresAt: snapshot.selectedOffer.expiresAt.toISOString(),
    policyValid: snapshot.selectedOffer.policyValid,
    lines: snapshot.selectedOffer.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity.toString(),
      unitPriceMinor: line.unitPrice.minor.toString(),
    })),
    paymentSchedule: snapshot.selectedOffer.paymentSchedule,
  },
});

export const decodePurchaseOrderSnapshot = (
  value: unknown,
  brandId: string,
  negotiationId: string,
  negotiationState = "RECOMMENDED",
): PurchaseOrderSnapshot => {
  const root = object(value);
  if (
    (root.brandId !== undefined && root.brandId !== brandId) ||
    (root.negotiationId !== undefined && root.negotiationId !== negotiationId)
  )
    throw new Error("persisted snapshot identity mismatch");
  const intent = object(root.orderIntent);
  const currency = string(
    intent.currency,
    "currency",
  ) as OrderIntent["currency"];

  if (!["USD", "EUR", "BRL"].includes(currency))
    throw new Error("invalid persisted currency");
  const lines = intent.lines;
  if (!Array.isArray(lines) || lines.length === 0)
    throw new Error("persisted order lines are incomplete");
  const orderIntent: OrderIntent = {
    quotationId: asQuotationId(string(intent.quotationId, "quotationId")),
    brandId: asBrandId(brandId),
    currency,
    lines: lines.map((v) => {
      const l = object(v);
      return {
        productId: asProductId(string(l.productId, "productId")),
        quantity: bigintValue(l.quantity, "quantity"),
        baselineUnitPrice: money(
          currency,
          bigintValue(l.baselineUnitPriceMinor, "baselineUnitPriceMinor"),
        ),
      };
    }),
  };
  const offer = object(root.selectedOffer);
  const expiresAt = new Date(string(offer.expiresAt, "expiresAt"));

  if (Number.isNaN(expiresAt.getTime()))
    throw new Error("invalid persisted expiry");
  const selectedOffer = {
    ...offer,
    id: asOfferId(string(offer.id, "offer id")),
    supplierId: string(offer.supplierId, "supplierId") as Offer["supplierId"],
    currency,
    leadTimeDays: Number(offer.leadTimeDays),
    capacityPercent: Number(offer.capacityPercent),
    expiresAt,
    lines: Array.isArray(offer.lines)
      ? offer.lines.map((v) => {
          const l = object(v);
          return {
            productId: asProductId(string(l.productId, "productId")),
            quantity: bigintValue(l.quantity, "quantity"),
            unitPrice: money(
              currency,
              bigintValue(l.unitPriceMinor, "unitPriceMinor"),
            ),
          };
        })
      : [],
    paymentSchedule: Array.isArray(offer.paymentSchedule)
      ? decodeSchedule(offer.paymentSchedule)
      : decodeSchedule(offer.paymentSchedule),
    policyValid: offer.policyValid === true,
  } as Offer;
  if (!["S1", "S2", "S3"].includes(selectedOffer.supplierId))
    throw new Error("invalid persisted supplier");
  if (
    !Number.isFinite(selectedOffer.leadTimeDays) ||
    !Number.isFinite(selectedOffer.capacityPercent)
  )
    throw new Error("invalid persisted offer numbers");
  validateOrderIntent(orderIntent);
  validateOfferCommercialFacts(selectedOffer, orderIntent, new Date(0));

  return {
    brandId: asBrandId(brandId),
    negotiationId,
    recommendationId: string(root.recommendationId, "recommendationId"),
    selectedOffer,
    orderIntent,
    catalogVersion: string(root.catalogVersion, "catalogVersion"),
    decisionVersion: string(root.decisionVersion, "decisionVersion"),
    eligible: root.eligible === true,
    negotiationState,
  };
};

export const decodePersistedPurchaseOrder = (
  row: {
    id: string;
    number: string;
    issued_by: string;
    idempotency_key: string;
    total_minor: bigint;
    immutable_snapshot: unknown;
  },
  brandId: string,
) => {
  const root = object(row.immutable_snapshot);
  const requestDigest = string(root.requestDigest, "requestDigest");
  const previewDigest = string(root.previewDigest, "previewDigest");
  const snapshot = decodePurchaseOrderSnapshot(
    root,
    brandId,
    string(root.negotiationId, "negotiationId"),
  );
  return {
    id: row.id,
    brandId: snapshot.brandId,
    number: row.number,
    actorId: row.issued_by,
    idempotencyKey: row.idempotency_key,
    totalMinor: row.total_minor,
    requestDigest,
    previewDigest,
    snapshot,
  };
};
