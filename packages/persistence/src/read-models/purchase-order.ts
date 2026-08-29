import type {
  PurchaseOrderReadModel,
  PurchaseOrderSummary,
} from "@procurement/application/ports";
import type { Database } from "@procurement/db/client";
import {
  auditLogs,
  purchaseOrderLines,
  purchaseOrders,
} from "@procurement/db/schema";
import type { BrandId } from "@procurement/domain";
import { and, asc, desc, eq } from "drizzle-orm";
import { decodePurchaseOrderSnapshot } from "../purchase-order-codec.js";

type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;

const summary = (row: PurchaseOrderRow): PurchaseOrderSummary => ({
  id: row.id,
  number: row.number,
  negotiationId: row.sourceNegotiationId,
  supplierId: row.supplierId,
  totalMinor: row.totalMinor.toString(),
  currency: row.currency,
  issuedAt: row.issuedAt.toISOString(),
  status: "ISSUED",
});

export class DrizzlePurchaseOrderReadModel implements PurchaseOrderReadModel {
  constructor(private readonly db: Database) {}

  async list(brandId: BrandId) {
    const rows = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.brandId, brandId))
      .orderBy(desc(purchaseOrders.issuedAt), desc(purchaseOrders.id));
    return rows.map(summary);
  }

  async get(brandId: BrandId, id: string) {
    const r = (
      await this.db
        .select()
        .from(purchaseOrders)
        .where(
          and(eq(purchaseOrders.brandId, brandId), eq(purchaseOrders.id, id)),
        )
        .limit(1)
    )[0];
    if (!r) return null;
    const snapshot = decodePurchaseOrderSnapshot(
      r.immutableSnapshot,
      brandId,
      r.sourceNegotiationId,
      "PO_COMMITTED",
    );
    const [ls, as] = await Promise.all([
      this.db
        .select()
        .from(purchaseOrderLines)
        .where(
          and(
            eq(purchaseOrderLines.brandId, brandId),
            eq(purchaseOrderLines.purchaseOrderId, id),
          ),
        )
        .orderBy(asc(purchaseOrderLines.id)),
      this.db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.brandId, brandId), eq(auditLogs.subjectId, id)))
        .orderBy(asc(auditLogs.createdAt)),
    ]);
    return {
      ...summary(r),
      supplierId: r.supplierId,
      leadTimeDays: snapshot.selectedOffer.leadTimeDays,
      paymentSchedule: snapshot.selectedOffer.paymentSchedule,
      issuedBy: r.issuedBy,
      lines: ls.map((l) => ({
        sku: l.productSku,
        name: l.productName,
        quantity: l.quantity.toString(),
        unitPriceMinor: l.unitPriceMinor.toString(),
        extendedTotalMinor: l.extendedTotalMinor.toString(),
      })),
      audit: as.map((entry) => ({
        type: entry.action,
        actorId: entry.actorId,
        at: entry.createdAt.toISOString(),
      })),
    };
  }
}
