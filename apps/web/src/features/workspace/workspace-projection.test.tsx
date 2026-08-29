import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceActions } from "./actions";
import { MatchCard } from "./components/MatchCard";
import { PurchaseOrderHistory } from "./components/PurchaseOrderHistory";
import { ProcurementWorkspace } from "./ProcurementWorkspace";
import type { WorkspaceState } from "./types";

const scenarioId = "00000000-0000-4000-8000-000000000002";
const quotation = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "INTERPRETATION_REQUIRED",
  scenarios: [{ id: scenarioId, label: "Quote 1", evidence: "Sheet 1" }],
  matches: [
    {
      id: "00000000-0000-4000-8000-000000000003",
      lineId: "00000000-0000-4000-8000-000000000003",
      scenarioId,
      label: "AQ009-0BS-XS",
      matchReady: false,
      status: "PENDING",
      reviewReasons: [],
      candidates: [],
    },
  ],
} satisfies NonNullable<WorkspaceState["quotation"]>;

const baseState = (patch: Partial<WorkspaceState> = {}): WorkspaceState => ({
  loading: false,
  stale: false,
  purchaseOrders: [],
  ...patch,
});

const actions = {
  refresh: vi.fn(),
  startAgain: vi.fn(),
  reset: vi.fn(),
  upload: vi.fn(),
  chooseScenario: vi.fn(),
  resolveMatch: vi.fn(),
  resolveQuantities: vi.fn(),
  startNegotiation: vi.fn(),
  previewPolicy: vi.fn(),
  confirmPolicy: vi.fn(),
  preview: vi.fn(),
  issue: vi.fn(),
  viewPurchaseOrder: vi.fn(),
  sendCopilotMessage: vi.fn(),
} satisfies WorkspaceActions;

const order = {
  id: "00000000-0000-4000-8000-000000000010",
  number: "PO-1001",
  negotiationId: "00000000-0000-4000-8000-000000000011",
  supplierId: "S1",
  totalMinor: "2500",
  currency: "USD",
  issuedAt: "2028-01-01T00:00:00.000Z",
  status: "ISSUED" as const,
};

describe("workspace projection boundaries", () => {
  it("does not expose provisional parsed rows while catalog matching runs", () => {
    const resolveMatch = vi.fn();
    render(
      <MatchCard
        state={baseState({ quotation, selectedScenarioId: scenarioId })}
        resolveMatch={resolveMatch}
      />,
    );

    expect(screen.getByText("Finding catalog products")).toBeVisible();
    expect(screen.queryByText("AQ009-0BS-XS")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Exclude/ })).toBeNull();
    expect(resolveMatch).not.toHaveBeenCalled();
  });

  it("hides an invalidated workflow until its current projection arrives", () => {
    render(
      <ProcurementWorkspace
        state={baseState({ quotation, stale: true })}
        actions={actions}
      />,
    );

    expect(screen.getByText("Refreshing newer evidence")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Confirm the spreadsheet layout" }),
    ).not.toBeInTheDocument();
  });

  it("keeps issued orders in an intentional left-side companion", () => {
    render(<ProcurementWorkspace state={baseState()} actions={actions} />);

    expect(
      screen.queryByRole("heading", { name: "Issued purchase orders" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Issued orders/ }));

    expect(
      screen.getByRole("heading", { name: "Issued purchase orders" }),
    ).toBeVisible();
    expect(
      screen.getByText("No purchase orders have been issued yet."),
    ).toBeVisible();
  });

  it("replaces the order list with detail and returns through an explicit back action", () => {
    const viewPurchaseOrder = vi.fn();
    const initial = baseState({ purchaseOrders: [order] });
    const { rerender } = render(
      <PurchaseOrderHistory
        state={initial}
        viewPurchaseOrder={viewPurchaseOrder}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Issued orders/ }));
    fireEvent.click(screen.getByRole("button", { name: /PO-1001/ }));
    expect(viewPurchaseOrder).toHaveBeenCalledWith(order.id);

    rerender(
      <PurchaseOrderHistory
        state={baseState({
          purchaseOrders: [order],
          purchaseOrderDetail: {
            ...order,
            leadTimeDays: 14,
            paymentSchedule: [
              { milestone: "ORDER", percentBasisPoints: 10_000 },
            ],
            issuedBy: "00000000-0000-4000-8000-000000000012",
            lines: [
              {
                sku: "SKU-1",
                name: "Product one",
                quantity: "2",
                unitPriceMinor: "1250",
                extendedTotalMinor: "2500",
              },
            ],
            audit: [],
          },
        })}
        viewPurchaseOrder={viewPurchaseOrder}
      />,
    );

    expect(screen.getByText("Product one")).toBeVisible();
    expect(screen.queryByRole("button", { name: /PO-1001/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back to orders" }));
    expect(screen.getByRole("button", { name: /PO-1001/ })).toBeVisible();
  });
});
