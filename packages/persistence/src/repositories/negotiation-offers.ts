import { randomUUID } from "node:crypto";
import type { NegotiationTurn } from "@procurement/application/ports";
import {
  domainEvents,
  offerLineFulfillments,
  offerLines,
  offers,
} from "@procurement/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";
import { decodeProposal } from "./negotiation-codecs.js";

export const materializeOffer = async (
  database: ReturnType<DrizzleUnitOfWork["databaseFor"]>,
  brandId: string,
  negotiationId: string,
  turn: NegotiationTurn,
): Promise<void> => {
  const proposal = decodeProposal(turn);
  if (!proposal) return;
  const inserted = await database
    .insert(offers)
    .values({
      id: randomUUID(),
      brandId,
      negotiationId,
      supplierId: proposal.supplierId,
      round: proposal.round,
      currency: proposal.currency,
      leadTimeDays: proposal.leadTimeDays,
      capacityPercent: proposal.capacityPercent,
      paymentSchedule: proposal.paymentSchedule,
      expiresAt: proposal.expiresAt,
      validationResult: {
        valid: true,
        turnKey: turn.key,
        provider: turn.providerMetadata,
      },
    })
    .onConflictDoNothing()
    .returning({ id: offers.id });
  const offer = inserted[0];
  if (!offer) return;
  await database.insert(offerLines).values(
    proposal.lines.map((line) => ({
      id: randomUUID(),
      brandId,
      offerId: offer.id,
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPriceMinor,
    })),
  );

  if (proposal.supplierId === "S2") {
    const capacity = await database
      .select({ id: domainEvents.id })
      .from(domainEvents)
      .where(
        and(
          eq(domainEvents.brandId, brandId),
          eq(domainEvents.aggregateId, negotiationId),
          eq(domainEvents.idempotencyKey, `${negotiationId}:s2-capacity-60`),
        ),
      )
      .limit(1);
    if (capacity[0])
      await materializeS2Fulfillment(database, brandId, negotiationId);
  }
};

export const materializeS2Fulfillment = async (
  database: ReturnType<DrizzleUnitOfWork["databaseFor"]>,
  brandId: string,
  negotiationId: string,
): Promise<void> => {
  const s2Offers = await database
    .select({ id: offers.id })
    .from(offers)
    .where(
      and(
        eq(offers.brandId, brandId),
        eq(offers.negotiationId, negotiationId),
        eq(offers.supplierId, "S2"),
      ),
    );
  if (!s2Offers.length) return;
  const lines = await database
    .select()
    .from(offerLines)
    .where(
      and(
        eq(offerLines.brandId, brandId),
        inArray(
          offerLines.offerId,
          s2Offers.map((offer) => offer.id),
        ),
      ),
    );
  if (lines.length)
    await database
      .insert(offerLineFulfillments)
      .values(
        lines.map((line) => ({
          id: randomUUID(),
          brandId,
          offerLineId: line.id,
          fulfillableQuantity: sql`${line.quantity} * 60 / 100`,
          fullOrderEligible: 0,
        })),
      )
      .onConflictDoNothing();
};
