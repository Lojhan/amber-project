import { describe, expect, it, vi } from "vitest";
import type { ProcurementApi } from "../../lib/api/workflow";
import { loadWorkspace } from "./loadWorkspace";

const quotationId = "00000000-0000-4000-8000-000000000001";
const scenarioId = "00000000-0000-4000-8000-000000000002";
const negotiationId = "00000000-0000-4000-8000-000000000003";

const apiFrom = (overrides: Record<string, unknown>): ProcurementApi =>
  overrides as unknown as ProcurementApi;

describe("durable workspace loading", () => {
  it("resumes a selected quotation without requesting downstream state", async () => {
    const negotiation = vi.fn();
    const decision = vi.fn();
    const purchaseOrders = vi.fn().mockResolvedValue({ items: [] });
    const api = apiFrom({
      quoteCopilot: vi.fn().mockResolvedValue({
        quotationId,
        messages: [],
      }),
      quotation: vi.fn().mockResolvedValue({
        id: quotationId,
        status: "READY",
        selectedScenarioId: scenarioId,
        scenarios: [],
        matches: [],
      }),
      negotiation,
      decision,
      purchaseOrders,
    });

    const loaded = await loadWorkspace(api, quotationId);

    expect(loaded.state).toMatchObject({
      quotation: { id: quotationId },
      selectedScenarioId: scenarioId,
    });
    expect(negotiation).not.toHaveBeenCalled();
    expect(decision).not.toHaveBeenCalled();
    expect(purchaseOrders).toHaveBeenCalledOnce();
  });

  it("reconstructs negotiation, decision, and the matching purchase order", async () => {
    const api = apiFrom({
      quoteCopilot: vi.fn().mockResolvedValue({
        quotationId,
        messages: [],
      }),
      quotation: vi.fn().mockResolvedValue({
        id: quotationId,
        status: "READY",
        selectedScenarioId: scenarioId,
        negotiationId,
        scenarios: [],
        matches: [],
      }),
      negotiation: vi.fn().mockResolvedValue({ id: negotiationId }),
      decision: vi.fn().mockResolvedValue({ id: "decision-1" }),
      purchaseOrders: vi.fn().mockResolvedValue({
        items: [
          { id: "other", number: "PO-OTHER", negotiationId: "other" },
          { id: "order-1", number: "PO-1001", negotiationId },
        ],
      }),
      purchaseOrder: vi.fn().mockResolvedValue({
        id: "order-1",
        number: "PO-1001",
        negotiationId,
      }),
    });

    const loaded = await loadWorkspace(api, quotationId);

    expect(loaded).toMatchObject({
      negotiationId,
      state: {
        negotiation: { id: negotiationId },
        decision: { id: "decision-1" },
        purchaseOrder: { id: "order-1", number: "PO-1001" },
        purchaseOrderDetail: { id: "order-1", number: "PO-1001" },
      },
    });
  });
});
