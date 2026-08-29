import { describe, expect, it } from "vitest";
import { buildApi } from "../server.js";
import {
  createComposition,
  createDependencies,
  testBrandId,
} from "../test-support.js";
import { formatSseBatch } from "./events.js";

const quotationId = "00000000-0000-4000-8000-000000000001";
const scenarioId = "00000000-0000-4000-8000-000000000002";
const matchId = "00000000-0000-4000-8000-000000000003";

const jsonRequest = (body: unknown, headers?: HeadersInit): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

describe("Hono API transport boundary", () => {
  it("serves liveness and readiness without touching application state", async () => {
    const app = buildApi(createDependencies());

    expect((await app.request("/api/v1/health")).status).toBe(200);
    expect((await app.request("/api/v1/readiness")).status).toBe(200);

    const unavailable = buildApi(createDependencies(), async () => {
      throw new Error("database unavailable");
    });
    expect((await unavailable.request("/api/v1/readiness")).status).toBe(503);
  });

  it("propagates the request id through context and response metadata", async () => {
    const composition = createComposition();
    let correlationId = "";
    composition.getQuotation.execute = async (context, query) => {
      correlationId = context.correlationId;
      return {
        id: query.quotationId,
        status: "READY",
        scenarios: [],
        matches: [],
      };
    };
    const response = await buildApi(
      createDependencies({ composition }),
    ).request(`/api/v1/quotations/${quotationId}`, {
      headers: { "x-request-id": "candidate-request-1" },
    });

    expect(response.headers.get("x-correlation-id")).toBe(
      "candidate-request-1",
    );
    expect(correlationId).toBe("candidate-request-1");
  });

  it("maps one matching command and returns only an acknowledgement", async () => {
    const composition = createComposition();
    let capturedBrand = "";
    let capturedInput: unknown;
    composition.resolveCatalogMatch.execute = async (context, input) => {
      capturedBrand = context.brandId;
      capturedInput = input;
    };
    const response = await buildApi(
      createDependencies({ composition }),
    ).request(
      "/api/v1/matching",
      jsonRequest({
        quotationId,
        scenarioId,
        matchId,
        action: "accept",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ quotationId });
    expect(capturedBrand).toBe(testBrandId);
    expect(capturedInput).toMatchObject({ matchId, action: "accept" });
  });

  it("maps an explicit full challenge reset", async () => {
    const composition = createComposition();
    let capturedBrand = "";
    composition.resetChallenge.execute = async (context) => {
      capturedBrand = context.brandId;
    };
    const response = await buildApi(
      createDependencies({ composition }),
    ).request("/api/v1/challenge/reset", jsonRequest({}));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(capturedBrand).toBe(testBrandId);
  });
});

describe("commercial review transport", () => {
  it("maps quantity review as one atomic command", async () => {
    const composition = createComposition();
    let capturedInput: unknown;
    composition.resolveRequestedQuantities.execute = async (
      _context,
      input,
    ) => {
      capturedInput = input;
    };
    const response = await buildApi(
      createDependencies({ composition }),
    ).request(
      "/api/v1/quotations/commercial-review",
      jsonRequest({
        quotationId,
        scenarioId,
        lines: [{ parsedLineId: matchId, requestedQuantity: "1000" }],
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ quotationId });
    expect(capturedInput).toEqual({
      quotationId,
      scenarioId,
      lines: [{ parsedLineId: matchId, requestedQuantity: "1000" }],
    });
  });
});

describe("Hono API error boundary", () => {
  it("returns a stable validation problem for an invalid command", async () => {
    const response = await buildApi(createDependencies()).request(
      "/api/v1/matching",
      jsonRequest({ quotationId: "not-an-id" }),
    );
    const problem = (await response.json()) as {
      code: string;
      fields?: Record<string, string>;
    };

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(problem.code).toBe("invalid-request");
    expect(Object.keys(problem.fields ?? {}).length).toBeGreaterThan(0);
  });

  it("returns a problem document for an unknown route", async () => {
    const response = await buildApi(createDependencies()).request(
      "/api/v1/not-a-route",
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "route-not-found" });
  });
});

describe("API command/query separation", () => {
  it("persists a copilot turn before returning the durable conversation", async () => {
    const composition = createComposition();
    let capturedInput: unknown;
    composition.chatWithQuoteCopilot.execute = async (_context, input) => {
      capturedInput = input;
      return {
        id: "00000000-0000-4000-8000-000000000031",
        role: "assistant",
        content: "Review the missing quantity.",
        suggestions: [],
        createdAt: new Date("2028-01-01T00:00:00.000Z"),
      };
    };
    composition.getQuoteCopilot.execute = async (_context, input) => ({
      quotationId: input.quotationId,
      messages: [
        {
          id: "00000000-0000-4000-8000-000000000031",
          role: "assistant",
          content: "Review the missing quantity.",
          suggestions: [],
          createdAt: new Date("2028-01-01T00:00:00.000Z"),
        },
      ],
    });
    const response = await buildApi(
      createDependencies({ composition }),
    ).request(
      "/api/v1/quote-copilot/messages",
      jsonRequest({ quotationId, message: "What is blocking this quote?" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(capturedInput).toEqual({
      quotationId,
      message: "What is blocking this quote?",
    });
    expect(await response.json()).toMatchObject({
      quotationId,
      messages: [{ role: "assistant" }],
    });
  });

  it("treats AI policy interpretation as a non-cacheable command", async () => {
    const composition = createComposition();
    let capturedInput: unknown;
    const original = composition.previewNegotiationPolicy.execute;
    composition.previewNegotiationPolicy.execute = async (context, input) => {
      capturedInput = input;
      return original(context, input);
    };
    const response = await buildApi(
      createDependencies({ composition }),
    ).request(
      "/api/v1/negotiation-policy/preview",
      jsonRequest({ quotationId, scenarioId }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(capturedInput).toEqual({ quotationId, scenarioId });
  });

  it("keeps upload completion separate from the quotation query", async () => {
    const composition = createComposition();
    let queryCalls = 0;
    composition.getQuotation.execute = async () => {
      queryCalls += 1;
      return {
        id: quotationId,
        status: "UPLOADED",
        scenarios: [],
        matches: [],
      };
    };
    const response = await buildApi(
      createDependencies({ composition }),
    ).request(
      "/api/v1/quotations",
      jsonRequest({
        objectKey: "uploads/quote.xlsx",
        contentHash: "a".repeat(64),
        idempotencyKey: "complete-1",
      }),
    );

    expect(await response.json()).toEqual({
      id: quotationId,
      state: "UPLOADED",
      replayed: false,
    });
    expect(queryCalls).toBe(0);
  });
});

describe("copilot streaming", () => {
  it("streams content before returning the durable conversation", async () => {
    const composition = createComposition();
    composition.getQuoteCopilot.execute = async (_context, input) => ({
      quotationId: input.quotationId,
      messages: [
        {
          id: "00000000-0000-4000-8000-000000000031",
          role: "assistant",
          content: "Review the missing quantity.",
          suggestions: [],
          createdAt: new Date("2028-01-01T00:00:00.000Z"),
        },
      ],
    });
    composition.chatWithQuoteCopilot.executeStreaming = async (
      _context,
      _input,
      onContent,
    ) => {
      await onContent("Review the");
      await onContent("Review the missing quantity.");
      return {
        id: "00000000-0000-4000-8000-000000000031",
        role: "assistant",
        content: "Review the missing quantity.",
        suggestions: [],
        createdAt: new Date("2028-01-01T00:00:00.000Z"),
      };
    };
    const response = await buildApi(
      createDependencies({ composition }),
    ).request(
      "/api/v1/quote-copilot/messages/stream",
      jsonRequest({ quotationId, message: "What is blocking this quote?" }),
    );
    const stream = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(stream).toContain("event: assistant-content");
    expect(stream).toContain("Review the missing quantity.");
    expect(stream).toContain("event: conversation");
  });
});

describe("event representation", () => {
  it("orders monotonic event ids without persistence metadata", () => {
    expect(
      formatSseBatch([
        { id: "10", aggregateId: "a", type: "later", version: 1, payload: {} },
        { id: "2", aggregateId: "a", type: "earlier", version: 1, payload: {} },
      ]),
    ).toMatch(/^id: 2[\s\S]*id: 10/);
  });

  it("serves a finite SSE snapshot for deterministic clients", async () => {
    const composition = createComposition();
    composition.readProjectionEvents.execute = async () => [
      { id: "2", aggregateId: "a", type: "updated", version: 1, payload: {} },
    ];
    const response = await buildApi(
      createDependencies({ composition }),
    ).request("/api/v1/events/stream?once=true");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain("event: updated");
  });
});
