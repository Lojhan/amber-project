import { createRoute } from "@hono/zod-openapi";
import {
  commercialReviewResponseSchema,
  commercialReviewSchema,
} from "@procurement/contracts";
import { jsonBody, jsonContent, problemResponses } from "../openapi.js";
import type { ApiApp, ApiDependencies } from "../types.js";

const resolveRequestedQuantitiesRoute = createRoute({
  method: "post",
  path: "/api/v1/quotations/commercial-review",
  tags: ["commercial review"],
  operationId: "resolveRequestedQuantities",
  request: { body: jsonBody(commercialReviewSchema) },
  responses: {
    200: jsonContent(commercialReviewResponseSchema),
    ...problemResponses,
  },
});

export const registerCommercialReviewRoutes = (
  app: ApiApp,
  dependencies: ApiDependencies,
): void => {
  app.openapi(resolveRequestedQuantitiesRoute, async (context) => {
    const command = commercialReviewSchema.parse(context.req.valid("json"));
    await dependencies.composition.resolveRequestedQuantities.execute(
      context.get("actorContext"),
      command,
    );

    return context.json({ quotationId: command.quotationId }, 200);
  });
};
