import { asBrandId } from "@procurement/domain";
import { describe, expect, it, vi } from "vitest";
import type { DrizzleUnitOfWork } from "./drizzle-unit-of-work.js";
import { PgBossJobScheduler } from "./pg-boss-bridge.js";
import { transactionConnection } from "./pg-boss-transaction-access.js";

describe("PgBossJobScheduler", () => {
  it("enqueues through the initiating transaction connection", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const connectionFor = vi.fn(() => ({ query }));
    const send = vi.fn(async (_name, _data, options) => {
      await options.db.executeSql("bridge statement", [1]);
      return "job-1";
    });
    const scheduler = new PgBossJobScheduler(
      { send } as never,
      {
        [transactionConnection]: connectionFor,
      } as unknown as DrizzleUnitOfWork,
    );
    const transaction = { id: "transaction-1" };

    await expect(
      scheduler.enqueue(transaction, {
        name: "parse-quotation",
        payload: { brandId: asBrandId("brand-1") },
        correlationId: "correlation-1",
        idempotencyKey: "parse:brand-1:quotation-1",
      }),
    ).resolves.toBe("job-1");

    expect(connectionFor).toHaveBeenCalledWith(transaction);
    expect(send).toHaveBeenCalledWith(
      "parse-quotation",
      {
        payload: { brandId: "brand-1" },
        correlationId: "correlation-1",
      },
      expect.objectContaining({
        singletonKey: "parse:brand-1:quotation-1",
      }),
    );
    expect(query).toHaveBeenCalledWith("bridge statement", [1]);
  });
});
