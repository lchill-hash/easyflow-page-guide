import type { EfError } from "./errors";
import { MIC_PERMISSION_MESSAGE_VERSION } from "./speech/constants";
import { MIC_REQUEST_OUTCOMES } from "./speech/permission";
import type { MicRequestOutcome } from "./speech/permission";

import type {
  CollectDiagnostics,
  ElementRef,
  HighlightResult,
  PageSnapshot,
} from "./types";

export const MSG = {
  GET_CONTEXT: "EF_GET_CONTEXT",
  COLLECT: "EF_COLLECT",
  HIGHLIGHT: "EF_HIGHLIGHT",
  HIGHLIGHT_CLEAR: "EF_HIGHLIGHT_CLEAR",
  SAVE_GOAL: "EF_SAVE_GOAL",
  LOAD_GOAL: "EF_LOAD_GOAL",
  PAGE_CHANGED: "EF_PAGE_CHANGED",
  WATCH_START: "EF_WATCH_START",
  WATCH_STOP: "EF_WATCH_STOP",
  WATCH_TICK: "EF_WATCH_TICK",
  CONTENT_COLLECT: "EF_CONTENT_COLLECT",
  CONTENT_HIGHLIGHT: "EF_CONTENT_HIGHLIGHT",
  CONTENT_HIGHLIGHT_CLEAR: "EF_CONTENT_HIGHLIGHT_CLEAR",
  CONTENT_PING: "EF_CONTENT_PING",
  CONTENT_WATCH: "EF_CONTENT_WATCH",
  CONTENT_UNWATCH: "EF_CONTENT_UNWATCH",
  MIC_PERMISSION_RESULT: "EF_MIC_PERMISSION_RESULT",
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];

export const MIC_RESULT_KINDS: readonly MicRequestOutcome[] = MIC_REQUEST_OUTCOMES;

export interface MicPermissionResultNotification {
  type: typeof MSG.MIC_PERMISSION_RESULT;
  v: 1;
  result: MicRequestOutcome;
  at: number;
}

export function createMicPermissionResult(
  result: MicRequestOutcome,
  at: number,
): MicPermissionResultNotification {
  return {
    type: MSG.MIC_PERMISSION_RESULT,
    v: MIC_PERMISSION_MESSAGE_VERSION,
    result,
    at,
  };
}

export function isMicPermissionResult(
  value: unknown,
): value is MicPermissionResultNotification {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.type !== MSG.MIC_PERMISSION_RESULT || record.v !== MIC_PERMISSION_MESSAGE_VERSION) {
    return false;
  }
  if (!MIC_RESULT_KINDS.some((kind) => kind === record.result)) {
    return false;
  }
  return typeof record.at === "number" && Number.isFinite(record.at) && record.at > 0;
}

interface BaseRequest {
  v: 1;
  requestId: string;
}

export interface GetContextRequest extends BaseRequest {
  type: typeof MSG.GET_CONTEXT;
  windowId?: number;
}

export interface CollectRequest extends BaseRequest {
  type: typeof MSG.COLLECT;
  tabId: number;
  reason: "initial" | "refresh" | "recheck";
}

export interface HighlightRequest extends BaseRequest {
  type: typeof MSG.HIGHLIGHT;
  tabId: number;
  ref: ElementRef;
  refs?: ElementRef[];
  mode?: "normal" | "care";
  sticky?: boolean;
}

export interface HighlightClearRequest extends BaseRequest {
  type: typeof MSG.HIGHLIGHT_CLEAR;
  tabId: number;
}

export interface SaveGoalRequest extends BaseRequest {
  type: typeof MSG.SAVE_GOAL;
  goal: string;
}

export interface LoadGoalRequest extends BaseRequest {
  type: typeof MSG.LOAD_GOAL;
}

export interface WatchStartRequest extends BaseRequest {
  type: typeof MSG.WATCH_START;
  tabId: number;
}

export interface WatchStopRequest extends BaseRequest {
  type: typeof MSG.WATCH_STOP;
  tabId: number;
}

export type SidePanelRequest =
  | GetContextRequest
  | CollectRequest
  | HighlightRequest
  | HighlightClearRequest
  | SaveGoalRequest
  | LoadGoalRequest
  | WatchStartRequest
  | WatchStopRequest;

export interface ContentCollectRequest extends BaseRequest {
  type: typeof MSG.CONTENT_COLLECT;
  snapshotId: string;
  runId: string;
  maxItems: number;
  maxTextLength: number;
}

export interface ContentHighlightRequest extends BaseRequest {
  type: typeof MSG.CONTENT_HIGHLIGHT;
  ref: ElementRef;
  refs?: ElementRef[];
  mode?: "normal" | "care";
  sticky?: boolean;
}

export interface ContentHighlightClearRequest extends BaseRequest {
  type: typeof MSG.CONTENT_HIGHLIGHT_CLEAR;
}

export interface ContentPingRequest extends BaseRequest {
  type: typeof MSG.CONTENT_PING;
}

export interface ContentWatchRequest extends BaseRequest {
  type: typeof MSG.CONTENT_WATCH;
}

export interface ContentUnwatchRequest extends BaseRequest {
  type: typeof MSG.CONTENT_UNWATCH;
}

export type ContentRequest =
  | ContentCollectRequest
  | ContentHighlightRequest
  | ContentHighlightClearRequest
  | ContentPingRequest
  | ContentWatchRequest
  | ContentUnwatchRequest;

export interface PageChangedNotification {
  type: typeof MSG.PAGE_CHANGED;
  v: 1;
  tabId: number;
  windowId: number;
  kind: "activated" | "navigated" | "reloaded" | "loading" | "authorized";
}

export interface WatchTickNotification {
  type: typeof MSG.WATCH_TICK;
  v: 1;
  tabId: number;
  changeCount: number;
  lastChangeAt: number;
}

export interface GetContextData {
  tabId: number;
  windowId: number;
}

export interface CollectData {
  snapshot: PageSnapshot;
  diagnostics: CollectDiagnostics;
}

export interface SaveGoalData {
  saved: boolean;
}

export interface LoadGoalData {
  goal: string | null;
}

export interface PingData {
  ready: true;
  contentVersion: string;
}

export interface WatchData {
  started?: true;
  stopped: boolean;
  changeCount: number;
  lastChangeAt: number;
  watchedMs: number;
}

export type HighlightData = HighlightResult;

export interface HighlightClearData {
  cleared: boolean;
}

export interface EfOk<T> {
  ok: true;
  requestId: string;
  data: T;
}

export interface EfFail {
  ok: false;
  requestId: string;
  error: EfError;
}

export type EfResponse<T> = EfOk<T> | EfFail;

export function ok<T>(requestId: string, data: T): EfResponse<T> {
  return { ok: true, requestId, data };
}

export function fail<T>(requestId: string, error: EfError): EfResponse<T> {
  return { ok: false, requestId, error };
}

export function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export function shouldAppendSystemNotice(
  messages: ReadonlyArray<{ role: string; kind: string; text: string }>,
  text: string,
): boolean {
  const last = messages[messages.length - 1];
  return !(last?.role === "system" && last.text === text);
}
