import { type Problem, problemSchema } from "@procurement/contracts";
import type { paths } from "./generated";

export type { Problem } from "@procurement/contracts";
export type Decoder<T> = (value: unknown) => T;
export type EventStreamMessage = Readonly<{ event: string; data: unknown }>;

type HttpMethod = "get" | "post";
type Endpoint<Path extends keyof paths, Method extends HttpMethod> =
  paths[Path] extends Record<Method, infer Operation>
    ? Operation extends { responses: unknown }
      ? Readonly<{ path: Path; method: Method }>
      : never
    : never;
type EndpointFor<Method extends HttpMethod> = {
  [Path in keyof paths]: Endpoint<Path, Method>;
}[keyof paths];
type OperationFor<Definition> =
  Definition extends Readonly<{
    path: infer Path;
    method: infer Method;
  }>
    ? Path extends keyof paths
      ? Method extends keyof paths[Path]
        ? paths[Path][Method]
        : never
      : never
    : never;
type JsonResponse<Definition> =
  OperationFor<Definition> extends {
    responses: { 200: { content: { "application/json": infer Response } } };
  }
    ? Response
    : never;
type JsonBody<Definition> =
  OperationFor<Definition> extends {
    requestBody: { content: { "application/json": infer Body } };
  }
    ? Body
    : never;

/**
 * The endpoint catalogue is checked against generated OpenAPI paths and verbs.
 * Callers cannot pair a valid path with the wrong HTTP method or JSON body.
 */
export const apiOperations = {
  resetChallenge: { path: "/api/v1/challenge/reset", method: "post" },
  quotation: { path: "/api/v1/quotations/{id}", method: "get" },
  quoteCopilot: {
    path: "/api/v1/quotations/{id}/copilot",
    method: "get",
  },
  chatWithQuoteCopilot: {
    path: "/api/v1/quote-copilot/messages",
    method: "post",
  },
  negotiation: { path: "/api/v1/negotiations/{id}", method: "get" },
  negotiationPolicy: {
    path: "/api/v1/negotiation-policy/preview",
    method: "post",
  },
  decision: {
    path: "/api/v1/negotiations/{negotiationId}/decision",
    method: "get",
  },
  reserveUpload: { path: "/api/v1/quotations/uploads", method: "post" },
  completeUpload: { path: "/api/v1/quotations", method: "post" },
  resolveMatch: { path: "/api/v1/matching", method: "post" },
  selectScenario: {
    path: "/api/v1/quotations/scenario-selection",
    method: "post",
  },
  commercialReview: {
    path: "/api/v1/quotations/commercial-review",
    method: "post",
  },
  startNegotiation: { path: "/api/v1/negotiations", method: "post" },
  previewPurchaseOrder: {
    path: "/api/v1/purchase-orders/preview",
    method: "post",
  },
  issuePurchaseOrder: { path: "/api/v1/purchase-orders/issue", method: "post" },
  purchaseOrders: { path: "/api/v1/purchase-orders", method: "get" },
  purchaseOrder: { path: "/api/v1/purchase-orders/{id}", method: "get" },
} as const satisfies Record<string, EndpointFor<"get"> | EndpointFor<"post">>;

export type ReadOperation = (typeof apiOperations)[keyof typeof apiOperations] &
  EndpointFor<"get">;
export type CommandOperation =
  (typeof apiOperations)[keyof typeof apiOperations] & EndpointFor<"post">;
export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
  }
}

export class ApiClient {
  constructor(
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = "",
  ) {}

  async request<T>(
    path: string,
    decode: Decoder<T>,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      credentials: "include",
      ...init,
    });
    const value: unknown = await response.json().catch(() => undefined);

    if (!response.ok)
      throw new ApiError(
        problemSchema.safeParse(value).success
          ? problemSchema.parse(value)
          : {
              type: "about:blank",
              title: "Request failed",
              status: response.status,
              detail: "The API returned an unrecognized error response.",
              code: "unrecognized-problem",
              correlationId: "unavailable",
            },
      );
    return decode(value);
  }

  get<
    Definition extends ReadOperation,
    Response extends JsonResponse<Definition>,
  >(
    definition: Definition,
    decode: Decoder<Response>,
    parameters: Record<string, string> = {},
  ): Promise<Response> {
    const resolvedPath = Object.entries(parameters).reduce<string>(
      (url, [name, value]) =>
        url.replace(`{${name}}`, encodeURIComponent(value)),
      definition.path,
    );
    return this.request(resolvedPath, decode);
  }

  command<
    Definition extends CommandOperation,
    Response extends JsonResponse<Definition>,
  >(
    definition: Definition,
    body: JsonBody<Definition>,
    decode: Decoder<Response>,
    idempotencyKey?: string,
  ) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    return this.request(definition.path, decode, {
      method: definition.method.toUpperCase(),
      headers,
      body: JSON.stringify(body),
    });
  }

  async streamCommand(
    path: string,
    body: unknown,
    onMessage: (message: EventStreamMessage) => void,
  ): Promise<void> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const value: unknown = await response.json().catch(() => undefined);
      throw new ApiError(
        problemSchema.safeParse(value).success
          ? problemSchema.parse(value)
          : {
              type: "about:blank",
              title: "Request failed",
              status: response.status,
              detail: "The API returned an unrecognized error response.",
              code: "unrecognized-problem",
              correlationId: "unavailable",
            },
      );
    }
    if (!response.body) throw new Error("The API returned an empty stream");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const result = await reader.read();
      buffer += decoder.decode(result.value, { stream: !result.done });
      const records = buffer.split(/\r?\n\r?\n/);
      buffer = records.pop() ?? "";

      for (const record of records) {
        const event = record
          .split(/\r?\n/)
          .find((line) => line.startsWith("event:"))
          ?.slice(6)
          .trim();
        const data = record
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (event && data) onMessage({ event, data: JSON.parse(data) });
      }

      if (result.done) break;
    }
  }
}
