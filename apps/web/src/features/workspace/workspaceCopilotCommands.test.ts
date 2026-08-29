import type { SetStateAction } from "react";
import { describe, expect, it, vi } from "vitest";
import type { QuoteCopilotConversation } from "../../lib/api/contracts";
import type { WorkspaceState } from "./types";
import type { WorkspaceProjection } from "./useWorkspaceProjection";
import { copilotCommands } from "./workspaceCopilotCommands";

const quotationId = "00000000-0000-4000-8000-000000000001";

describe("workspace copilot commands", () => {
  it("shows the buyer turn immediately and updates assistant content as it streams", async () => {
    const completed: QuoteCopilotConversation = {
      quotationId,
      messages: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          role: "user",
          content: "Propose a safe adjustment",
          suggestions: [],
          createdAt: "2028-01-01T00:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000003",
          role: "assistant",
          content: "Review this catalog match.",
          suggestions: [],
          createdAt: "2028-01-01T00:00:01.000Z",
        },
      ],
    };
    let finishStream:
      | ((conversation: QuoteCopilotConversation) => void)
      | undefined;
    const api = {
      streamQuoteCopilot: vi.fn(
        async (
          _input: unknown,
          onContent: (content: string) => void,
        ): Promise<QuoteCopilotConversation> => {
          onContent("Review this");
          return new Promise((resolve) => {
            finishStream = resolve;
          });
        },
      ),
    };
    const mutable: { state: WorkspaceState } = {
      state: {
        loading: false,
        stale: false,
        purchaseOrders: [],
        quotation: { id: quotationId } as never,
      },
    };
    const projection = {
      get state() {
        return mutable.state;
      },
      setState(update: SetStateAction<WorkspaceState>) {
        mutable.state =
          typeof update === "function" ? update(mutable.state) : update;
      },
    } as WorkspaceProjection;
    const command = copilotCommands(api as never, projection);

    const pending = command.sendCopilotMessage("Propose a safe adjustment");

    expect(mutable.state.copilot?.messages.at(-1)).toMatchObject({
      role: "user",
      content: "Propose a safe adjustment",
    });
    expect(mutable.state.copilotStreamingContent).toBe("Review this");
    expect(mutable.state.copilotPending).toBe(true);

    finishStream?.(completed);
    await pending;

    expect(mutable.state.copilot).toEqual(completed);
    expect(mutable.state.copilotStreamingContent).toBeUndefined();
    expect(mutable.state.copilotPending).toBe(false);
  });
});
