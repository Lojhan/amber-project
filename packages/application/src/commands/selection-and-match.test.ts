import { asActorId, asBrandId } from "@procurement/domain";
import { describe, expect, it, vi } from "vitest";
import { ResolveCatalogMatchCommandHandler } from "./resolve-catalog-match.js";
import { SelectQuotationScenarioCommandHandler } from "./select-quotation-scenario.js";

const context = {
  brandId: asBrandId("brand"),
  actorId: asActorId("actor"),
  correlationId: "correlation",
};
const unitOfWork = {
  run: <T>(work: (transaction: { id: string }) => Promise<T>) =>
    work({ id: "tx" }),
};
const quotation = {
  id: "quotation",
  brandId: context.brandId,
  state: "REVIEW_REQUIRED" as const,
  version: 1,
  objectKey: "object",
  contentHash: "hash",
  catalogVersion: "catalog",
  note: null,
};

describe("scenario selection", () => {
  it("selects an existing scenario in the write transaction", async () => {
    const selectScenario = vi.fn().mockResolvedValue(true);
    const handler = new SelectQuotationScenarioCommandHandler({
      unitOfWork,
      quotations: {
        loadForUpdate: vi.fn().mockResolvedValue(quotation),
        transition: vi.fn().mockResolvedValue(quotation),
      },
      scenarios: {
        selectScenario,
      },
      commercialReview: { hasBlockers: vi.fn().mockResolvedValue(false) },
      matches: {
        resolutionSummary: vi
          .fn()
          .mockResolvedValue({ unresolved: 0, included: 1 }),
      },
    } as never);
    await handler.execute(context, {
      quotationId: "quotation",
      scenarioId: "scenario",
    });
    expect(selectScenario).toHaveBeenCalledWith(
      { id: "tx" },
      expect.objectContaining({
        scenarioId: "scenario",
        actorId: context.actorId,
      }),
    );
  });

  it("keeps parser ambiguity behind the review gate", async () => {
    const transition = vi.fn();
    const handler = new SelectQuotationScenarioCommandHandler({
      unitOfWork,
      quotations: {
        loadForUpdate: vi.fn().mockResolvedValue(quotation),
        transition,
      },
      scenarios: {
        selectScenario: vi.fn().mockResolvedValue(true),
      },
      commercialReview: { hasBlockers: vi.fn().mockResolvedValue(true) },
      matches: {
        resolutionSummary: vi
          .fn()
          .mockResolvedValue({ unresolved: 0, included: 1 }),
      },
    } as never);

    await handler.execute(context, {
      quotationId: "quotation",
      scenarioId: "scenario",
    });

    expect(transition).not.toHaveBeenCalled();
  });
});

describe("match resolution", () => {
  it("moves an all-resolved quotation to READY", async () => {
    const transition = vi.fn().mockResolvedValue(quotation);
    const handler = new ResolveCatalogMatchCommandHandler({
      unitOfWork,
      quotations: {
        loadForUpdate: vi.fn().mockResolvedValue(quotation),
        transition,
      },
      matches: {
        resolve: vi.fn().mockResolvedValue({ scenarioId: "scenario" }),
        resolutionSummary: vi
          .fn()
          .mockResolvedValue({ unresolved: 0, included: 1 }),
      },
      scenarios: {
        selectedScenario: vi.fn().mockResolvedValue("scenario"),
      },
      commercialReview: { hasBlockers: vi.fn().mockResolvedValue(false) },
    } as never);
    await handler.execute(context, {
      quotationId: "quotation",
      scenarioId: "scenario",
      matchId: "match",
      action: "select",
      selectedProductId: "product",
    });
    expect(transition).toHaveBeenCalledWith(
      { id: "tx" },
      expect.objectContaining({ nextState: "READY" }),
    );
  });

  it("keeps an all-excluded quotation behind the review gate", async () => {
    const transition = vi.fn().mockResolvedValue(quotation);
    const handler = new ResolveCatalogMatchCommandHandler({
      unitOfWork,
      quotations: {
        loadForUpdate: vi.fn().mockResolvedValue(quotation),
        transition,
      },
      matches: {
        resolve: vi.fn().mockResolvedValue({ scenarioId: "scenario" }),
        resolutionSummary: vi
          .fn()
          .mockResolvedValue({ unresolved: 0, included: 0 }),
      },
      scenarios: {
        selectedScenario: vi.fn().mockResolvedValue("scenario"),
      },
      commercialReview: { hasBlockers: vi.fn().mockResolvedValue(false) },
    } as never);

    await handler.execute(context, {
      quotationId: "quotation",
      scenarioId: "scenario",
      matchId: "match",
      action: "exclude",
    });

    expect(transition).not.toHaveBeenCalled();
  });
});
