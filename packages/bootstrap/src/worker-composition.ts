import {
  CompleteQuotationPreflightCommandHandler,
  ContinueDecisionCommandHandler,
  ExecuteNegotiationTurnCommandHandler,
  GenerateMatchCandidatesCommandHandler,
  IdempotentWorkerExecutionService,
  ParseQuotationCommandHandler,
  RecordWorkerFailureCommandHandler,
} from "@procurement/application";

export interface WorkerComposition {
  readonly completeQuotationPreflight: Pick<
    CompleteQuotationPreflightCommandHandler,
    "execute"
  >;
  readonly parseQuotation: Pick<ParseQuotationCommandHandler, "execute">;
  readonly generateMatchCandidates: Pick<
    GenerateMatchCandidatesCommandHandler,
    "execute"
  >;
  readonly executeNegotiationTurn: Pick<
    ExecuteNegotiationTurnCommandHandler,
    "execute"
  >;
  readonly continueDecision: Pick<ContinueDecisionCommandHandler, "execute">;
  readonly executions: Pick<IdempotentWorkerExecutionService, "execute">;
  readonly recordFailure: Pick<RecordWorkerFailureCommandHandler, "execute">;
}

export type WorkerCompositionDependencies = Readonly<{
  completeQuotationPreflight: ConstructorParameters<
    typeof CompleteQuotationPreflightCommandHandler
  >[0];
  parseQuotation: ConstructorParameters<typeof ParseQuotationCommandHandler>[0];
  generateMatchCandidates: ConstructorParameters<
    typeof GenerateMatchCandidatesCommandHandler
  >[0];
  executeNegotiationTurn: ConstructorParameters<
    typeof ExecuteNegotiationTurnCommandHandler
  >[0];
  continueDecision: ConstructorParameters<
    typeof ContinueDecisionCommandHandler
  >[0];
  executions: ConstructorParameters<typeof IdempotentWorkerExecutionService>;
  recordFailure: ConstructorParameters<
    typeof RecordWorkerFailureCommandHandler
  >;
}>;

export const composeWorker = (
  dependencies: WorkerCompositionDependencies,
): WorkerComposition => ({
  completeQuotationPreflight: new CompleteQuotationPreflightCommandHandler(
    dependencies.completeQuotationPreflight,
  ),
  parseQuotation: new ParseQuotationCommandHandler(dependencies.parseQuotation),
  generateMatchCandidates: new GenerateMatchCandidatesCommandHandler(
    dependencies.generateMatchCandidates,
  ),
  executeNegotiationTurn: new ExecuteNegotiationTurnCommandHandler(
    dependencies.executeNegotiationTurn,
  ),
  continueDecision: new ContinueDecisionCommandHandler(
    dependencies.continueDecision,
  ),
  executions: new IdempotentWorkerExecutionService(...dependencies.executions),
  recordFailure: new RecordWorkerFailureCommandHandler(
    ...dependencies.recordFailure,
  ),
});
