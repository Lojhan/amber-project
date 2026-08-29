import { asBrandId } from "@procurement/domain";
import { describe, expect, it, vi } from "vitest";
import {
  CompleteQuotationUploadCommandHandler,
  ReserveQuotationUploadCommandHandler,
} from "./quotation-upload.js";

const context = {
  brandId: asBrandId("brand"),
  actorId: "actor",
  correlationId: "correlation",
};
const unitOfWork = {
  run: <T>(work: (transaction: { id: string }) => Promise<T>) =>
    work({ id: "tx" }),
};
const record = {
  id: "quotation",
  brandId: context.brandId,
  state: "UPLOADED" as const,
  version: 1,
  objectKey: "uploads/quote.xlsx",
  contentHash: "hash",
  catalogVersion: "catalog",
  note: null,
};

describe("quotation upload handlers", () => {
  it("reserves directly through object storage", async () => {
    const reserveUpload = vi.fn().mockResolvedValue({
      key: "uploads/quote.xlsx",
      url: "https://upload",
      headers: { a: "b" },
    });
    const handler = new ReserveQuotationUploadCommandHandler({
      reserveUpload,
    } as never);
    await expect(
      handler.execute(context as never, {
        filename: "quote.xlsx",
        contentHash: "hash",
      }),
    ).resolves.toMatchObject({
      objectKey: "uploads/quote.xlsx",
      uploadUrl: "https://upload",
      uploadMethod: "PUT",
    });
  });

  it("persists and schedules a new upload in one transaction", async () => {
    const insert = vi.fn().mockResolvedValue(record);
    const events = { append: vi.fn().mockResolvedValue(undefined) };
    const jobs = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const handler = new CompleteQuotationUploadCommandHandler({
      unitOfWork,
      objects: { verifyUpload: vi.fn().mockResolvedValue({}) },
      quotations: {
        findReservation: vi.fn().mockResolvedValue(null),
        findByContentHash: vi.fn().mockResolvedValue(null),
        insert,
      },
      catalog: { currentVersion: vi.fn().mockResolvedValue("catalog") },
      events,
      jobs,
      ids: { next: vi.fn().mockReturnValue("quotation") },
    } as never);
    await expect(
      handler.execute(context as never, {
        objectKey: "uploads/quote.xlsx",
        contentHash: "hash",
        idempotencyKey: "key",
      }),
    ).resolves.toEqual({ id: "quotation", state: "UPLOADED", replayed: false });
    expect(insert).toHaveBeenCalledWith(
      { id: "tx" },
      expect.objectContaining({ id: "quotation" }),
    );
    expect(jobs.enqueue).toHaveBeenCalledWith(
      { id: "tx" },
      expect.objectContaining({ name: "preflight-quotation" }),
    );
  });

  it("replays a matching idempotency reservation without opening a transaction", async () => {
    const handler = new CompleteQuotationUploadCommandHandler({
      unitOfWork: { run: vi.fn() },
      quotations: { findReservation: vi.fn().mockResolvedValue(record) },
    } as never);
    await expect(
      handler.execute(context as never, {
        objectKey: "uploads/quote.xlsx",
        contentHash: "hash",
        idempotencyKey: "key",
      }),
    ).resolves.toEqual({ id: "quotation", state: "UPLOADED", replayed: true });
  });

  it("rejects duplicate workbook content with different commercial context", async () => {
    const handler = new CompleteQuotationUploadCommandHandler({
      unitOfWork: { run: vi.fn() },
      quotations: {
        findReservation: vi.fn().mockResolvedValue(null),
        findByContentHash: vi.fn().mockResolvedValue(record),
      },
    } as never);

    await expect(
      handler.execute(context as never, {
        objectKey: "uploads/another-copy.xlsx",
        contentHash: "hash",
        note: "maximum lead time 30 days",
        idempotencyKey: "different-key",
      }),
    ).rejects.toMatchObject({
      code: "quotation-context-conflict",
      status: 409,
    });
  });
});
