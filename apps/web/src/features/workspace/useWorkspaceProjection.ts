import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError } from "../../lib/api/client";
import { connectEvents, type StreamEvent } from "../../lib/api/events";
import type { ProcurementApi } from "../../lib/api/workflow";
import { loadWorkspace } from "./loadWorkspace";
import type { WorkspaceState } from "./types";
import { initialWorkspaceState } from "./workspaceState";
import { matchingPending } from "./workspaceView";

export type WorkspaceProjection = {
  state: WorkspaceState;
  setState: Dispatch<SetStateAction<WorkspaceState>>;
  quotationId: RefObject<string | undefined>;
  negotiationId: RefObject<string | undefined>;
  refresh: () => Promise<boolean>;
  clear: () => void;
  fail: (error: unknown) => void;
};

const retryDelay = (signal: AbortSignal, milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

const retryProjection = async (
  refresh: () => Promise<boolean>,
  signal: AbortSignal,
): Promise<void> => {
  for (let attempt = 0; attempt < 3 && !signal.aborted; attempt += 1) {
    if (await refresh()) return;
    await retryDelay(signal, 25 * (attempt + 1));
  }
};

const useProjectionInvalidation = (
  refresh: () => Promise<boolean>,
  setState: Dispatch<SetStateAction<WorkspaceState>>,
  quotationId: RefObject<string | undefined>,
  negotiationId: RefObject<string | undefined>,
): void => {
  useEffect(() => {
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let staleTimer: ReturnType<typeof setTimeout> | undefined;
    const markStale = () =>
      setState((current) => ({ ...current, stale: true }));
    const clearTimers = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (staleTimer) clearTimeout(staleTimer);
    };
    const scheduleRefresh = () => {
      if (!quotationId.current && !negotiationId.current) return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        staleTimer = setTimeout(markStale, 400);
        void refresh().finally(() => {
          if (staleTimer) clearTimeout(staleTimer);
          setState((current) =>
            current.stale ? { ...current, stale: false } : current,
          );
        });
      }, 50);
    };
    const isRelevant = (event: StreamEvent): boolean => {
      if (!event.data || typeof event.data !== "object") return false;
      const aggregateId = Reflect.get(event.data, "aggregateId");

      return (
        aggregateId === quotationId.current ||
        aggregateId === negotiationId.current
      );
    };
    const connection = connectEvents(
      "/api/v1/events/stream",
      (event) => {
        if (isRelevant(event)) scheduleRefresh();
      },
      () => {
        if (!quotationId.current && !negotiationId.current) return;
        staleTimer = setTimeout(markStale, 400);
        void retryProjection(refresh, controller.signal).finally(() => {
          if (staleTimer) clearTimeout(staleTimer);
          setState((current) =>
            current.stale ? { ...current, stale: false } : current,
          );
        });
      },
    );

    return () => {
      controller.abort();
      clearTimers();
      connection.close();
    };
  }, [refresh, setState, quotationId, negotiationId]);
};

const useMatchingCompletionPolling = (
  pending: boolean,
  refresh: () => Promise<boolean>,
): void => {
  useEffect(() => {
    if (!pending) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await refresh();
      if (!controller.signal.aborted) timer = setTimeout(poll, 500);
    };
    timer = setTimeout(poll, 250);

    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [pending, refresh]);
};

export function useWorkspaceProjection(
  api: ProcurementApi,
  workspaceId?: string,
): WorkspaceProjection {
  const [state, setState] = useState(initialWorkspaceState);
  const quotationId = useRef<string | undefined>(workspaceId);
  const negotiationId = useRef<string | undefined>(undefined);
  const refreshSequence = useRef(0);
  const fail = useCallback((error: unknown) => {
    const problem =
      error instanceof ApiError
        ? {
            title: error.problem.title,
            detail: error.problem.detail,
            status: error.problem.status,
            code: error.problem.code,
            correlationId: error.problem.correlationId,
            ...(error.problem.fields ? { fields: error.problem.fields } : {}),
          }
        : {
            title: "Request failed",
            detail: error instanceof Error ? error.message : "A request failed",
          };
    setState((current) => ({
      ...current,
      loading: false,
      pendingAction: undefined,
      error: {
        ...problem,
        ...(current.pendingAction ? { action: current.pendingAction } : {}),
      },
    }));
  }, []);
  const refresh = useCallback(async (): Promise<boolean> => {
    const sequence = refreshSequence.current + 1;
    refreshSequence.current = sequence;
    const requestedQuotationId = quotationId.current;

    if (!requestedQuotationId) {
      try {
        const orders = await api.purchaseOrders();

        if (sequence !== refreshSequence.current) return false;
        setState({
          ...initialWorkspaceState,
          purchaseOrders: orders.items,
          loading: false,
        });
        return true;
      } catch (error) {
        fail(error);
        return false;
      }
    }

    try {
      const loaded = await loadWorkspace(
        api,
        requestedQuotationId,
        negotiationId.current,
      );

      if (sequence !== refreshSequence.current) return false;

      negotiationId.current = loaded.negotiationId;
      setState((current) => ({
        ...current,
        ...loaded.state,
        loading: false,
        pendingAction: undefined,
        stale: false,
        error: undefined,
      }));
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }, [api, fail]);
  const clear = useCallback(() => {
    refreshSequence.current += 1;
    quotationId.current = undefined;
    negotiationId.current = undefined;
    setState((current) => ({
      ...initialWorkspaceState,
      purchaseOrders: current.purchaseOrders,
      loading: false,
    }));
  }, []);

  useEffect(() => {
    if (quotationId.current !== workspaceId) {
      quotationId.current = workspaceId;
      negotiationId.current = undefined;
      setState({
        ...initialWorkspaceState,
        loading: Boolean(workspaceId),
      });
    }
    void refresh();
  }, [refresh, workspaceId]);
  useProjectionInvalidation(refresh, setState, quotationId, negotiationId);
  useMatchingCompletionPolling(matchingPending(state), refresh);

  return { state, setState, quotationId, negotiationId, refresh, clear, fail };
}
