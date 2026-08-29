import { createRoute } from "@hono/zod-openapi";
import {
  idParamsSchema,
  negotiationPolicyPreviewRequestSchema,
  negotiationPolicyPreviewSchema,
  negotiationProjectionSchema,
  negotiationStartSchema,
} from "@procurement/contracts";
import { jsonBody, jsonContent, problemResponses } from "../openapi.js";
import type { ApiApp, ApiDependencies } from "../types.js";

const previewPolicyRoute = createRoute({
  method: "post",
  path: "/api/v1/negotiation-policy/preview",
  tags: ["negotiations"],
  operationId: "previewNegotiationPolicy",
  request: { body: jsonBody(negotiationPolicyPreviewRequestSchema) },
  responses: {
    200: jsonContent(negotiationPolicyPreviewSchema),
    ...problemResponses,
  },
});

const startNegotiationRoute = createRoute({
  method: "post",
  path: "/api/v1/negotiations",
  tags: ["negotiations"],
  operationId: "startNegotiation",
  request: { body: jsonBody(negotiationStartSchema) },
  responses: {
    200: jsonContent(negotiationProjectionSchema),
    ...problemResponses,
  },
});

const getNegotiationRoute = createRoute({
  method: "get",
  path: "/api/v1/negotiations/{id}",
  tags: ["negotiations"],
  operationId: "getNegotiation",
  request: { params: idParamsSchema },
  responses: {
    200: jsonContent(negotiationProjectionSchema),
    ...problemResponses,
  },
});

export const registerNegotiationRoutes = (
  app: ApiApp,
  dependencies: ApiDependencies,
): void => {
  app.openapi(previewPolicyRoute, async (context) => {
    const preview =
      await dependencies.composition.previewNegotiationPolicy.execute(
        context.get("actorContext"),
        negotiationPolicyPreviewRequestSchema.parse(context.req.valid("json")),
      );

    context.header("Cache-Control", "no-store");
    return context.json(preview, 200);
  });

  app.openapi(startNegotiationRoute, async (context) => {
    const negotiation = await dependencies.composition.startNegotiation.execute(
      context.get("actorContext"),
      negotiationStartSchema.parse(context.req.valid("json")),
    );

    return context.json(negotiation, 200);
  });

  app.openapi(getNegotiationRoute, async (context) => {
    const { id } = context.req.valid("param");
    const negotiation = await dependencies.composition.getNegotiation.execute(
      context.get("actorContext"),
      { negotiationId: id },
    );

    return context.json(negotiation, 200);
  });
};
