import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { WorkspaceState } from "../types";
import { DecisionCard } from "./DecisionCard";
import { PurchaseOrderCard } from "./PurchaseOrderCard";
import { WorkspaceStatus } from "./WorkspaceStatus";

const baseState = (patch: Partial<WorkspaceState> = {}): WorkspaceState => ({
  loading: false,
  stale: false,
  purchaseOrders: [],
  ...patch,
});

const decision = {
  id: "00000000-0000-4000-8000-000000000010",
  negotiationId: "00000000-0000-4000-8000-000000000011",
  winnerOfferId: "00000000-0000-4000-8000-000000000012",
  decisionRecord: {
    recommendationStatus: "recommended",
    rationale: "S1 has the strongest eligible recorded score.",
    preferenceSensitive: true,
    warnings: ["Lead-time sensitivity is material."],
    offers: [
      {
        offerId: "00000000-0000-4000-8000-000000000012",
        totalMinor: "66223600",
        quality: "4",
        leadTimeDays: 42,
        preShipmentBps: 6000,
        eligible: true,
        score: "0.812",
        exclusionReasons: [],
        candidate: { supplierId: "S1", currency: "USD" },
      },
      {
        offerId: "00000000-0000-4000-8000-000000000013",
        totalMinor: "61000000",
        quality: "3",
        leadTimeDays: 60,
        preShipmentBps: 5000,
        eligible: false,
        exclusionReasons: ["lead exceeds hard maximum"],
        candidate: { supplierId: "S2", currency: "USD" },
      },
    ],
  },
} as never;

const preview = {
  digest: "b".repeat(64),
  confirmationToken: "confirmation-token",
  totalMinor: "66223600",
  currency: "USD",
  supplierId: "S1",
  lineCount: 22,
  leadTimeDays: 42,
  paymentSchedule: [
    { milestone: "ORDER", percentBasisPoints: 3300 },
    { milestone: "PRE_SHIPMENT", percentBasisPoints: 3300 },
    { milestone: "DELIVERY", percentBasisPoints: 3400 },
  ],
} satisfies NonNullable<WorkspaceState["preview"]>;

const renderWithTooltip = (element: React.ReactNode) =>
  render(<TooltipProvider>{element}</TooltipProvider>);

describe("decision evidence", () => {
  it("shows a designed empty state before the server recommends an offer", () => {
    render(<DecisionCard state={baseState()} />);

    expect(screen.getByText("No recommendation yet")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows winner, exclusions, sensitivity, and commercial facts", () => {
    render(<DecisionCard state={baseState({ decision })} />);

    expect(screen.getByText("Recommended supplier")).toBeVisible();
    expect(screen.getByText("Preference-sensitive result")).toBeVisible();
    expect(
      screen.getByText("Lead-time sensitivity is material."),
    ).toBeVisible();
    expect(screen.getByRole("cell", { name: "USD 662,236.00" })).toBeVisible();
    expect(screen.getByText("lead exceeds hard maximum")).toBeVisible();
    expect(screen.getByText("Recommended")).toBeVisible();
  });
});

describe("commitment controls", () => {
  it("keeps preview disabled without an authoritative winner", () => {
    renderWithTooltip(
      <PurchaseOrderCard
        state={baseState()}
        actions={{ preview: vi.fn(), issue: vi.fn(), startAgain: vi.fn() }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Preview purchase order" }),
    ).toBeDisabled();
  });

  it("requires a second explicit confirmation before issuing", () => {
    const issue = vi.fn().mockResolvedValue(undefined);
    renderWithTooltip(
      <PurchaseOrderCard
        state={baseState({ decision, preview })}
        actions={{ preview: vi.fn(), issue, startAgain: vi.fn() }}
      />,
    );

    expect(screen.getByText("S1")).toBeVisible();
    expect(screen.getByText("USD 662,236.00")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Approve and issue purchase order" }),
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "This creates an authoritative order",
    );
    expect(issue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and issue" }));
    expect(issue).toHaveBeenCalledOnce();
  });

  it("explains an idempotent replay instead of implying a duplicate", () => {
    renderWithTooltip(
      <PurchaseOrderCard
        state={baseState({
          decision,
          purchaseOrder: {
            id: "00000000-0000-4000-8000-000000000020",
            number: "PO-0000001",
            replayed: true,
          },
        })}
        actions={{ preview: vi.fn(), issue: vi.fn(), startAgain: vi.fn() }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "no duplicate order was created",
    );
  });

  it("starts a new workspace without deleting the issued result", () => {
    const startAgain = vi.fn();
    renderWithTooltip(
      <PurchaseOrderCard
        state={baseState({
          decision,
          purchaseOrder: {
            id: "00000000-0000-4000-8000-000000000020",
            number: "PO-0000001",
          },
        })}
        actions={{ preview: vi.fn(), issue: vi.fn(), startAgain }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start again" }));
    expect(startAgain).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("workspace-wide states", () => {
  it("renders field errors and a support-safe correlation reference", () => {
    render(
      <WorkspaceStatus
        state={baseState({
          error: {
            title: "invalid-request",
            detail: "Request validation failed",
            status: 422,
            correlationId: "candidate-request-1",
            fields: { scenarioId: "Invalid UUID" },
          },
        })}
        refresh={vi.fn()}
      />,
    );

    expect(screen.getByText("422 · invalid-request")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "scenarioId: Invalid UUID",
    );
    expect(screen.getByText(/candidate-request-1/)).toBeVisible();
  });

  it("does not detach a command error into the workspace status area", () => {
    const { container } = render(
      <WorkspaceStatus
        state={baseState({
          error: {
            title: "quotation-context-conflict",
            detail: "The upload context changed",
            action: "upload",
          },
        })}
        refresh={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
