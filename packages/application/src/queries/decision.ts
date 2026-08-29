import type { RequestContext } from "../context.js";
import type { QueryHandler } from "../core/handlers.js";
import type { DecisionReadModel, DecisionView } from "../ports/read-models.js";

export type GetDecisionQuery = Readonly<{ negotiationId: string }>;

export class GetDecisionQueryHandler
  implements QueryHandler<GetDecisionQuery, DecisionView | null>
{
  constructor(private readonly decisions: DecisionReadModel) {}

  execute(
    context: RequestContext,
    query: GetDecisionQuery,
  ): Promise<DecisionView | null> {
    return this.decisions.get(context.brandId, query.negotiationId);
  }
}
