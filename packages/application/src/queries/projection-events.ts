import type { RequestContext } from "../context.js";
import type { QueryHandler } from "../core/handlers.js";
import type {
  ProjectionEvent,
  ProjectionEventReadModel,
} from "../ports/read-models.js";

export type ReadProjectionEventsQuery = Readonly<{ lastEventId?: string }>;

export class ReadProjectionEventsQueryHandler
  implements QueryHandler<ReadProjectionEventsQuery, readonly ProjectionEvent[]>
{
  constructor(private readonly events: ProjectionEventReadModel) {}

  execute(
    context: RequestContext,
    query: ReadProjectionEventsQuery,
  ): Promise<readonly ProjectionEvent[]> {
    return this.events.since(context.brandId, query.lastEventId);
  }
}
