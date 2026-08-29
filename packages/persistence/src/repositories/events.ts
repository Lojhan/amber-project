import { randomUUID } from "node:crypto";
import type {
  AuditEntry,
  AuditWriter,
  DomainEventWriter,
  JsonValue,
  NewDomainEvent,
  StoredDomainEvent,
} from "@procurement/application/ports";
import {
  auditLogs,
  domainEvents,
  projectionEvents,
} from "@procurement/db/schema";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";

const json = (value: JsonValue): object | JsonValue => value;

export class DrizzleDomainEventWriter implements DomainEventWriter {
  constructor(
    private readonly unitOfWork: DrizzleUnitOfWork,
    private readonly createId: () => string = randomUUID,
  ) {}

  async append(
    transaction: Parameters<DomainEventWriter["append"]>[0],
    event: NewDomainEvent,
  ): Promise<StoredDomainEvent> {
    const id = this.createId();
    const database = this.unitOfWork.databaseFor(transaction);
    const rows = await database
      .insert(domainEvents)
      .values({
        id,
        brandId: event.brandId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        type: event.type,
        schemaVersion: event.schemaVersion,
        payload: json(event.payload),
        correlationId: event.correlationId,
        causationId: event.causationId,
        idempotencyKey: event.idempotencyKey,
      })
      .returning({ createdAt: domainEvents.createdAt });
    const createdAt = rows[0]?.createdAt;

    if (!createdAt) throw new Error("domain event insert returned no row");

    await database.insert(projectionEvents).values({
      brandId: event.brandId,
      domainEventId: id,
      eventType: event.type,
      payload: json(event.payload),
    });

    return { ...event, id, createdAt };
  }
}

export class DrizzleAuditWriter implements AuditWriter {
  constructor(
    private readonly unitOfWork: DrizzleUnitOfWork,
    private readonly createId: () => string = randomUUID,
  ) {}

  async record(
    transaction: Parameters<AuditWriter["record"]>[0],
    entry: AuditEntry,
  ): Promise<void> {
    await this.unitOfWork
      .databaseFor(transaction)
      .insert(auditLogs)
      .values({
        id: this.createId(),
        brandId: entry.brandId,
        actorId: entry.actorId,
        action: entry.action,
        subjectId: entry.subjectId,
        metadata: json(entry.metadata),
        entry,
      });
  }
}
