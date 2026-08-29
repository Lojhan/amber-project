import { randomUUID } from "node:crypto";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { createRequestContext } from "@procurement/bootstrap/api";
import { okResponseSchema } from "@procurement/contracts";
import { jsonContent, openApiDocument, problemResponses } from "./openapi.js";
import { notFoundResponse, problemResponse } from "./problem.js";
import { registerChallengeRoutes } from "./routes/challenge.js";
import { registerCommercialReviewRoutes } from "./routes/commercial-review.js";
import { registerDecisionRoutes } from "./routes/decisions.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerMatchingRoutes } from "./routes/matching.js";
import { registerNegotiationRoutes } from "./routes/negotiations.js";
import { registerPurchaseOrderRoutes } from "./routes/purchase-orders.js";
import { registerQuotationRoutes } from "./routes/quotations.js";
import { registerQuoteCopilotRoutes } from "./routes/quote-copilot.js";
import type { ApiApp, ApiDependencies, ApiEnvironment } from "./types.js";

export type ReadinessCheck = () => Promise<void>;

const healthRoute = createRoute({
  method: "get",
  path: "/api/v1/health",
  tags: ["system"],
  operationId: "health",
  responses: { 200: jsonContent(okResponseSchema), ...problemResponses },
});

const readinessRoute = createRoute({
  method: "get",
  path: "/api/v1/readiness",
  tags: ["system"],
  operationId: "readiness",
  responses: {
    200: jsonContent(okResponseSchema),
    503: jsonContent(okResponseSchema, "Dependencies are unavailable"),
    ...problemResponses,
  },
});

const requestId = (header: string | undefined): string =>
  header?.trim() || randomUUID();

export const buildApi = (
  dependencies: ApiDependencies,
  readiness: ReadinessCheck = async () => undefined,
): ApiApp => {
  const app = new OpenAPIHono<ApiEnvironment>({
    defaultHook: (result) => {
      if (!result.success) throw result.error;
    },
  });

  app.use("*", async (context, next) => {
    const correlationId = requestId(context.req.header("x-request-id"));
    context.set(
      "actorContext",
      createRequestContext({
        actorId: dependencies.config.ACTOR_ID,
        brandId: dependencies.config.BRAND_ID,
        correlationId,
      }),
    );
    await next();
    context.header("x-correlation-id", correlationId);
  });
  app.onError((error, context) => problemResponse(context, error));
  app.notFound(notFoundResponse);
  app.openapi(healthRoute, (context) => context.json({ ok: true }, 200));
  app.openapi(readinessRoute, async (context) => {
    try {
      await readiness();
      return context.json({ ok: true }, 200);
    } catch {
      return context.json({ ok: false }, 503);
    }
  });
  registerChallengeRoutes(app, dependencies);
  registerQuotationRoutes(app, dependencies);
  registerQuoteCopilotRoutes(app, dependencies);
  registerMatchingRoutes(app, dependencies);
  registerCommercialReviewRoutes(app, dependencies);
  registerNegotiationRoutes(app, dependencies);
  registerDecisionRoutes(app, dependencies);
  registerPurchaseOrderRoutes(app, dependencies);
  registerEventRoutes(app, dependencies);

  return app;
};

export const apiDocument = (app: ApiApp): Record<string, unknown> =>
  app.getOpenAPI31Document(openApiDocument) as unknown as Record<
    string,
    unknown
  >;
