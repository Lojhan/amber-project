import type { ChatStatus } from "ai";
import { Bot, CircleAlert, Sparkles, X } from "lucide-react";
import { useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspaceActions } from "../actions";
import type { WorkspaceState } from "../types";
import { workspaceCopilotContext } from "../workspaceCopilotContext";
import { CopilotSuggestionCard } from "./CopilotSuggestionCard";

const copilotStatus = (state: WorkspaceState): ChatStatus => {
  if (state.copilotError) return "error";
  if (!state.copilotPending) return "ready";

  return state.copilotStreamingContent === undefined
    ? "submitted"
    : "streaming";
};

function CopilotMessages({
  state,
  actions,
}: {
  state: WorkspaceState;
  actions: WorkspaceActions;
}) {
  const messages = state.copilot?.messages ?? [];

  return (
    <Conversation className="min-h-0">
      <ConversationContent className="gap-5 px-4 py-5">
        {messages.length === 0 ? (
          <ConversationEmptyState
            className="min-h-56"
            icon={<Sparkles className="size-6" />}
            title="Ask about the work in front of you"
            description="The copilot can inspect the current workspace, explain evidence, and propose buyer-confirmed corrections."
          />
        ) : null}
        {messages.map((message) => (
          <Message key={message.id} from={message.role}>
            <MessageContent>
              {message.role === "assistant" ? (
                <MessageResponse>{message.content}</MessageResponse>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
            </MessageContent>
            {message.suggestions.map((suggestion) => (
              <CopilotSuggestionCard
                key={`${message.id}-${suggestion.kind}-${suggestion.title}`}
                suggestion={suggestion}
                state={state}
                actions={actions}
              />
            ))}
          </Message>
        ))}
        {state.copilotStreamingContent ? (
          <Message from="assistant">
            <MessageContent>
              <MessageResponse isAnimating>
                {state.copilotStreamingContent}
              </MessageResponse>
            </MessageContent>
          </Message>
        ) : state.copilotPending ? (
          <Message from="assistant">
            <MessageContent className="text-muted-foreground">
              Inspecting the current workspace…
            </MessageContent>
          </Message>
        ) : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

export function WorkspaceCopilot({
  state,
  actions,
}: {
  state: WorkspaceState;
  actions: WorkspaceActions;
}) {
  const [open, setOpen] = useState(false);
  const context = workspaceCopilotContext(state);
  const enabled = Boolean(state.quotation) && !state.stale;
  const status = copilotStatus(state);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close procurement copilot"
          className="fixed inset-0 z-40 bg-background/70 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      {open ? (
        <aside
          id="procurement-copilot-panel"
          aria-labelledby="procurement-copilot-title"
          className="fixed inset-y-3 right-3 z-50 flex w-[min(28rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
        >
          <header className="grid gap-3 border-b px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <Bot aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="procurement-copilot-title" className="font-semibold">
                    Procurement copilot
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    Context follows this workspace
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Close procurement copilot"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{context.step}</Badge>
                <p className="text-sm font-medium">{context.title}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {context.description}
              </p>
            </div>
          </header>

          <CopilotMessages state={state} actions={actions} />

          <div className="grid gap-3 border-t bg-card p-4">
            {context.prompts.length > 0 ? (
              <Suggestions>
                {context.prompts.map((prompt) => (
                  <Suggestion
                    key={prompt}
                    suggestion={prompt}
                    disabled={state.copilotPending}
                    onClick={(content) =>
                      void actions.sendCopilotMessage(content)
                    }
                  />
                ))}
              </Suggestions>
            ) : null}
            {state.copilotError ? (
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertTitle>{state.copilotError.title}</AlertTitle>
                <AlertDescription>{state.copilotError.detail}</AlertDescription>
              </Alert>
            ) : null}
            <PromptInput
              onSubmit={async ({ text }) => {
                const content = text.trim();
                if (!enabled || !content) return;
                await actions.sendCopilotMessage(content);
              }}
            >
              <PromptInputBody>
                <PromptInputTextarea
                  aria-label="Ask the procurement copilot"
                  placeholder={
                    enabled
                      ? "Ask about this step, evidence, or next action…"
                      : "Upload a quotation to begin"
                  }
                  disabled={!enabled || state.copilotPending}
                  maxLength={2_000}
                />
              </PromptInputBody>
              <PromptInputFooter>
                <span className="text-xs text-muted-foreground">
                  {state.quotation?.negotiationId
                    ? "The quotation is read-only after negotiation starts"
                    : "Adjustments appear as reviewable actions"}
                </span>
                <PromptInputSubmit
                  status={status}
                  disabled={!enabled || state.copilotPending}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </aside>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="fixed right-5 bottom-5 z-30 gap-3 rounded-full px-5 shadow-xl"
        aria-expanded={open}
        aria-controls="procurement-copilot-panel"
        onClick={() => setOpen(true)}
      >
        <Bot aria-hidden="true" />
        <span className="grid text-left leading-tight">
          <span>Procurement copilot</span>
          <span className="text-[11px] font-normal opacity-75">
            {context.step}
          </span>
        </span>
      </Button>
    </>
  );
}
