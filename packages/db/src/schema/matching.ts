import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./brand-catalog.js";
import { entityId } from "./helpers.js";
import { parsedQuoteLines } from "./quotation.js";

export const matchDecisions = pgTable(
  "match_decision",
  {
    id: entityId(),
    brandId: uuid("brand_id").notNull(),
    parsedLineId: uuid("parsed_line_id").notNull(),
    candidates: jsonb("candidates").notNull(),
    selectedProductId: uuid("selected_product_id"),
    excluded: boolean("excluded").notNull().default(false),
    actorId: uuid("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("match_decision_brand_id_unique").on(t.brandId, t.id),
    uniqueIndex("match_decision_initial_fact_unique")
      .on(t.brandId, t.parsedLineId)
      .where(sql`${t.actorId} is null`),
    foreignKey({
      columns: [t.brandId, t.parsedLineId],
      foreignColumns: [parsedQuoteLines.brandId, parsedQuoteLines.id],
      name: "match_decision_brand_line_fk",
    }),
    foreignKey({
      columns: [t.brandId, t.selectedProductId],
      foreignColumns: [products.brandId, products.id],
      name: "match_decision_brand_product_fk",
    }),
    check(
      "match_decision_selected_xor_excluded",
      sql`not (${t.selectedProductId} is not null and ${t.excluded})`,
    ),
  ],
);
