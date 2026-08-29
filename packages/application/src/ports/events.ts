import type { ActorId, BrandId } from "@procurement/domain";
import type { TransactionContext } from "../core/transaction-context.js";
import type { JsonValue } from "./json.js";

export type NewDomainEvent = Readonly<{
  brandId: BrandId;
  aggregateType: string;
  aggregateId: string;
  type: string;
  schemaVersion: string;
  payload: JsonValue;
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
}>;

export type StoredDomainEvent = NewDomainEvent &
  Readonly<{ id: string; createdAt: Date }>;

export interface DomainEventWriter {
  append(
    transaction: TransactionContext,
    event: NewDomainEvent,
  ): Promise<StoredDomainEvent>;
}

export type AuditEntry = Readonly<{
  brandId: BrandId;
  actorId: ActorId;
  action: string;
  subjectId: string;
  metadata: JsonValue;
}>;

export interface AuditWriter {
  record(transaction: TransactionContext, entry: AuditEntry): Promise<void>;
}

export type ScheduledJob = Readonly<{
  name: string;
  payload: JsonValue;
  correlationId: string;
  idempotencyKey: string;
}>;

export interface JobScheduler {
  enqueue(transaction: TransactionContext, job: ScheduledJob): Promise<string>;
}
