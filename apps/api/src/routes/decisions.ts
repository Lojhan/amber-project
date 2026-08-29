import { createRoute } from "@hono/zod-openapi";
import {
  decisionProjectionResponseSchema,
  negotiationParamsSchema,
} from "@procurement/contracts";
import { jsonContent, problemResponses } from "../openapi.js";
import type { ApiApp, ApiDependencies } from "../types.js";

const getDecisionRoute = createRoute({
  method: "get",
  path: "/api/v1/negotiations/{negotiationId}/decision",
  tags: ["decisions"],
  operationId: "getDecision",
  request: { params: negotiationParamsSchema },
  responses: {
    200: jsonContent(decisionProjectionResponseSchema),
    ...problemResponses,
  },
});

export const registerDecisionRoutes = (
  app: ApiApp,
  dependencies: ApiDependencies,
): void => {
  app.openAPIRegistry.registerPath(getDecisionRoute);
  app.get("/api/v1/negotiations/:negotiationId/decision", async (context) => {
    const { negotiationId } = negotiationParamsSchema.parse(
      context.req.param(),
    );
    const decision = await dependencies.composition.getDecision.execute(
      context.get("actorContext"),
      { negotiationId },
    );

    return new Response(JSON.stringify(decision), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
};
