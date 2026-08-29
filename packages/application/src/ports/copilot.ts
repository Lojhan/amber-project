import type { BrandId } from "@procurement/domain";
import type { TransactionContext } from "../core/transaction-context.js";
import type {
  DecisionView,
  NegotiationView,
  PurchaseOrderDetail,
  QuotationView,
} from "./read-models.js";

type SuggestionCopy = Readonly<{ title: string; explanation: string }>;

export type QuoteCopilotSuggestion =
  | (SuggestionCopy & Readonly<{ kind: "select_scenario"; scenarioId: string }>)
  | (SuggestionCopy &
      Readonly<{
        kind: "include_line";
        matchId: string;
        productId: string;
      }>)
  | (SuggestionCopy & Readonly<{ kind: "exclude_line"; matchId: string }>)
  | (SuggestionCopy &
      Readonly<{ kind: "set_quantity"; lineId: string; quantity: string }>);

export type QuoteCopilotMessage = Readonly<{
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions: readonly QuoteCopilotSuggestion[];
  createdAt: Date;
}>;

export type ProcurementWorkspaceContext = Readonly<{
  quotation: QuotationView;
  negotiation?: NegotiationView;
  decision?: DecisionView;
  purchaseOrder?: PurchaseOrderDetail;
}>;

export interface QuoteCopilotRepository {
  list(
    brandId: BrandId,
    quotationId: string,
    limit: number,
  ): Promise<readonly QuoteCopilotMessage[]>;
  append(
    transaction: TransactionContext,
    input: Readonly<{
      brandId: BrandId;
      quotationId: string;
      messages: readonly QuoteCopilotMessage[];
    }>,
  ): Promise<void>;
}

export interface QuoteCopilotModel {
  respond(
    input: Readonly<{
      workspace: ProcurementWorkspaceContext;
      history: readonly QuoteCopilotMessage[];
      message: string;
    }>,
    onContent?: (content: string) => Promise<void> | void,
  ): Promise<
    Readonly<{
      content: string;
      suggestions: readonly QuoteCopilotSuggestion[];
    }>
  >;
}
