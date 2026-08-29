import { createRoute } from "@hono/zod-openapi";
import {
  matchResolutionResponseSchema,
  matchResolutionSchema,
  scenarioSelectionResponseSchema,
  scenarioSelectionSchema,
} from "@procurement/contracts";
import { jsonBody, jsonContent, problemResponses } from "../openapi.js";
import type { ApiApp, ApiDependencies } from "../types.js";

const resolveMatchRoute = createRoute({
  method: "post",
  path: "/api/v1/matching",
  tags: ["matching"],
  operationId: "resolveMatch",
  request: { body: jsonBody(matchResolutionSchema) },
  responses: {
    200: jsonContent(matchResolutionResponseSchema),
    ...problemResponses,
  },
});

const selectScenarioRoute = createRoute({
  method: "post",
  path: "/api/v1/quotations/scenario-selection",
  tags: ["matching"],
  operationId: "selectQuotationScenario",
  request: { body: jsonBody(scenarioSelectionSchema) },
  responses: {
    200: jsonContent(scenarioSelectionResponseSchema),
    ...problemResponses,
  },
});

export const registerMatchingRoutes = (
  app: ApiApp,
  dependencies: ApiDependencies,
): void => {
  app.openapi(resolveMatchRoute, async (context) => {
    const command = matchResolutionSchema.parse(context.req.valid("json"));
    await dependencies.composition.resolveCatalogMatch.execute(
      context.get("actorContext"),
      {
        quotationId: command.quotationId,
        scenarioId: command.scenarioId,
        matchId: command.matchId,
        action: command.action,
        ...(command.selectedProductId
          ? { selectedProductId: command.selectedProductId }
          : {}),
        ...(command.rationale ? { rationale: command.rationale } : {}),
      },
    );

    return context.json({ quotationId: command.quotationId }, 200);
  });

  app.openapi(selectScenarioRoute, async (context) => {
    const command = scenarioSelectionSchema.parse(context.req.valid("json"));
    await dependencies.composition.selectQuotationScenario.execute(
      context.get("actorContext"),
      command,
    );

    return context.json(command, 200);
  });
};
