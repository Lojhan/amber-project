import type { PurchaseOrderSnapshot } from "@procurement/application/ports";
import type { DatabaseTransaction } from "@procurement/db";
import {
  negotiations,
  offerLineFulfillments,
  offerLines,
  offers,
  orderIntentLines,
  orderIntents,
  quotations,
  recommendations,
} from "@procurement/db/schema";
import type { BrandId } from "@procurement/domain";
import { and, eq, inArray } from "drizzle-orm";
import { decodePurchaseOrderSnapshot } from "../purchase-order-codec.js";

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`invalid persisted ${label}`);

  return value as Record<string, unknown>;
};

const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`invalid persisted ${label}`);

  return value;
};

const headerFor = async (
  database: DatabaseTransaction,
  brandId: BrandId,
  negotiationId: string,
) => {
  const rows = await database
    .select({
      negotiationState: negotiations.state,
      quotationId: negotiations.quotationId,
      catalogVersion: quotations.catalogVersion,
      orderIntentId: negotiations.orderIntentId,
      currency: orderIntents.currency,
      recommendationId: recommendations.id,
      decisionRecord: recommendations.decisionRecord,
      offerId: offers.id,
      supplierId: offers.supplierId,
      offerCurrency: offers.currency,
      leadTimeDays: offers.leadTimeDays,
      capacityPercent: offers.capacityPercent,
      expiresAt: offers.expiresAt,
      paymentSchedule: offers.paymentSchedule,
      validationResult: offers.validationResult,
    })
    .from(negotiations)
    .innerJoin(
      quotations,
      and(
        eq(quotations.brandId, negotiations.brandId),
        eq(quotations.id, negotiations.quotationId),
      ),
    )
    .innerJoin(
      orderIntents,
      and(
        eq(orderIntents.brandId, negotiations.brandId),
        eq(orderIntents.id, negotiations.orderIntentId),
      ),
    )
    .innerJoin(
      recommendations,
      and(
        eq(recommendations.brandId, negotiations.brandId),
        eq(recommendations.negotiationId, negotiations.id),
      ),
    )
    .innerJoin(
      offers,
      and(
        eq(offers.brandId, recommendations.brandId),
        eq(offers.id, recommendations.winnerOfferId),
      ),
    )
    .where(
      and(
        eq(negotiations.brandId, brandId),
        eq(negotiations.id, negotiationId),
      ),
    )
    .for("update")
    .limit(1);

  return rows[0] ?? null;
};

const commercialRows = async (
  database: DatabaseTransaction,
  brandId: BrandId,
  orderIntentId: string,
  offerId: string,
) => {
  const [intent, offer] = await Promise.all([
    database
      .select({
        productId: orderIntentLines.productId,
        quantity: orderIntentLines.quantity,
        unitPrice: orderIntentLines.baselineUnitPrice,
      })
      .from(orderIntentLines)
      .where(
        and(
          eq(orderIntentLines.brandId, brandId),
          eq(orderIntentLines.orderIntentId, orderIntentId),
        ),
      )
      .orderBy(orderIntentLines.productId),
    database
      .select({
        id: offerLines.id,
        productId: offerLines.productId,
        quantity: offerLines.quantity,
        unitPrice: offerLines.unitPrice,
      })
      .from(offerLines)
      .where(
        and(eq(offerLines.brandId, brandId), eq(offerLines.offerId, offerId)),
      )
      .orderBy(offerLines.productId),
  ]);

  if (intent.length === 0 || offer.length === 0)
    throw new Error("purchase-order commercial snapshot is incomplete");

  return { intent, offer };
};

type Header = NonNullable<Awaited<ReturnType<typeof headerFor>>>;
type Commercial = Awaited<ReturnType<typeof commercialRows>>;

const decodeSnapshot = (
  header: Header,
  commercial: Commercial,
  brandId: BrandId,
  negotiationId: string,
  eligible: boolean,
): PurchaseOrderSnapshot => {
  const decision = record(header.decisionRecord, "decision record");
  const validation = record(header.validationResult, "offer validation");
  const snapshot = decodePurchaseOrderSnapshot(
    {
      brandId,
      negotiationId,
      recommendationId: header.recommendationId,
      catalogVersion: header.catalogVersion,
      decisionVersion: requiredString(
        decision.decisionVersion,
        "decision version",
      ),
      eligible,
      orderIntent: {
        quotationId: header.quotationId,
        currency: header.currency,
        lines: commercial.intent.map((line) => ({
          productId: line.productId,
          quantity: line.quantity.toString(),
          baselineUnitPriceMinor: line.unitPrice.toString(),
        })),
      },
      selectedOffer: {
        id: header.offerId,
        supplierId: header.supplierId,
        currency: header.offerCurrency,
        leadTimeDays: header.leadTimeDays,
        capacityPercent: header.capacityPercent,
        expiresAt: header.expiresAt.toISOString(),
        paymentSchedule: header.paymentSchedule,
        policyValid: validation.valid === true,
        lines: commercial.offer.map((line) => ({
          productId: line.productId,
          quantity: line.quantity.toString(),
          unitPriceMinor: line.unitPrice.toString(),
        })),
      },
    },
    brandId,
    negotiationId,
    header.negotiationState,
  );

  return snapshot;
};

export const loadPurchaseOrderSnapshot = async (
  database: DatabaseTransaction,
  brandId: BrandId,
  negotiationId: string,
): Promise<PurchaseOrderSnapshot | null> => {
  const header = await headerFor(database, brandId, negotiationId);

  if (!header) return null;

  const commercial = await commercialRows(
    database,
    brandId,
    header.orderIntentId,
    header.offerId,
  );
  const fulfillment = await database
    .select({ eligible: offerLineFulfillments.fullOrderEligible })
    .from(offerLineFulfillments)
    .where(
      and(
        eq(offerLineFulfillments.brandId, brandId),
        inArray(
          offerLineFulfillments.offerLineId,
          commercial.offer.map((line) => line.id),
        ),
      ),
    );

  return decodeSnapshot(
    header,
    commercial,
    brandId,
    negotiationId,
    fulfillment.every((item) => item.eligible === 1),
  );
};
