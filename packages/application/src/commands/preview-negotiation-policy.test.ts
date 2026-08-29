import { asActorId, asBrandId } from "@procurement/domain";
import { describe, expect, it, vi } from "vitest";
import { PreviewNegotiationPolicyCommandHandler } from "./preview-negotiation-policy.js";

const context = {
  brandId: asBrandId("brand"),
  actorId: asActorId("actor"),
  correlationId: "correlation",
};
const input = { quotationId: "quotation", scenarioId: "scenario" };

const dependencies = (note: string | null | undefined) => ({
  policies: { quotationNote: vi.fn().mockResolvedValue(note) },
  interpreter: {
    interpret: vi.fn().mockResolvedValue({
      primaryPriority: "quality" as const,
      hardMaxLeadDays: 30,
      summary: "Quality is primary and delivery is capped at 30 days.",
      warnings: [],
      source: "ai" as const,
    }),
  },
  confirmationTokens: {
    issuePolicy: vi.fn().mockReturnValue("signed-policy-confirmation"),
  },
  clock: { now: vi.fn().mockReturnValue(new Date("2026-08-29T12:00:00Z")) },
});

describe("PreviewNegotiationPolicyCommandHandler", () => {
  it("interprets a note, normalizes weights, and signs the exact policy", async () => {
    const configured = dependencies("Quality first; deliver within 30 days.");
    const handler = new PreviewNegotiationPolicyCommandHandler(
      configured as never,
    );

    const preview = await handler.execute(context, input);

    expect(configured.interpreter.interpret).toHaveBeenCalledOnce();
    expect(preview).toMatchObject({
      weights: { cost: "0.35", quality: "0.40", lead: "0.15" },
      constraints: { hardMaxLead: 30 },
      confirmationToken: "signed-policy-confirmation",
    });
    expect(configured.confirmationTokens.issuePolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        quotationId: input.quotationId,
        scenarioId: input.scenarioId,
        policy: expect.objectContaining({ hash: preview.policyHash }),
      }),
      new Date("2026-08-29T12:00:00Z"),
    );
  });

  it("uses the standard policy without spending an AI call when the note is empty", async () => {
    const configured = dependencies(null);
    const handler = new PreviewNegotiationPolicyCommandHandler(
      configured as never,
    );

    const preview = await handler.execute(context, input);

    expect(configured.interpreter.interpret).not.toHaveBeenCalled();
    expect(preview.interpretation.source).toBe("default");
    expect(preview.weights.cost).toBe("0.45");
  });

  it("returns a retryable boundary error when AI interpretation fails", async () => {
    const configured = dependencies("A note");
    configured.interpreter.interpret.mockRejectedValue(new Error("provider"));
    const handler = new PreviewNegotiationPolicyCommandHandler(
      configured as never,
    );

    await expect(handler.execute(context, input)).rejects.toMatchObject({
      code: "commercial-note-interpretation-unavailable",
      status: 503,
    });
  });
});
