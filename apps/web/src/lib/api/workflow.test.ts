import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";
import { ProcurementApi } from "./workflow";

describe("ProcurementApi", () => {
  it("forwards the content hash and decodes exact PUT headers", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            objectKey: "valden/upload.xlsx",
            uploadUrl: "https://storage.example/upload",
            uploadMethod: "PUT",
            headers: {
              "content-type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "x-amz-meta-sha256": "a".repeat(64),
            },
          }),
          { status: 200 },
        ),
    );
    const api = new ProcurementApi(new ApiClient(fetcher));

    await expect(
      api.reserve("quote.xlsx", "a".repeat(64)),
    ).resolves.toMatchObject({
      uploadMethod: "PUT",
      headers: { "x-amz-meta-sha256": "a".repeat(64) },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/quotations/uploads",
      expect.objectContaining({
        body: JSON.stringify({
          filename: "quote.xlsx",
          contentHash: "a".repeat(64),
        }),
      }),
    );
  });

  it("sends an explicit reset command", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const api = new ProcurementApi(new ApiClient(fetcher));

    await expect(api.resetChallenge()).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/challenge/reset",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
  });
});
