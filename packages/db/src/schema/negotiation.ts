import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { products } from "./brand-catalog.js";
import { negotiationState } from "./enums.js";
import { entityId } from "./helpers.js";
import { orderIntents, quotations } from "./quotation.js";

export const negotiations = pgTable(
  "negotiation",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    quotationId: uuid("quotation_id").notNull(),
    orderIntentId: uuid("order_intent_id").notNull(),
    state: negotiationState("state").notNull(),
    policyVersion: varchar("policy_version", { length: 64 }).notNull(),
    policySnapshot: jsonb("policy_snapshot").notNull(),
    modelSnapshot: jsonb("model_snapshot").notNull(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("negotiation_brand_id_unique").on(t.brandId, t.id),
    foreignKey({
      columns: [t.brandId, t.quotationId],
      foreignColumns: [quotations.brandId, quotations.id],
      name: "negotiation_brand_quotation_fk",
    }),
    foreignKey({
      columns: [t.brandId, t.orderIntentId],
      foreignColumns: [orderIntents.brandId, orderIntents.id],
      name: "negotiation_brand_order_intent_fk",
    }),
    check("negotiation_version_positive", sql`${t.version} > 0`),
  ],
);
export const offers = pgTable(
  "offer",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    negotiationId: uuid("negotiation_id").notNull(),
    supplierId: varchar("supplier_id", { length: 16 }).notNull(),
    round: integer("round").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    leadTimeDays: integer("lead_time_days").notNull(),
    capacityPercent: integer("capacity_percent").notNull(),
    paymentSchedule: jsonb("payment_schedule").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    validationResult: jsonb("validation_result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("offer_brand_id_unique").on(t.brandId, t.id),
    foreignKey({
      columns: [t.brandId, t.negotiationId],
      foreignColumns: [negotiations.brandId, negotiations.id],
      name: "offer_brand_negotiation_fk",
    }),
    uniqueIndex("offer_supplier_round_unique").on(
      t.brandId,
      t.negotiationId,
      t.supplierId,
      t.round,
    ),
    check("offer_round_positive", sql`${t.round} > 0`),
    check("offer_lead_time_positive", sql`${t.leadTimeDays} > 0`),
    check(
      "offer_capacity_percent_valid",
      sql`${t.capacityPercent} between 1 and 100`,
    ),
    check("offer_supplier_nonempty", sql`length(${t.supplierId}) > 0`),
  ],
);

export const negotiationTurns = pgTable(
  "negotiation_turn",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    negotiationId: uuid("negotiation_id").notNull(),
    supplierId: varchar("supplier_id", { length: 16 }).notNull(),
    round: integer("round").notNull(),
    turnKey: varchar("turn_key", { length: 96 }).notNull(),
    status: varchar("status", { length: 24 }).notNull(),
    result: jsonb("result").notNull(),
    providerMetadata: jsonb("provider_metadata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.brandId, t.negotiationId],
      foreignColumns: [negotiations.brandId, negotiations.id],
      name: "negotiation_turn_brand_negotiation_fk",
    }),
    uniqueIndex("negotiation_turn_key_unique").on(
      t.brandId,
      t.negotiationId,
      t.turnKey,
    ),
    check("negotiation_turn_round_valid", sql`${t.round} in (1, 2)`),
  ],
);
export const offerLines = pgTable(
  "offer_line",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    offerId: uuid("offer_id").notNull(),
    productId: uuid("product_id").notNull(),
    quantity: bigint("quantity", { mode: "bigint" }).notNull(),
    unitPrice: bigint("unit_price_minor", { mode: "bigint" }).notNull(),
  },
  (t) => [
    unique("offer_line_brand_id_unique").on(t.brandId, t.id),
    foreignKey({
      columns: [t.brandId, t.offerId],
      foreignColumns: [offers.brandId, offers.id],
      name: "offer_line_brand_offer_fk",
    }),
    foreignKey({
      columns: [t.brandId, t.productId],
      foreignColumns: [products.brandId, products.id],
      name: "offer_line_brand_product_fk",
    }),
    uniqueIndex("offer_line_product_unique").on(
      t.brandId,
      t.offerId,
      t.productId,
    ),
    check("offer_line_quantity_positive", sql`${t.quantity} > 0`),
    check("offer_line_price_positive", sql`${t.unitPrice} > 0`),
  ],
);
export const offerLineFulfillments = pgTable(
  "offer_line_fulfillment",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    offerLineId: uuid("offer_line_id").notNull(),
    fulfillableQuantity: bigint("fulfillable_quantity", {
      mode: "bigint",
    }).notNull(),
    fullOrderEligible: integer("full_order_eligible").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.brandId, t.offerLineId],
      foreignColumns: [offerLines.brandId, offerLines.id],
      name: "offer_line_fulfillment_brand_offer_line_fk",
    }),
    uniqueIndex("offer_line_fulfillment_line_unique").on(
      t.brandId,
      t.offerLineId,
    ),
    check(
      "offer_line_fulfillment_quantity_nonnegative",
      sql`${t.fulfillableQuantity} >= 0`,
    ),
    check(
      "offer_line_fulfillment_eligible_boolean",
      sql`${t.fullOrderEligible} in (0, 1)`,
    ),
  ],
);
