import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "./brand-catalog.js";
import { entityId } from "./helpers.js";
import { quotations } from "./quotation.js";

export const quoteCopilotMessages = pgTable(
  "quote_copilot_message",
  {
    id: entityId(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.brandId),
    quotationId: uuid("quotation_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    suggestions: jsonb("suggestions").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("quote_copilot_message_brand_id_unique").on(t.brandId, t.id),
    foreignKey({
      columns: [t.brandId, t.quotationId],
      foreignColumns: [quotations.brandId, quotations.id],
      name: "quote_copilot_message_brand_quotation_fk",
    }),
    index("quote_copilot_message_conversation_idx").on(
      t.brandId,
      t.quotationId,
      t.createdAt,
    ),
    check(
      "quote_copilot_message_role_valid",
      sql`${t.role} in ('user', 'assistant')`,
    ),
    check(
      "quote_copilot_message_content_present",
      sql`length(${t.content}) > 0`,
    ),
  ],
);
