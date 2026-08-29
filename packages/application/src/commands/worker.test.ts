import { asBrandId } from "@procurement/domain";
import { describe, expect, it } from "vitest";
import {
  CompleteQuotationPreflightCommandHandler,
  ParseQuotationCommandHandler,
} from "./upload-worker.js";
import { IdempotentWorkerExecutionService } from "./worker-execution.js";

const job = {
  brandId: asBrandId("brand-1"),
  quotationId: "quotation-1",
  objectKey: "q/key",
  correlationId: "correlation-1",
};
const unitOfWork = {
  run: <T>(work: (tx: { id: string }) => Promise<T>) => work({ id: "tx" }),
};

describe("upload worker commands", () => {
  it("rejects an unsafe workbook and schedules no parse job", async () => {
    const preflight: boolean[] = [];
    const enqueued: string[] = [];
    const handler = new CompleteQuotationPreflightCommandHandler({
      objects: { read: async () => new Uint8Array([1]) },
      parser: { preflight: async () => ({ safe: false, reason: "macro" }) },
      uploads: {
        finishPreflight: async (_tx: unknown, _job: unknown, safe: boolean) => {
          preflight.push(safe);
        },
      },
      jobs: {
        enqueue: async (_tx: unknown, scheduled: { name: string }) => {
          enqueued.push(scheduled.name);
          return "job";
        },
      },
      unitOfWork,
    } as never);
    await handler.execute(job);
    expect(preflight).toEqual([false]);
    expect(enqueued).toEqual([]);
  });

  it("does not parse a completed quotation replay", async () => {
    let parsed = false;
    const handler = new ParseQuotationCommandHandler({
      objects: {},
      parser: {
        parse: async () => {
          parsed = true;
          return { scenarios: [] };
        },
      },
      uploads: {
        loadParseTarget: async () => ({
          state: "REVIEW_REQUIRED",
          objectKey: "q/key",
          contentHash: "hash",
          scenarioCount: 1,
        }),
      },
      hashing: { sha256: () => "hash" },
      jobs: { enqueue: async () => "job" },
      unitOfWork,
      ids: { next: () => "id" },
    } as never);
    await handler.execute(job);
    expect(parsed).toBe(false);
  });

  it("publishes the parsed projection and schedules matching atomically", async () => {
    const events: string[] = [];
    const jobs: string[] = [];
    const handler = new ParseQuotationCommandHandler({
      objects: { read: async () => new Uint8Array([1]) },
      parser: {
        parse: async () => ({
          requiresInterpretation: false,
          scenarios: [
            {
              sourceSheet: "Quote",
              rationale: "Single scenario",
              metadata: {},
              lines: [],
            },
          ],
        }),
      },
      uploads: {
        loadParseTarget: async () => ({
          state: "PARSING",
          objectKey: "q/key",
          contentHash: "hash",
          scenarioCount: 0,
        }),
        persistParsedQuotation: async () => undefined,
        finishParse: async () => undefined,
      },
      hashing: { sha256: () => "hash" },
      events: {
        append: async (_tx: unknown, event: { type: string }) => {
          events.push(event.type);
          return {};
        },
      },
      jobs: {
        enqueue: async (_tx: unknown, scheduled: { name: string }) => {
          jobs.push(scheduled.name);
          return "job";
        },
      },
      unitOfWork,
    } as never);

    await handler.execute(job);

    expect(events).toEqual(["quotation.parsed"]);
    expect(jobs).toEqual(["match-candidates"]);
  });
});

describe("worker failure and replay semantics", () => {
  it("marks a hash mismatch as a parse failure before parsing", async () => {
    const failures: string[] = [];
    const handler = new ParseQuotationCommandHandler({
      objects: {
        read: async () => new Uint8Array([1]),
      },
      parser: {
        parse: async () => {
          throw new Error("must not parse");
        },
      },
      uploads: {
        loadParseTarget: async () => ({
          state: "PARSING",
          objectKey: "q/key",
          contentHash: "expected",
          scenarioCount: 0,
        }),
        markParseFailed: async (
          _transaction: unknown,
          _job: unknown,
          reason: string,
        ) => {
          failures.push(reason);
        },
      },
      hashing: { sha256: () => "actual" },
      jobs: { enqueue: async () => "job" },
      unitOfWork,
      ids: { next: () => "id" },
    } as never);
    await handler.execute(job);
    expect(failures).toEqual(["content_hash_mismatch"]);
  });

  it("marks a successful execution once and replays subsequent delivery", async () => {
    const completed = new Set<string>();
    const service = new IdempotentWorkerExecutionService(
      {
        claim: async (_tx: unknown, key: string) => {
          if (completed.has(key)) return false;
          completed.add(key);
          return true;
        },
        recordFailure: async () => undefined,
      },
      unitOfWork,
    );
    let calls = 0;
    expect(
      await service.execute("key", async () => {
        calls += 1;
      }),
    ).toEqual({ replayed: false });
    expect(
      await service.execute("key", async () => {
        calls += 1;
      }),
    ).toEqual({ replayed: true });
    expect(calls).toBe(1);
  });
});
