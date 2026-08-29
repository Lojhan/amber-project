import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
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
import { brands, products } from "./brand-catalog.js";
import { quotationState } from "./enums.js";
import { entityId } from "./helpers.js";

export const quotations = pgTable(
  "quotation",
  {
    id: entityId(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.brandId),
    fileHash: varchar("file_hash", { length: 128 }).notNull(),
    objectKey: text("object_key").notNull(),
    note: text("note"),
    failureDetail: text("failure_detail"),
    catalogVersion: varchar("catalog_version", { length: 64 }).notNull(),
    state: quotationState("state").notNull(),
    version: integer("version").notNull().default(1),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("quotation_brand_id_unique").on(t.brandId, t.id),
    uniqueIndex("quotation_brand_hash_unique").on(t.brandId, t.fileHash),
    uniqueIndex("quotation_brand_idempotency_unique")
      .on(t.brandId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    check("quotation_version_positive", sql`${t.version} > 0`),
  ],
);
export const quoteScenarios = pgTable(
  "quote_scenario",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    quotationId: uuid("quotation_id").notNull(),
    sourceSheet: text("source_sheet").notNull(),
    rationale: text("rationale").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    unique("quote_scenario_brand_id_unique").on(t.brandId, t.id),
    foreignKey({
      columns: [t.brandId, t.quotationId],
      foreignColumns: [quotations.brandId, quotations.id],
      name: "quote_scenario_brand_quotation_fk",
    }),
    index("quote_scenario_quotation_idx").on(t.brandId, t.quotationId),
  ],
);
export const parsedQuoteLines = pgTable(
  "parsed_quote_line",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    scenarioId: uuid("scenario_id").notNull(),
    sourceEvidence: jsonb("source_evidence").notNull(),
    normalizedCandidates: jsonb("normalized_candidates").notNull(),
    rawValue: text("raw_value"),
  },
  (t) => [
    unique("parsed_quote_line_brand_id_unique").on(t.brandId, t.id),
    foreignKey({
      columns: [t.brandId, t.scenarioId],
      foreignColumns: [quoteScenarios.brandId, quoteScenarios.id],
      name: "parsed_quote_line_brand_scenario_fk",
    }),
  ],
);
export const orderIntents = pgTable(
  "order_intent",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    quotationId: uuid("quotation_id").notNull(),
    scenarioId: uuid("scenario_id").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    assumptions: jsonb("assumptions").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("order_intent_brand_id_unique").on(t.brandId, t.id),
    foreignKey({
      columns: [t.brandId, t.quotationId],
      foreignColumns: [quotations.brandId, quotations.id],
      name: "order_intent_brand_quotation_fk",
    }),
    foreignKey({
      columns: [t.brandId, t.scenarioId],
      foreignColumns: [quoteScenarios.brandId, quoteScenarios.id],
      name: "order_intent_brand_scenario_fk",
    }),
  ],
);
export const orderIntentLines = pgTable(
  "order_intent_line",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    orderIntentId: uuid("order_intent_id").notNull(),
    productId: uuid("product_id").notNull(),
    quantity: bigint("quantity", { mode: "bigint" }).notNull(),
    baselineUnitPrice: bigint("baseline_unit_price_minor", {
      mode: "bigint",
    }).notNull(),
    sourceTierEvidence: jsonb("source_tier_evidence").notNull(),
  },
  (t) => [
    uniqueIndex("order_intent_line_brand_id_unique").on(t.brandId, t.id),
    foreignKey({
      columns: [t.brandId, t.orderIntentId],
      foreignColumns: [orderIntents.brandId, orderIntents.id],
      name: "order_intent_line_brand_intent_fk",
    }),
    foreignKey({
      columns: [t.brandId, t.productId],
      foreignColumns: [products.brandId, products.id],
      name: "order_intent_line_brand_product_fk",
    }),
    check("order_intent_line_quantity_positive", sql`${t.quantity} > 0`),
    check("order_intent_line_price_positive", sql`${t.baselineUnitPrice} > 0`),
    uniqueIndex("order_intent_line_product_unique").on(
      t.brandId,
      t.orderIntentId,
      t.productId,
    ),
  ],
);
