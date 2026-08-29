import { describe, expect, it, vi } from "vitest";
import { issueIdempotencyKey } from "./useWorkspaceCommands";

describe("preview-bound purchase-order idempotency", () => {
  it("reuses a lost-response retry key and creates a new key for a new preview", () => {
    const create = vi
      .fn()
      .mockReturnValueOnce("key-1")
      .mockReturnValueOnce("key-2");
    const keys = new Map<string, string>();
    const first = issueIdempotencyKey(keys, "digest-a", create);
    const retry = issueIdempotencyKey(keys, "digest-a", create);
    const changedPreview = issueIdempotencyKey(keys, "digest-b", create);
    expect([first, retry, changedPreview]).toEqual(["key-1", "key-1", "key-2"]);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
