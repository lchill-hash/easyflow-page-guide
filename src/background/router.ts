import {
  COLLECT_TIMEOUT_MS,
  ELEMENT_ID_PATTERN,
  GOAL_STORAGE_KEY,
  LOCATE_TIMEOUT_MS,
  MAX_GOAL_LENGTH,
  MAX_ITEMS,
  MAX_TEXT_LENGTH,
} from "../shared/constants";
import { createEfError, isEfError, toEfError } from "../shared/errors";
import type { EfError, EfResult } from "../shared/errors";
import { MSG, createRequestId, fail, ok } from "../shared/messages";
import type {
  CollectData,
  CollectRequest,
  ContentRequest,
  EfResponse,
  GetContextData,
  HighlightData,
  HighlightRequest,
  LoadGoalData,
  LoadGoalRequest,
  SaveGoalData,
  SaveGoalRequest,
  SidePanelRequest,
  WatchData,
  WatchStartRequest,
  WatchStopRequest,
} from "../shared/messages";
import { ensureInjected, getLastInjectionError } from "./injector";
import { getActiveTab } from "./tabContext";

let memoryGoal: string | null = null;

const collectLocks = new Map<number, Promise<EfResult<CollectData>>>();

function withInjectionDetail(tabId: number, error: EfError): EfError {
  if (error.detail !== undefined) {
    return error;
  }
  const last = getLastInjectionError(tabId);
  if (last === undefined) {
    return error;
  }
  return {
    ...error,
    detail: last.detail ?? last.message,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isElementRef(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.elementId === "string" &&
    typeof value.domPath === "string" &&
    typeof value.textHash === "string"
  );
}

function isSidePanelRequest(value: unknown): value is SidePanelRequest {
  if (!isRecord(value) || value.v !== 1 || typeof value.requestId !== "string" || typeof value.type !== "string") {
    return false;
  }
  switch (value.type) {
    case MSG.GET_CONTEXT:
    case MSG.LOAD_GOAL:
      return true;
    case MSG.COLLECT:
      return isPositiveInteger(value.tabId) && (value.reason === "initial" || value.reason === "refresh" || value.reason === "recheck");
    case MSG.HIGHLIGHT:
      return isPositiveInteger(value.tabId) && isElementRef(value.ref);
    case MSG.SAVE_GOAL:
      return typeof value.goal === "string";
    case MSG.WATCH_START:
    case MSG.WATCH_STOP:
      return isPositiveInteger(value.tabId);
    default:
      return false;
  }
}

function isEfResponse(value: unknown): value is EfResponse<unknown> {
  if (!isRecord(value)) {
    return false;
  }
  if (value.ok === true) {
    return "data" in value;
  }
  if (value.ok === false) {
    return isEfError(value.error);
  }
  return false;
}

function sendToContent<T>(
  tabId: number,
  message: ContentRequest,
  timeoutMs: number,
  timeoutCode: "EF-E006" | "EF-E008",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(createEfError(timeoutCode));
      }
    }, timeoutMs);

    chrome.tabs.sendMessage(tabId, message, (response: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(createEfError("EF-E007", chrome.runtime.lastError.message ?? "消息通道中断"));
        return;
      }
      if (!isEfResponse(response)) {
        reject(createEfError("EF-E007", "内容脚本响应格式异常"));
        return;
      }
      if (!response.ok) {
        reject(response.error);
        return;
      }
      resolve(response.data as T);
    });
  });
}

async function runCollect(tabId: number): Promise<EfResult<CollectData>> {
  const injected = await ensureInjected(tabId);
  if (!injected.ok) {
    return { ok: false, error: injected.error };
  }
  const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const data = await sendToContent<CollectData>(
      tabId,
      {
        type: MSG.CONTENT_COLLECT,
        v: 1,
        requestId: createRequestId(),
        snapshotId,
        runId,
        maxItems: MAX_ITEMS,
        maxTextLength: MAX_TEXT_LENGTH,
      },
      COLLECT_TIMEOUT_MS,
      "EF-E006",
    );
    return { ok: true, data };
  } catch (error) {
    if (isEfError(error)) {
      return { ok: false, error };
    }
    return { ok: false, error: toEfError(error) };
  }
}

async function handleCollect(request: CollectRequest): Promise<EfResponse<CollectData>> {
  if (!isPositiveInteger(request.tabId)) {
    return fail(request.requestId, createEfError("EF-E002", "标签页参数非法"));
  }

  const existing = collectLocks.get(request.tabId);
  if (existing !== undefined) {
    const shared = await existing;
    if (shared.ok) {
      return ok(request.requestId, shared.data);
    }
    return fail(request.requestId, withInjectionDetail(request.tabId, shared.error));
  }

  const task = runCollect(request.tabId);
  collectLocks.set(request.tabId, task);
  try {
    const result = await task;
    if (result.ok) {
      return ok(request.requestId, result.data);
    }
    return fail(request.requestId, withInjectionDetail(request.tabId, result.error));
  } finally {
    collectLocks.delete(request.tabId);
  }
}

