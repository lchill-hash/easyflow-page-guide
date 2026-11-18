import { CONTENT_VERSION, PING_TIMEOUT_MS } from "../shared/constants";
import { createEfError, toEfError } from "../shared/errors";
import type { EfError, EfResult } from "../shared/errors";
import { MSG, createRequestId } from "../shared/messages";
import type { EfOk, PingData } from "../shared/messages";

const injectionLocks = new Map<number, Promise<EfResult<{ contentVersion: string }>>>();
const lastInjectionErrors = new Map<number, EfError>();
const injectionCounts = new Map<number, number>();
const seenVersions = new Map<number, string>();
const documentEpochs = new Map<number, number>();
let nextEpoch = 0;

function epochFor(tabId: number): number {
  let epoch = documentEpochs.get(tabId);
  if (epoch === undefined) {
    epoch = ++nextEpoch;
    documentEpochs.set(tabId, epoch);
  }
  return epoch;
}

function staleDocument(): EfResult<{ contentVersion: string }> {
  return { ok: false, error: createEfError("EF-E007", "页面文档已切换，等待当前页面重新读取") };
}

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

function ping(tabId: number, epoch: number): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(null);
    }, PING_TIMEOUT_MS);
    chrome.tabs.sendMessage(
      tabId,
      { type: MSG.CONTENT_PING, v: 1, requestId: createRequestId() },
      (response: unknown) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        if (!isPingResponse(response)) {
          resolve(null);
          return;
        }
        if (documentEpochs.get(tabId) !== epoch) {
          resolve(null);
          return;
        }
        seenVersions.set(tabId, response.data.contentVersion);
        resolve(response.data.contentVersion);
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

async function doEnsureInjected(tabId: number, epoch: number): Promise<EfResult<{ contentVersion: string }>> {
  const isCurrent = (): boolean => documentEpochs.get(tabId) === epoch;
  let mayReuseContent = false;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isCurrent()) return staleDocument();
    // A loading document can still answer PING from its old content script.
    // Wait for the complete event before accepting or injecting a script.
    if (tab.status === "loading") return staleDocument();
    if (tab.url !== undefined && !/^https?:\/\//i.test(tab.url)) {
      return recordInjectionError(tabId, createEfError("EF-E002", "浏览器内部页面不允许扩展读取"));
    }
    // Without tabs permission, Chrome hides this field after host access is lost.
    // A surviving content script is not evidence of a current permission grant.
    mayReuseContent = typeof tab.url === "string" && /^https?:\/\//i.test(tab.url);
  } catch (error) {
    return isCurrent() ? recordInjectionError(tabId, toEfError(error)) : staleDocument();
  }
  const existingVersion = await ping(tabId, epoch);
  if (!isCurrent()) return staleDocument();
  // Service worker memory may have been reset while the content script survived.
  if (mayReuseContent && existingVersion === CONTENT_VERSION) {
    lastInjectionErrors.delete(tabId);
    return { ok: true, data: { contentVersion: CONTENT_VERSION } };
  }

  injectionCounts.set(tabId, (injectionCounts.get(tabId) ?? 0) + 1);
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (error) {
    return isCurrent() ? recordInjectionError(tabId, toEfError(error)) : staleDocument();
  }
  if (!isCurrent()) return staleDocument();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const version = await ping(tabId, epoch);
    if (!isCurrent()) return staleDocument();
    if (version === CONTENT_VERSION) {
      lastInjectionErrors.delete(tabId);
      return { ok: true, data: { contentVersion: CONTENT_VERSION } };
    }
    await delay(150);
    if (!isCurrent()) return staleDocument();
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
  const task = doEnsureInjected(tabId, epochFor(tabId));
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

export function primeInjection(tabId: number): Promise<void> {
  return ensureInjected(tabId).then((result) => {
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

export function getInjectionDiagnostics(tabId: number): {
  pageInjectionCount: number;
  contentVersionSeen: string;
  expectedContentVersion: string;
} {
  return {
    pageInjectionCount: injectionCounts.get(tabId) ?? 0,
    contentVersionSeen: seenVersions.get(tabId) ?? "",
    expectedContentVersion: CONTENT_VERSION,
  };
}

export function resetInjected(tabId: number): void {
  documentEpochs.set(tabId, ++nextEpoch);
  injectionLocks.delete(tabId);
  lastInjectionErrors.delete(tabId);
  injectionCounts.delete(tabId);
  seenVersions.delete(tabId);
}

export function forgetTab(tabId: number): void {
  resetInjected(tabId);
  // Pending tasks compare against their old epoch and cannot repopulate maps.
  documentEpochs.delete(tabId);
}
