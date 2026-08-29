import { createRoute } from "@hono/zod-openapi";
import {
  idParamsSchema,
  quotationProjectionSchema,
  quotationUploadCommandSchema,
  quotationUploadCompleteSchema,
  quotationUploadCompletionSchema,
  quotationUploadReservationSchema,
} from "@procurement/contracts";
import { jsonBody, jsonContent, problemResponses } from "../openapi.js";
import type { ApiApp, ApiDependencies } from "../types.js";

const reserveUploadRoute = createRoute({
  method: "post",
  path: "/api/v1/quotations/uploads",
  tags: ["quotations"],
  operationId: "reserveQuotationUpload",
  request: { body: jsonBody(quotationUploadCommandSchema) },
  responses: {
    200: jsonContent(quotationUploadReservationSchema),
    ...problemResponses,
  },
});

const completeUploadRoute = createRoute({
  method: "post",
  path: "/api/v1/quotations",
  tags: ["quotations"],
  operationId: "completeQuotationUpload",
  request: { body: jsonBody(quotationUploadCompleteSchema) },
  responses: {
    200: jsonContent(quotationUploadCompletionSchema),
    ...problemResponses,
  },
});

const getQuotationRoute = createRoute({
  method: "get",
  path: "/api/v1/quotations/{id}",
  tags: ["quotations"],
  operationId: "getQuotation",
  request: { params: idParamsSchema },
  responses: {
    200: jsonContent(quotationProjectionSchema),
    ...problemResponses,
  },
});

export const registerQuotationRoutes = (
  app: ApiApp,
  dependencies: ApiDependencies,
): void => {
  app.openapi(reserveUploadRoute, async (context) => {
    const command = quotationUploadCommandSchema.parse(
      context.req.valid("json"),
    );
    const reservation =
      await dependencies.composition.reserveQuotationUpload.execute(
        context.get("actorContext"),
        {
          filename: command.filename,
          contentHash: command.contentHash,
          ...(command.note ? { note: command.note } : {}),
        },
      );

    return context.json(
      quotationUploadReservationSchema.parse(reservation),
      200,
    );
  });

  app.openapi(completeUploadRoute, async (context) => {
    const command = quotationUploadCompleteSchema.parse(
      context.req.valid("json"),
    );
    const completion =
      await dependencies.composition.completeQuotationUpload.execute(
        context.get("actorContext"),
        {
          objectKey: command.objectKey,
          contentHash: command.contentHash,
          idempotencyKey: command.idempotencyKey,
          ...(command.note ? { note: command.note } : {}),
        },
      );

    return context.json(completion, 200);
  });

  app.openapi(getQuotationRoute, async (context) => {
    const { id } = context.req.valid("param");
    const quotation = await dependencies.composition.getQuotation.execute(
      context.get("actorContext"),
      { quotationId: id },
    );

    return context.json(quotation, 200);
  });
};
