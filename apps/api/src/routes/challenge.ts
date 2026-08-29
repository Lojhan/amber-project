import { createRoute } from "@hono/zod-openapi";
import { emptyObjectSchema, okResponseSchema } from "@procurement/contracts";
import { jsonBody, jsonContent, problemResponses } from "../openapi.js";
import type { ApiApp, ApiDependencies } from "../types.js";

const resetChallengeRoute = createRoute({
  method: "post",
  path: "/api/v1/challenge/reset",
  tags: ["challenge"],
  operationId: "resetChallenge",
  request: { body: jsonBody(emptyObjectSchema) },
  responses: { 200: jsonContent(okResponseSchema), ...problemResponses },
});

export const registerChallengeRoutes = (
  app: ApiApp,
  dependencies: ApiDependencies,
): void => {
  app.openapi(resetChallengeRoute, async (context) => {
    await dependencies.composition.resetChallenge.execute(
      context.get("actorContext"),
      {},
    );

    return context.json({ ok: true as const }, 200);
  });
};
