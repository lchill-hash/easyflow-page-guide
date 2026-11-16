import { MSG, isMicPermissionResult } from "../shared/messages";
import type { PageChangedNotification, WatchTickNotification } from "../shared/messages";
import { primeInjection, resetInjected } from "./injector";
import { routeSidePanelMessage } from "./router";

function disableBrowserAutoOpen(): void {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(() => undefined);
}

disableBrowserAutoOpen();

chrome.runtime.onInstalled.addListener(() => {
  disableBrowserAutoOpen();
});

chrome.action.onClicked.addListener((tab) => {
  if (typeof tab.id !== "number") {
    return;
  }
  const tabId = tab.id;
  chrome.sidePanel.open({ tabId }).catch((error: unknown) => {
    console.warn("[EF]", {
      phase: "side-panel-open-failed",
      tabId,
      detail: String(error),
    });
  });
  primeInjection(tabId);
});

function isWatchTick(value: unknown): value is {
  type: typeof MSG.WATCH_TICK;
  v: 1;
  changeCount: number;
  lastChangeAt: number;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.type === MSG.WATCH_TICK &&
    record.v === 1 &&
    typeof record.changeCount === "number" &&
    typeof record.lastChangeAt === "number"
  );
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isMicPermissionResult(message)) {
    return false;
  }
  if (isWatchTick(message) && typeof sender.tab?.id === "number") {
    const notification: WatchTickNotification = {
      type: MSG.WATCH_TICK,
      v: 1,
      tabId: sender.tab.id,
      changeCount: message.changeCount,
      lastChangeAt: message.lastChangeAt,
    };
    void chrome.runtime.sendMessage(notification).catch(() => undefined);
    return false;
  }
  const handled = routeSidePanelMessage(message, (response) => {
    sendResponse(response);
  });
  return handled;
});

function broadcastPageChanged(tabId: number, kind: PageChangedNotification["kind"]): void {
  const notification: PageChangedNotification = {
    type: MSG.PAGE_CHANGED,
    v: 1,
    tabId,
    kind,
  };
  void chrome.runtime.sendMessage(notification).catch(() => undefined);
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  broadcastPageChanged(activeInfo.tabId, "activated");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete") {
    return;
  }
  resetInjected(tabId);
  broadcastPageChanged(tabId, "navigated");
});