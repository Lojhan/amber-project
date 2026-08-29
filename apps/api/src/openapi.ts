import { problemSchema } from "@procurement/contracts";
import type { JSONValue } from "hono/utils/types";
import type { z } from "zod";

type WireSchema = z.ZodType;

export const jsonContent = (schema: WireSchema, description = "Success") => ({
  content: {
    "application/json": { schema },
  },
  description,
});

const problemContent = (description: string) =>
  jsonContent(problemSchema, description);

export const problemResponses = {
  400: problemContent("Malformed request"),
  401: problemContent("Authentication required"),
  403: problemContent("Operation forbidden"),
  404: problemContent("Resource not found"),
  409: problemContent("Request conflicts with current state"),
  422: problemContent("Request validation failed"),
  500: problemContent("Unexpected server error"),
} as const;

export const jsonBody = (schema: WireSchema) => ({
  content: {
    "application/json": { schema },
  },
  required: true,
});

export const openApiDocument = {
  openapi: "3.1.0" as const,
  info: { title: "Procurement API", version: "1.0.0" },
};

/** Contract schemas guarantee that successful payloads are JSON-compatible. */
export const wireJson = (value: unknown): JSONValue => value as JSONValue;
