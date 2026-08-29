import { type RefObject, useRef } from "react";
import { pollUntil } from "../../lib/api/events";
import type { ProcurementApi } from "../../lib/api/workflow";
import type { WorkspaceAction, WorkspaceState } from "./types";
import type { WorkspaceProjection } from "./useWorkspaceProjection";
import { sha256 } from "./workspaceCommands";
import { copilotCommands } from "./workspaceCopilotCommands";
import { sessionCommands } from "./workspaceSessionCommands";

const newIdempotencyKey = (): string => crypto.randomUUID();

export const issueIdempotencyKey = (
  keys: Map<string, string>,
  digest: string,
  create: () => string = newIdempotencyKey,
): string => {
  const existing = keys.get(digest);
  if (existing) return existing;

  const key = create();
  keys.set(digest, key);
  return key;
};

type CommandContext = Readonly<{
  api: ProcurementApi;
  projection: WorkspaceProjection;
  issueKeys: RefObject<Map<string, string>>;
  onWorkspaceChange?: ((workspaceId: string | undefined) => void) | undefined;
}>;

const begin = (
  projection: WorkspaceProjection,
  action: WorkspaceAction,
  patch: Partial<WorkspaceState> = {},
): void => {
  projection.setState((state) => ({
    ...state,
    ...patch,
    pendingAction: action,
    error: undefined,
  }));
};

const finish = (
  projection: WorkspaceProjection,
  patch: Partial<WorkspaceState>,
): void => {
  projection.setState((state) => ({
    ...state,
    ...patch,
    loading: false,
    pendingAction: undefined,
  }));
};

const uploadCommand =
  ({ api, projection, onWorkspaceChange }: CommandContext) =>
  async (file: File, note?: string): Promise<void> => {
    begin(projection, "upload", {
      quotation: undefined,
      selectedScenarioId: undefined,
      policyPreview: undefined,
      confirmedPolicyHash: undefined,
      negotiation: undefined,
      decision: undefined,
      preview: undefined,
      purchaseOrder: undefined,
      copilot: undefined,
      copilotError: undefined,
    });

    try {
      const contentHash = await sha256(file);
      const reservation = await api.reserve(file.name, contentHash, note);
      const response = await fetch(reservation.uploadUrl, {
        method: reservation.uploadMethod,
        headers: reservation.headers,
        body: file,
      });
      if (!response.ok)
        throw new Error("Upload to the reserved location failed");

      const quotation = await api.complete({
        objectKey: reservation.objectKey,
        contentHash,
        idempotencyKey: newIdempotencyKey(),
        ...(note ? { note } : {}),
      });
      projection.quotationId.current = quotation.id;
      onWorkspaceChange?.(quotation.id);
      finish(projection, { quotation });

      const parsed = await pollUntil(
        () => api.quotation(quotation.id),
        (item) =>
          item.scenarios.length > 0 ||
          item.status === "REJECTED" ||
          item.status === "PARSE_FAILED",
        20,
        undefined,
        100,
      );
      finish(projection, { quotation: parsed });
    } catch (error) {
      projection.fail(error);
    }
  };

const scenarioCommands = ({ api, projection }: CommandContext) => ({
  chooseScenario: async (id: string) => {
    const quotation = projection.state.quotation;
    if (!quotation) return;
    begin(projection, "scenario");

    try {
      const selected = await api.selectScenario({
        quotationId: quotation.id,
        scenarioId: id,
      });
      finish(projection, {
        quotation: selected,
        selectedScenarioId: id,
        policyPreview: undefined,
        confirmedPolicyHash: undefined,
        negotiation: undefined,
        decision: undefined,
        preview: undefined,
        purchaseOrder: undefined,
      });
    } catch (error) {
      projection.fail(error);
    }
  },
  resolveMatch: async (
    matchId: string,
    action: "accept" | "select" | "exclude",
    selectedProductId?: string,
  ) => {
    const { quotation, selectedScenarioId } = projection.state;
    if (!quotation || !selectedScenarioId) return;
    begin(projection, "match");

    try {
      const next = await api.match({
        quotationId: quotation.id,
        scenarioId: selectedScenarioId,
        matchId,
        action,
        ...(selectedProductId ? { selectedProductId } : {}),
      });
      finish(projection, {
        quotation: next,
        policyPreview: undefined,
        confirmedPolicyHash: undefined,
      });
    } catch (error) {
      projection.fail(error);
    }
  },
});

