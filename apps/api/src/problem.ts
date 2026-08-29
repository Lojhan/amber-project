import { randomUUID } from "node:crypto";
import { knownApplicationProblem } from "@procurement/bootstrap/api";
import { type Problem, problemSchema } from "@procurement/contracts";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { ApiEnvironment } from "./types.js";

const diagnosticCode = (value: unknown): string | undefined => {
  if (value === null || typeof value !== "object" || !("code" in value))
    return undefined;

  return typeof value.code === "string" ? value.code : undefined;
};

const zodFields = (error: ZodError): Record<string, string> =>
  Object.fromEntries(
    error.issues.map((issue) => [
      issue.path.join(".") || "request",
      issue.message,
    ]),
  );

export class ApiHttpError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiHttpError";
  }
}

export const toProblem = (error: Error, correlationId: string): Problem => {
  if (error instanceof ApiHttpError)
    return problemSchema.parse({
      type: `https://procurement.local/problems/${error.code}`,
      title: error.code,
      status: error.status,
      detail: error.message,
      code: error.code,
      correlationId,
    });

  if (error instanceof HTTPException)
    return problemSchema.parse({
      type: "https://procurement.local/problems/malformed-request",
      title: "malformed-request",
      status: error.status,
      detail: error.message || "The HTTP request is malformed",
      code: "malformed-request",
      correlationId,
    });

  const known = knownApplicationProblem(error);
  if (known)
    return problemSchema.parse({
      type: `https://procurement.local/problems/${known.code}`,
      title: known.code,
      status: known.status,
      detail: known.detail,
      code: known.code,
      correlationId,
      ...(known.fields ? { fields: known.fields } : {}),
    });

  if (error instanceof ZodError)
    return problemSchema.parse({
      type: "https://procurement.local/problems/invalid-request",
      title: "invalid-request",
      status: 422,
      detail: "Request validation failed",
      code: "invalid-request",
      correlationId,
      fields: zodFields(error),
    });

  return problemSchema.parse({
    type: "https://procurement.local/problems/internal-error",
    title: "internal-error",
    status: 500,
    detail: "An unexpected error occurred",
    code: "internal-error",
    correlationId,
  });
};

const correlationIdFrom = (context: Context<ApiEnvironment>): string =>
  context.get("actorContext")?.correlationId ?? randomUUID();

export const problemResponse = (
  context: Context<ApiEnvironment>,
  error: Error,
): Response => {
  const problem = toProblem(error, correlationIdFrom(context));

  if (problem.status >= 500)
    console.error("request failed", {
      correlationId: problem.correlationId,
      errorName: error.name,
      errorCode: diagnosticCode(error),
      causeCode: diagnosticCode(error.cause),
    });

  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: {
      "content-type": "application/problem+json",
      "x-correlation-id": problem.correlationId,
    },
  });
};

export const notFoundResponse = (context: Context<ApiEnvironment>): Response =>
  problemResponse(
    context,
    new ApiHttpError("route-not-found", 404, "Route not found"),
  );
