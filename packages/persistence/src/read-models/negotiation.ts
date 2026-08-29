import type { NegotiationReadModel } from "@procurement/application/ports";
import type { Database } from "@procurement/db/client";
import {
  domainEvents,
  negotiations,
  negotiationTurns,
  offerLineFulfillments,
  offerLines,
  offers,
} from "@procurement/db/schema";
import type { BrandId } from "@procurement/domain";
import { and, asc, eq, inArray } from "drizzle-orm";
import { brandMoveMessage, proposalMessage } from "./codecs.js";

const timelineFrom = (
  turns: Awaited<ReturnType<Database["select"]>> extends never
    ? never
    : readonly (typeof negotiationTurns.$inferSelect)[],
) =>
  turns.flatMap((turn) => {
    const brandDetail = brandMoveMessage(turn.result);
    const supplierDetail = proposalMessage(turn.result);

    return [
      ...(brandDetail
        ? [
            {
              actor: "brand" as const,
              supplierId: turn.supplierId,
              round: turn.round,
              status: "request",
              detail: brandDetail,
            },
          ]
        : []),
      {
        actor: "supplier" as const,
        supplierId: turn.supplierId,
        round: turn.round,
        status: turn.status,
        ...(supplierDetail ? { detail: supplierDetail } : {}),
      },
    ];
  });

const offersFrom = (
  storedOffers: readonly (typeof offers.$inferSelect)[],
  fulfillments: readonly { offerId: string; eligible: number | null }[],
) =>
  storedOffers.map((offer) => ({
    id: offer.id,
    supplierId: offer.supplierId,
    round: offer.round,
    leadTimeDays: offer.leadTimeDays,
    capacityPercent: offer.capacityPercent,
    fullOrderEligible: fulfillments
      .filter((fulfillment) => fulfillment.offerId === offer.id)
      .every(
        (fulfillment) =>
          fulfillment.eligible === 1 || fulfillment.eligible === null,
      ),
  }));

export class DrizzleNegotiationReadModel implements NegotiationReadModel {
  constructor(private readonly db: Database) {}

  async get(brandId: BrandId, id: string) {
    const n = (
      await this.db
        .select()
        .from(negotiations)
        .where(and(eq(negotiations.brandId, brandId), eq(negotiations.id, id)))
        .limit(1)
    )[0];
    if (!n) return null;
    const [ts, os, ev] = await Promise.all([
      this.db
        .select()
        .from(negotiationTurns)
        .where(
          and(
            eq(negotiationTurns.brandId, brandId),
            eq(negotiationTurns.negotiationId, id),
          ),
        )
        .orderBy(asc(negotiationTurns.createdAt)),
      this.db
        .select()
        .from(offers)
        .where(and(eq(offers.brandId, brandId), eq(offers.negotiationId, id)))
        .orderBy(asc(offers.round), asc(offers.supplierId)),
      this.db
        .select({ id: domainEvents.id })
        .from(domainEvents)
        .where(
          and(
            eq(domainEvents.brandId, brandId),
            eq(domainEvents.aggregateId, id),
            eq(domainEvents.type, "SupplierCapacityChanged"),
          ),
        )
        .limit(1),
    ]);
    const fs = os.length
      ? await this.db
          .select({
            offerId: offerLines.offerId,
            eligible: offerLineFulfillments.fullOrderEligible,
          })
          .from(offerLines)
          .leftJoin(
            offerLineFulfillments,
            and(
              eq(offerLineFulfillments.brandId, offerLines.brandId),
              eq(offerLineFulfillments.offerLineId, offerLines.id),
            ),
          )
          .where(
            and(
              eq(offerLines.brandId, brandId),
              inArray(
                offerLines.offerId,
                os.map((offer) => offer.id),
              ),
            ),
          )
      : [];
    return {
      id,
      status: n.state,
      timeline: timelineFrom(ts),
      reducedCompetition: ev.length > 0,
      offers: offersFrom(os, fs),
    };
  }
}