const commercialReviewCommands = ({ api, projection }: CommandContext) => ({
  resolveQuantities: async (
    lines: readonly Readonly<{
      parsedLineId: string;
      requestedQuantity: string;
    }>[],
  ) => {
    const { quotation, selectedScenarioId } = projection.state;
    if (!quotation || !selectedScenarioId) return;
    begin(projection, "commercial-review");

    try {
      const next = await api.reviewQuantities({
        quotationId: quotation.id,
        scenarioId: selectedScenarioId,
        lines: [...lines],
      });
      finish(projection, {
        quotation: next,
        policyPreview: undefined,
        confirmedPolicyHash: undefined,
      });
    } catch (error) {
      projection.fail(error);
    }
  },
});

const policyCommands = ({ api, projection }: CommandContext) => ({
  previewPolicy: async () => {
    const { quotation, selectedScenarioId } = projection.state;
    if (!quotation || !selectedScenarioId) return;
    begin(projection, "policy");

    try {
      const policyPreview = await api.negotiationPolicy(
        quotation.id,
        selectedScenarioId,
      );
      finish(projection, {
        policyPreview,
        confirmedPolicyHash: undefined,
      });
    } catch (error) {
      projection.fail(error);
    }
  },
  confirmPolicy: () => {
    const policyPreview = projection.state.policyPreview;
    if (policyPreview)
      projection.setState((state) => ({
        ...state,
        confirmedPolicyHash: policyPreview.policyHash,
      }));
  },
  startNegotiation: async () => {
    const { quotation, selectedScenarioId, policyPreview } = projection.state;
    if (!quotation || !selectedScenarioId) return;
    begin(projection, "negotiation");

    try {
      if (
        !policyPreview ||
        policyPreview.scenarioId !== selectedScenarioId ||
        projection.state.confirmedPolicyHash !== policyPreview.policyHash
      )
        throw new Error(
          "Preview and confirm the derived negotiation policy first",
        );

      const negotiation = await api.startNegotiation({
        quotationId: quotation.id,
        scenarioId: selectedScenarioId,
        policyHash: policyPreview.policyHash,
        confirmationToken: policyPreview.confirmationToken,
      });
      projection.negotiationId.current = negotiation.id;
      finish(projection, {
        negotiation,
        decision: undefined,
        preview: undefined,
        purchaseOrder: undefined,
      });
      await projection.refresh();
    } catch (error) {
      projection.fail(error);
    }
  },
});

const purchaseOrderCommands = ({
  api,
  projection,
  issueKeys,
}: CommandContext) => ({
  preview: async () => {
    const offer = projection.state.decision?.winnerOfferId;
    const negotiation = projection.state.negotiation;
    if (!offer || !negotiation) return;
    begin(projection, "preview-order");

    try {
      const preview = await api.preview({
        negotiationId: negotiation.id,
        selectedOfferId: offer,
      });
      finish(projection, { preview, purchaseOrder: undefined });
    } catch (error) {
      projection.fail(error);
    }
  },
  issue: async () => {
    const { decision, negotiation, preview } = projection.state;
    if (!decision?.winnerOfferId || !negotiation || !preview) return;
    begin(projection, "issue-order");

    try {
      const purchaseOrder = await api.issue({
        negotiationId: negotiation.id,
        selectedOfferId: decision.winnerOfferId,
        previewDigest: preview.digest,
        confirmationToken: preview.confirmationToken,
        idempotencyKey: issueIdempotencyKey(issueKeys.current, preview.digest),
      });
      finish(projection, { purchaseOrder });
      await projection.refresh();
    } catch (error) {
      projection.fail(error);
    }
  },
  viewPurchaseOrder: async (id: string) => {
    begin(projection, "purchase-order-detail");

    try {
      const purchaseOrderDetail = await api.purchaseOrder(id);
      finish(projection, { purchaseOrderDetail });
    } catch (error) {
      projection.fail(error);
    }
  },
});

export const useWorkspaceCommands = (
  api: ProcurementApi,
  projection: WorkspaceProjection,
  onWorkspaceChange?: (workspaceId: string | undefined) => void,
) => {
  const issueKeys = useRef(new Map<string, string>());
  const context = { api, projection, issueKeys, onWorkspaceChange };

  return {
    ...sessionCommands(context),
    upload: uploadCommand(context),
    ...scenarioCommands(context),
    ...commercialReviewCommands(context),
    ...policyCommands(context),
    ...purchaseOrderCommands(context),
    ...copilotCommands(api, projection),
  };
};
