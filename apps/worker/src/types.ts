import type { QueueName } from "./queue-names.js";

export type WorkerEnvelope<T extends object = object> = Readonly<{
  id: string;
  name: QueueName;
  data: T;
}>;

export type QuotationJob = Readonly<{
  quotationId: string;
  brandId: string;
  objectKey: string;
  correlationId: string;
}>;

export type NegotiationJob = Readonly<{
  negotiationId: string;
  brandId: string;
  supplierId: "S1" | "S2" | "S3";
  round: 1 | 2;
  expectedVersion: number;
  correlationId: string;
}>;

export type DecisionJob = Readonly<{
  negotiationId: string;
  brandId: string;
  expectedVersion: number;
  correlationId: string;
}>;

export type MatchingJob = Readonly<{
  quotationId: string;
  brandId: string;
  correlationId: string;
}>;

export type QueuePayloadMap = {
  "preflight-quotation": QuotationJob;
  "parse-quotation": QuotationJob;
  "match-candidates": MatchingJob;
  "negotiation-turn": NegotiationJob;
  "decision-continuation": DecisionJob;
};
