import type { RequestContext } from "../context.js";
import type { QueryHandler } from "../core/handlers.js";
import { ApplicationError } from "../errors.js";
import type {
  QuotationReadModel,
  QuoteCopilotMessage,
  QuoteCopilotRepository,
} from "../ports/index.js";

export type GetQuoteCopilotQuery = Readonly<{ quotationId: string }>;
export type QuoteCopilotConversation = Readonly<{
  quotationId: string;
  messages: readonly QuoteCopilotMessage[];
}>;

export class GetQuoteCopilotQueryHandler
  implements QueryHandler<GetQuoteCopilotQuery, QuoteCopilotConversation>
{
  constructor(
    private readonly dependencies: Readonly<{
      quotations: QuotationReadModel;
      conversations: QuoteCopilotRepository;
    }>,
  ) {}

  async execute(
    context: RequestContext,
    query: GetQuoteCopilotQuery,
  ): Promise<QuoteCopilotConversation> {
    const quotation = await this.dependencies.quotations.get(
      context.brandId,
      query.quotationId,
    );
    if (!quotation)
      throw new ApplicationError(
        "quotation-not-found",
        404,
        "Quotation was not found",
      );

    return {
      quotationId: quotation.id,
      messages: await this.dependencies.conversations.list(
        context.brandId,
        quotation.id,
        100,
      ),
    };
  }
}
