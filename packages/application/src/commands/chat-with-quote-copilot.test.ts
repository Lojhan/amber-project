import { asActorId, asBrandId } from "@procurement/domain";
import { describe, expect, it, vi } from "vitest";
import {
  ChatWithQuoteCopilotCommandHandler,
  validCopilotSuggestions,
} from "./chat-with-quote-copilot.js";

const context = {
  brandId: asBrandId("brand"),
  actorId: asActorId("buyer"),
  correlationId: "request",
};
const quotation = {
  id: "quotation",
  status: "INTERPRETATION_REQUIRED",
  selectedScenarioId: "scenario",
  scenarios: [{ id: "scenario", label: "Sheet1" }],
  matches: [
    {
      id: "match",
      lineId: "line",
      scenarioId: "scenario",
      label: "SKU-1",
      matchReady: true,
      status: "RESOLVED",
      selectedProductId: "product",
      reviewReasons: [],
      candidates: [{ productId: "product", sku: "SKU-1", score: 1 }],
    },
  ],
};

describe("quote copilot", () => {
  it("rejects adjustments that target provisional catalog matches", () => {
    const provisional = {
      ...quotation,
      matches: quotation.matches.map((match) => ({
        ...match,
        matchReady: false,
        status: "PENDING",
      })),
    };

    expect(
      validCopilotSuggestions(provisional, [
        {
          kind: "exclude_line",
          title: "Exclude provisional line",
          explanation: "This must wait for catalog matching.",
          matchId: "match",
        },
        {
          kind: "set_quantity",
          title: "Set provisional quantity",
          explanation: "This must also wait.",
          lineId: "line",
          quantity: "10",
        },
      ]),
    ).toEqual([]);
  });

  it("stores the exchange and removes suggestions that do not reference the quote", async () => {
    const append = vi.fn().mockResolvedValue(undefined);
    const modelRespond = vi.fn().mockResolvedValue({
      content: "One line needs a quantity review.",
      suggestions: [
        {
          kind: "set_quantity",
          title: "Use 100 units",
          explanation: "This is within the quoted tier.",
          lineId: "line",
          quantity: "100",
        },
        {
          kind: "exclude_line",
          title: "Invented line",
          explanation: "This ID does not exist.",
          matchId: "invented",
        },
      ],
    });
    let nextId = 0;
    const handler = new ChatWithQuoteCopilotCommandHandler({
      unitOfWork: {
        run: <T>(work: (transaction: { id: string }) => Promise<T>) =>
          work({ id: "transaction" }),
      },
      quotations: { get: vi.fn().mockResolvedValue(quotation) },
      negotiations: { get: vi.fn() },
      decisions: { get: vi.fn() },
      purchaseOrders: { list: vi.fn(), get: vi.fn() },
      conversations: {
        list: vi.fn().mockResolvedValue([]),
        append,
      },
      model: { respond: modelRespond },
      ids: {
        next: () => {
          nextId += 1;
          return `message-${nextId}`;
        },
      },
      clock: { now: () => new Date("2028-01-01T00:00:00.000Z") },
    } as never);

    const response = await handler.execute(context, {
      quotationId: quotation.id,
      message: " What is next? ",
    });

    expect(response.suggestions).toHaveLength(1);
    expect(response.suggestions[0]).toMatchObject({
      kind: "set_quantity",
      lineId: "line",
    });
    expect(modelRespond).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: { quotation },
        message: "What is next?",
      }),
      undefined,
    );
    expect(append).toHaveBeenCalledWith(
      { id: "transaction" },
      expect.objectContaining({
        brandId: context.brandId,
        quotationId: quotation.id,
        messages: [
          expect.objectContaining({ role: "user", content: "What is next?" }),
          expect.objectContaining({ role: "assistant" }),
        ],
      }),
    );
    const storedMessages = append.mock.calls[0]?.[1].messages;
    expect(storedMessages[1].createdAt.getTime()).toBeGreaterThan(
      storedMessages[0].createdAt.getTime(),
    );
  });
});

describe("quote copilot after negotiation", () => {
  it("never returns editing suggestions after negotiation starts", async () => {
    const negotiation = {
      id: "negotiation",
      status: "RECOMMENDED",
      timeline: [],
      reducedCompetition: false,
      offers: [],
    };
    const decision = {
      id: "decision",
      negotiationId: "negotiation",
      winnerOfferId: null,
      decisionRecord: {},
    };
    const purchaseOrder = {
      id: "order",
      number: "PO-1",
      negotiationId: "negotiation",
      totalMinor: "100",
      currency: "USD",
      issuedAt: "2028-01-01T00:00:00.000Z",
      status: "ISSUED",
      supplierId: "S1",
      issuedBy: "buyer",
      lines: [],
      audit: [],
    };
    const modelRespond = vi.fn().mockResolvedValue({
      content: "The negotiation is already running.",
      suggestions: [
        {
          kind: "exclude_line",
          title: "Exclude",
          explanation: "Should be rejected.",
          matchId: "match",
        },
      ],
    });
    const handler = new ChatWithQuoteCopilotCommandHandler({
      unitOfWork: {
        run: <T>(work: (transaction: { id: string }) => Promise<T>) =>
          work({ id: "transaction" }),
      },
      quotations: {
        get: vi.fn().mockResolvedValue({
          ...quotation,
          negotiationId: "negotiation",
        }),
      },
      negotiations: { get: vi.fn().mockResolvedValue(negotiation) },
      decisions: { get: vi.fn().mockResolvedValue(decision) },
      purchaseOrders: {
        list: vi.fn().mockResolvedValue([
          {
            id: "order",
            number: "PO-1",
            negotiationId: "negotiation",
            totalMinor: "100",
            currency: "USD",
            issuedAt: "2028-01-01T00:00:00.000Z",
            status: "ISSUED",
          },
        ]),
        get: vi.fn().mockResolvedValue(purchaseOrder),
      },
      conversations: {
        list: vi.fn().mockResolvedValue([]),
        append: vi.fn().mockResolvedValue(undefined),
      },
      model: { respond: modelRespond },
      ids: { next: () => crypto.randomUUID() },
      clock: { now: () => new Date() },
    } as never);

    const response = await handler.execute(context, {
      quotationId: quotation.id,
      message: "Can I change it?",
    });

    expect(response.suggestions).toEqual([]);
    expect(modelRespond).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: {
          quotation: expect.anything(),
          negotiation,
          decision,
          purchaseOrder,
        },
      }),
      undefined,
    );
  });
});
