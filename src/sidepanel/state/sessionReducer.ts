import type { EfError, EfErrorCode } from "../../shared/errors";
import type {
  AnalysisRun,
  CollectDiagnostics,
  PageSnapshot,
} from "../../shared/types";
import type { RunLogEntry, SessionState } from "./initialState";

export type SessionAction =
  | { type: "resolve-start" }
  | { type: "context-ok"; tabId: number }
  | { type: "context-fail"; error: EfError }
  | { type: "collect-start" }
  | {
      type: "collect-ok";
      snapshot: PageSnapshot;
      diagnostics: CollectDiagnostics;
    }
  | { type: "collect-fail"; error: EfError }
  | { type: "analyze-start" }
  | { type: "analyze-result"; run: AnalysisRun; message: string | null }
  | { type: "invalid-goal"; error: EfError }
  | { type: "highlight-start"; elementId: string }
  | { type: "highlight-result"; message: string }
  | { type: "page-dirty" }
  | { type: "set-goal"; goal: string }
  | { type: "save-failed" }
  | { type: "clear-notice" };

function statusForError(code: EfErrorCode): SessionState["status"] {
  switch (code) {
    case "EF-E006":
      return "timeout";
    case "EF-E001":
    case "EF-E002":
    case "EF-E003":
    case "EF-E004":
      return "unsupported";
    default:
      return "inject-failed";
  }
}

function appendLog(state: SessionState, entry: RunLogEntry): RunLogEntry[] {
  return [entry, ...state.runLog.filter((item) => item.runId !== entry.runId)].slice(0, 5);
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "resolve-start":
      return { ...state, status: "resolving", error: null, notice: null };
    case "context-ok":
      return { ...state, tabId: action.tabId, status: "collecting", error: null };
    case "context-fail":
      return {
        ...state,
        status: statusForError(action.error.code),
        tabId: null,
        snapshot: null,
        collectDiagnostics: null,
        cards: [],
        error: action.error,
        notice: null,
        locatingId: null,
      };
    case "collect-start":
      return {
        ...state,
        status: "collecting",
        snapshot: null,
        collectDiagnostics: null,
        cards: [],
        error: null,
        notice: null,
        locatingId: null,
      };
    case "collect-ok":
      return {
        ...state,
        status: "ready",
        snapshot: action.snapshot,
        collectDiagnostics: action.diagnostics,
        cards: [],
        error: null,
        notice: null,
      };
    case "collect-fail":
      return {
        ...state,
        status: statusForError(action.error.code),
        snapshot: null,
        collectDiagnostics: null,
        cards: [],
        error: action.error,
        notice: null,
        locatingId: null,
      };
    case "analyze-start":
      return { ...state, status: "analyzing", error: null, notice: null, locatingId: null };
    case "analyze-result": {
      const status =
        action.run.status === "success"
          ? "ready"
          : action.run.status === "partial"
            ? "partial"
            : action.run.status === "no-evidence"
              ? "no-evidence"
              : "ready";
      const entry: RunLogEntry = {
        runId: action.run.runId,
        collectMs: state.collectDiagnostics?.collectMs ?? 0,
        matchMs: action.run.diagnostics.matchMs,
        items: state.snapshot?.itemCount ?? 0,
        truncated: state.snapshot?.truncated ?? false,
        contentVersion: state.collectDiagnostics?.contentVersion ?? "",
        matchedCards: action.run.cards.length,
      };
      return {
        ...state,
        status,
        cards: action.run.cards,
        error: null,
        notice: action.message,
        runLog: appendLog(state, entry),
      };
    }
    case "invalid-goal":
      return {
        ...state,
        status: "invalid-goal",
        error: action.error,
        notice: null,
        focusSignal: state.focusSignal + 1,
      };
    case "highlight-start":
      return {
        ...state,
        locatingId: action.elementId,
        error: null,
        notice: null,
      };
    case "highlight-result":
      return {
        ...state,
        locatingId: null,
        notice: action.message,
        error: null,
      };
    case "page-dirty":
      return {
        ...state,
        status: "dirty",
        snapshot: null,
        collectDiagnostics: null,
        cards: [],
        error: null,
        notice: "页面已切换或刷新，请重新读取页面",
        locatingId: null,
      };
    case "set-goal":
      return { ...state, goal: action.goal };
    case "save-failed":
      return { ...state, notice: "目标记忆已停用（不影响分析）" };
    case "clear-notice":
      return { ...state, notice: null };
    default:
      return state;
  }
}