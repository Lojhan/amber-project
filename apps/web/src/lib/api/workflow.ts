import { ApiClient, ApiError, apiOperations, type Problem } from "./client";
import {
  type Decision,
  decodeCommercialReview,
  decodeDecision,
  decodeMatchResolution,
  decodeNegotiation,
  decodeNegotiationPolicyPreview,
  decodeOk,
  decodePreview,
  decodeProblem,
  decodePurchaseOrder,
  decodePurchaseOrderDetail,
  decodePurchaseOrderList,
  decodeQuotation,
  decodeQuoteCopilotConversation,
  decodeScenarioSelection,
  decodeUploadCompletion,
  decodeUploadReservation,
  type Negotiation,
  type NegotiationPolicyPreview,
  type PurchaseOrder,
  type PurchaseOrderDetail,
  type PurchaseOrderList,
  type PurchaseOrderPreview,
  type Quotation,
  type QuoteCopilotConversation,
} from "./contracts";
import type {
  CommercialReviewRequest,
  CompleteUploadRequest,
  IssuePurchaseOrderRequest,
  PreviewPurchaseOrderRequest,
  QuoteCopilotRequest,
  ReserveUploadRequest,
  ResolveMatchRequest,
  SelectScenarioRequest,
  StartNegotiationRequest,
} from "./types";

export class ProcurementApi {
  constructor(private readonly client = new ApiClient()) {}

  resetChallenge(): Promise<{ ok: true }> {
    return this.client.command(apiOperations.resetChallenge, {}, decodeOk);
  }

  quotation(id: string): Promise<Quotation> {
    return this.client.get(apiOperations.quotation, decodeQuotation, { id });
  }

  quoteCopilot(id: string): Promise<QuoteCopilotConversation> {
    return this.client.get(
      apiOperations.quoteCopilot,
      decodeQuoteCopilotConversation,
      { id },
    );
  }

  chatWithQuoteCopilot(
    input: QuoteCopilotRequest,
  ): Promise<QuoteCopilotConversation> {
    return this.client.command(
      apiOperations.chatWithQuoteCopilot,
      input,
      decodeQuoteCopilotConversation,
    );
  }

  async streamQuoteCopilot(
    input: QuoteCopilotRequest,
    onContent: (content: string) => void,
  ): Promise<QuoteCopilotConversation> {
    let conversation: QuoteCopilotConversation | undefined;
    let problem: Problem | undefined;

    await this.client.streamCommand(
      "/api/v1/quote-copilot/messages/stream",
      input,
      (message) => {
        if (message.event === "assistant-content") {
          const content = Reflect.get(Object(message.data), "content");
          if (typeof content === "string") onContent(content);
        }
        if (message.event === "conversation")
          conversation = decodeQuoteCopilotConversation(message.data);
        if (message.event === "problem") problem = decodeProblem(message.data);
      },
    );

    if (problem) throw new ApiError(problem);
    if (!conversation)
      throw new Error("The copilot stream ended before completing the turn");

    return conversation;
  }

  negotiation(id: string): Promise<Negotiation> {
    return this.client.get(apiOperations.negotiation, decodeNegotiation, {
      id,
    });
  }

  negotiationPolicy(
    quotationId: string,
    scenarioId: string,
  ): Promise<NegotiationPolicyPreview> {
    return this.client.command(
      apiOperations.negotiationPolicy,
      { quotationId, scenarioId },
      decodeNegotiationPolicyPreview,
    );
  }

  decision(negotiationId: string): Promise<Decision> {
    return this.client.get(apiOperations.decision, decodeDecision, {
      negotiationId,
    });
  }

  reserve(
    filename: ReserveUploadRequest["filename"],
    contentHash: ReserveUploadRequest["contentHash"],
    note?: string,
  ) {
    return this.client.command(
      apiOperations.reserveUpload,
      { filename, contentHash, ...(note ? { note } : {}) },
      decodeUploadReservation,
    );
  }

  complete(input: CompleteUploadRequest) {
    return this.client
      .command(
        apiOperations.completeUpload,
        input,
        decodeUploadCompletion,
        input.idempotencyKey,
      )
      .then((completion) => this.quotation(completion.id));
  }

  match(input: ResolveMatchRequest) {
    return this.client
      .command(apiOperations.resolveMatch, input, decodeMatchResolution)
      .then((resolution) => this.quotation(resolution.quotationId));
  }

  selectScenario(input: SelectScenarioRequest) {
    return this.client
      .command(apiOperations.selectScenario, input, decodeScenarioSelection)
      .then((selection) => this.quotation(selection.quotationId));
  }

  reviewQuantities(input: CommercialReviewRequest) {
    return this.client
      .command(apiOperations.commercialReview, input, decodeCommercialReview)
      .then((review) => this.quotation(review.quotationId));
  }

  startNegotiation(input: StartNegotiationRequest) {
    return this.client.command(
      apiOperations.startNegotiation,
      input,
      decodeNegotiation,
    );
  }

  preview(input: PreviewPurchaseOrderRequest): Promise<PurchaseOrderPreview> {
    return this.client.command(
      apiOperations.previewPurchaseOrder,
      input,
      decodePreview,
    );
  }

  issue(input: IssuePurchaseOrderRequest): Promise<PurchaseOrder> {
    return this.client.command(
      apiOperations.issuePurchaseOrder,
      input,
      decodePurchaseOrder,
      input.idempotencyKey,
    );
  }

  purchaseOrders(): Promise<PurchaseOrderList> {
    return this.client.get(
      apiOperations.purchaseOrders,
      decodePurchaseOrderList,
    );
  }

  purchaseOrder(id: string): Promise<PurchaseOrderDetail> {
    return this.client.get(
      apiOperations.purchaseOrder,
      decodePurchaseOrderDetail,
      { id },
    );
  }
}
