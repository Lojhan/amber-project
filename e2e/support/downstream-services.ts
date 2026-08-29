import type { CompositionStub } from "../../apps/api/src/test-support.js";
import type { E2eState } from "./state.js";
import { ids } from "./state.js";

const digest =
  "0000000000000000000000000000000000000000000000000000000000000000";

const paymentSchedule = [
  { milestone: "ORDER" as const, percentBasisPoints: 3300 },
  { milestone: "PRE_SHIPMENT" as const, percentBasisPoints: 3300 },
  { milestone: "DELIVERY" as const, percentBasisPoints: 3400 },
];

export const configurePurchaseOrder = (
  composition: CompositionStub,
  state: E2eState,
) => {
  composition.preparePurchaseOrder.execute = async () => ({
    digest,
    confirmationToken: "e2e-confirmation-token",
    totalMinor: "1000",
    currency: "USD",
    supplierId: "S1",
    lineCount: 1,
    leadTimeDays: 12,
    paymentSchedule,
  });
  composition.issuePurchaseOrder.execute = async () => {
    state.order = true;

    return { id: ids.order, number: "PO-E2E-0001", replayed: false };
  };
  composition.listPurchaseOrders.execute = async () =>
    state.order
      ? [
          {
            id: ids.order,
            number: "PO-E2E-0001",
            negotiationId: ids.negotiation,
            supplierId: "S1",
            totalMinor: "1000",
            currency: "USD",
            issuedAt: new Date().toISOString(),
            status: "ISSUED" as const,
          },
        ]
      : [];
  composition.getPurchaseOrder.execute = async () => ({
    id: ids.order,
    number: "PO-E2E-0001",
    negotiationId: ids.negotiation,
    totalMinor: "1000",
    currency: "USD",
    issuedAt: new Date().toISOString(),
    status: "ISSUED" as const,
    supplierId: "S1",
    leadTimeDays: 12,
    paymentSchedule,
    issuedBy: "00000000-0000-4000-8000-000000000008",
    lines: [
      {
        sku: "AQ009-0BS-XS",
        name: "Catalog product",
        quantity: "1",
        unitPriceMinor: "1000",
        extendedTotalMinor: "1000",
      },
    ],
    audit: [],
  });
};

export const configureCopilot = (
  composition: CompositionStub,
  state: E2eState,
) => {
  composition.getQuoteCopilot.execute = async (_context, input) => ({
    quotationId: input.quotationId,
    messages: state.copilotMessages,
  });
  composition.chatWithQuoteCopilot.executeStreaming = async (
    _context,
    input,
    onContent,
  ) => {
    state.copilotMessages.push({
      id: "00000000-0000-4000-8000-000000000020",
      role: "user",
      content: input.message,
      suggestions: [],
      createdAt: new Date("2028-01-01T00:00:00.000Z"),
    });
    await onContent("I’m reviewing the available quotation scenarios.");
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const assistant = {
      id: "00000000-0000-4000-8000-000000000021",
      role: "assistant" as const,
      content:
        "Quote 2 contains the commercial scenario used by the catalog review. Review this selection before applying it.",
      suggestions: [
        {
          kind: "select_scenario" as const,
          title: "Use Quote 2",
          explanation:
            "This scenario contains the quotation lines intended for review.",
          scenarioId: ids.scenario2,
        },
      ],
      createdAt: new Date("2028-01-01T00:00:01.000Z"),
    };
    state.copilotMessages.push(assistant);
    await onContent(assistant.content);

    return assistant;
  };
};
