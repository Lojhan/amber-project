import type { ProcurementApi } from "../../lib/api/workflow";
import type { WorkspaceState } from "./types";

export type LoadedWorkspace = Readonly<{
  state: Pick<
    WorkspaceState,
    | "quotation"
    | "selectedScenarioId"
    | "negotiation"
    | "decision"
    | "purchaseOrder"
    | "purchaseOrders"
    | "purchaseOrderDetail"
    | "copilot"
  >;
  negotiationId?: string | undefined;
}>;

export async function loadWorkspace(
  api: ProcurementApi,
  quotationId: string,
  knownNegotiationId?: string,
): Promise<LoadedWorkspace> {
  const [quotation, copilot, orders] = await Promise.all([
    api.quotation(quotationId),
    api.quoteCopilot(quotationId),
    api.purchaseOrders(),
  ]);
  const negotiationId = quotation.negotiationId ?? knownNegotiationId;

  if (!negotiationId)
    return {
      state: {
        quotation,
        copilot,
        purchaseOrders: orders.items,
        selectedScenarioId: quotation.selectedScenarioId,
      },
    };

  const [negotiation, decision] = await Promise.all([
    api.negotiation(negotiationId),
    api.decision(negotiationId),
  ]);
  const issuedOrder = orders.items.find(
    (order) => order.negotiationId === negotiationId,
  );
  const purchaseOrderDetail = issuedOrder
    ? await api.purchaseOrder(issuedOrder.id)
    : undefined;

  return {
    negotiationId,
    state: {
      quotation,
      copilot,
      selectedScenarioId: quotation.selectedScenarioId,
      negotiation,
      decision: decision ?? undefined,
      purchaseOrder: issuedOrder
        ? { id: issuedOrder.id, number: issuedOrder.number }
        : undefined,
      purchaseOrders: orders.items,
      purchaseOrderDetail,
    },
  };
}
