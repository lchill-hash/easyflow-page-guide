import { MSG, isMicPermissionResult } from "../shared/messages";
import type { PageChangedNotification, WatchTickNotification } from "../shared/messages";
import { forgetTab, primeInjection, resetInjected } from "./injector";
import { resetTabRequests, routeSidePanelMessage } from "./router";

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
  void primeInjection(tabId).then(async () => {
    // Clicking the action grants activeTab even when the sidebar is already open.
    // Tell that existing sidebar to retry after injection, without another click.
    try {
      const current = await chrome.tabs.get(tabId);
      if (current.active && current.windowId === tab.windowId) {
        broadcastPageChanged(tabId, current.windowId, "authorized");
      }
    } catch { /* The clicked tab may have closed while injection was pending. */ }
  });
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

function broadcastPageChanged(tabId: number, windowId: number, kind: PageChangedNotification["kind"]): void {
  const notification: PageChangedNotification = {
    type: MSG.PAGE_CHANGED,
    v: 1,
    tabId,
    windowId,
    kind,
  };
  void chrome.runtime.sendMessage(notification).catch(() => undefined);
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  broadcastPageChanged(activeInfo.tabId, activeInfo.windowId, "activated");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    resetInjected(tabId);
    resetTabRequests(tabId);
    if (tab.active) broadcastPageChanged(tabId, tab.windowId, "loading");
  } else if (changeInfo.status === "complete" && tab.active) {
    broadcastPageChanged(tabId, tab.windowId, "navigated");
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  forgetTab(tabId);
  resetTabRequests(tabId);
});
