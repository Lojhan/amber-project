import {
  commercialReviewResponseSchema,
  decisionProjectionResponseSchema,
  matchResolutionResponseSchema,
  negotiationPolicyPreviewSchema,
  negotiationProjectionSchema,
  okResponseSchema,
  type Problem,
  problemSchema,
  purchaseOrderDetailSchema,
  purchaseOrderListSchema,
  purchaseOrderPreviewResponseSchema,
  purchaseOrderResponseSchema,
  quotationProjectionSchema,
  quotationUploadCompletionSchema,
  quotationUploadReservationSchema,
  quoteCopilotConversationSchema,
  scenarioSelectionResponseSchema,
} from "@procurement/contracts";
import type { Decoder } from "./client";
import type {
  CommercialReviewResponse,
  DecisionResponse,
  MatchResolutionResponse,
  NegotiationPolicyPreviewResponse,
  NegotiationResponse,
  PurchaseOrderDetailResponse,
  PurchaseOrderListResponse,
  PurchaseOrderPreviewResponse,
  PurchaseOrderResponse,
  QuotationResponse,
  QuoteCopilotConversationResponse,
  ScenarioSelectionResponse,
  UploadCompletionResponse,
  UploadReservationResponse,
} from "./types";

export type UploadReservation = UploadReservationResponse;
export type UploadCompletion = UploadCompletionResponse;
export type MatchResolution = MatchResolutionResponse;
export type ScenarioSelection = ScenarioSelectionResponse;
export type CommercialReview = CommercialReviewResponse;
export type Quotation = QuotationResponse;
export type Negotiation = NegotiationResponse;
export type Decision = DecisionResponse;
export type PurchaseOrderPreview = PurchaseOrderPreviewResponse;
export type PurchaseOrder = PurchaseOrderResponse;
export type NegotiationPolicyPreview = NegotiationPolicyPreviewResponse;
export type PurchaseOrderDetail = PurchaseOrderDetailResponse;
export type PurchaseOrderList = PurchaseOrderListResponse;
export type QuoteCopilotConversation = QuoteCopilotConversationResponse;

export const decodeUploadReservation: Decoder<UploadReservation> = (value) =>
  quotationUploadReservationSchema.parse(value) as UploadReservation;

export const decodeUploadCompletion: Decoder<UploadCompletion> = (value) =>
  quotationUploadCompletionSchema.parse(value) as UploadCompletion;

export const decodeMatchResolution: Decoder<MatchResolution> = (value) =>
  matchResolutionResponseSchema.parse(value) as MatchResolution;

export const decodeScenarioSelection: Decoder<ScenarioSelection> = (value) =>
  scenarioSelectionResponseSchema.parse(value) as ScenarioSelection;

export const decodeCommercialReview: Decoder<CommercialReview> = (value) =>
  commercialReviewResponseSchema.parse(value) as CommercialReview;

export const decodeQuotation: Decoder<Quotation> = (value) =>
  quotationProjectionSchema.parse(value) as Quotation;

export const decodeNegotiation: Decoder<Negotiation> = (value) =>
  negotiationProjectionSchema.parse(value) as Negotiation;

export const decodeNegotiationPolicyPreview: Decoder<
  NegotiationPolicyPreview
> = (value) =>
  negotiationPolicyPreviewSchema.parse(value) as NegotiationPolicyPreview;

export const decodeDecision: Decoder<Decision> = (value) =>
  decisionProjectionResponseSchema.parse(value) as Decision;

export const decodePreview: Decoder<PurchaseOrderPreview> = (value) =>
  purchaseOrderPreviewResponseSchema.parse(value) as PurchaseOrderPreview;

export const decodePurchaseOrder: Decoder<PurchaseOrder> = (value) =>
  purchaseOrderResponseSchema.parse(value) as PurchaseOrder;

export const decodePurchaseOrderList: Decoder<PurchaseOrderList> = (value) =>
  purchaseOrderListSchema.parse(value) as PurchaseOrderList;

export const decodePurchaseOrderDetail: Decoder<PurchaseOrderDetail> = (
  value,
) => purchaseOrderDetailSchema.parse(value) as PurchaseOrderDetail;

export const decodeProblem: Decoder<Problem> = (value) =>
  problemSchema.parse(value);

export const decodeOk: Decoder<{ ok: true }> = (value) =>
  okResponseSchema.parse(value);

export const decodeQuoteCopilotConversation: Decoder<
  QuoteCopilotConversation
> = (value) =>
  quoteCopilotConversationSchema.parse(value) as QuoteCopilotConversation;
