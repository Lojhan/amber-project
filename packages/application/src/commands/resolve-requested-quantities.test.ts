import { asActorId, asBrandId } from "@procurement/domain";
import { describe, expect, it, vi } from "vitest";
import { ResolveRequestedQuantitiesCommandHandler } from "./resolve-requested-quantities.js";

const context = {
  brandId: asBrandId("brand"),
  actorId: asActorId("actor"),
  correlationId: "correlation",
};
const transaction = { id: "tx" };
const quotation = {
  id: "quotation",
  brandId: context.brandId,
  state: "INTERPRETATION_REQUIRED" as const,
  version: 1,
  objectKey: "object",
  contentHash: "hash",
  catalogVersion: "catalog",
  note: null,
};

describe("requested quantity review", () => {
  it("persists the complete review and opens the negotiation gate", async () => {
    const resolveQuantities = vi.fn().mockResolvedValue(true);
    const transition = vi.fn().mockResolvedValue(quotation);
    const handler = new ResolveRequestedQuantitiesCommandHandler({
      unitOfWork: {
        run: <T>(work: (value: typeof transaction) => Promise<T>) =>
          work(transaction),
      },
      quotations: {
        loadForUpdate: vi.fn().mockResolvedValue(quotation),
        transition,
      },
      scenarios: { selectedScenario: vi.fn().mockResolvedValue("scenario") },
      matches: {
        resolutionSummary: vi
          .fn()
          .mockResolvedValue({ unresolved: 0, included: 1 }),
      },
      commercialReview: {
        resolveQuantities,
        hasBlockers: vi.fn().mockResolvedValue(false),
      },
    } as never);

    await handler.execute(context, {
      quotationId: quotation.id,
      scenarioId: "scenario",
      lines: [{ parsedLineId: "line", requestedQuantity: "5000" }],
    });

    expect(resolveQuantities).toHaveBeenCalledWith(transaction, {
      brandId: context.brandId,
      actorId: context.actorId,
      quotationId: quotation.id,
      scenarioId: "scenario",
      lines: [{ parsedLineId: "line", requestedQuantity: 5000n }],
    });
    expect(transition).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ nextState: "READY" }),
    );
  });

  it("does not open negotiation when every commercial line is excluded", async () => {
    const transition = vi.fn().mockResolvedValue(quotation);
    const handler = new ResolveRequestedQuantitiesCommandHandler({
      unitOfWork: {
        run: <T>(work: (value: typeof transaction) => Promise<T>) =>
          work(transaction),
      },
      quotations: {
        loadForUpdate: vi.fn().mockResolvedValue(quotation),
        transition,
      },
      scenarios: { selectedScenario: vi.fn().mockResolvedValue("scenario") },
      matches: {
        resolutionSummary: vi
          .fn()
          .mockResolvedValue({ unresolved: 0, included: 0 }),
      },
      commercialReview: {
        resolveQuantities: vi.fn().mockResolvedValue(true),
        hasBlockers: vi.fn().mockResolvedValue(false),
      },
    } as never);

    await handler.execute(context, {
      quotationId: quotation.id,
      scenarioId: "scenario",
      lines: [{ parsedLineId: "line", requestedQuantity: "5000" }],
    });

    expect(transition).not.toHaveBeenCalled();
  });

  it("rejects review for a scenario that is not selected", async () => {
    const handler = new ResolveRequestedQuantitiesCommandHandler({
      unitOfWork: {
        run: <T>(work: (value: typeof transaction) => Promise<T>) =>
          work(transaction),
      },
      quotations: { loadForUpdate: vi.fn().mockResolvedValue(quotation) },
      scenarios: { selectedScenario: vi.fn().mockResolvedValue("other") },
    } as never);

    await expect(
      handler.execute(context, {
        quotationId: quotation.id,
        scenarioId: "scenario",
        lines: [{ parsedLineId: "line", requestedQuantity: "1000" }],
      }),
    ).rejects.toMatchObject({ code: "scenario-not-selected", status: 409 });
  });
});
