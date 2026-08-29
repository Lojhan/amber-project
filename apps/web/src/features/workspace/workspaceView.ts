import type { WorkspaceState } from "./types";

export const reviewableMatches = (state: WorkspaceState) =>
  state.quotation?.matches.filter(
    (match) =>
      match.scenarioId === state.selectedScenarioId &&
      match.matchReady &&
      match.status === "PENDING",
  ) ?? [];

export const matchingPending = (state: WorkspaceState): boolean =>
  state.quotation?.matches.some(
    (match) =>
      match.scenarioId === state.selectedScenarioId && !match.matchReady,
  ) ?? false;

export const includedMatches = (state: WorkspaceState) =>
  state.quotation?.matches.filter(
    (match) =>
      match.scenarioId === state.selectedScenarioId &&
      match.matchReady &&
      match.status === "RESOLVED",
  ) ?? [];

export const recoverableExcludedMatches = (state: WorkspaceState) =>
  state.quotation?.matches.filter(
    (match) =>
      match.scenarioId === state.selectedScenarioId &&
      match.matchReady &&
      match.status === "EXCLUDED" &&
      match.candidates.length > 0 &&
      !match.reviewReasons.some(
        (reason) =>
          reason === "missing_unit_price" ||
          reason === "ambiguous_commercial_fields",
      ),
  ) ?? [];

export const commercialReviewLines = (state: WorkspaceState) =>
  state.quotation?.matches.filter(
    (match) =>
      match.scenarioId === state.selectedScenarioId &&
      match.matchReady &&
      match.status !== "EXCLUDED" &&
      match.reviewReasons.length > 0,
  ) ?? [];

export const policyConfirmed = (state: WorkspaceState): boolean =>
  Boolean(
    state.policyPreview &&
      state.confirmedPolicyHash === state.policyPreview.policyHash,
  );

export const statusLabel = (status: string | undefined): string =>
  status ? status.toLowerCase().replaceAll("_", " ") : "not started";
