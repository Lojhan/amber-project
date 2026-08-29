import {
  ChatWithQuoteCopilotCommandHandler,
  CompleteQuotationUploadCommandHandler,
  GetDecisionQueryHandler,
  GetNegotiationQueryHandler,
  GetPurchaseOrderQueryHandler,
  GetQuotationQueryHandler,
  GetQuoteCopilotQueryHandler,
  IssuePurchaseOrderCommandHandler,
  ListPurchaseOrdersQueryHandler,
  PreparePurchaseOrderCommandHandler,
  PreviewNegotiationPolicyCommandHandler,
  ReadProjectionEventsQueryHandler,
  ReserveQuotationUploadCommandHandler,
  ResetChallengeCommandHandler,
  ResolveCatalogMatchCommandHandler,
  ResolveRequestedQuantitiesCommandHandler,
  SelectQuotationScenarioCommandHandler,
  StartNegotiationCommandHandler,
} from "@procurement/application";

export interface ApiComposition {
  readonly chatWithQuoteCopilot: Pick<
    ChatWithQuoteCopilotCommandHandler,
    "execute" | "executeStreaming"
  >;
  readonly getQuoteCopilot: Pick<GetQuoteCopilotQueryHandler, "execute">;
  readonly resetChallenge: Pick<ResetChallengeCommandHandler, "execute">;
  readonly reserveQuotationUpload: Pick<
    ReserveQuotationUploadCommandHandler,
    "execute"
  >;
  readonly completeQuotationUpload: Pick<
    CompleteQuotationUploadCommandHandler,
    "execute"
  >;
  readonly resolveCatalogMatch: Pick<
    ResolveCatalogMatchCommandHandler,
    "execute"
  >;
  readonly selectQuotationScenario: Pick<
    SelectQuotationScenarioCommandHandler,
    "execute"
  >;
  readonly resolveRequestedQuantities: Pick<
    ResolveRequestedQuantitiesCommandHandler,
    "execute"
  >;
  readonly startNegotiation: Pick<StartNegotiationCommandHandler, "execute">;
  readonly preparePurchaseOrder: Pick<
    PreparePurchaseOrderCommandHandler,
    "execute"
  >;
  readonly issuePurchaseOrder: Pick<
    IssuePurchaseOrderCommandHandler,
    "execute"
  >;
  readonly getQuotation: Pick<GetQuotationQueryHandler, "execute">;
  readonly previewNegotiationPolicy: Pick<
    PreviewNegotiationPolicyCommandHandler,
    "execute"
  >;
  readonly getNegotiation: Pick<GetNegotiationQueryHandler, "execute">;
  readonly getDecision: Pick<GetDecisionQueryHandler, "execute">;
  readonly listPurchaseOrders: Pick<ListPurchaseOrdersQueryHandler, "execute">;
  readonly getPurchaseOrder: Pick<GetPurchaseOrderQueryHandler, "execute">;
  readonly readProjectionEvents: Pick<
    ReadProjectionEventsQueryHandler,
    "execute"
  >;
}

export type ApiCompositionDependencies = Readonly<{
  chatWithQuoteCopilot: ConstructorParameters<
    typeof ChatWithQuoteCopilotCommandHandler
  >[0];
  getQuoteCopilot: ConstructorParameters<typeof GetQuoteCopilotQueryHandler>[0];
  resetChallenge: ConstructorParameters<typeof ResetChallengeCommandHandler>[0];
  reserveQuotationUpload: ConstructorParameters<
    typeof ReserveQuotationUploadCommandHandler
  >[0];
  completeQuotationUpload: ConstructorParameters<
    typeof CompleteQuotationUploadCommandHandler
  >[0];
  resolveCatalogMatch: ConstructorParameters<
    typeof ResolveCatalogMatchCommandHandler
  >[0];
  selectQuotationScenario: ConstructorParameters<
    typeof SelectQuotationScenarioCommandHandler
  >[0];
  resolveRequestedQuantities: ConstructorParameters<
    typeof ResolveRequestedQuantitiesCommandHandler
  >[0];
  startNegotiation: ConstructorParameters<
    typeof StartNegotiationCommandHandler
  >[0];
  preparePurchaseOrder: ConstructorParameters<
    typeof PreparePurchaseOrderCommandHandler
  >[0];
  issuePurchaseOrder: ConstructorParameters<
    typeof IssuePurchaseOrderCommandHandler
  >[0];
  getQuotation: ConstructorParameters<typeof GetQuotationQueryHandler>[0];
  previewNegotiationPolicy: ConstructorParameters<
    typeof PreviewNegotiationPolicyCommandHandler
  >[0];
  getNegotiation: ConstructorParameters<typeof GetNegotiationQueryHandler>[0];
  getDecision: ConstructorParameters<typeof GetDecisionQueryHandler>[0];
  purchaseOrders: ConstructorParameters<
    typeof ListPurchaseOrdersQueryHandler
  >[0];
  readProjectionEvents: ConstructorParameters<
    typeof ReadProjectionEventsQueryHandler
  >[0];
}>;

export const composeApi = (
  dependencies: ApiCompositionDependencies,
): ApiComposition => ({
  chatWithQuoteCopilot: new ChatWithQuoteCopilotCommandHandler(
    dependencies.chatWithQuoteCopilot,
  ),
  getQuoteCopilot: new GetQuoteCopilotQueryHandler(
    dependencies.getQuoteCopilot,
  ),
  resetChallenge: new ResetChallengeCommandHandler(dependencies.resetChallenge),
  reserveQuotationUpload: new ReserveQuotationUploadCommandHandler(
    dependencies.reserveQuotationUpload,
  ),
  completeQuotationUpload: new CompleteQuotationUploadCommandHandler(
    dependencies.completeQuotationUpload,
  ),
  resolveCatalogMatch: new ResolveCatalogMatchCommandHandler(
    dependencies.resolveCatalogMatch,
  ),
  selectQuotationScenario: new SelectQuotationScenarioCommandHandler(
    dependencies.selectQuotationScenario,
  ),
  resolveRequestedQuantities: new ResolveRequestedQuantitiesCommandHandler(
    dependencies.resolveRequestedQuantities,
  ),
  startNegotiation: new StartNegotiationCommandHandler(
    dependencies.startNegotiation,
  ),
  preparePurchaseOrder: new PreparePurchaseOrderCommandHandler(
    dependencies.preparePurchaseOrder,
  ),
  issuePurchaseOrder: new IssuePurchaseOrderCommandHandler(
    dependencies.issuePurchaseOrder,
  ),
  getQuotation: new GetQuotationQueryHandler(dependencies.getQuotation),
  previewNegotiationPolicy: new PreviewNegotiationPolicyCommandHandler(
    dependencies.previewNegotiationPolicy,
  ),
  getNegotiation: new GetNegotiationQueryHandler(dependencies.getNegotiation),
  getDecision: new GetDecisionQueryHandler(dependencies.getDecision),
  listPurchaseOrders: new ListPurchaseOrdersQueryHandler(
    dependencies.purchaseOrders,
  ),
  getPurchaseOrder: new GetPurchaseOrderQueryHandler(
    dependencies.purchaseOrders,
  ),
  readProjectionEvents: new ReadProjectionEventsQueryHandler(
    dependencies.readProjectionEvents,
  ),
});
