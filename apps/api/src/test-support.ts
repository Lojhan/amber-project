import type { ApiComposition } from "@procurement/bootstrap/api";
import type { ApiDependencies } from "./types.js";

export type CompositionStub = {
  -readonly [Key in keyof ApiComposition]: ApiComposition[Key];
};

const actorId = "11111111-1111-4111-8111-111111111111";
export const testBrandId = "33333333-3333-4333-8333-333333333333";
const quotationId = "00000000-0000-4000-8000-000000000001";

const quotationHandlers = () =>
  ({
    reserveQuotationUpload: {
      execute: async (_context, input) => ({
        objectKey: `uploads/${input.filename}`,
        uploadUrl: "https://storage.example/upload",
        uploadMethod: "PUT",
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "x-amz-meta-sha256": input.contentHash,
        },
      }),
    },
    completeQuotationUpload: {
      execute: async () => ({
        id: quotationId,
        state: "UPLOADED",
        replayed: false,
      }),
    },
    resolveCatalogMatch: { execute: async () => undefined },
    selectQuotationScenario: { execute: async () => undefined },
    resolveRequestedQuantities: { execute: async () => undefined },
    getQuotation: {
      execute: async () => ({
        id: quotationId,
        status: "READY" as const,
        scenarios: [],
        matches: [],
      }),
    },
  }) satisfies Pick<
    CompositionStub,
    | "reserveQuotationUpload"
    | "completeQuotationUpload"
    | "resolveCatalogMatch"
    | "selectQuotationScenario"
    | "resolveRequestedQuantities"
    | "getQuotation"
  >;

const negotiationHandlers = () =>
  ({
    startNegotiation: {
      execute: async () => ({
        id: "00000000-0000-4000-8000-000000000010",
        status: "ROUND_1_RUNNING",
        timeline: [],
        reducedCompetition: false,
        offers: [],
      }),
    },
    previewNegotiationPolicy: {
      execute: async (_context, query) => ({
        ...query,
        policyVersion: "decision-policy-v1",
        policyHash: "a".repeat(64),
        weights: {
          cost: "0.45",
          quality: "0.25",
          lead: "0.20",
          payment: "0.10",
        },
        constraints: {},
        interpretation: {
          primaryPriority: null,
          summary: "The standard buying policy applies.",
          warnings: [],
          source: "default" as const,
        },
        confirmationToken: "signed-policy-confirmation",
      }),
    },
    getNegotiation: {
      execute: async () => ({
        id: "00000000-0000-4000-8000-000000000010",
        status: "ROUND_1_RUNNING" as const,
        timeline: [],
        reducedCompetition: false,
        offers: [],
      }),
    },
    getDecision: { execute: async () => null },
  }) satisfies Pick<
    CompositionStub,
    | "startNegotiation"
    | "previewNegotiationPolicy"
    | "getNegotiation"
    | "getDecision"
  >;

const purchaseOrderHandlers = () =>
  ({
    preparePurchaseOrder: {
      execute: async () => ({
        digest: "a".repeat(64),
        confirmationToken: "confirmation-token",
        totalMinor: "100",
        currency: "USD",
        supplierId: "S1",
        lineCount: 1,
        leadTimeDays: 30,
        paymentSchedule: [
          { milestone: "ORDER" as const, percentBasisPoints: 4000 },
          { milestone: "DELIVERY" as const, percentBasisPoints: 6000 },
        ],
      }),
    },
    issuePurchaseOrder: {
      execute: async () => ({
        id: "00000000-0000-4000-8000-000000000020",
        number: "PO-1",
        replayed: false,
      }),
    },
    listPurchaseOrders: { execute: async () => [] },
    getPurchaseOrder: {
      execute: async () => ({
        id: "00000000-0000-4000-8000-000000000020",
        number: "PO-1",
        negotiationId: "00000000-0000-4000-8000-000000000010",
        totalMinor: "100",
        currency: "USD",
        issuedAt: "2028-01-01T00:00:00.000Z",
        status: "ISSUED" as const,
        supplierId: "S1",
        leadTimeDays: 30,
        paymentSchedule: [
          { milestone: "ORDER" as const, percentBasisPoints: 4000 },
          { milestone: "DELIVERY" as const, percentBasisPoints: 6000 },
        ],
        issuedBy: actorId,
        lines: [],
        audit: [],
      }),
    },
  }) satisfies Pick<
    CompositionStub,
    | "preparePurchaseOrder"
    | "issuePurchaseOrder"
    | "listPurchaseOrders"
    | "getPurchaseOrder"
  >;

export const createComposition = (): CompositionStub => ({
  chatWithQuoteCopilot: {
    execute: async (_context, input) => ({
      id: "00000000-0000-4000-8000-000000000031",
      role: "assistant" as const,
      content: `Reviewing ${input.quotationId}`,
      suggestions: [],
      createdAt: new Date("2028-01-01T00:00:00.000Z"),
    }),
    executeStreaming: async (_context, input, onContent) => {
      await onContent(`Reviewing ${input.quotationId}`);
      return {
        id: "00000000-0000-4000-8000-000000000031",
        role: "assistant" as const,
        content: `Reviewing ${input.quotationId}`,
        suggestions: [],
        createdAt: new Date("2028-01-01T00:00:00.000Z"),
      };
    },
  },
  getQuoteCopilot: {
    execute: async (_context, input) => ({
      quotationId: input.quotationId,
      messages: [],
    }),
  },
  resetChallenge: { execute: async () => undefined },
  ...quotationHandlers(),
  ...negotiationHandlers(),
  ...purchaseOrderHandlers(),
  readProjectionEvents: { execute: async () => [] },
});

export const createDependencies = (
  overrides: Partial<ApiDependencies> = {},
): ApiDependencies => {
  return {
    config: {
      ACTOR_ID: actorId,
      BRAND_ID: testBrandId,
    },
    composition: createComposition(),
    ...overrides,
  };
};
