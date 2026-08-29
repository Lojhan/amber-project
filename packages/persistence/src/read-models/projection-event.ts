import type { ProjectionEventReadModel } from "@procurement/application/ports";
import type { Database } from "@procurement/db/client";
import { domainEvents, projectionEvents } from "@procurement/db/schema";
import type { BrandId } from "@procurement/domain";
import { and, asc, eq, gt } from "drizzle-orm";
import { json } from "./codecs.js";

export class DrizzleProjectionEventReadModel
  implements ProjectionEventReadModel
{
  constructor(private readonly db: Database) {}

  async since(brandId: BrandId, lastEventId?: string) {
    const rows = await this.db
      .select({
        resumeId: projectionEvents.resumeId,
        aggregateId: domainEvents.aggregateId,
        type: projectionEvents.eventType,
        schemaVersion: domainEvents.schemaVersion,
        payload: projectionEvents.payload,
      })
      .from(projectionEvents)
      .innerJoin(
        domainEvents,
        and(
          eq(domainEvents.brandId, projectionEvents.brandId),
          eq(domainEvents.id, projectionEvents.domainEventId),
        ),
      )
      .where(
        and(
          eq(projectionEvents.brandId, brandId),
          lastEventId
            ? gt(projectionEvents.resumeId, BigInt(lastEventId))
            : undefined,
        ),
      )
      .orderBy(asc(projectionEvents.resumeId));
    return rows.map((r) => ({
      id: r.resumeId.toString(),
      aggregateId: r.aggregateId,
      type: r.type,
      version: Number.parseInt(r.schemaVersion, 10),
      payload: json(r.payload),
    }));
  }
}
