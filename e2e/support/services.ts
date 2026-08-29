import { deriveNegotiationPolicy } from "@procurement/application";
import type { BrandId } from "@procurement/domain";
import {
  type CompositionStub,
  createComposition,
} from "../../apps/api/src/test-support.js";
import { parseWorkbook } from "../../packages/parser/src/index.js";
import {
  configureCopilot,
  configurePurchaseOrder,
} from "./downstream-services.js";
import type { E2eState } from "./state.js";
import { ids } from "./state.js";

type Projection = () => Record<string, unknown>;

const policyHash =
  "0000000000000000000000000000000000000000000000000000000000000000";

const negotiation = () => ({
  id: ids.negotiation,
  status: "COMPLETED",
  reducedCompetition: true,
  timeline: [
    {
      actor: "brand" as const,
      supplierId: "S2",
      round: 1,
      status: "request",
      detail:
        "Use the uploaded quote as leverage and provide a complete opening offer.",
    },
    {
      actor: "supplier" as const,
      supplierId: "S2",
      round: 1,
      status: "capacity changed",
      detail:
        "We can continue in round 2 at 60% capacity, but cannot fulfill the complete order.",
    },
    {
      actor: "brand" as const,
      supplierId: "S2",
      round: 2,
      status: "request",
      detail:
        "Address the 40% fulfillment gap and improve the earlier commercial terms.",
    },
    {
      actor: "supplier" as const,
      supplierId: "S2",
      round: 2,
      status: "offer received",
      detail:
        "Our revised proposal reflects the 60% capacity limit and updated terms.",
    },
  ],
  offers: [
    {
      id: ids.offer,
      supplierId: "S1",
      round: 1,
      leadTimeDays: 12,
      capacityPercent: 100,
      fullOrderEligible: true,
    },
    {
      id: "00000000-0000-4000-8000-000000000010",
      supplierId: "S2",
      round: 2,
      leadTimeDays: 10,
      capacityPercent: 60,
      fullOrderEligible: false,
    },
  ],
});

const decision = (_brandId: BrandId) => ({
  id: "00000000-0000-4000-8000-000000000009",
  negotiationId: ids.negotiation,
  winnerOfferId: ids.offer,
  decisionRecord: {
    policyVersion: "e2e-v1",
    policyHash,
    decisionVersion: "e2e-v1",
    inputs: { baselineMinor: "1000", currency: "USD" },
    policySnapshot: {
      version: "e2e-v1",
      hash: policyHash,
      weights: { cost: "1", quality: "1", lead: "1", payment: "1" },
    },
    anchors: {
      cost: {
        best: "0.92*baseline",
        worst: "1.15*baseline",
        bestMinor: "1000",
        worstMinor: "1000",
      },
      quality: { best: "1", worst: "1" },
      lead: { best: "1", worst: "1" },
      payment: { best: "1", worst: "1" },
    },
    valueFunctions: {
      cost: "linear",
      quality: "linear",
      lead: "linear",
      payment: "linear",
    },
    weights: { cost: "1", quality: "1", lead: "1", payment: "1" },
    offers: [
      {
        candidate: {
          offerId: ids.offer,
          supplierId: "S1",
          totalMinor: "1000",
          quality: 4,
          leadTimeDays: 12,
          preShipmentBps: 5000,
          policyValid: true,
          currency: "USD",
          capacityPercent: 100,
        },
        offerId: ids.offer,
        eligible: true,
        exclusionReasons: [],
        totalMinor: "1000",
        quality: "4",
        leadTimeDays: 12,
        preShipmentBps: 5000,
        normalized: {
          cost: "1",
          quality: "1",
          lead: "1",
          payment: "1",
        },
        score: "1",
        paretoStatus: "non_dominated",
      },
    ],
    paretoOfferIds: [ids.offer],
    sensitivity: [],
    preferenceSensitive: false,
    winnerOfferId: ids.offer,
    recommendationStatus: "RECOMMENDED",
    tieBreakTrace: [],
    warnings: [],
    rationale: "Selected eligible full-order offer.",
  },
});

