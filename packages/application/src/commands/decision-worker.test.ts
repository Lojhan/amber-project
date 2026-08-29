import { asBrandId } from "@procurement/domain";
import { describe, expect, it } from "vitest";
import { ContinueDecisionCommandHandler } from "./decision-worker.js";

const brandId = asBrandId("brand-1");
const unitOfWork = {
  run: <T>(work: (transaction: { id: string }) => Promise<T>) =>
    work({ id: "tx" }),
};

describe("ContinueDecisionCommandHandler", () => {
  it("stores and commits a recommendation in the command transaction", async () => {
    const calls: string[] = [];
    const handler = new ContinueDecisionCommandHandler({
      unitOfWork,
      decide: () => ({ winnerOfferId: "offer-1" }),
      events: {
        append: async (
          transaction: { id: string },
          event: { type: string },
        ) => {
          calls.push(`event:${transaction.id}:${event.type}`);
          return {};
        },
      },
      negotiations: {
        loadDecisionInputs: async (transaction: { id: string }) => {
          calls.push(`load:${transaction.id}`);
          return {
            negotiation: {
              id: "negotiation-1",
              brandId,
              quotationId: "quotation-1",
              state: "EVALUATED",
              version: 7,
              currency: "USD",
              lines: [],
            },
            baselineMinor: 0n,
            policySnapshot: { version: "policy-v1" },
            offers: [],
          };
        },
        saveRecommendation: async (transaction: { id: string }) => {
          calls.push(`save:${transaction.id}`);
        },
        transition: async (
          transaction: { id: string },
          transition: { nextState: string },
        ) => {
          calls.push(`transition:${transaction.id}:${transition.nextState}`);
          return true;
        },
      },
    } as never);

    await handler.execute({
      brandId,
      negotiationId: "negotiation-1",
      expectedVersion: 7,
      correlationId: "correlation-1",
    });

    expect(calls).toEqual([
      "load:tx",
      "save:tx",
      "transition:tx:RECOMMENDED",
      "event:tx:decision.recommended",
    ]);
  });
});
