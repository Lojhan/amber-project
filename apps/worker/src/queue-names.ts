export const QUEUE_NAMES = [
  "preflight-quotation",
  "parse-quotation",
  "match-candidates",
  "negotiation-turn",
  "decision-continuation",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export const queuePolicy = Object.freeze({
  retryLimit: 3,
  retryDelay: 5,
  retryBackoff: true,
  expireInSeconds: 300,
  deadLetter: "worker-failures",
});
