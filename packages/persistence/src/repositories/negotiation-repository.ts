import type { NegotiationRepository } from "@procurement/application/ports";
import type { DrizzleUnitOfWork } from "../drizzle-unit-of-work.js";
import {
  loadDecisionInputs,
  saveRecommendation,
} from "./negotiation-decision.js";
import {
  appendTurn,
  applyCapacityEvent,
  createNegotiation,
  createOrderIntent,
  listTurns,
  loadRun,
  transition,
} from "./negotiation-lifecycle.js";
import { loadStartFacts } from "./negotiation-start-facts.js";

export class DrizzleNegotiationRepository implements NegotiationRepository {
  constructor(private readonly unitOfWork: DrizzleUnitOfWork) {}

  loadStartFacts: NegotiationRepository["loadStartFacts"] = (...args) =>
    loadStartFacts(this.unitOfWork, ...args);
  createOrderIntent: NegotiationRepository["createOrderIntent"] = (...args) =>
    createOrderIntent(this.unitOfWork, ...args);
  create: NegotiationRepository["create"] = (...args) =>
    createNegotiation(this.unitOfWork, ...args);
  loadRun: NegotiationRepository["loadRun"] = (...args) =>
    loadRun(this.unitOfWork, ...args);
  listTurns: NegotiationRepository["listTurns"] = (...args) =>
    listTurns(this.unitOfWork, ...args);
  appendTurn: NegotiationRepository["appendTurn"] = (...args) =>
    appendTurn(this.unitOfWork, ...args);
  applyCapacityEvent: NegotiationRepository["applyCapacityEvent"] = (...args) =>
    applyCapacityEvent(this.unitOfWork, ...args);
  transition: NegotiationRepository["transition"] = (...args) =>
    transition(this.unitOfWork, ...args);
  loadDecisionInputs: NegotiationRepository["loadDecisionInputs"] = (...args) =>
    loadDecisionInputs(this.unitOfWork, ...args);
  saveRecommendation: NegotiationRepository["saveRecommendation"] = (...args) =>
    saveRecommendation(this.unitOfWork, ...args);
}
