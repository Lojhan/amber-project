import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { parsedQuoteLines } from "./quotation.js";

/** A buyer-provided quantity for a parsed line whose workbook value was absent or ambiguous. */
export const quotationLineQuantities = pgTable(
  "quotation_line_quantity",
  {
    brandId: uuid("brand_id").notNull(),
    parsedLineId: uuid("parsed_line_id").notNull(),
    requestedQuantity: bigint("requested_quantity", {
      mode: "bigint",
    }).notNull(),
    actorId: uuid("actor_id").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.brandId, t.parsedLineId] }),
    foreignKey({
      columns: [t.brandId, t.parsedLineId],
      foreignColumns: [parsedQuoteLines.brandId, parsedQuoteLines.id],
      name: "quotation_line_quantity_brand_line_fk",
    }),
    check("quotation_line_quantity_positive", sql`${t.requestedQuantity} > 0`),
  ],
);
