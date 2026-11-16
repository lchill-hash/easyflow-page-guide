import { createEfError, toEfError } from "../shared/errors";
import type { EfError } from "../shared/errors";

export type TabContextResult =
  | { ok: true; tabId: number; windowId: number }
  | { ok: false; error: EfError };

export async function getActiveTab(): Promise<TabContextResult> {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (tab === undefined || typeof tab.id !== "number") {
      return { ok: false, error: createEfError("EF-E001") };
    }
    const windowId =
      typeof tab.windowId === "number" ? tab.windowId : chrome.windows.WINDOW_ID_CURRENT;
    return { ok: true, tabId: tab.id, windowId };
  } catch (error) {
    return { ok: false, error: toEfError(error) };
  }
}