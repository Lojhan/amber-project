import type { RequestContext } from "../context.js";
import type { QueryHandler } from "../core/handlers.js";
import { ApplicationError } from "../errors.js";
import type {
  PurchaseOrderDetail,
  PurchaseOrderReadModel,
  PurchaseOrderSummary,
} from "../ports/read-models.js";

export class ListPurchaseOrdersQueryHandler
  implements
    QueryHandler<
      Readonly<Record<string, never>>,
      readonly PurchaseOrderSummary[]
    >
{
  constructor(private readonly purchaseOrders: PurchaseOrderReadModel) {}

  execute(context: RequestContext): Promise<readonly PurchaseOrderSummary[]> {
    return this.purchaseOrders.list(context.brandId);
  }
}

export type GetPurchaseOrderQuery = Readonly<{ id: string }>;

export class GetPurchaseOrderQueryHandler
  implements QueryHandler<GetPurchaseOrderQuery, PurchaseOrderDetail>
{
  constructor(private readonly purchaseOrders: PurchaseOrderReadModel) {}

  async execute(
    context: RequestContext,
    query: GetPurchaseOrderQuery,
  ): Promise<PurchaseOrderDetail> {
    const purchaseOrder = await this.purchaseOrders.get(
      context.brandId,
      query.id,
    );

    if (!purchaseOrder)
      throw new ApplicationError(
        "purchase-order-not-found",
        404,
        "Purchase order was not found",
      );

    return purchaseOrder;
  }
}
