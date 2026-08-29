import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceActions } from "../actions";
import type { WorkspaceState } from "../types";
import { WorkspaceCopilot } from "./WorkspaceCopilot";

const scenarioId = "00000000-0000-4000-8000-000000000002";
const matchId = "00000000-0000-4000-8000-000000000003";
const lineId = "00000000-0000-4000-8000-000000000004";
const productId = "00000000-0000-4000-8000-000000000005";
const actions = {
  refresh: vi.fn(),
  startAgain: vi.fn(),
  reset: vi.fn(),
  upload: vi.fn(),
  chooseScenario: vi.fn(),
  resolveMatch: vi.fn().mockResolvedValue(undefined),
  resolveQuantities: vi.fn(),
  startNegotiation: vi.fn(),
  previewPolicy: vi.fn(),
  confirmPolicy: vi.fn(),
  preview: vi.fn(),
  issue: vi.fn(),
  viewPurchaseOrder: vi.fn(),
  sendCopilotMessage: vi.fn(),
} satisfies WorkspaceActions;
const state = {
  loading: false,
  stale: false,
  purchaseOrders: [],
  selectedScenarioId: scenarioId,
  quotation: {
    id: "00000000-0000-4000-8000-000000000001",
    status: "INTERPRETATION_REQUIRED",
    currency: "USD",
    selectedScenarioId: scenarioId,
    scenarios: [{ id: scenarioId, label: "Supplier quote" }],
    matches: [
      {
        id: matchId,
        lineId,
        scenarioId,
        label: "SKU-1",
        matchReady: true,
        status: "RESOLVED",
        selectedProductId: productId,
        requestedQuantity: "10",
        unitPriceMinor: "1250",
        extendedTotalMinor: "12500",
        sourceReference: "Supplier quote · row 4",
        reviewReasons: ["ambiguous_commercial_fields"],
        candidates: [
          { productId, sku: "SKU-1", name: "Shell Jacket", score: 1 },
        ],
      },
    ],
  },
  copilot: {
    quotationId: "00000000-0000-4000-8000-000000000001",
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000006",
        role: "assistant",
        content: "The quote is commercially blocked.",
        createdAt: "2028-01-01T00:00:00.000Z",
        suggestions: [
          {
            kind: "exclude_line",
            title: "Exclude the line",
            explanation: "Only if it is no longer required.",
            matchId,
          },
        ],
      },
    ],
  },
} satisfies WorkspaceState;

describe("workspace copilot", () => {
  it("opens as a global companion with step context and explicit actions", () => {
    render(<WorkspaceCopilot state={state} actions={actions} />);

    expect(
      screen.getByRole("button", { name: /Procurement copilot/ }),
    ).toHaveTextContent("Commercial review");

    fireEvent.click(
      screen.getByRole("button", { name: /Procurement copilot/ }),
    );

    expect(
      screen.getByRole("heading", { name: "Procurement copilot" }),
    ).toBeVisible();
    expect(screen.getByText("Resolve commercial blockers")).toBeVisible();
    expect(
      screen.getByText("The quote is commercially blocked."),
    ).toBeVisible();
    expect(actions.resolveMatch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Review and apply" }));

    expect(actions.resolveMatch).toHaveBeenCalledWith(matchId, "exclude");
  });

  it("is available before upload without pretending AI has workspace context", () => {
    render(
      <WorkspaceCopilot
        state={{ loading: false, stale: false, purchaseOrders: [] }}
        actions={actions}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Procurement copilot/ }),
    );

    expect(screen.getByText("Start with a supplier quotation")).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Ask the procurement copilot" }),
    ).toBeDisabled();
  });

  it("renders the buyer turn and partial assistant response while streaming", () => {
    render(
      <WorkspaceCopilot
        state={{
          ...state,
          copilotPending: true,
          copilotStreamingContent: "I found a safe adjustment",
          copilot: {
            ...state.copilot,
            messages: [
              ...state.copilot.messages,
              {
                id: "00000000-0000-4000-8000-000000000007",
                role: "user",
                content: "Propose an adjustment",
                createdAt: "2028-01-01T00:00:01.000Z",
                suggestions: [],
              },
            ],
          },
        }}
        actions={actions}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Procurement copilot/ }),
    );

    expect(screen.getByText("Propose an adjustment")).toBeVisible();
    expect(screen.getByText("I found a safe adjustment")).toBeVisible();
  });
});
