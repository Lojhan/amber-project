import { asBrandId } from "@procurement/domain";
import { describe, expect, it, vi } from "vitest";
import {
  defaultCommercialNoteInterpretation,
  deriveNegotiationPolicy,
} from "../negotiation-policy.js";
import { StartNegotiationCommandHandler } from "./start-negotiation.js";

const context = {
  brandId: asBrandId("brand-1"),
  actorId: "actor-1",
  correlationId: "correlation-1",
};
const unitOfWork = {
  run: <T>(work: (transaction: { id: string }) => Promise<T>) =>
    work({ id: "tx" }),
};
const input = {
  quotationId: "quotation-1",
  scenarioId: "scenario-1",
  policyHash: deriveNegotiationPolicy(defaultCommercialNoteInterpretation())
    .hash,
  confirmationToken: "signed-policy-confirmation",
};

const dependencies = (
  selectedScenario: string | null,
  unresolvedMatchCount = 0,
) => ({
  unitOfWork,
  scenarios: { selectedScenario: vi.fn().mockResolvedValue(selectedScenario) },
  negotiations: {
    loadStartFacts: vi.fn().mockResolvedValue({
      quotationState: "READY",
      quotationNote: null,
      currency: "USD",
      unresolvedMatchCount,
      lines: [
        {
          productId: "product-1",
          quantity: 1n,
          baselineUnitPriceMinor: 100n,
        },
      ],
    }),
    createOrderIntent: vi.fn(),
    create: vi.fn(),
  },
  jobs: { enqueue: vi.fn() },
  events: { append: vi.fn().mockResolvedValue({}) },
  ids: { next: vi.fn().mockReturnValue("id") },
  confirmationTokens: {
    verifyPolicy: vi
      .fn()
      .mockReturnValue(
        deriveNegotiationPolicy(defaultCommercialNoteInterpretation()),
      ),
  },
  clock: { now: vi.fn().mockReturnValue(new Date("2026-08-29T12:00:00Z")) },
});

describe("StartNegotiationCommandHandler", () => {
  it("publishes the started event in the command transaction", async () => {
    const configured = dependencies("scenario-1");
    const handler = new StartNegotiationCommandHandler(configured as never);

    await handler.execute(context as never, input);

    expect(configured.events.append).toHaveBeenCalledWith(
      { id: "tx" },
      expect.objectContaining({
        aggregateType: "negotiation",
        type: "negotiation.started",
      }),
    );
  });

  it("requires the submitted scenario to be explicitly selected", async () => {
    const handler = new StartNegotiationCommandHandler(
      dependencies(null) as never,
    );

    await expect(
      handler.execute(context as never, input),
    ).rejects.toMatchObject({
      code: "scenario-not-selected",
      status: 409,
    });
  });

  it("blocks selected scenarios with unresolved included lines", async () => {
    const handler = new StartNegotiationCommandHandler(
      dependencies("scenario-1", 1) as never,
    );

    await expect(
      handler.execute(context as never, input),
    ).rejects.toMatchObject({
      code: "matches-unresolved",
      status: 409,
    });
  });
});
