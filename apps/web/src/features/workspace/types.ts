import type {
  Decision,
  Negotiation,
  PurchaseOrderDetail,
  PurchaseOrderList,
  PurchaseOrderPreview,
  Quotation,
  QuoteCopilotConversation,
} from "../../lib/api/contracts";

export type WorkspacePurchaseOrder = Readonly<{
  id: string;
  number: string;
  replayed?: boolean;
}>;

export type WorkspaceState = {
  quotation?: Quotation | undefined;
  negotiation?: Negotiation | undefined;
  policyPreview?:
    | import("../../lib/api/contracts").NegotiationPolicyPreview
    | undefined;
  confirmedPolicyHash?: string | undefined;
  decision?: Decision | undefined;
  preview?: PurchaseOrderPreview | undefined;
  purchaseOrder?: WorkspacePurchaseOrder | undefined;
  purchaseOrders: PurchaseOrderList["items"];
  purchaseOrderDetail?: PurchaseOrderDetail | undefined;
  copilot?: QuoteCopilotConversation | undefined;
  copilotPending?: boolean | undefined;
  copilotStreamingContent?: string | undefined;
  copilotError?: WorkspaceProblem | undefined;
  selectedScenarioId?: string | undefined;
  error?: WorkspaceProblem | undefined;
  pendingAction?: WorkspaceAction | undefined;
  loading: boolean;
  stale: boolean;
};

export type WorkspaceAction =
  | "reset"
  | "upload"
  | "scenario"
  | "match"
  | "commercial-review"
  | "policy"
  | "negotiation"
  | "preview-order"
  | "issue-order"
  | "purchase-order-detail"
  | "refresh";

export type WorkspaceProblem = Readonly<{
  title: string;
  detail: string;
  status?: number;
  code?: string;
  correlationId?: string;
  fields?: Record<string, string>;
  action?: WorkspaceAction;
}>;
