export const workerQueueNames = [
  "preflight-quotation",
  "parse-quotation",
  "match-candidates",
  "negotiation-turn",
  "decision-continuation",
] as const;

export type WorkerQueueName = (typeof workerQueueNames)[number];
