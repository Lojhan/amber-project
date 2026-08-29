import {
  asActorId,
  asBrandId,
  asOfferId,
  asProductId,
  asQuotationId,
  money,
} from "@procurement/domain";
import { describe, expect, it, vi } from "vitest";
import { IssuePurchaseOrderCommandHandler } from "./issue-purchase-order.js";
import { PreparePurchaseOrderCommandHandler } from "./prepare-purchase-order.js";

const brandId = asBrandId("brand");
const context = {
  brandId,
  actorId: asActorId("actor"),
  correlationId: "correlation",
};
const unitOfWork = {
  run: <T>(work: (transaction: { id: string }) => Promise<T>) =>
    work({ id: "tx" }),
};
const snapshot = {
  brandId,
  negotiationId: "negotiation",
  recommendationId: "recommendation",
  catalogVersion: "catalog",
  decisionVersion: "1",
  eligible: true,
  negotiationState: "RECOMMENDED",
  orderIntent: {
    brandId,
    quotationId: asQuotationId("quotation"),
    currency: "USD" as const,
    lines: [
      {
        productId: asProductId("product"),
        quantity: 1n,
        baselineUnitPrice: money("USD", 100n),
      },
    ],
  },
  selectedOffer: {
    id: asOfferId("offer"),
    supplierId: "S1" as const,
    currency: "USD" as const,
    leadTimeDays: 45,
    capacityPercent: 100,
    expiresAt: new Date("2099-01-01"),
    policyValid: true,
    lines: [
      {
        productId: asProductId("product"),
        quantity: 1n,
        unitPrice: money("USD", 94n),
      },
    ],
    paymentSchedule: [
      { milestone: "ORDER" as const, percentBasisPoints: 2000 },
      { milestone: "PRE_SHIPMENT" as const, percentBasisPoints: 4000 },
      { milestone: "DELIVERY" as const, percentBasisPoints: 4000 },
    ],
  },
};
const hashing = { sha256: vi.fn().mockReturnValue("digest") };

describe("prepare purchase order", () => {
  it("prepares an authorized selected offer in one transaction", async () => {
    const issue = vi.fn().mockReturnValue("token");
    const handler = new PreparePurchaseOrderCommandHandler({
      unitOfWork,
      purchaseOrders: {
        loadIssuableSnapshot: vi.fn().mockResolvedValue(snapshot),
      },
      confirmationTokens: { issue },
      hashing,
      clock: { now: () => new Date("2026-01-01") },
    } as never);
    await expect(
      handler.execute(context, {
        negotiationId: "negotiation",
        selectedOfferId: "offer",
      }),
    ).resolves.toMatchObject({
      digest: "digest",
      confirmationToken: "token",
      totalMinor: "94",
      currency: "USD",
      supplierId: "S1",
      lineCount: 1,
      leadTimeDays: 45,
    });
    expect(issue).toHaveBeenCalledWith(
      expect.objectContaining({ offerId: "offer" }),
      expect.any(Date),
    );
  });

  it("rejects stale selected offers before confirmation", async () => {
    const handler = new PreparePurchaseOrderCommandHandler({
      unitOfWork,
      purchaseOrders: {
        loadIssuableSnapshot: vi.fn().mockResolvedValue(snapshot),
      },
      confirmationTokens: {},
      hashing,
      clock: { now: () => new Date() },
    } as never);
    await expect(
      handler.execute(context, {
        negotiationId: "negotiation",
        selectedOfferId: "other",
      }),
    ).rejects.toMatchObject({ code: "offer-not-selected" });
  });
});

describe("issue purchase order", () => {
  it("replays an identical issue idempotency key in its transaction", async () => {
    const handler = new IssuePurchaseOrderCommandHandler({
      unitOfWork,
      purchaseOrders: {
        findByIdempotency: vi.fn().mockResolvedValue({
          id: "po",
          number: "PO-1",
          requestDigest: "digest",
        }),
      },
      hashing,
      confirmationTokens: {},
      clock: {},
      audits: {},
      events: {},
      ids: {},
    } as never);
    await expect(
      handler.execute(context, {
        negotiationId: "negotiation",
        selectedOfferId: "offer",
        previewDigest: "preview",
        confirmationToken: "x".repeat(16),
        idempotencyKey: "key",
      }),
    ).resolves.toEqual({ id: "po", number: "PO-1", replayed: true });
  });

  it("rejects a replay with a different request digest and short confirmations", async () => {
    const handler = new IssuePurchaseOrderCommandHandler({
      unitOfWork,
      purchaseOrders: {
        findByIdempotency: vi.fn().mockResolvedValue({
          id: "po",
          number: "PO-1",
          requestDigest: "other",
        }),
      },
      hashing,
      confirmationTokens: {},
      clock: {},
      audits: {},
      events: {},
      ids: {},
    } as never);
    await expect(
      handler.execute(context, {
        negotiationId: "negotiation",
        selectedOfferId: "offer",
        previewDigest: "preview",
        confirmationToken: "x".repeat(16),
        idempotencyKey: "key",
      }),
    ).rejects.toMatchObject({ code: "idempotency-conflict" });
    expect(() =>
      handler.execute(context, {
        negotiationId: "negotiation",
        selectedOfferId: "offer",
        previewDigest: "preview",
        confirmationToken: "short",
        idempotencyKey: "key",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "confirmation-invalid", status: 422 }),
    );
  });
});
