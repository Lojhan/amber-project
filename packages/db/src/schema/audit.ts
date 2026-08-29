import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { brands } from "./brand-catalog.js";

/**
 * Immutable operational audit trail.  Deliberately does not have an update
 * path: command handlers append a scrubbed, structured record in their own
 * database transaction.
 */
export const auditLogs = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.brandId),
    actorId: uuid("actor_id").notNull(),
    action: varchar("action", { length: 255 }).notNull(),
    subjectId: uuid("subject_id").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    entry: jsonb("entry").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_log_brand_subject_idx").on(
      table.brandId,
      table.subjectId,
      table.createdAt,
    ),
  ],
);
