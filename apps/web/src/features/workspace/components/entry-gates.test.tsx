import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { WorkspaceState } from "../types";
import { CommercialReviewCard } from "./CommercialReviewCard";
import { MatchCard } from "./MatchCard";
import { NegotiationCard } from "./NegotiationCard";
import { ScenarioCard } from "./ScenarioCard";
import { UploadCard } from "./UploadCard";

const baseState = (patch: Partial<WorkspaceState> = {}): WorkspaceState => ({
  loading: false,
  stale: false,
  purchaseOrders: [],
  ...patch,
});

const scenario1Id = "00000000-0000-4000-8000-000000000002";
const scenario2Id = "00000000-0000-4000-8000-000000000003";
const candidateMatchId = "00000000-0000-4000-8000-000000000004";
const productId = "00000000-0000-4000-8000-000000000005";
const unmatchedId = "00000000-0000-4000-8000-000000000006";

const quotation = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "INTERPRETATION_REQUIRED",
  scenarios: [
    {
      id: scenario1Id,
      label: "Quote 1",
      evidence: "23 contiguous product rows",
    },
    {
      id: scenario2Id,
      label: "Quote 2",
    },
  ],
  matches: [
    {
      id: candidateMatchId,
      lineId: candidateMatchId,
      scenarioId: scenario1Id,
      label: "AQ009-0BS-XS",
      matchReady: true,
      status: "PENDING",
      reviewReasons: [],
      candidates: [
        {
          productId,
          sku: "AK009-OBS-XS",
          name: "Technical Quarter-Zip",
          score: 0.846,
        },
      ],
    },
    {
      id: unmatchedId,
      lineId: unmatchedId,
      scenarioId: scenario1Id,
      label: "UNKNOWN-SKU",
      matchReady: true,
      status: "PENDING",
      reviewReasons: [],
      candidates: [],
    },
  ],
} satisfies NonNullable<WorkspaceState["quotation"]>;

