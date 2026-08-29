import { randomUUID } from "node:crypto";
import type {
  DecisionInputs,
  NegotiationRepository,
} from "@procurement/application/ports";
import {
  negotiations,
  offerLineFulfillments,
  offerLines,
  offers,
  recommendations,
} from "@procurement/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";
import { preShipmentBasisPoints, supplier } from "./negotiation-codecs.js";
import { loadRun } from "./negotiation-lifecycle.js";

export const loadDecisionInputs = async (
  unitOfWork: DrizzleUnitOfWork,
  transaction: Parameters<NegotiationRepository["loadDecisionInputs"]>[0],
  brandId: Parameters<NegotiationRepository["loadDecisionInputs"]>[1],
  negotiationId: string,
): Promise<DecisionInputs | null> => {
  const run = await loadRun(unitOfWork, transaction, brandId, negotiationId);
  if (!run) return null;
  const database = unitOfWork.databaseFor(transaction);
  const negotiation = await database
    .select({ policySnapshot: negotiations.policySnapshot })
    .from(negotiations)
    .where(
      and(
        eq(negotiations.brandId, brandId),
        eq(negotiations.id, negotiationId),
      ),
    )
    .limit(1);
  if (!negotiation[0]) return null;
  const rows = await database
    .select()
    .from(offers)
    .where(
      and(eq(offers.brandId, brandId), eq(offers.negotiationId, negotiationId)),
    )
    .orderBy(desc(offers.round), desc(offers.createdAt), desc(offers.id));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const offer of rows)
    if (!latest.has(offer.supplierId)) latest.set(offer.supplierId, offer);
  const selected = [...latest.values()];
  if (selected.some((offer) => !supplier(offer.supplierId)))
    throw new Error("persisted offer has invalid supplier identity");
  const ids = selected.map((offer) => offer.id);
  const lines = ids.length
    ? await database
        .select()
        .from(offerLines)
        .where(
          and(
            eq(offerLines.brandId, brandId),
            inArray(offerLines.offerId, ids),
          ),
        )
    : [];
  const lineIds = lines.map((line) => line.id);
  const fulfillments = lineIds.length
    ? await database
        .select()
        .from(offerLineFulfillments)
        .where(
          and(
            eq(offerLineFulfillments.brandId, brandId),
            inArray(offerLineFulfillments.offerLineId, lineIds),
          ),
        )
    : [];
  const byLine = new Map(fulfillments.map((item) => [item.offerLineId, item]));
  return {
    negotiation: run,
    baselineMinor: run.lines.reduce(
      (total, line) => total + line.quantity * line.baselineUnitPriceMinor,
      0n,
    ),
    policySnapshot: negotiation[0]
      .policySnapshot as DecisionInputs["policySnapshot"],
    offers: selected.map((offer) => {
      const offerLines = lines.filter((line) => line.offerId === offer.id);
      return {
        id: offer.id,
        supplierId:
          offer.supplierId as DecisionInputs["offers"][number]["supplierId"],
        totalMinor: offerLines.reduce(
          (total, line) => total + line.quantity * line.unitPrice,
          0n,
        ),
        leadTimeDays: offer.leadTimeDays,
        preShipmentBasisPoints: preShipmentBasisPoints(offer.paymentSchedule),
        capacityPercent: offer.capacityPercent,
        fullOrderEligible: offerLines.every(
          (line) => byLine.get(line.id)?.fullOrderEligible !== 0,
        ),
      };
    }),
  };
};

export const saveRecommendation = (
  unitOfWork: DrizzleUnitOfWork,
  transaction: Parameters<NegotiationRepository["saveRecommendation"]>[0],
  brandId: Parameters<NegotiationRepository["saveRecommendation"]>[1],
  negotiationId: string,
  recommendation: Parameters<NegotiationRepository["saveRecommendation"]>[3],
  winnerOfferId: string | null,
  policyVersion: string,
): Promise<void> =>
  unitOfWork
    .databaseFor(transaction)
    .insert(recommendations)
    .values({
      id: randomUUID(),
      brandId,
      negotiationId,
      decisionRecord: recommendation,
      winnerOfferId,
      policyVersion,
    })
    .onConflictDoNothing()
    .then(() => undefined);
