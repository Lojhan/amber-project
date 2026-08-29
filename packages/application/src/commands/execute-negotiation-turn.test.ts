import { asBrandId } from "@procurement/domain";
import { describe, expect, it, vi } from "vitest";
import type { NegotiationTurn } from "../ports/index.js";
import { ExecuteNegotiationTurnCommandHandler } from "./execute-negotiation-turn.js";

const brandId = asBrandId("00000000-0000-4000-8000-000000000001");
const negotiationId = "00000000-0000-4000-8000-000000000002";
const roundOneTurn: NegotiationTurn = {
  key: "S1:1:proposal",
  supplierId: "S1",
  round: 1,
  status: "proposal",
  result: {
    status: "proposal",
    brandMove: {
      message: "Provide an opening offer against the quotation baseline.",
    },
    proposal: {
      supplierId: "S1",
      round: 1,
      message: "Our opening offer follows the supplied baseline.",
      currency: "USD",
      leadTimeDays: 50,
      capacityPercent: 100,
      paymentSchedule: [
        { milestone: "ORDER", percentBasisPoints: 3300 },
        { milestone: "PRE_SHIPMENT", percentBasisPoints: 3300 },
        { milestone: "DELIVERY", percentBasisPoints: 3400 },
      ],
      lines: [
        {
          productId: "00000000-0000-4000-8000-000000000003",
          quantity: "2",
          unitPriceMinor: "100",
        },
      ],
    },
  },
  providerMetadata: {},
};

const competingTurn: NegotiationTurn = {
  ...roundOneTurn,
  key: "S2:1:proposal",
  supplierId: "S2",
  result: {
    status: "proposal",
    brandMove: { message: "Compete with the quotation baseline." },
    proposal: {
      supplierId: "S2",
      round: 1,
      message: "Supplier 2 opening position.",
    },
  },
};

const setup = () => {
  const turns: NegotiationTurn[] = [roundOneTurn, competingTurn];
  const brand = {
    plan: vi.fn().mockResolvedValue({
      move: {
        message: "Reduce cost and delivery time from your opening offer.",
        objectives: [
          {
            dimension: "cost",
            target: "Below baseline",
            rationale: "Another supplier is competing for the order.",
          },
        ],
        leverage: ["The uploaded quote is the baseline."],
        mustHaves: ["Fulfill the complete order."],
        source: "ai",
      },
      metadata: { modelId: "brand-model" },
    }),
  };
  const proposals = {
    propose: vi.fn().mockResolvedValue({
      status: "proposal",
      result: {
        status: "proposal",
        proposal: {
          supplierId: "S1",
          round: 2,
          message: "We reduced price and lead time to stay competitive.",
        },
      },
      metadata: { modelId: "supplier-model" },
    }),
  };
  const negotiations = {
    loadRun: vi.fn().mockResolvedValue({
      id: negotiationId,
      brandId,
      quotationId: "00000000-0000-4000-8000-000000000004",
      state: "ROUND_2_RUNNING",
      version: 4,
      currency: "USD",
      policySnapshot: { weights: { cost: "0.5" } },
      lines: [
        {
          productId: "00000000-0000-4000-8000-000000000003",
          quantity: 2n,
          baselineUnitPriceMinor: 100n,
        },
      ],
    }),
    listTurns: vi.fn().mockImplementation(async () => turns),
    appendTurn: vi.fn().mockImplementation(async (_tx, _brand, _id, turn) => {
      turns.push(turn);
      return true;
    }),
  };
  const handler = new ExecuteNegotiationTurnCommandHandler({
    unitOfWork: { run: <T>(work: (tx: object) => Promise<T>) => work({}) },
    negotiations,
    brand,
    proposals,
    jobs: { enqueue: vi.fn() },
  } as never);

  return { brand, proposals, negotiations, handler };
};

describe("adversarial negotiation turn", () => {
  it("maps prior offers into a brand counter before asking the supplier", async () => {
    const { brand, proposals, negotiations, handler } = setup();

    await handler.execute({
      brandId,
      negotiationId,
      supplierId: "S1",
      round: 2,
      expectedVersion: 4,
      correlationId: "correlation",
    });

    expect(brand.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: "S1",
        round: 2,
        priorConversation: expect.arrayContaining([
          expect.objectContaining({
            brandMessage: expect.stringContaining("opening offer"),
            supplierMessage: expect.stringContaining("opening offer"),
            commercialTerms: expect.objectContaining({
              totalMinor: "200",
              leadTimeDays: 50,
            }),
          }),
        ]),
      }),
    );
    expect(brand.plan.mock.calls[0]?.[0].priorConversation).toHaveLength(2);
    expect(brand.plan.mock.calls[0]?.[0]).not.toHaveProperty("capacityChange");
    expect(proposals.propose).toHaveBeenCalledWith(
      expect.objectContaining({
        brandMessage: "Reduce cost and delivery time from your opening offer.",
        priorConversation: expect.arrayContaining([
          expect.objectContaining({ supplierId: "S1", round: 1 }),
        ]),
      }),
    );
    expect(proposals.propose.mock.calls[0]?.[0].priorConversation).toHaveLength(
      1,
    );
    expect(negotiations.appendTurn).toHaveBeenCalledWith(
      expect.anything(),
      brandId,
      negotiationId,
      expect.objectContaining({
        result: expect.objectContaining({
          brandMove: expect.objectContaining({ source: "ai" }),
          proposal: expect.objectContaining({ round: 2 }),
        }),
        providerMetadata: {
          brand: { modelId: "brand-model" },
          supplier: { modelId: "supplier-model" },
        },
      }),
    );
  });
});
