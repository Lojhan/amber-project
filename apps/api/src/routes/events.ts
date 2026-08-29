import { createRoute, z } from "@hono/zod-openapi";
import type { ProjectionEvent } from "@procurement/bootstrap/api";
import { eventBatchSchema, eventsQuerySchema } from "@procurement/contracts";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import { jsonContent, problemResponses } from "../openapi.js";
import type { ApiApp, ApiDependencies } from "../types.js";

const compareEventIds = (left: string, right: string): number => {
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    const leftNumber = BigInt(left);
    const rightNumber = BigInt(right);

    return leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0;
  }

  return left.localeCompare(right);
};

const eventQuery = (lastEventId: string | undefined) =>
  lastEventId ? { lastEventId } : {};

export const formatSseBatch = (events: readonly ProjectionEvent[]): string =>
  [...events]
    .sort((left, right) => compareEventIds(left.id, right.id))
    .map(
      (event) =>
        `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
    )
    .join("");

const listEventsRoute = createRoute({
  method: "get",
  path: "/api/v1/events",
  tags: ["events"],
  operationId: "listEvents",
  responses: { 200: jsonContent(eventBatchSchema), ...problemResponses },
});

const streamEventsRoute = createRoute({
  method: "get",
  path: "/api/v1/events/stream",
  tags: ["events"],
  operationId: "streamEvents",
  request: { query: eventsQuerySchema },
  responses: {
    200: {
      content: { "text/event-stream": { schema: z.string() } },
      description: "A resumable stream of projection invalidations",
    },
    ...problemResponses,
  },
});

const writeEvents = async (
  stream: SSEStreamingApi,
  events: readonly ProjectionEvent[],
): Promise<void> => {
  for (const event of [...events].sort((left, right) =>
    compareEventIds(left.id, right.id),
  ))
    await stream.writeSSE({
      id: event.id,
      event: event.type,
      data: JSON.stringify(event),
    });
};

const newerThan = (
  events: readonly ProjectionEvent[],
  lastEventId: string | undefined,
): readonly ProjectionEvent[] =>
  lastEventId
    ? events.filter((event) => compareEventIds(event.id, lastEventId) > 0)
    : events;

const pollProjectionEvents = async (
  stream: SSEStreamingApi,
  dependencies: ApiDependencies,
  actorContext: Parameters<
    ApiDependencies["composition"]["readProjectionEvents"]["execute"]
  >[0],
  initialEventId: string | undefined,
): Promise<void> => {
  let lastEventId = initialEventId;
  let failures = 0;

  while (!stream.aborted) {
    await stream.sleep(2_000);
    const next = await dependencies.composition.readProjectionEvents
      .execute(actorContext, eventQuery(lastEventId))
      .catch(() => undefined);

    if (!next) {
      failures += 1;
      await stream.writeSSE({
        event: "stream-error",
        data: JSON.stringify({ code: "events-unavailable" }),
      });
      if (failures >= 3) return;
      continue;
    }

    const batch = newerThan(next, lastEventId);
    await writeEvents(stream, batch);
    lastEventId = batch.at(-1)?.id ?? lastEventId;
    if (batch.length === 0) await stream.write(": heartbeat\n\n");
    failures = 0;
  }
};

const streamProjectionEvents = (
  app: ApiApp,
  dependencies: ApiDependencies,
): void => {
  app.openapi(streamEventsRoute, async (context) => {
    const { once } = context.req.valid("query");
    const actorContext = context.get("actorContext");
    const requestedEventId = context.req.header("last-event-id");

    return streamSSE(context, async (stream) => {
      const initial =
        await dependencies.composition.readProjectionEvents.execute(
          actorContext,
          eventQuery(requestedEventId),
        );
      if (once === "true" || requestedEventId)
        await writeEvents(stream, initial);
      await stream.write(": heartbeat\n\n");
      if (once === "true") return;
      await pollProjectionEvents(
        stream,
        dependencies,
        actorContext,
        initial.at(-1)?.id ?? requestedEventId,
      );
    });
  });
};

export const registerEventRoutes = (
  app: ApiApp,
  dependencies: ApiDependencies,
): void => {
  app.openAPIRegistry.registerPath(listEventsRoute);
  app.get("/api/v1/events", async (context) => {
    const events = await dependencies.composition.readProjectionEvents.execute(
      context.get("actorContext"),
      eventQuery(context.req.header("last-event-id")),
    );

    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  streamProjectionEvents(app, dependencies);
};
