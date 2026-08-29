import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceActions } from "./actions";
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
      label: "SKU-1",
      matchReady: true,
      status: "PENDING",
      reviewReasons: [],
      candidates: [],
    },
  ],
} satisfies NonNullable<WorkspaceState["quotation"]>;

const actions: WorkspaceActions = {
  refresh: vi.fn().mockResolvedValue(undefined),
  startAgain: vi.fn(),
  reset: vi.fn().mockResolvedValue(undefined),
  upload: vi.fn().mockResolvedValue(undefined),
  chooseScenario: vi.fn().mockResolvedValue(undefined),
  resolveMatch: vi.fn().mockResolvedValue(undefined),
  resolveQuantities: vi.fn().mockResolvedValue(undefined),
  previewPolicy: vi.fn().mockResolvedValue(undefined),
  confirmPolicy: vi.fn(),
  startNegotiation: vi.fn().mockResolvedValue(undefined),
  preview: vi.fn().mockResolvedValue(undefined),
  issue: vi.fn().mockResolvedValue(undefined),
  viewPurchaseOrder: vi.fn().mockResolvedValue(undefined),
  sendCopilotMessage: vi.fn().mockResolvedValue(undefined),
};

const state = (patch: Partial<WorkspaceState> = {}): WorkspaceState => ({
  loading: false,
  stale: false,
  purchaseOrders: [],
  ...patch,
});

describe("step-owned failures", () => {
  it("keeps a command failure inside the step that caused it", () => {
    render(
      <ProcurementWorkspace
        state={state({
          error: {
            title: "quotation-context-conflict",
            detail: "This workbook was already uploaded with different context",
            status: 409,
            action: "upload",
          },
        })}
        actions={actions}
      />,
    );

    const card = screen
      .getByRole("heading", { name: "Upload quotation" })
      .closest("[data-slot='card']");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByRole("alert")).toHaveTextContent(
      "This workbook was already uploaded",
    );
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Upload and continue" }),
    ).toBeEnabled();
  });
});

describe("guided workspace composition", () => {
  it("keeps destructive reset globally available behind confirmation", () => {
    const reset = vi.fn().mockResolvedValue(undefined);
    render(
      <ProcurementWorkspace state={state()} actions={{ ...actions, reset }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset challenge" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("permanently removes");
    expect(reset).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Reset challenge" }),
    );
    expect(reset).toHaveBeenCalledOnce();
  });

  it("shows only upload before a quotation exists", () => {
    render(<ProcurementWorkspace state={state()} actions={actions} />);

    expect(
      screen.getByRole("heading", { name: "Upload quotation" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Confirm the spreadsheet layout" }),
    ).not.toBeInTheDocument();
  });

  it("replaces layout confirmation with product review", () => {
    const { rerender } = render(
      <ProcurementWorkspace state={state({ quotation })} actions={actions} />,
    );

    expect(
      screen.getByRole("heading", { name: "Confirm the spreadsheet layout" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Upload quotation" }),
    ).not.toBeInTheDocument();

    rerender(
      <ProcurementWorkspace
        state={state({ quotation, selectedScenarioId: scenarioId })}
        actions={actions}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Review product matches" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Confirm the spreadsheet layout" }),
    ).not.toBeInTheDocument();
  });
});

describe("guided review completion", () => {
  it("replaces completed review with negotiation preparation", () => {
    const resolvedMatch = {
      ...quotation.matches[0]!,
      status: "RESOLVED" as const,
      candidates: [
        {
          productId: "00000000-0000-4000-8000-000000000004",
          sku: "SKU-1",
          name: "Product 1",
          score: 1,
        },
      ],
    };

    render(
      <ProcurementWorkspace
        state={state({
          quotation: {
            ...quotation,
            status: "READY",
            matches: [resolvedMatch],
          },
          selectedScenarioId: scenarioId,
        })}
        actions={actions}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Prepare the negotiation" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Review product matches" }),
    ).not.toBeInTheDocument();
  });

  it("returns an all-excluded workspace to product inclusion", () => {
    const resolveMatch = vi.fn().mockResolvedValue(undefined);
    const excludedMatch = {
      ...quotation.matches[0]!,
      status: "EXCLUDED" as const,
      candidates: [
        {
          productId: "00000000-0000-4000-8000-000000000004",
          sku: "SKU-1",
          name: "Product 1",
          score: 1,
        },
      ],
    };

    render(
      <ProcurementWorkspace
        state={state({
          quotation: {
            ...quotation,
            status: "READY",
            matches: [excludedMatch],
          },
          selectedScenarioId: scenarioId,
          error: {
            title: "order-intent-empty",
            detail: "Selected scenario has no matched commercial lines",
            status: 422,
            code: "order-intent-empty",
            action: "negotiation",
          },
        })}
        actions={{ ...actions, resolveMatch }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Include a product" }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Selected scenario has no matched commercial lines",
    );
    expect(
      screen.queryByRole("heading", { name: "Prepare the negotiation" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Include product for SKU-1" }),
    );
    expect(resolveMatch).toHaveBeenCalledWith(
      excludedMatch.id,
      "select",
      excludedMatch.candidates[0]?.productId,
    );
  });
});

describe("active negotiation composition", () => {
  it("shows supplier response status while negotiation is active", () => {
    render(
      <ProcurementWorkspace
        state={state({
          quotation: { ...quotation, status: "READY", matches: [] },
          selectedScenarioId: scenarioId,
          negotiation: {
            id: "00000000-0000-4000-8000-000000000010",
            status: "IN_PROGRESS",
            reducedCompetition: false,
            offers: [],
            timeline: [],
          } as never,
        })}
        actions={actions}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Negotiating with suppliers" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Prepare the negotiation" }),
    ).not.toBeInTheDocument();
  });
});

describe("recommendation and commitment composition", () => {
  it("keeps recommendation evidence beside its approval action only", () => {
    const decision = {
      id: "00000000-0000-4000-8000-000000000010",
      negotiationId: "00000000-0000-4000-8000-000000000011",
      winnerOfferId: "00000000-0000-4000-8000-000000000012",
      decisionRecord: {
        recommendationStatus: "recommended",
        rationale: "Supplier 1 has the strongest eligible score.",
        preferenceSensitive: false,
        warnings: [],
        offers: [],
      },
    } as never;
    const { rerender } = render(
      <ProcurementWorkspace state={state({ decision })} actions={actions} />,
    );

    expect(
      screen.getByRole("heading", { name: "Review the recommendation" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Approve the purchase order" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Negotiating with suppliers" }),
    ).not.toBeInTheDocument();

    rerender(
      <ProcurementWorkspace
        state={state({
          decision,
          purchaseOrder: {
            id: "00000000-0000-4000-8000-000000000020",
            number: "PO-0001",
            replayed: false,
          },
        })}
        actions={actions}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Purchase order issued" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Review the recommendation" }),
    ).not.toBeInTheDocument();
  });
});
