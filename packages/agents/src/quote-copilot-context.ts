import type { ProcurementWorkspaceContext } from "@procurement/application/ports";
import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { displayMinorUnits } from "./money-display.js";

const selectedLines = (workspace: ProcurementWorkspaceContext) =>
  workspace.quotation.matches.filter(
    (line) => line.scenarioId === workspace.quotation.selectedScenarioId,
  );

export type ProcurementWorkspaceStep =
  | "scenario_selection"
  | "product_matching"
  | "commercial_review"
  | "prepare_negotiation"
  | "negotiation"
  | "decision"
  | "purchase_order_issued";

export const procurementWorkspaceStep = (
  workspace: ProcurementWorkspaceContext,
): ProcurementWorkspaceStep => {
  if (workspace.purchaseOrder) return "purchase_order_issued";
  if (workspace.decision) return "decision";
  if (workspace.negotiation) return "negotiation";
  if (!workspace.quotation.selectedScenarioId) return "scenario_selection";

  const lines = selectedLines(workspace);
  const included = lines.filter((line) => line.status === "RESOLVED");
  if (lines.some((line) => line.status === "PENDING") || included.length === 0)
    return "product_matching";
  if (included.some((line) => line.reviewReasons.length > 0))
    return "commercial_review";

  return "prepare_negotiation";
};

export const quoteCopilotContext = (workspace: ProcurementWorkspaceContext) => {
  const currency = workspace.quotation.currency;

  return {
    id: workspace.quotation.id,
    status: workspace.quotation.status,
    currency: currency ?? null,
    selectedScenarioId: workspace.quotation.selectedScenarioId ?? null,
    negotiationId: workspace.quotation.negotiationId ?? null,
    scenarios: workspace.quotation.scenarios,
    lines: workspace.quotation.matches.map((line) => ({
      id: line.matchReady ? line.id : null,
      lineId: line.lineId,
      scenarioId: line.scenarioId,
      label: line.label,
      matchReady: line.matchReady,
      status: line.matchReady ? (line.status ?? "PENDING") : "MATCHING",
      selectedProductId: line.selectedProductId ?? null,
      requestedQuantity: line.requestedQuantity ?? null,
      minimumOrderQuantity: line.minimumOrderQuantity ?? null,
      unitPriceMinor: line.unitPriceMinor ?? null,
      unitPriceDisplay: displayMinorUnits(line.unitPriceMinor, currency),
      extendedTotalMinor: line.extendedTotalMinor ?? null,
      extendedTotalDisplay: displayMinorUnits(
        line.extendedTotalMinor,
        currency,
      ),
      reviewReasons: line.reviewReasons,
      candidates: line.candidates,
      sourceReference: line.sourceReference ?? null,
    })),
  };
};

const jsonRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};

export const decisionCopilotContext = (
  decision: NonNullable<ProcurementWorkspaceContext["decision"]>,
) => {
  const record = jsonRecord(decision.decisionRecord);
  const inputs = jsonRecord(record.inputs);
  const currency =
    typeof inputs.currency === "string" ? inputs.currency : undefined;
  const offers = Array.isArray(record.offers) ? record.offers : [];

  return {
    ...decision,
    monetaryDisplay: {
      currency: currency ?? null,
      baseline: displayMinorUnits(
        typeof inputs.baselineMinor === "string"
          ? inputs.baselineMinor
          : undefined,
        currency,
      ),
      offers: offers.map((value) => {
        const offer = jsonRecord(value);
        const candidate = jsonRecord(offer.candidate);

        return {
          offerId: typeof offer.offerId === "string" ? offer.offerId : null,
          supplierId:
            typeof candidate.supplierId === "string"
              ? candidate.supplierId
              : null,
          total: displayMinorUnits(
            typeof offer.totalMinor === "string" ? offer.totalMinor : undefined,
            currency,
          ),
        };
      }),
    },
  };
};

export const purchaseOrderCopilotContext = (
  order: NonNullable<ProcurementWorkspaceContext["purchaseOrder"]>,
) => ({
  ...order,
  totalDisplay: displayMinorUnits(order.totalMinor, order.currency),
  lines: order.lines.map((line) => ({
    ...line,
    unitPriceDisplay: displayMinorUnits(line.unitPriceMinor, order.currency),
    extendedTotalDisplay: displayMinorUnits(
      line.extendedTotalMinor,
      order.currency,
    ),
  })),
});

const workspaceSummary = (workspace: ProcurementWorkspaceContext) => {
  const lines = selectedLines(workspace);

  return {
    activeStep: procurementWorkspaceStep(workspace),
    quotationId: workspace.quotation.id,
    quotationStatus: workspace.quotation.status,
    scenarioCount: workspace.quotation.scenarios.length,
    selectedLineCount: lines.length,
    included: lines.filter((line) => line.status === "RESOLVED").length,
    excluded: lines.filter((line) => line.status === "EXCLUDED").length,
    unresolved: lines.filter((line) => line.status === "PENDING").length,
    blocked: lines.filter(
      (line) => line.status !== "EXCLUDED" && line.reviewReasons.length > 0,
    ).length,
    negotiationStatus: workspace.negotiation?.status ?? null,
    decisionAvailable: Boolean(workspace.decision),
    purchaseOrderNumber: workspace.purchaseOrder?.number ?? null,
    purchaseOrderTotalDisplay: workspace.purchaseOrder
      ? displayMinorUnits(
          workspace.purchaseOrder.totalMinor,
          workspace.purchaseOrder.currency,
        )
      : null,
  };
};

