import { describe, expect, it } from "vitest";
import { ApiClient, ApiError } from "./client";

describe("ApiClient", () => {
  it("returns a typed successful payload", async () => {
    const client = new ApiClient(
      async () => new Response(JSON.stringify({ id: "q1" }), { status: 200 }),
    );
    await expect(
      client.request("/quotations/q1", (value) => value),
    ).resolves.toEqual({ id: "q1" });
  });

  it("preserves RFC 9457-like API failures", async () => {
    const client = new ApiClient(
      async () =>
        new Response(
          JSON.stringify({
            type: "https://example.test/problems/blocked",
            title: "Blocked",
            status: 403,
            detail: "No active brand",
          }),
          { status: 403 },
        ),
    );
    await expect(
      client.request("/quotations/q1", (value) => value),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("creates a generic problem for non-JSON failures", async () => {
    const client = new ApiClient(async () => new Response("", { status: 503 }));
    await expect(
      client.request("/health", (value) => value),
    ).rejects.toMatchObject({
      problem: { status: 503 },
    });
  });
});
