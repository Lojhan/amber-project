import { sql } from "drizzle-orm";
import {
  bigint,
  foreignKey,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { brands } from "./brand-catalog.js";
import { entityId } from "./helpers.js";

export const domainEvents = pgTable(
  "domain_event",
  {
    id: entityId(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.brandId),
    aggregateType: varchar("aggregate_type", { length: 64 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    type: varchar("type", { length: 128 }).notNull(),
    schemaVersion: varchar("schema_version", { length: 64 }).notNull(),
    payload: jsonb("payload").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    causationId: uuid("causation_id"),
    correlationId: varchar("correlation_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("domain_event_brand_id_unique").on(t.brandId, t.id),
    uniqueIndex("domain_event_idempotency_unique")
      .on(t.brandId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    index("domain_event_aggregate_idx").on(
      t.brandId,
      t.aggregateType,
      t.aggregateId,
    ),
  ],
);
export const projectionEvents = pgTable(
  "projection_event",
  {
    resumeId: bigint("resume_id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.brandId),
    domainEventId: uuid("domain_event_id").notNull(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.brandId, t.domainEventId],
      foreignColumns: [domainEvents.brandId, domainEvents.id],
      name: "projection_event_brand_domain_event_fk",
    }),
    uniqueIndex("projection_event_resume_unique").on(t.resumeId),
    index("projection_event_brand_resume_idx").on(t.brandId, t.resumeId),
  ],
);
