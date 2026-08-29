import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const workerCompletions = pgTable(
  "worker_completion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("worker_completion_key_unique").on(t.idempotencyKey)],
);

export const workerFailures = pgTable(
  "worker_failure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull(),
    queue: varchar("queue", { length: 64 }).notNull(),
    correlationId: varchar("correlation_id", { length: 255 }).notNull(),
    code: varchar("code", { length: 128 }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("worker_failure_job_idx").on(t.jobId),
    index("worker_failure_correlation_idx").on(t.correlationId),
  ],
);
