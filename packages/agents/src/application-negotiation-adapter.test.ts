import { asBrandId } from "@procurement/domain";
import { describe, expect, it, vi } from "vitest";
import { OpenAIProposalModelAdapter } from "./application-negotiation-adapter.js";

const context = {
  brandId: asBrandId("00000000-0000-4000-8000-000000000001"),
  quotationId: "00000000-0000-4000-8000-000000000002",
  supplierId: "S1" as const,
  round: 1 as const,
  currency: "USD",
  brandMessage: "Please improve the uploaded quotation baseline.",
  priorConversation: [],
  lines: [
    {
      productId: "00000000-0000-4000-8000-000000000003",
      quantity: 2n,
      baselineUnitPriceMinor: 1250n,
    },
  ],
};

describe("OpenAIProposalModelAdapter", () => {
  it("maps a structured proposal into the application result and stringifies money lines", async () => {
    const propose = vi.fn().mockResolvedValue({
      status: "proposal",
      proposal: { supplierId: "S1", round: 1, currency: "USD", lines: [] },
      metadata: { modelId: "openai-model", tokenUsage: {}, requestId: null },
    });
    const adapter = new OpenAIProposalModelAdapter({ propose });

    const result = await adapter.propose(context);

    expect(result).toEqual({
      status: "proposal",
      result: {
        status: "proposal",
        proposal: { supplierId: "S1", round: 1, currency: "USD", lines: [] },
        metadata: { modelId: "openai-model", tokenUsage: {}, requestId: null },
      },
      metadata: { modelId: "openai-model", tokenUsage: {}, requestId: null },
    });
    expect(propose).toHaveBeenCalledWith(
      "S1",
      expect.objectContaining({
        lines: [
          {
            productId: context.lines[0]!.productId,
            quantity: "2",
            baselineUnitPriceMinor: "1250",
          },
        ],
        brandMessage: context.brandMessage,
        priorConversation: [],
      }),
    );
  });

  it("rejects an invalid provider result safely", async () => {
    const adapter = new OpenAIProposalModelAdapter({
      propose: vi.fn().mockResolvedValue({ unexpected: true }),
    });
    await expect(adapter.propose(context)).resolves.toMatchObject({
      status: "invalid",
      result: { status: "invalid" },
      metadata: {},
    });
  });
});
