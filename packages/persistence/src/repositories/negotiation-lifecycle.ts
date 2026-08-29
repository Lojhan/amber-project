import { randomUUID } from "node:crypto";
import type {
  NegotiationRepository,
  NegotiationRun,
  NegotiationTurn,
} from "@procurement/application/ports";
import {
  domainEvents,
  negotiations,
  negotiationTurns,
  orderIntentLines,
  orderIntents,
  projectionEvents,
} from "@procurement/db/schema";
import { asBrandId } from "@procurement/domain";
import { and, asc, eq, sql } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";
import { round, supplier } from "./negotiation-codecs.js";
import {
  materializeOffer,
  materializeS2Fulfillment,
} from "./negotiation-offers.js";

export const createOrderIntent = async (
  unitOfWork: DrizzleUnitOfWork,
  transaction: Parameters<NegotiationRepository["createOrderIntent"]>[0],
  intent: Parameters<NegotiationRepository["createOrderIntent"]>[1],
) => {
  const database = unitOfWork.databaseFor(transaction);
  await database.insert(orderIntents).values({
    id: intent.id,
    brandId: intent.brandId,
    quotationId: intent.quotationId,
    scenarioId: intent.scenarioId,
    currency: intent.currency,
    assumptions: { source: "selected-scenario" },
  });

  if (intent.lines.length)
    await database.insert(orderIntentLines).values(
      intent.lines.map((line) => ({
        id: randomUUID(),
        brandId: intent.brandId,
        orderIntentId: intent.id,
        productId: line.productId,
        quantity: line.quantity,
        baselineUnitPrice: line.baselineUnitPriceMinor,
        sourceTierEvidence: { source: "parsed-quotation" },
      })),
    );
};

export const createNegotiation = (
  unitOfWork: DrizzleUnitOfWork,
  transaction: Parameters<NegotiationRepository["create"]>[0],
  negotiation: Parameters<NegotiationRepository["create"]>[1],
) =>
  unitOfWork
    .databaseFor(transaction)
    .insert(negotiations)
    .values(negotiation)
    .then(() => undefined);

