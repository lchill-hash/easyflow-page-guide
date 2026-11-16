import { useCallback, useEffect, useReducer, useRef } from "react";
import { MAX_GOAL_LENGTH } from "../../shared/constants";
import { createEfError, toEfError } from "../../shared/errors";
import { MSG, createRequestId, fail } from "../../shared/messages";
import type {
  CollectData,
  EfResponse,
  GetContextData,
  HighlightData,
  LoadGoalData,
  SaveGoalData,
  SidePanelRequest,
} from "../../shared/messages";
import type {
  AnalysisRun,
  ElementRef,
  PageSnapshot,
} from "../../shared/types";
import { ruleMatcher } from "../match/ruleMatcher";
import { createInitialState } from "../state/initialState";
import { sessionReducer } from "../state/sessionReducer";

async function callBackground<T>(request: SidePanelRequest): Promise<EfResponse<T>> {
  try {
    const response = (await chrome.runtime.sendMessage(request)) as EfResponse<T> | undefined;
    if (response === undefined) {
      return fail(request.requestId, createEfError("EF-E007", "后台无响应"));
    }
    return response;
  } catch (error) {
    return fail(request.requestId, toEfError(error));
  }
}

function isPageChangedNotification(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.type === MSG.PAGE_CHANGED && typeof record.tabId === "number";
}

export function usePageSession() {
  const [state, dispatch] = useReducer(sessionReducer, undefined, createInitialState);
  const sequence = useRef(0);

  const loadPage = useCallback(async (reason: "initial" | "refresh"): Promise<void> => {
    const token = sequence.current + 1;
    sequence.current = token;
    dispatch({ type: "resolve-start" });

    const context = await callBackground<GetContextData>({
      type: MSG.GET_CONTEXT,
      v: 1,
      requestId: createRequestId(),
    });
    if (token !== sequence.current) {
      return;
    }
    if (!context.ok) {
      dispatch({ type: "context-fail", error: context.error });
      return;
    }
    dispatch({ type: "context-ok", tabId: context.data.tabId });

    const collect = await callBackground<CollectData>({
      type: MSG.COLLECT,
      v: 1,
      requestId: createRequestId(),
      tabId: context.data.tabId,
      reason,
    });
    if (token !== sequence.current) {
      return;
    }
    if (!collect.ok) {
      dispatch({ type: "collect-fail", error: collect.error });
      return;
    }
    dispatch({
      type: "collect-ok",
      snapshot: collect.data.snapshot,
      diagnostics: collect.data.diagnostics,
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const stored = await callBackground<LoadGoalData>({
        type: MSG.LOAD_GOAL,
        v: 1,
        requestId: createRequestId(),
      });
      if (!disposed && stored.ok && stored.data.goal !== null) {
        dispatch({ type: "set-goal", goal: stored.data.goal });
      }
      if (!disposed) {
        await loadPage("initial");
      }
    })();
    return () => {
      disposed = true;
      sequence.current += 1;
    };
  }, [loadPage]);

  useEffect(() => {
    const listener = (message: unknown): void => {
      if (isPageChangedNotification(message)) {
        dispatch({ type: "page-dirty" });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    const goal = state.goal.trim();
    if (goal.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      void callBackground<SaveGoalData>({
        type: MSG.SAVE_GOAL,
        v: 1,
        requestId: createRequestId(),
        goal: goal.slice(0, MAX_GOAL_LENGTH),
      }).then((response) => {
        if (response.ok && !response.data.saved) {
          dispatch({ type: "save-failed" });
        }
      });
    }, 500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state.goal]);

  const refresh = useCallback(async (): Promise<void> => {
    await loadPage("refresh");
  }, [loadPage]);

  const setGoal = useCallback((goal: string): void => {
    dispatch({ type: "set-goal", goal });
  }, []);

  const analyze = useCallback((): void => {
    const snapshot: PageSnapshot | null = state.snapshot;
    if (snapshot === null) {
      dispatch({ type: "invalid-goal", error: createEfError("EF-E007", "请先重新读取页面") });
      return;
    }

    const startedAt = performance.now();
    dispatch({ type: "analyze-start" });
    const result = ruleMatcher.match(state.goal, snapshot);

    if (result.status === "invalid-goal") {
      const base = createEfError("EF-E010");
      dispatch({
        type: "invalid-goal",
        error: { ...base, message: result.message ?? base.message },
      });
      return;
    }

    const finishedAt = Date.now();
    const run: AnalysisRun = {
      runId: `run-${finishedAt}-${Math.random().toString(36).slice(2, 8)}`,
      snapshotId: snapshot.snapshotId,
      mode: "rule-demo",
      status: result.status,
      goal: state.goal.trim(),
      cards: result.cards,
      startedAt,
      finishedAt,
      diagnostics: result.diagnostics,
    };
    dispatch({ type: "analyze-result", run, message: result.message ?? null });
  }, [state.goal, state.snapshot]);

  const highlight = useCallback(
    async (ref: ElementRef): Promise<void> => {
      const tabId = state.tabId;
      if (tabId === null) {
        dispatch({ type: "highlight-result", message: "请先重新读取页面" });
        return;
      }
      dispatch({ type: "highlight-start", elementId: ref.elementId });
      const response = await callBackground<HighlightData>({
        type: MSG.HIGHLIGHT,
        v: 1,
        requestId: createRequestId(),
        tabId,
        ref,
      });
      if (!response.ok) {
        dispatch({ type: "highlight-result", message: response.error.message });
        return;
      }
      const status = response.data.status;
      const message =
        status === "highlighted"
          ? "已在页面中定位并临时高亮"
          : status === "folded"
            ? "目标内容被折叠，请展开后重试"
            : "该依据已不在页面中，请重新读取页面";
      dispatch({ type: "highlight-result", message });
    },
    [state.tabId],
  );

  const clearNotice = useCallback((): void => {
    dispatch({ type: "clear-notice" });
  }, []);

  return {
    state,
    refresh,
    setGoal,
    analyze,
    highlight,
    clearNotice,
  };
}