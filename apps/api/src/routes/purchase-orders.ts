import { createRoute } from "@hono/zod-openapi";
import {
  idParamsSchema,
  purchaseOrderDetailSchema,
  purchaseOrderIssueSchema,
  purchaseOrderListSchema,
  purchaseOrderPreviewResponseSchema,
  purchaseOrderPreviewSchema,
  purchaseOrderResponseSchema,
} from "@procurement/contracts";
import { jsonBody, jsonContent, problemResponses } from "../openapi.js";
import type { ApiApp, ApiDependencies } from "../types.js";

const listPurchaseOrdersRoute = createRoute({
  method: "get",
  path: "/api/v1/purchase-orders",
  tags: ["purchase-orders"],
  operationId: "listPurchaseOrders",
  responses: {
    200: jsonContent(purchaseOrderListSchema),
    ...problemResponses,
  },
});

const getPurchaseOrderRoute = createRoute({
  method: "get",
  path: "/api/v1/purchase-orders/{id}",
  tags: ["purchase-orders"],
  operationId: "getPurchaseOrder",
  request: { params: idParamsSchema },
  responses: {
    200: jsonContent(purchaseOrderDetailSchema),
    ...problemResponses,
  },
});

const previewPurchaseOrderRoute = createRoute({
  method: "post",
  path: "/api/v1/purchase-orders/preview",
  tags: ["purchase-orders"],
  operationId: "previewPurchaseOrder",
  request: { body: jsonBody(purchaseOrderPreviewSchema) },
  responses: {
    200: jsonContent(purchaseOrderPreviewResponseSchema),
    ...problemResponses,
  },
});

const issuePurchaseOrderRoute = createRoute({
  method: "post",
  path: "/api/v1/purchase-orders/issue",
  tags: ["purchase-orders"],
  operationId: "issuePurchaseOrder",
  request: { body: jsonBody(purchaseOrderIssueSchema) },
  responses: {
    200: jsonContent(purchaseOrderResponseSchema),
    ...problemResponses,
  },
});

export const registerPurchaseOrderRoutes = (
  app: ApiApp,
  dependencies: ApiDependencies,
): void => {
  app.openapi(listPurchaseOrdersRoute, async (context) => {
    const items = await dependencies.composition.listPurchaseOrders.execute(
      context.get("actorContext"),
    );

    return context.json({ items }, 200);
  });

  app.openapi(getPurchaseOrderRoute, async (context) => {
    const purchaseOrder =
      await dependencies.composition.getPurchaseOrder.execute(
        context.get("actorContext"),
        context.req.valid("param"),
      );

    return context.json(purchaseOrderDetailSchema.parse(purchaseOrder), 200);
  });

  app.openapi(previewPurchaseOrderRoute, async (context) => {
    const preview = await dependencies.composition.preparePurchaseOrder.execute(
      context.get("actorContext"),
      purchaseOrderPreviewSchema.parse(context.req.valid("json")),
    );

    return context.json(preview, 200);
  });

  app.openapi(issuePurchaseOrderRoute, async (context) => {
    const purchaseOrder =
      await dependencies.composition.issuePurchaseOrder.execute(
        context.get("actorContext"),
        purchaseOrderIssueSchema.parse(context.req.valid("json")),
      );

    return context.json(purchaseOrder, 200);
  });
};