export const loadRun = async (
  unitOfWork: DrizzleUnitOfWork,
  transaction: Parameters<NegotiationRepository["loadRun"]>[0],
  brandId: Parameters<NegotiationRepository["loadRun"]>[1],
  negotiationId: string,
): Promise<NegotiationRun | null> => {
  const database = unitOfWork.databaseFor(transaction);
  const rows = await database
    .select({
      id: negotiations.id,
      brandId: negotiations.brandId,
      quotationId: negotiations.quotationId,
      orderIntentId: negotiations.orderIntentId,
      state: negotiations.state,
      version: negotiations.version,
      currency: orderIntents.currency,
      policySnapshot: negotiations.policySnapshot,
    })
    .from(negotiations)
    .innerJoin(
      orderIntents,
      and(
        eq(orderIntents.brandId, negotiations.brandId),
        eq(orderIntents.id, negotiations.orderIntentId),
      ),
    )
    .where(
      and(
        eq(negotiations.brandId, brandId),
        eq(negotiations.id, negotiationId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const lines = await database
    .select({
      productId: orderIntentLines.productId,
      quantity: orderIntentLines.quantity,
      baselineUnitPriceMinor: orderIntentLines.baselineUnitPrice,
    })
    .from(orderIntentLines)
    .where(
      and(
        eq(orderIntentLines.brandId, brandId),
        eq(orderIntentLines.orderIntentId, row.orderIntentId),
      ),
    )
    .orderBy(asc(orderIntentLines.productId));
  return {
    id: row.id,
    brandId: asBrandId(row.brandId),
    quotationId: row.quotationId,
    state: row.state,
    version: row.version,
    currency: row.currency,
    policySnapshot: row.policySnapshot as NegotiationRun["policySnapshot"],
    lines,
  };
};

export const listTurns = async (
  unitOfWork: DrizzleUnitOfWork,
  transaction: Parameters<NegotiationRepository["listTurns"]>[0],
  brandId: Parameters<NegotiationRepository["listTurns"]>[1],
  negotiationId: string,
): Promise<readonly NegotiationTurn[]> => {
  const rows = await unitOfWork
    .databaseFor(transaction)
    .select({
      key: negotiationTurns.turnKey,
      supplierId: negotiationTurns.supplierId,
      round: negotiationTurns.round,
      status: negotiationTurns.status,
      result: negotiationTurns.result,
      providerMetadata: negotiationTurns.providerMetadata,
    })
    .from(negotiationTurns)
    .where(
      and(
        eq(negotiationTurns.brandId, brandId),
        eq(negotiationTurns.negotiationId, negotiationId),
      ),
    )
    .orderBy(asc(negotiationTurns.createdAt), asc(negotiationTurns.supplierId));
  return rows.map((row) => {
    if (!supplier(row.supplierId) || !round(row.round))
      throw new Error("persisted negotiation turn has invalid identity");
    return {
      ...row,
      supplierId: row.supplierId,
      round: row.round,
      result: row.result as NegotiationTurn["result"],
      providerMetadata:
        row.providerMetadata as NegotiationTurn["providerMetadata"],
    };
  });
};

export const appendTurn = async (
  unitOfWork: DrizzleUnitOfWork,
  transaction: Parameters<NegotiationRepository["appendTurn"]>[0],
  brandId: Parameters<NegotiationRepository["appendTurn"]>[1],
  negotiationId: string,
  turn: NegotiationTurn,
): Promise<boolean> => {
  const database = unitOfWork.databaseFor(transaction);
  const exists = await database
    .select({ id: negotiations.id })
    .from(negotiations)
    .where(
      and(
        eq(negotiations.brandId, brandId),
        eq(negotiations.id, negotiationId),
      ),
    )
    .limit(1);
  if (!exists[0]) return false;
  const inserted = await database
    .insert(negotiationTurns)
    .values({
      id: randomUUID(),
      brandId,
      negotiationId,
      supplierId: turn.supplierId,
      round: turn.round,
      turnKey: turn.key,
      status: turn.status,
      result: turn.result,
      providerMetadata: turn.providerMetadata,
    })
    .onConflictDoNothing()
    .returning({ id: negotiationTurns.id });
  if (!inserted[0]) return false;
  const recordedEvents = await database
    .insert(domainEvents)
    .values({
      id: randomUUID(),
      brandId,
      aggregateType: "negotiation",
      aggregateId: negotiationId,
      type: turn.status === "proposal" ? "OfferSubmitted" : "OfferRejected",
      schemaVersion: "1",
      payload: {
        supplierId: turn.supplierId,
        round: turn.round,
        status: turn.status,
        metadata: turn.providerMetadata,
      },
      idempotencyKey: `${negotiationId}:turn:${turn.supplierId}:${turn.round}`,
    })
    .onConflictDoNothing()
    .returning({ id: domainEvents.id });

  if (recordedEvents[0])
    await database.insert(projectionEvents).values({
      brandId,
      domainEventId: recordedEvents[0].id,
      eventType:
        turn.status === "proposal" ? "OfferSubmitted" : "OfferRejected",
      payload: {
        supplierId: turn.supplierId,
        round: turn.round,
        status: turn.status,
      },
    });

  await materializeOffer(database, brandId, negotiationId, turn);

  return true;
};

export const applyCapacityEvent = async (
  unitOfWork: DrizzleUnitOfWork,
  transaction: Parameters<NegotiationRepository["applyCapacityEvent"]>[0],
  brandId: Parameters<NegotiationRepository["applyCapacityEvent"]>[1],
  negotiationId: string,
  event: Parameters<NegotiationRepository["applyCapacityEvent"]>[3],
): Promise<boolean> => {
  const database = unitOfWork.databaseFor(transaction);
  const inserted = await database
    .insert(domainEvents)
    .values({
      id: randomUUID(),
      brandId,
      aggregateType: "negotiation",
      aggregateId: negotiationId,
      type: "SupplierCapacityChanged",
      schemaVersion: "1",
      payload: {
        supplierId: event.supplierId,
        from: event.fromPercent,
        to: event.toPercent,
      },
      idempotencyKey: `${negotiationId}:s2-capacity-60`,
    })
    .onConflictDoNothing()
    .returning({ id: domainEvents.id });

  if (!inserted[0]) return false;

  await database.insert(projectionEvents).values({
    brandId,
    domainEventId: inserted[0].id,
    eventType: "SupplierCapacityChanged",
    payload: {
      supplierId: event.supplierId,
      from: event.fromPercent,
      to: event.toPercent,
    },
  });

  await materializeS2Fulfillment(database, brandId, negotiationId);

  return true;
};

export const transition = async (
  unitOfWork: DrizzleUnitOfWork,
  transaction: Parameters<NegotiationRepository["transition"]>[0],
  input: Parameters<NegotiationRepository["transition"]>[1],
): Promise<boolean> =>
  Boolean(
    (
      await unitOfWork
        .databaseFor(transaction)
        .update(negotiations)
        .set({
          state: input.nextState,
          version: sql`${negotiations.version} + 1`,
        })
        .where(
          and(
            eq(negotiations.brandId, input.brandId),
            eq(negotiations.id, input.id),
            eq(negotiations.state, input.expectedState),
            eq(negotiations.version, input.expectedVersion),
          ),
        )
        .returning({ id: negotiations.id })
    )[0],
  );
