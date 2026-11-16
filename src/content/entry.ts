import { CONTENT_VERSION } from "../shared/constants";
import { createEfError, toEfError } from "../shared/errors";
import { MSG, fail, ok } from "../shared/messages";
import type { ContentRequest, EfResponse } from "../shared/messages";
import { collectPage } from "./collect";
import { cleanupHighlight, highlightRef } from "./highlight";
import { startWatching, stopWatching } from "./observe";

type ContentListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => void;

interface ContentBridge {
  version: string;
  listener: ContentListener;
}

declare global {
  interface Window {
    __EASYFLOW_CONTENT__?: ContentBridge;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isContentRequest(value: unknown): value is ContentRequest {
  if (!isRecord(value) || value.v !== 1 || typeof value.requestId !== "string" || typeof value.type !== "string") {
    return false;
  }
  switch (value.type) {
    case MSG.CONTENT_PING:
      return true;
    case MSG.CONTENT_WATCH:
    case MSG.CONTENT_UNWATCH:
      return true;
    case MSG.CONTENT_COLLECT:
      return (
        typeof value.snapshotId === "string" &&
        typeof value.runId === "string" &&
        typeof value.maxItems === "number" &&
        typeof value.maxTextLength === "number"
      );
    case MSG.CONTENT_HIGHLIGHT: {
      const ref = value.ref;
      return (
        isRecord(ref) &&
        typeof ref.elementId === "string" &&
        typeof ref.domPath === "string" &&
        typeof ref.textHash === "string"
      );
    }
    default:
      return false;
  }
}

function handle(request: ContentRequest): EfResponse<unknown> {
  switch (request.type) {
    case MSG.CONTENT_PING:
      return ok(request.requestId, { ready: true, contentVersion: CONTENT_VERSION });
    case MSG.CONTENT_WATCH:
      return ok(request.requestId, startWatching());
    case MSG.CONTENT_UNWATCH:
      return ok(request.requestId, stopWatching());
    case MSG.CONTENT_COLLECT: {
      cleanupHighlight();
      const result = collectPage(
        request.snapshotId,
        request.runId,
        request.maxItems,
        request.maxTextLength,
      );
      return ok(request.requestId, result);
    }
    case MSG.CONTENT_HIGHLIGHT: {
      const result = highlightRef(request.ref, request.mode);
      return ok(request.requestId, result);
    }
    default:
      return fail("unknown", createEfError("EF-E005", "未知的消息类型"));
  }
}

const listener: ContentListener = (message, _sender, sendResponse) => {
  if (!isContentRequest(message)) {
    return;
  }
  const request = message;
  try {
    sendResponse(handle(request));
  } catch (error) {
    sendResponse(fail(request.requestId, toEfError(error)));
  }
};

const existing = window.__EASYFLOW_CONTENT__;
if (existing === undefined || existing.version !== CONTENT_VERSION) {
  if (existing !== undefined) {
    chrome.runtime.onMessage.removeListener(existing.listener);
  }
  chrome.runtime.onMessage.addListener(listener);
  window.__EASYFLOW_CONTENT__ = { version: CONTENT_VERSION, listener };
}