import { createRoute, z } from "@hono/zod-openapi";
import {
  idParamsSchema,
  quoteCopilotConversationSchema,
  quoteCopilotRequestSchema,
} from "@procurement/contracts";
import { streamSSE } from "hono/streaming";
import { jsonBody, jsonContent, problemResponses } from "../openapi.js";
import { toProblem } from "../problem.js";
import type { ApiApp, ApiDependencies } from "../types.js";

const getConversationRoute = createRoute({
  method: "get",
  path: "/api/v1/quotations/{id}/copilot",
  tags: ["quote copilot"],
  operationId: "getQuoteCopilotConversation",
  request: { params: idParamsSchema },
  responses: {
    200: jsonContent(quoteCopilotConversationSchema),
    ...problemResponses,
  },
});

const chatRoute = createRoute({
  method: "post",
  path: "/api/v1/quote-copilot/messages",
  tags: ["quote copilot"],
  operationId: "chatWithQuoteCopilot",
  request: { body: jsonBody(quoteCopilotRequestSchema) },
  responses: {
    200: jsonContent(quoteCopilotConversationSchema),
    ...problemResponses,
  },
});

const streamChatRoute = createRoute({
  method: "post",
  path: "/api/v1/quote-copilot/messages/stream",
  tags: ["quote copilot"],
  operationId: "streamQuoteCopilotMessage",
  request: { body: jsonBody(quoteCopilotRequestSchema) },
  responses: {
    200: {
      content: { "text/event-stream": { schema: z.string() } },
      description:
        "Assistant content updates followed by the durable conversation",
    },
    ...problemResponses,
  },
});

const responseFor = (
  conversation: Awaited<
    ReturnType<ApiDependencies["composition"]["getQuoteCopilot"]["execute"]>
  >,
) =>
  quoteCopilotConversationSchema.parse({
    quotationId: conversation.quotationId,
    messages: conversation.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
  });

export const registerQuoteCopilotRoutes = (
  app: ApiApp,
  dependencies: ApiDependencies,
): void => {
  app.openapi(getConversationRoute, async (context) => {
    const { id } = context.req.valid("param");
    const conversation = await dependencies.composition.getQuoteCopilot.execute(
      context.get("actorContext"),
      { quotationId: id },
    );
    context.header("cache-control", "no-store");

    return context.json(responseFor(conversation), 200);
  });

  app.openapi(chatRoute, async (context) => {
    const command = quoteCopilotRequestSchema.parse(context.req.valid("json"));
    const actor = context.get("actorContext");
    await dependencies.composition.chatWithQuoteCopilot.execute(actor, command);
    const conversation = await dependencies.composition.getQuoteCopilot.execute(
      actor,
      {
        quotationId: command.quotationId,
      },
    );
    context.header("cache-control", "no-store");

    return context.json(responseFor(conversation), 200);
  });

  app.openapi(streamChatRoute, async (context) => {
    const command = quoteCopilotRequestSchema.parse(context.req.valid("json"));
    const actor = context.get("actorContext");
    context.header("cache-control", "no-store");
    context.header("x-accel-buffering", "no");

    return streamSSE(context, async (stream) => {
      try {
        await dependencies.composition.chatWithQuoteCopilot.executeStreaming(
          actor,
          command,
          async (content) => {
            await stream.writeSSE({
              event: "assistant-content",
              data: JSON.stringify({ content }),
            });
          },
        );
        const conversation =
          await dependencies.composition.getQuoteCopilot.execute(actor, {
            quotationId: command.quotationId,
          });
        await stream.writeSSE({
          event: "conversation",
          data: JSON.stringify(responseFor(conversation)),
        });
      } catch (error) {
        const problem = toProblem(
          error instanceof Error ? error : new Error("Unknown copilot error"),
          actor.correlationId,
        );
        await stream.writeSSE({
          event: "problem",
          data: JSON.stringify(problem),
        });
      }
    });
  });
};
