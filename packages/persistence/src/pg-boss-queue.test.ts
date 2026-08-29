import { describe, expect, it, vi } from "vitest";
import { PgBossQueue } from "./pg-boss-bridge.js";

type Payloads = { parse: Readonly<{ quotationId: string }> };

const createHarness = () => {
  let consumer: ((jobs: unknown[]) => Promise<unknown>) | undefined;
  const boss = {
    start: vi.fn(async () => undefined),
    createQueue: vi.fn(async () => undefined),
    work: vi.fn(async (_name, _options, handler) => {
      consumer = handler;
      return "worker-id";
    }),
    stop: vi.fn(async () => undefined),
  };
  const decode = vi.fn(
    (_name: "parse", value: unknown): Payloads["parse"] =>
      value as Payloads["parse"],
  );
  const queue = new PgBossQueue<Payloads>(
    "postgres://unused",
    decode,
    boss as never,
  );

  return { boss, decode, queue, invoke: (jobs: unknown[]) => consumer?.(jobs) };
};

describe("PgBossQueue", () => {
  it("owns queue lifecycle and graceful shutdown", async () => {
    const { boss, queue } = createHarness();

    await queue.start();
    await queue.create("parse", { retryLimit: 3 });
    await queue.stop();

    expect(boss.start).toHaveBeenCalledOnce();
    expect(boss.createQueue).toHaveBeenCalledWith("parse", { retryLimit: 3 });
    expect(boss.stop).toHaveBeenCalledWith({ graceful: true, timeout: 30_000 });
  });

  it("decodes jobs and returns explicit per-job completion results", async () => {
    const { decode, invoke, queue } = createHarness();
    const handler = vi.fn(async () => ({ parsed: true }));

    await queue.work("parse", handler);
    await expect(
      invoke([{ id: "job-1", data: { quotationId: "quotation-1" } }]),
    ).resolves.toEqual([
      {
        id: "job-1",
        status: "completed",
        output: { result: { parsed: true } },
      },
    ]);
    expect(decode).toHaveBeenCalledWith("parse", {
      quotationId: "quotation-1",
    });
    expect(handler).toHaveBeenCalledWith({
      id: "job-1",
      name: "parse",
      data: { quotationId: "quotation-1" },
    });
  });

  it("propagates decoder and handler failures for pg-boss retry", async () => {
    const handlerFailure = createHarness();
    await handlerFailure.queue.work("parse", async () => {
      throw new Error("work failed");
    });

    await expect(
      handlerFailure.invoke([
        { id: "job-1", data: { quotationId: "quotation-1" } },
      ]),
    ).rejects.toThrow("work failed");

    const decodeFailure = createHarness();
    decodeFailure.decode.mockImplementationOnce(() => {
      throw new Error("invalid envelope");
    });
    await decodeFailure.queue.work("parse", async () => undefined);

    await expect(
      decodeFailure.invoke([{ id: "job-2", data: {} }]),
    ).rejects.toThrow("invalid envelope");
  });
});