async function handleHighlight(request: HighlightRequest): Promise<EfResponse<HighlightData>> {
  if (!isPositiveInteger(request.tabId)) {
    return fail(request.requestId, createEfError("EF-E002", "标签页参数非法"));
  }
  if (!ELEMENT_ID_PATTERN.test(request.ref.elementId)) {
    return fail(request.requestId, createEfError("EF-E010", "元素 ID 格式非法"));
  }

  const injected = await ensureInjected(request.tabId);
  if (!injected.ok) {
    return fail(request.requestId, withInjectionDetail(request.tabId, injected.error));
  }

  try {
    const data = await sendToContent<HighlightData>(
      request.tabId,
      {
        type: MSG.CONTENT_HIGHLIGHT,
        v: 1,
        requestId: createRequestId(),
        ref: {
          elementId: request.ref.elementId,
          domPath: request.ref.domPath,
          textHash: request.ref.textHash,
        },
        ...(request.mode === "normal" || request.mode === "care"
          ? { mode: request.mode }
          : {}),
      },
      LOCATE_TIMEOUT_MS,
      "EF-E008",
    );
    return ok(request.requestId, data);
  } catch (error) {
    if (isEfError(error)) {
      return fail(request.requestId, withInjectionDetail(request.tabId, error));
    }
    return fail(request.requestId, withInjectionDetail(request.tabId, toEfError(error)));
  }
}

async function handleSaveGoal(request: SaveGoalRequest): Promise<EfResponse<SaveGoalData>> {
  const goal = request.goal.trim().slice(0, MAX_GOAL_LENGTH);
  memoryGoal = goal;
  try {
    await chrome.storage.local.set({ [GOAL_STORAGE_KEY]: goal });
    return ok(request.requestId, { saved: true });
  } catch {
    return ok(request.requestId, { saved: false });
  }
}

async function handleLoadGoal(request: LoadGoalRequest): Promise<EfResponse<LoadGoalData>> {
  try {
    const record = await chrome.storage.local.get(GOAL_STORAGE_KEY);
    const value = record[GOAL_STORAGE_KEY];
    if (typeof value === "string" && value.length > 0) {
      memoryGoal = value;
      return ok(request.requestId, { goal: value });
    }
    return ok(request.requestId, { goal: memoryGoal });
  } catch {
    return ok(request.requestId, { goal: memoryGoal });
  }
}

async function handleWatchStart(request: WatchStartRequest): Promise<EfResponse<WatchData>> {
  if (!isPositiveInteger(request.tabId)) {
    return fail(request.requestId, createEfError("EF-E002", "标签页参数非法"));
  }
  const injected = await ensureInjected(request.tabId);
  if (!injected.ok) {
    return fail(request.requestId, withInjectionDetail(request.tabId, injected.error));
  }
  try {
    await sendToContent<{ started: true }>(
      request.tabId,
      {
        type: MSG.CONTENT_WATCH,
        v: 1,
        requestId: createRequestId(),
      },
      LOCATE_TIMEOUT_MS,
      "EF-E006",
    );
    return ok(request.requestId, {
      started: true,
      stopped: false,
      changeCount: 0,
      lastChangeAt: 0,
      watchedMs: 0,
    });
  } catch (error) {
    if (isEfError(error)) {
      return fail(request.requestId, withInjectionDetail(request.tabId, error));
    }
    return fail(request.requestId, withInjectionDetail(request.tabId, toEfError(error)));
  }
}

async function handleWatchStop(request: WatchStopRequest): Promise<EfResponse<WatchData>> {
  if (!isPositiveInteger(request.tabId)) {
    return fail(request.requestId, createEfError("EF-E002", "标签页参数非法"));
  }
  try {
    const data = await sendToContent<WatchData>(
      request.tabId,
      {
        type: MSG.CONTENT_UNWATCH,
        v: 1,
        requestId: createRequestId(),
      },
      LOCATE_TIMEOUT_MS,
      "EF-E006",
    );
    return ok(request.requestId, data);
  } catch (error) {
    if (isEfError(error)) {
      return fail(request.requestId, error);
    }
    return fail(request.requestId, toEfError(error));
  }
}

async function dispatch(request: SidePanelRequest): Promise<EfResponse<unknown>> {
  switch (request.type) {
    case MSG.GET_CONTEXT: {
      const context = await getActiveTab();
      if (!context.ok) {
        return fail(request.requestId, context.error);
      }
      const data: GetContextData = { tabId: context.tabId, windowId: context.windowId };
      return ok(request.requestId, data);
    }
    case MSG.COLLECT:
      return handleCollect(request);
    case MSG.HIGHLIGHT:
      return handleHighlight(request);
    case MSG.SAVE_GOAL:
      return handleSaveGoal(request);
    case MSG.LOAD_GOAL:
      return handleLoadGoal(request);
    case MSG.WATCH_START:
      return handleWatchStart(request);
    case MSG.WATCH_STOP:
      return handleWatchStop(request);
    default:
      return fail("unknown", createEfError("EF-E005", "未知的消息类型"));
  }
}

export function routeSidePanelMessage(
  rawMessage: unknown,
  sendResponse: (response: EfResponse<unknown>) => void,
): boolean {
  if (!isSidePanelRequest(rawMessage)) {
    return false;
  }
  const request = rawMessage;
  void dispatch(request)
    .then((response) => {
      sendResponse(response);
    })
    .catch((error: unknown) => {
      sendResponse(fail(request.requestId, toEfError(error)));
    });
  return true;
}