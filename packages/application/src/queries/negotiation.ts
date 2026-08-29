import type { RequestContext } from "../context.js";
import type { QueryHandler } from "../core/handlers.js";
import { ApplicationError } from "../errors.js";
import type {
  NegotiationReadModel,
  NegotiationView,
} from "../ports/read-models.js";

export type GetNegotiationQuery = Readonly<{ negotiationId: string }>;

export class GetNegotiationQueryHandler
  implements QueryHandler<GetNegotiationQuery, NegotiationView>
{
  constructor(private readonly negotiations: NegotiationReadModel) {}

  async execute(
    context: RequestContext,
    query: GetNegotiationQuery,
  ): Promise<NegotiationView> {
    const negotiation = await this.negotiations.get(
      context.brandId,
      query.negotiationId,
    );

    if (!negotiation)
      throw new ApplicationError(
        "negotiation-not-found",
        404,
        "Negotiation was not found",
      );

    return negotiation;
  }
}
