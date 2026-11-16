import type { EfError } from "../../shared/errors";
import type {
  CollectDiagnostics,
  GuidanceCard,
  PageSnapshot,
} from "../../shared/types";

export type SessionStatus =
  | "idle"
  | "resolving"
  | "collecting"
  | "ready"
  | "analyzing"
  | "partial"
  | "no-evidence"
  | "invalid-goal"
  | "dirty"
  | "unsupported"
  | "inject-failed"
  | "timeout"
  | "stale-ref";

export interface RunLogEntry {
  runId: string;
  collectMs: number;
  matchMs: number;
  items: number;
  truncated: boolean;
  contentVersion: string;
  matchedCards: number;
}

export interface SessionState {
  status: SessionStatus;
  tabId: number | null;
  snapshot: PageSnapshot | null;
  collectDiagnostics: CollectDiagnostics | null;
  cards: GuidanceCard[];
  error: EfError | null;
  notice: string | null;
  goal: string;
  locatingId: string | null;
  focusSignal: number;
  runLog: RunLogEntry[];
}

export function createInitialState(): SessionState {
  return {
    status: "idle",
    tabId: null,
    snapshot: null,
    collectDiagnostics: null,
    cards: [],
    error: null,
    notice: null,
    goal: "",
    locatingId: null,
    focusSignal: 0,
    runLog: [],
  };
}