const configureQuotation = (
  composition: CompositionStub,
  state: E2eState,
  project: Projection,
) => {
  const webPort = process.env.E2E_WEB_PORT ?? "3100";
  composition.reserveQuotationUpload.execute = async (_context, input) => {
    state.file = input.filename;
    state.note = input.note;

    return {
      objectKey: `e2e/${input.filename}`,
      uploadUrl: `http://127.0.0.1:${webPort}/e2e-upload/${encodeURIComponent(input.filename)}`,
      uploadMethod: "PUT",
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "x-amz-meta-sha256": input.contentHash,
      },
    };
  };
  composition.completeQuotationUpload.execute = async () => {
    state.parsed = await parseWorkbook(state.bytes);
    state.selectedScenarioId = undefined;
    state.quantitiesReviewed = false;
    state.negotiationStarted = false;
    state.order = false;
    state.quotation = project();

    return { id: ids.quotation, state: "UPLOADED", replayed: false };
  };
  composition.getQuotation.execute = async () => state.quotation ?? project();
  composition.selectQuotationScenario.execute = async (_context, input) => {
    state.selectedScenarioId = input.scenarioId;
    state.quotation = project();
  };
  composition.resolveCatalogMatch.execute = async () => {
    state.quotation = {
      ...(state.quotation ?? project()),
      matches: [
        {
          id: ids.match,
          lineId: ids.match,
          scenarioId: ids.scenario2,
          label: "AQ009-0BS-XS",
          matchReady: true,
          status: "RESOLVED",
          reviewReasons: [],
          candidates: [],
        },
      ],
      status: "READY",
    };
  };
  composition.resolveRequestedQuantities.execute = async () => {
    state.quantitiesReviewed = true;
    state.quotation = project();
  };
};

const configureNegotiation = (
  composition: CompositionStub,
  state: E2eState,
  project: Projection,
  brandId: BrandId,
) => {
  composition.previewNegotiationPolicy.execute = async (_context, query) => {
    const interpretation = state.note
      ? {
          primaryPriority: "lead_time" as const,
          hardMaxLeadDays: 30,
          summary: "Delivery within 30 days is the main buying priority.",
          warnings: [],
          source: "ai" as const,
        }
      : {
          primaryPriority: null,
          hardMaxLeadDays: null,
          summary: "The standard buying policy applies.",
          warnings: [],
          source: "default" as const,
        };
    const policy = deriveNegotiationPolicy(interpretation);

    return {
      ...query,
      policyVersion: policy.version,
      policyHash: policy.hash,
      weights: policy.weights,
      constraints:
        policy.hardMaxLead === undefined
          ? {}
          : { hardMaxLead: policy.hardMaxLead },
      interpretation: {
        primaryPriority: interpretation.primaryPriority,
        summary: interpretation.summary,
        warnings: interpretation.warnings,
        source: interpretation.source,
      },
      confirmationToken: "e2e-policy-confirmation",
    };
  };
  composition.startNegotiation.execute = async () => {
    state.negotiationStarted = true;
    state.quotation = project();
    return negotiation();
  };
  composition.getNegotiation.execute = async () => negotiation();
  composition.getDecision.execute = async () => decision(brandId);
};

export const createE2eComposition = (
  state: E2eState,
  project: Projection,
  brandId: BrandId,
): CompositionStub => {
  const composition = createComposition();

  composition.resetChallenge.execute = async () => {
    state.file = "";
    state.note = undefined;
    state.bytes = new Uint8Array();
    state.parsed = undefined;
    state.quotation = undefined;
    state.selectedScenarioId = undefined;
    state.quantitiesReviewed = false;
    state.negotiationStarted = false;
    state.order = false;
    state.copilotMessages = [];
  };

  configureQuotation(composition, state, project);
  configureNegotiation(composition, state, project, brandId);
  configurePurchaseOrder(composition, state);
  configureCopilot(composition, state);

  return composition;
};
