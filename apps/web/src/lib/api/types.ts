/** Generated from packages/contracts/openapi.json; import API wire types here. */
export type { operations, paths } from "./generated";

import type { operations } from "./generated";

export type ReserveUploadRequest =
  operations["reserveQuotationUpload"]["requestBody"]["content"]["application/json"];
export type CompleteUploadRequest =
  operations["completeQuotationUpload"]["requestBody"]["content"]["application/json"];
export type ResolveMatchRequest =
  operations["resolveMatch"]["requestBody"]["content"]["application/json"];
export type SelectScenarioRequest =
  operations["selectQuotationScenario"]["requestBody"]["content"]["application/json"];
export type CommercialReviewRequest =
  operations["resolveRequestedQuantities"]["requestBody"]["content"]["application/json"];
export type StartNegotiationRequest =
  operations["startNegotiation"]["requestBody"]["content"]["application/json"];
export type PreviewPurchaseOrderRequest =
  operations["previewPurchaseOrder"]["requestBody"]["content"]["application/json"];
export type IssuePurchaseOrderRequest =
  operations["issuePurchaseOrder"]["requestBody"]["content"]["application/json"];
export type NegotiationPolicyPreviewResponse =
  operations["previewNegotiationPolicy"]["responses"][200]["content"]["application/json"];
export type PurchaseOrderListResponse =
  operations["listPurchaseOrders"]["responses"][200]["content"]["application/json"];
export type PurchaseOrderDetailResponse =
  operations["getPurchaseOrder"]["responses"][200]["content"]["application/json"];
export type QuoteCopilotRequest =
  operations["chatWithQuoteCopilot"]["requestBody"]["content"]["application/json"];
export type QuoteCopilotConversationResponse =
  operations["getQuoteCopilotConversation"]["responses"][200]["content"]["application/json"];

export type UploadReservationResponse =
  operations["reserveQuotationUpload"]["responses"][200]["content"]["application/json"];
export type UploadCompletionResponse =
  operations["completeQuotationUpload"]["responses"][200]["content"]["application/json"];
export type MatchResolutionResponse =
  operations["resolveMatch"]["responses"][200]["content"]["application/json"];
export type ScenarioSelectionResponse =
  operations["selectQuotationScenario"]["responses"][200]["content"]["application/json"];
export type CommercialReviewResponse =
  operations["resolveRequestedQuantities"]["responses"][200]["content"]["application/json"];
export type QuotationResponse =
  operations["getQuotation"]["responses"][200]["content"]["application/json"];
export type NegotiationResponse =
  operations["getNegotiation"]["responses"][200]["content"]["application/json"];
export type DecisionResponse =
  operations["getDecision"]["responses"][200]["content"]["application/json"];
export type PurchaseOrderPreviewResponse =
  operations["previewPurchaseOrder"]["responses"][200]["content"]["application/json"];
export type PurchaseOrderResponse =
  operations["issuePurchaseOrder"]["responses"][200]["content"]["application/json"];