describe("quotation entry gates", () => {
  it("rejects a submit without a workbook", () => {
    render(<UploadCard state={baseState()} upload={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Upload and continue" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose an XLSX quotation",
    );
  });

  it("rejects a non-XLSX file before invoking the API", () => {
    const upload = vi.fn();
    render(<UploadCard state={baseState()} upload={upload} />);
    const input = screen.getByLabelText("XLSX quotation");

    fireEvent.change(input, {
      target: { files: [new File(["csv"], "quote.csv", { type: "text/csv" })] },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Upload and continue" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Only .xlsx");
    expect(upload).not.toHaveBeenCalled();
  });

  it("submits the selected workbook with trimmed commercial context", () => {
    const upload = vi.fn().mockResolvedValue(undefined);
    render(<UploadCard state={baseState()} upload={upload} />);
    const file = new File(["xlsx"], "quote.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fireEvent.change(screen.getByLabelText("XLSX quotation"), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByLabelText("Buying priorities"), {
      target: { value: "  max lead 30 days  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Upload and continue" }),
    );

    expect(upload).toHaveBeenCalledWith(file, "max lead 30 days");
  });

  it("accepts a dropped workbook and shows a removable preview", () => {
    render(<UploadCard state={baseState()} upload={vi.fn()} />);
    const file = new File(["xlsx"], "supplier-quote.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fireEvent.drop(
      screen.getByRole("group", { name: "Quotation file drop zone" }),
      { dataTransfer: { files: [file] } },
    );

    expect(screen.getByText("supplier-quote.xlsx")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("ready to upload");
    fireEvent.click(
      screen.getByRole("button", { name: "Remove supplier-quote.xlsx" }),
    );
    expect(screen.queryByText("supplier-quote.xlsx")).not.toBeInTheDocument();
  });

  it("shows a deterministic pending state during workbook processing", () => {
    render(
      <UploadCard
        state={baseState({ pendingAction: "upload" })}
        upload={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Reading quotation" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("XLSX quotation")).toBeDisabled();
  });
});

describe("interpretation and match gates", () => {
  it("designs the empty parse state instead of rendering blank controls", () => {
    render(<ScenarioCard state={baseState()} chooseScenario={vi.fn()} />);

    expect(screen.getByText("Waiting for parsed evidence")).toBeVisible();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("selects one of multiple evidence-backed scenarios", () => {
    const chooseScenario = vi.fn().mockResolvedValue(undefined);
    render(
      <ScenarioCard
        state={baseState({ quotation })}
        chooseScenario={chooseScenario}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Quote 2/ }));

    expect(chooseScenario).toHaveBeenCalledWith(scenario2Id);
  });

  it("supports both candidate selection and explicit exclusion", () => {
    const resolveMatch = vi.fn().mockResolvedValue(undefined);
    render(
      <MatchCard
        state={baseState({
          quotation,
          selectedScenarioId: scenario1Id,
        })}
        resolveMatch={resolveMatch}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Use this product for/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Exclude UNKNOWN-SKU" }),
    );

    expect(resolveMatch).toHaveBeenNthCalledWith(
      1,
      candidateMatchId,
      "select",
      productId,
    );
    expect(resolveMatch).toHaveBeenNthCalledWith(2, unmatchedId, "exclude");
  });

  it("collects missing quantities and submits them as one review", () => {
    const resolveQuantities = vi.fn().mockResolvedValue(undefined);
    render(
      <CommercialReviewCard
        state={baseState({
          quotation: {
            ...quotation,
            matches: [
              {
                ...quotation.matches[0]!,
                status: "RESOLVED",
                minimumOrderQuantity: "1000",
                reviewReasons: ["missing_requested_quantity"],
              },
            ],
          },
          selectedScenarioId: scenario1Id,
        })}
        resolveQuantities={resolveQuantities}
        resolveMatch={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Requested quantity"), {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save quantities/ }));

    expect(resolveQuantities).toHaveBeenCalledWith([
      { parsedLineId: candidateMatchId, requestedQuantity: "1000" },
    ]);
  });
});

describe("negotiation gates", () => {
  const actions = {
    previewPolicy: vi.fn().mockResolvedValue(undefined),
    confirmPolicy: vi.fn(),
    startNegotiation: vi.fn().mockResolvedValue(undefined),
  };

  it("blocks policy preview while catalog uncertainty remains", () => {
    render(
      <TooltipProvider>
        <NegotiationCard
          state={baseState({
            quotation,
            selectedScenarioId: scenario1Id,
          })}
          actions={actions}
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Prepare buying priorities" }),
    ).toBeDisabled();
  });

  it("requires an exact policy confirmation before negotiation starts", () => {
    const resolvedQuotation = {
      ...quotation,
      status: "READY",
      matches: quotation.matches.map((match) => ({
        ...match,
        status: "RESOLVED",
      })),
    };
    const policyPreview = {
      quotationId: quotation.id,
      scenarioId: scenario1Id,
      policyVersion: "decision-policy-v1",
      policyHash: "a".repeat(64),
      weights: { cost: "0.45", quality: "0.25", lead: "0.20", payment: "0.10" },
      constraints: { hardMaxLead: 30 },
      interpretation: {
        primaryPriority: "lead_time" as const,
        summary: "Delivery speed is the main priority.",
        warnings: [],
        source: "ai" as const,
      },
      confirmationToken: "signed-policy-confirmation",
    };
    const { rerender } = render(
      <TooltipProvider>
        <NegotiationCard
          state={baseState({
            quotation: resolvedQuotation,
            selectedScenarioId: scenario1Id,
            policyPreview,
          })}
          actions={actions}
        />
      </TooltipProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Start supplier negotiation" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Use these priorities" }),
    );
    expect(actions.confirmPolicy).toHaveBeenCalled();

    rerender(
      <TooltipProvider>
        <NegotiationCard
          state={baseState({
            quotation: resolvedQuotation,
            selectedScenarioId: scenario1Id,
            policyPreview,
            confirmedPolicyHash: policyPreview.policyHash,
          })}
          actions={actions}
        />
      </TooltipProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Start supplier negotiation" }),
    ).toBeEnabled();
  });

  it("keeps policy gated when parser ambiguity remains without catalog matches", () => {
    render(
      <TooltipProvider>
        <NegotiationCard
          state={baseState({
            quotation: { ...quotation, matches: [] },
            selectedScenarioId: scenario1Id,
          })}
          actions={actions}
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Prepare buying priorities" }),
    ).toBeDisabled();
  });
});
