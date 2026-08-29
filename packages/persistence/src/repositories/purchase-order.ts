import { randomUUID } from "node:crypto";
import type {
  PurchaseOrderRecord,
  PurchaseOrderRepository,
} from "@procurement/application/ports";
import {
  negotiations,
  products,
  purchaseOrderCounters,
  purchaseOrderLines,
  purchaseOrders,
} from "@procurement/db/schema";
import { asActorId, asBrandId } from "@procurement/domain";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";
import {
  decodePurchaseOrderSnapshot,
  encodePurchaseOrderSnapshot,
} from "../purchase-order-codec.js";
import { loadPurchaseOrderSnapshot } from "./purchase-order-snapshot.js";

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

export class DrizzlePurchaseOrderRepository implements PurchaseOrderRepository {
  constructor(
    private readonly unitOfWork: DrizzleUnitOfWork,
    private readonly createId: () => string = randomUUID,
  ) {}

  loadIssuableSnapshot(
    transaction: Parameters<PurchaseOrderRepository["loadIssuableSnapshot"]>[0],
    brandId: Parameters<PurchaseOrderRepository["loadIssuableSnapshot"]>[1],
    negotiationId: string,
  ) {
    return loadPurchaseOrderSnapshot(
      this.unitOfWork.databaseFor(transaction),
      brandId,
      negotiationId,
    );
  }

  async findByIdempotency(
    transaction: Parameters<PurchaseOrderRepository["findByIdempotency"]>[0],
    brandId: Parameters<PurchaseOrderRepository["findByIdempotency"]>[1],
    idempotencyKey: string,
  ): Promise<PurchaseOrderRecord | null> {
    const rows = await this.unitOfWork
      .databaseFor(transaction)
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.brandId, brandId),
          eq(purchaseOrders.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    const row = rows[0];

    if (!row) return null;

    const stored = record(row.immutableSnapshot, "purchase-order snapshot");
    const decoded = decodePurchaseOrderSnapshot(
      stored,
      brandId,
      row.sourceNegotiationId,
    );

    return {
      id: row.id,
      brandId: asBrandId(row.brandId),
      number: row.number,
      actorId: asActorId(row.issuedBy),
      idempotencyKey: row.idempotencyKey,
      requestDigest: requiredString(stored.requestDigest, "request digest"),
      previewDigest: requiredString(stored.previewDigest, "preview digest"),
      totalMinor: row.totalMinor,
      snapshot: {
        ...decoded,
        recommendationId: requiredString(
          stored.recommendationId,
          "recommendation id",
        ),
      },
    };
  }

  async nextNumber(
    transaction: Parameters<PurchaseOrderRepository["nextNumber"]>[0],
    brandId: Parameters<PurchaseOrderRepository["nextNumber"]>[1],
  ): Promise<string> {
    const rows = await this.unitOfWork
      .databaseFor(transaction)
      .insert(purchaseOrderCounters)
      .values({ brandId, nextValue: 2 })
      .onConflictDoUpdate({
        target: purchaseOrderCounters.brandId,
        set: {
          nextValue: sql`${purchaseOrderCounters.nextValue} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({
        allocated: sql<number>`${purchaseOrderCounters.nextValue} - 1`,
      });
    const allocated = rows[0]?.allocated;

    if (allocated === undefined)
      throw new Error("purchase-order counter returned no value");

    return `PO-${String(allocated).padStart(7, "0")}`;
  }

  async insert(
    transaction: Parameters<PurchaseOrderRepository["insert"]>[0],
    order: PurchaseOrderRecord,
  ): Promise<boolean> {
    const database = this.unitOfWork.databaseFor(transaction);
    const rows = await database
      .insert(purchaseOrders)
      .values({
        id: order.id,
        brandId: order.brandId,
        number: order.number,
        sourceNegotiationId: order.snapshot.negotiationId,
        sourceOfferId: order.snapshot.selectedOffer.id,
        recommendationId: order.snapshot.recommendationId,
        supplierId: order.snapshot.selectedOffer.supplierId,
        supplierDisplayName: order.snapshot.selectedOffer.supplierId,
        idempotencyKey: order.idempotencyKey,
        currency: order.snapshot.orderIntent.currency,
        totalMinor: order.totalMinor,
        terms: order.snapshot.selectedOffer.paymentSchedule,
        immutableSnapshot: {
          ...encodePurchaseOrderSnapshot(order.snapshot),
          recommendationId: order.snapshot.recommendationId,
          requestDigest: order.requestDigest,
          previewDigest: order.previewDigest,
        },
        issuedBy: order.actorId,
      })
      .onConflictDoNothing({
        target: [purchaseOrders.brandId, purchaseOrders.idempotencyKey],
      })
      .returning({ id: purchaseOrders.id });

    if (rows.length === 0) return false;

    await this.insertLines(database, order);

    return true;
  }

  async markNegotiationCommitted(
    transaction: Parameters<
      PurchaseOrderRepository["markNegotiationCommitted"]
    >[0],
    brandId: Parameters<PurchaseOrderRepository["markNegotiationCommitted"]>[1],
    negotiationId: string,
    expectedState: "RECOMMENDED",
  ): Promise<void> {
    const rows = await this.unitOfWork
      .databaseFor(transaction)
      .update(negotiations)
      .set({
        state: "PO_COMMITTED",
        version: sql`${negotiations.version} + 1`,
      })
      .where(
        and(
          eq(negotiations.brandId, brandId),
          eq(negotiations.id, negotiationId),
          eq(negotiations.state, expectedState),
        ),
      )
      .returning({ id: negotiations.id });

    if (rows.length !== 1)
      throw new Error(
        "negotiation state conflict while issuing purchase order",
      );
  }

  private async insertLines(
    database: ReturnType<DrizzleUnitOfWork["databaseFor"]>,
    order: PurchaseOrderRecord,
  ): Promise<void> {
    const selectedLines = order.snapshot.selectedOffer.lines;
    const productRows = await database
      .select({ id: products.id, sku: products.sku, name: products.name })
      .from(products)
      .where(
        and(
          eq(products.brandId, order.brandId),
          inArray(
            products.id,
            selectedLines.map((line) => line.productId),
          ),
        ),
      );
    const catalog = new Map(
      productRows.map((product) => [product.id, product]),
    );

    if (catalog.size !== selectedLines.length)
      throw new Error(
        "purchase-order line did not resolve to the current brand catalog",
      );

    await database.insert(purchaseOrderLines).values(
      selectedLines.map((line) => {
        const product = catalog.get(line.productId);

        if (!product) throw new Error("purchase-order product is unavailable");

        return {
          id: this.createId(),
          brandId: order.brandId,
          purchaseOrderId: order.id,
          productSku: product.sku,
          productName: product.name,
          quantity: line.quantity,
          unitPriceMinor: line.unitPrice.minor,
          extendedTotalMinor: line.quantity * line.unitPrice.minor,
        };
      }),
    );
  }
}
