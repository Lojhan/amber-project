import type { RequestContext } from "../context.js";
import type { CommandHandler } from "../core/handlers.js";
import type { UnitOfWork } from "../core/unit-of-work.js";
import { ApplicationError } from "../errors.js";
import type {
  Clock,
  DecisionReadModel,
  IdGenerator,
  NegotiationReadModel,
  PurchaseOrderDetail,
  PurchaseOrderReadModel,
  QuotationReadModel,
  QuotationView,
  QuoteCopilotMessage,
  QuoteCopilotModel,
  QuoteCopilotRepository,
  QuoteCopilotSuggestion,
} from "../ports/index.js";

export type ChatWithQuoteCopilotInput = Readonly<{
  quotationId: string;
  message: string;
}>;

type Dependencies = Readonly<{
  unitOfWork: UnitOfWork;
  quotations: QuotationReadModel;
  negotiations: NegotiationReadModel;
  decisions: DecisionReadModel;
  purchaseOrders: PurchaseOrderReadModel;
  conversations: QuoteCopilotRepository;
  model: QuoteCopilotModel;
  ids: IdGenerator;
  clock: Clock;
}>;

const downstreamContext = async (
  dependencies: Dependencies,
  brandId: RequestContext["brandId"],
  negotiationId: string | undefined,
) => {
  if (!negotiationId) return {};

  const [negotiation, decision, summaries] = await Promise.all([
    dependencies.negotiations.get(brandId, negotiationId),
    dependencies.decisions.get(brandId, negotiationId),
    dependencies.purchaseOrders.list(brandId),
  ]);
  const summary = summaries.find(
    (purchaseOrder) => purchaseOrder.negotiationId === negotiationId,
  );
  const purchaseOrder: PurchaseOrderDetail | null = summary
    ? await dependencies.purchaseOrders.get(brandId, summary.id)
    : null;

  return {
    ...(negotiation ? { negotiation } : {}),
    ...(decision ? { decision } : {}),
    ...(purchaseOrder ? { purchaseOrder } : {}),
  };
};

const currentMatch = (quotation: QuotationView, matchId: string) =>
  quotation.matches.find((match) => match.id === matchId);

export const validCopilotSuggestions = (
  quotation: QuotationView,
  suggestions: readonly QuoteCopilotSuggestion[],
): readonly QuoteCopilotSuggestion[] => {
  if (quotation.negotiationId) return [];

  return suggestions.slice(0, 3).filter((suggestion) => {
    if (suggestion.kind === "select_scenario")
      return quotation.scenarios.some(
        (scenario) => scenario.id === suggestion.scenarioId,
      );

    if (suggestion.kind === "set_quantity")
      return (
        /^[1-9]\d*$/.test(suggestion.quantity) &&
        quotation.matches.some(
          (match) =>
            match.matchReady &&
            match.lineId === suggestion.lineId &&
            match.scenarioId === quotation.selectedScenarioId &&
            match.status !== "EXCLUDED",
        )
      );

    const match = currentMatch(quotation, suggestion.matchId);
    if (!match?.matchReady || match.scenarioId !== quotation.selectedScenarioId)
      return false;
    if (suggestion.kind === "exclude_line") return match.status !== "EXCLUDED";

    return match.candidates.some(
      (candidate) => candidate.productId === suggestion.productId,
    );
  });
};

export class ChatWithQuoteCopilotCommandHandler
  implements CommandHandler<ChatWithQuoteCopilotInput, QuoteCopilotMessage>
{
  constructor(private readonly dependencies: Dependencies) {}

  async executeStreaming(
    context: RequestContext,
    input: ChatWithQuoteCopilotInput,
    onContent: (content: string) => Promise<void> | void,
  ): Promise<QuoteCopilotMessage> {
    return this.executeTurn(context, input, onContent, true);
  }

  async execute(
    context: RequestContext,
    input: ChatWithQuoteCopilotInput,
  ): Promise<QuoteCopilotMessage> {
    return this.executeTurn(context, input);
  }

  private async executeTurn(
    context: RequestContext,
    input: ChatWithQuoteCopilotInput,
    onContent?: (content: string) => Promise<void> | void,
    persistUserFirst = false,
  ): Promise<QuoteCopilotMessage> {
    const message = input.message.trim();
    if (!message || message.length > 2_000)
      throw new ApplicationError(
        "copilot-message-invalid",
        422,
        "Ask the quote copilot a question of up to 2,000 characters",
      );

    const quotation = await this.dependencies.quotations.get(
      context.brandId,
      input.quotationId,
    );
    if (!quotation)
      throw new ApplicationError(
        "quotation-not-found",
        404,
        "Quotation was not found",
      );

    const history = await this.dependencies.conversations.list(
      context.brandId,
      input.quotationId,
      20,
    );
    const userCreatedAt = this.dependencies.clock.now();
    const userMessage: QuoteCopilotMessage = {
      id: this.dependencies.ids.next(),
      role: "user",
      content: message,
      suggestions: [],
      createdAt: userCreatedAt,
    };
    if (persistUserFirst)
      await this.dependencies.unitOfWork.run((transaction) =>
        this.dependencies.conversations.append(transaction, {
          brandId: context.brandId,
          quotationId: quotation.id,
          messages: [userMessage],
        }),
      );
    const downstream = await downstreamContext(
      this.dependencies,
      context.brandId,
      quotation.negotiationId,
    );
    const response = await this.dependencies.model.respond(
      {
        workspace: { quotation, ...downstream },
        history,
        message,
      },
      onContent,
    );
    const responseTime = this.dependencies.clock.now().getTime();
    const assistantCreatedAt = new Date(
      Math.max(responseTime, userCreatedAt.getTime() + 1),
    );
    const assistantMessage: QuoteCopilotMessage = {
      id: this.dependencies.ids.next(),
      role: "assistant",
      content: response.content.trim(),
      suggestions: validCopilotSuggestions(quotation, response.suggestions),
      createdAt: assistantCreatedAt,
    };

    if (!assistantMessage.content)
      throw new ApplicationError(
        "copilot-response-empty",
        502,
        "The quote copilot returned an empty response",
      );

    await this.dependencies.unitOfWork.run((transaction) =>
      this.dependencies.conversations.append(transaction, {
        brandId: context.brandId,
        quotationId: quotation.id,
        messages: persistUserFirst
          ? [assistantMessage]
          : [userMessage, assistantMessage],
      }),
    );

    return assistantMessage;
  }
}
