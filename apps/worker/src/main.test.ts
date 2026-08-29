import type {
  ProductionWorkerRuntime,
  WorkerQueueJob,
  WorkerQueueName,
} from "@procurement/bootstrap/worker";
import { describe, expect, it, vi } from "vitest";
import { registerConsumers } from "./main.js";

const brandId = "33333333-3333-4333-8333-333333333333";

const fakeRuntime = () => {
  const consumers = new Map<
    WorkerQueueName,
    (job: WorkerQueueJob) => Promise<unknown>
  >();
  const completeQuotationPreflight = vi.fn().mockResolvedValue(undefined);
  const recordFailure = vi.fn().mockResolvedValue(undefined);
  const runtime = {
    composition: {
      completeQuotationPreflight: { execute: completeQuotationPreflight },
      parseQuotation: { execute: vi.fn() },
      generateMatchCandidates: { execute: vi.fn() },
      executeNegotiationTurn: { execute: vi.fn() },
      continueDecision: { execute: vi.fn() },
      executions: {
        execute: vi.fn(async (_key: string, work: () => Promise<void>) => {
          await work();
          return { replayed: false };
        }),
      },
      recordFailure: { execute: recordFailure },
    },
    queue: {
      start: vi.fn(),
      work: vi.fn(
        async (
          name: WorkerQueueName,
          handler: (job: WorkerQueueJob) => Promise<unknown>,
        ) => {
          consumers.set(name, handler);
        },
      ),
      stop: vi.fn(),
    },
    health: vi.fn(),
    close: vi.fn(),
  } as unknown as ProductionWorkerRuntime;

  return { runtime, consumers, completeQuotationPreflight, recordFailure };
};

describe("worker transport", () => {
  it("registers every queue and validates a persisted envelope", async () => {
    const { runtime, consumers, completeQuotationPreflight } = fakeRuntime();
    await registerConsumers(runtime);

    expect(consumers.size).toBe(5);
    await consumers.get("preflight-quotation")?.({
      id: "job-1",
      name: "preflight-quotation",
      data: {
        correlationId: "request-1",
        payload: {
          brandId,
          quotationId: "quotation-1",
          objectKey: "uploads/quote.xlsx",
          correlationId: "request-1",
        },
      },
    });

    expect(completeQuotationPreflight).toHaveBeenCalledWith(
      expect.objectContaining({ brandId, quotationId: "quotation-1" }),
    );
  });

  it("records a durable failure and rethrows for queue retry", async () => {
    const { runtime, consumers, completeQuotationPreflight, recordFailure } =
      fakeRuntime();
    completeQuotationPreflight.mockRejectedValueOnce(
      new Error("invalid workbook"),
    );
    await registerConsumers(runtime);
    const job = {
      id: "job-2",
      name: "preflight-quotation",
      data: {
        correlationId: "request-2",
        payload: {
          brandId,
          quotationId: "quotation-2",
          objectKey: "uploads/quote.xlsx",
          correlationId: "request-2",
        },
      },
    } as const;

    await expect(consumers.get("preflight-quotation")?.(job)).rejects.toThrow(
      "invalid workbook",
    );
    expect(recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-2",
        queue: "preflight-quotation",
        correlationId: "request-2",
      }),
    );
  });
});