type AvailableAdjustment =
  | Readonly<{
      kind: "include_line";
      matchId: string;
      productId: string;
      quotedLabel: string;
      catalogSku: string;
      confidence: number;
    }>
  | Readonly<{
      kind: "set_quantity";
      lineId: string;
      quantity: string;
      quotedLabel: string;
      basis: string;
    }>;

const availableAdjustments = (workspace: ProcurementWorkspaceContext) => {
  if (workspace.quotation.negotiationId)
    return {
      editable: false,
      reason:
        "The quotation is immutable after negotiation starts. Explain the evidence or next approval instead.",
      suggestions: [],
    };

  if (!workspace.quotation.selectedScenarioId)
    return {
      editable: true,
      reason: "A quotation scenario must be selected.",
      suggestions: workspace.quotation.scenarios.map((scenario) => ({
        kind: "select_scenario" as const,
        scenarioId: scenario.id,
        label: scenario.label,
      })),
    };

  const suggestions: AvailableAdjustment[] = [];
  for (const line of selectedLines(workspace)) {
    if (!line.matchReady) continue;

    if (line.status === "PENDING") {
      const exactCandidate = line.candidates.find(
        (candidate) => candidate.score === 1,
      );
      if (exactCandidate && line.unitPriceMinor)
        suggestions.push({
          kind: "include_line",
          matchId: line.id,
          productId: exactCandidate.productId,
          quotedLabel: line.label,
          catalogSku: exactCandidate.sku,
          confidence: exactCandidate.score,
        });
      continue;
    }

    if (
      line.status === "RESOLVED" &&
      !line.requestedQuantity &&
      line.minimumOrderQuantity
    )
      suggestions.push({
        kind: "set_quantity",
        lineId: line.lineId,
        quantity: line.minimumOrderQuantity,
        quotedLabel: line.label,
        basis: "quoted minimum order quantity",
      });
  }

  return {
    editable: true,
    reason:
      suggestions.length > 0
        ? "These adjustments are supported by deterministic quotation evidence and still require buyer confirmation."
        : "No safe automatic adjustment is supported by the current evidence. Ask the buyer to resolve ambiguous fields rather than guessing.",
    suggestions: suggestions.slice(0, 10),
  };
};

export const createCopilotTools = (
  workspace: ProcurementWorkspaceContext,
): ToolSet => ({
  inspectWorkspace: tool({
    description:
      "Inspect the active procurement step and high-level progress across the complete workspace.",
    inputSchema: z.object({}).strict(),
    execute: async () => workspaceSummary(workspace),
  }),
  inspectQuotation: tool({
    description:
      "Inspect quotation scenarios and every commercial line with source evidence and blockers.",
    inputSchema: z.object({}).strict(),
    execute: async () => quoteCopilotContext(workspace),
  }),
  inspectLine: tool({
    description:
      "Inspect one quotation line, including source, candidates, quantity, price, and blockers.",
    inputSchema: z.object({ lineId: z.string().min(1) }).strict(),
    execute: async ({ lineId }) =>
      workspace.quotation.matches.find(
        (line) => line.lineId === lineId || line.id === lineId,
      ) ?? { error: "Line not found in this quotation" },
  }),
  inspectNegotiation: tool({
    description:
      "Inspect supplier offers, competition changes, and timeline evidence.",
    inputSchema: z.object({}).strict(),
    execute: async () =>
      workspace.negotiation ?? {
        available: false,
        reason: "Negotiation has not started",
      },
  }),
  inspectDecision: tool({
    description: "Inspect the durable recommendation and decision record.",
    inputSchema: z.object({}).strict(),
    execute: async () =>
      workspace.decision
        ? decisionCopilotContext(workspace.decision)
        : {
            available: false,
            reason: "A decision is not available",
          },
  }),
  inspectPurchaseOrder: tool({
    description: "Inspect the issued order, monetary lines, and audit facts.",
    inputSchema: z.object({}).strict(),
    execute: async () =>
      workspace.purchaseOrder
        ? purchaseOrderCopilotContext(workspace.purchaseOrder)
        : {
            available: false,
            reason: "A purchase order has not been issued",
          },
  }),
  inspectAvailableAdjustments: tool({
    description:
      "Inspect safe, applicable adjustments. Call this before answering before negotiation. It never applies changes.",
    inputSchema: z.object({}).strict(),
    execute: async () => availableAdjustments(workspace),
  }),
});
