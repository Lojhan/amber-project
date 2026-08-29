import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { entityId } from "./helpers.js";
import { negotiations, offers } from "./negotiation.js";

export const recommendations = pgTable(
  "recommendation",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    negotiationId: uuid("negotiation_id").notNull(),
    decisionRecord: jsonb("decision_record").notNull(),
    winnerOfferId: uuid("winner_offer_id"),
    policyVersion: varchar("policy_version", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("recommendation_brand_id_unique").on(t.brandId, t.id),
    foreignKey({
      columns: [t.brandId, t.negotiationId],
      foreignColumns: [negotiations.brandId, negotiations.id],
      name: "recommendation_brand_negotiation_fk",
    }),
    foreignKey({
      columns: [t.brandId, t.winnerOfferId],
      foreignColumns: [offers.brandId, offers.id],
      name: "recommendation_brand_offer_fk",
    }),
    uniqueIndex("recommendation_negotiation_unique").on(
      t.brandId,
      t.negotiationId,
    ),
  ],
);
export const purchaseOrderCounters = pgTable(
  "purchase_order_counter",
  {
    brandId: uuid("brand_id").primaryKey(),
    nextValue: integer("next_value").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("purchase_order_counter_positive", sql`${t.nextValue} > 0`)],
);
export const purchaseOrders = pgTable(
  "purchase_order",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    number: varchar("number", { length: 64 }).notNull(),
    sourceNegotiationId: uuid("source_negotiation_id").notNull(),
    sourceOfferId: uuid("source_offer_id").notNull(),
    recommendationId: uuid("recommendation_id").notNull(),
    supplierId: varchar("supplier_id", { length: 64 }).notNull(),
    supplierDisplayName: text("supplier_display_name").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    totalMinor: bigint("total_minor", { mode: "bigint" }).notNull(),
    terms: jsonb("terms").notNull(),
    immutableSnapshot: jsonb("immutable_snapshot").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    issuedBy: uuid("issued_by").notNull(),
  },
  (t) => [
    unique("purchase_order_brand_id_unique").on(t.brandId, t.id),
    foreignKey({
      columns: [t.brandId, t.sourceNegotiationId],
      foreignColumns: [negotiations.brandId, negotiations.id],
      name: "purchase_order_brand_negotiation_fk",
    }),
    foreignKey({
      columns: [t.brandId, t.sourceOfferId],
      foreignColumns: [offers.brandId, offers.id],
      name: "purchase_order_brand_offer_fk",
    }),
    foreignKey({
      columns: [t.brandId, t.recommendationId],
      foreignColumns: [recommendations.brandId, recommendations.id],
      name: "purchase_order_brand_recommendation_fk",
    }),
    uniqueIndex("purchase_order_source_offer_unique").on(
      t.brandId,
      t.sourceOfferId,
    ),
    uniqueIndex("purchase_order_brand_idempotency_unique").on(
      t.brandId,
      t.idempotencyKey,
    ),
    uniqueIndex("purchase_order_brand_number_unique").on(t.brandId, t.number),
    check("purchase_order_total_positive", sql`${t.totalMinor} > 0`),
  ],
);
export const purchaseOrderLines = pgTable(
  "purchase_order_line",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    purchaseOrderId: uuid("purchase_order_id").notNull(),
    productSku: varchar("product_sku", { length: 128 }).notNull(),
    productName: text("product_name"),
    quantity: bigint("quantity", { mode: "bigint" }).notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "bigint" }).notNull(),
    extendedTotalMinor: bigint("extended_total_minor", {
      mode: "bigint",
    }).notNull(),
  },
  (t) => [
    uniqueIndex("purchase_order_line_brand_id_unique").on(t.brandId, t.id),
    foreignKey({
      columns: [t.brandId, t.purchaseOrderId],
      foreignColumns: [purchaseOrders.brandId, purchaseOrders.id],
      name: "purchase_order_line_brand_po_fk",
    }),
    check("purchase_order_line_quantity_positive", sql`${t.quantity} > 0`),
    check("purchase_order_line_price_positive", sql`${t.unitPriceMinor} > 0`),
    check(
      "purchase_order_line_total_positive",
      sql`${t.extendedTotalMinor} > 0`,
    ),
  ],
);
