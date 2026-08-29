import type { ProcurementWorkspaceContext } from "@procurement/application/ports";
import { describe, expect, it } from "vitest";
import { procurementWorkspaceStep } from "./quote-copilot.js";
import {
  decisionCopilotContext,
  purchaseOrderCopilotContext,
  quoteCopilotContext,
} from "./quote-copilot-context.js";

const quotation = {
  id: "quotation",
  status: "INTERPRETATION_REQUIRED",
  scenarios: [{ id: "scenario", label: "Sheet1" }],
  matches: [],
};

const workspace = (
  patch: Partial<ProcurementWorkspaceContext> = {},
): ProcurementWorkspaceContext => ({
  quotation,
  ...patch,
});

describe("procurement copilot context", () => {
  it("tracks the active workflow stage instead of assuming quote review", () => {
    expect(procurementWorkspaceStep(workspace())).toBe("scenario_selection");
    expect(
      procurementWorkspaceStep(
        workspace({
          quotation: {
            ...quotation,
            selectedScenarioId: "scenario",
            matches: [
              {
                id: "match",
                lineId: "line",
                scenarioId: "scenario",
                label: "SKU-1",
                matchReady: true,
                status: "PENDING",
                reviewReasons: [],
                candidates: [],
              },
            ],
          },
        }),
      ),
    ).toBe("product_matching");
    expect(
      procurementWorkspaceStep(
        workspace({
          negotiation: {
            id: "negotiation",
            status: "IN_PROGRESS",
            timeline: [],
            reducedCompetition: false,
            offers: [],
          },
        }),
      ),
    ).toBe("negotiation");
    expect(
      procurementWorkspaceStep(
        workspace({
          decision: {
            id: "decision",
            negotiationId: "negotiation",
            winnerOfferId: null,
            decisionRecord: {},
          },
        }),
      ),
    ).toBe("decision");
    expect(
      procurementWorkspaceStep(
        workspace({
          purchaseOrder: {
            id: "order",
            number: "PO-1",
            negotiationId: "negotiation",
            totalMinor: "100",
            currency: "USD",
            issuedAt: "2028-01-01T00:00:00.000Z",
            status: "ISSUED",
            supplierId: "S1",
            leadTimeDays: 15,
            paymentSchedule: [
              { milestone: "ORDER", percentBasisPoints: 10_000 },
            ],
            issuedBy: "buyer",
            lines: [],
            audit: [],
          },
        }),
      ),
    ).toBe("purchase_order_issued");
  });
});

describe("procurement copilot monetary context", () => {
  it("provides exact authoritative display money instead of asking the model to round", () => {
    const quoted = quoteCopilotContext(
      workspace({
        quotation: {
          ...quotation,
          currency: "USD",
          matches: [
            {
              id: "match",
              lineId: "line",
              scenarioId: "scenario",
              label: "SKU-1",
              matchReady: true,
              unitPriceMinor: "135838703",
              extendedTotalMinor: "138639501",
              reviewReasons: [],
              candidates: [],
            },
          ],
        },
      }),
    );
    expect(quoted.lines[0]).toMatchObject({
      unitPriceDisplay: "USD 1,358,387.03",
      extendedTotalDisplay: "USD 1,386,395.01",
    });

    const decision = decisionCopilotContext({
      id: "decision",
      negotiationId: "negotiation",
      winnerOfferId: "offer",
      decisionRecord: {
        inputs: { baselineMinor: "140039900", currency: "USD" },
        offers: [
          {
            offerId: "offer",
            candidate: { supplierId: "S3" },
            totalMinor: "135838703",
          },
        ],
      },
    });
    expect(decision.monetaryDisplay).toEqual({
      currency: "USD",
      baseline: "USD 1,400,399.00",
      offers: [
        {
          offerId: "offer",
          supplierId: "S3",
          total: "USD 1,358,387.03",
        },
      ],
    });

    const purchaseOrder = purchaseOrderCopilotContext({
      id: "order",
      number: "PO-1",
      negotiationId: "negotiation",
      supplierId: "S3",
      totalMinor: "135838703",
      currency: "USD",
      issuedAt: "2028-01-01T00:00:00.000Z",
      status: "ISSUED",
      leadTimeDays: 14,
      paymentSchedule: [{ milestone: "ORDER", percentBasisPoints: 10_000 }],
      issuedBy: "buyer",
      lines: [
        {
          sku: "SKU-1",
          name: "Product",
          quantity: "1",
          unitPriceMinor: "135838703",
          extendedTotalMinor: "135838703",
        },
      ],
      audit: [],
    });
    expect(purchaseOrder).toMatchObject({
      totalDisplay: "USD 1,358,387.03",
      lines: [
        {
          unitPriceDisplay: "USD 1,358,387.03",
          extendedTotalDisplay: "USD 1,358,387.03",
        },
      ],
    });
  });
});
