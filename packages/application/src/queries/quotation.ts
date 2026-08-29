import type { RequestContext } from "../context.js";
import type { QueryHandler } from "../core/handlers.js";
import { ApplicationError } from "../errors.js";
import type {
  QuotationReadModel,
  QuotationView,
} from "../ports/read-models.js";

export type GetQuotationQuery = Readonly<{ quotationId: string }>;

export class GetQuotationQueryHandler
  implements QueryHandler<GetQuotationQuery, QuotationView>
{
  constructor(private readonly quotations: QuotationReadModel) {}

  async execute(
    context: RequestContext,
    query: GetQuotationQuery,
  ): Promise<QuotationView> {
    const quotation = await this.quotations.get(
      context.brandId,
      query.quotationId,
    );

    if (!quotation)
      throw new ApplicationError(
        "quotation-not-found",
        404,
        "Quotation was not found",
      );

    return quotation;
  }
}
