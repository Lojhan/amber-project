import type { QuoteCopilotMessage } from "@procurement/application/ports";
import type { ParsedQuote } from "../../../packages/parser/src/index.js";

export const ids = {
  quotation: "00000000-0000-4000-8000-000000000001",
  negotiation: "00000000-0000-4000-8000-000000000002",
  scenario1: "00000000-0000-4000-8000-000000000003",
  scenario2: "00000000-0000-4000-8000-000000000004",
  match: "00000000-0000-4000-8000-000000000005",
  offer: "00000000-0000-4000-8000-000000000006",
  order: "00000000-0000-4000-8000-000000000007",
  product: "00000000-0000-4000-8000-000000000008",
} as const;

export type E2eState = {
  file: string;
  note?: string;
  bytes: Uint8Array;
  parsed?: ParsedQuote;
  quotation?: Record<string, unknown>;
  selectedScenarioId?: string;
  quantitiesReviewed: boolean;
  negotiationStarted: boolean;
  order: boolean;
  copilotMessages: QuoteCopilotMessage[];
};

export const createE2eState = (): E2eState => ({
  file: "",
  bytes: new Uint8Array(),
  quantitiesReviewed: false,
  negotiationStarted: false,
  order: false,
  copilotMessages: [],
});
