import { CONTENT_VERSION, PING_TIMEOUT_MS } from "../shared/constants";
import { createEfError, toEfError } from "../shared/errors";
import type { EfError, EfResult } from "../shared/errors";
import { MSG, createRequestId } from "../shared/messages";
import type { EfOk, PingData } from "../shared/messages";

const injectedTabs = new Set<number>();
const injectionLocks = new Map<number, Promise<EfResult<{ contentVersion: string }>>>();
const lastInjectionErrors = new Map<number, EfError>();

function isPingResponse(value: unknown): value is EfOk<PingData> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.ok !== true || typeof record.data !== "object" || record.data === null) {
    return false;
  }
  const data = record.data as Record<string, unknown>;
  return data.ready === true && typeof data.contentVersion === "string";
}

function ping(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(false);
    }, PING_TIMEOUT_MS);
    chrome.tabs.sendMessage(
      tabId,
      { type: MSG.CONTENT_PING, v: 1, requestId: createRequestId() },
      (response: unknown) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        if (!isPingResponse(response)) {
          resolve(false);
          return;
        }
        resolve(response.data.contentVersion === CONTENT_VERSION);
      },
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function recordInjectionError(tabId: number, error: EfError): EfResult<{ contentVersion: string }> {
  lastInjectionErrors.set(tabId, error);
  console.warn("[EF]", {
    phase: "content-injection",
    tabId,
    code: error.code,
    detail: error.detail ?? error.message,
  });
  return { ok: false, error };
}

async function doEnsureInjected(tabId: number): Promise<EfResult<{ contentVersion: string }>> {
  if (injectedTabs.has(tabId) && (await ping(tabId))) {
    lastInjectionErrors.delete(tabId);
    return { ok: true, data: { contentVersion: CONTENT_VERSION } };
  }
  injectedTabs.delete(tabId);

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (error) {
    return recordInjectionError(tabId, toEfError(error));
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await ping(tabId)) {
      injectedTabs.add(tabId);
      lastInjectionErrors.delete(tabId);
      return { ok: true, data: { contentVersion: CONTENT_VERSION } };
    }
    await delay(150);
  }

  return recordInjectionError(
    tabId,
    createEfError("EF-E005", "content.js 已注入，但未收到内容脚本 PING 响应"),
  );
}

export function ensureInjected(tabId: number): Promise<EfResult<{ contentVersion: string }>> {
  const existing = injectionLocks.get(tabId);
  if (existing !== undefined) {
    return existing;
  }
  const task = doEnsureInjected(tabId);
  injectionLocks.set(tabId, task);
  void task.then(
    () => {
      if (injectionLocks.get(tabId) === task) {
        injectionLocks.delete(tabId);
      }
    },
    () => {
      if (injectionLocks.get(tabId) === task) {
        injectionLocks.delete(tabId);
      }
    },
  );
  return task;
}

export function primeInjection(tabId: number): void {
  void ensureInjected(tabId).then((result) => {
    if (!result.ok) {
      console.warn("[EF]", {
        phase: "click-preflight",
        tabId,
        code: result.error.code,
        detail: result.error.detail ?? result.error.message,
      });
    }
  });
}

export function getLastInjectionError(tabId: number): EfError | undefined {
  return lastInjectionErrors.get(tabId);
}

export function resetInjected(tabId: number): void {
  injectedTabs.delete(tabId);
  lastInjectionErrors.delete(tabId);
}