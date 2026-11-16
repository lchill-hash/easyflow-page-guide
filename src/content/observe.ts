import { WATCH_DEBOUNCE_MS } from "../shared/constants";
import { MSG } from "../shared/messages";
import type { WatchData } from "../shared/messages";

let observer: MutationObserver | null = null;
let startedAt = 0;
let changeCount = 0;
let lastChangeAt = 0;
let debounceTimer: number | null = null;

function emitTick(): void {
  debounceTimer = null;
  void chrome.runtime
    .sendMessage({
      type: MSG.WATCH_TICK,
      v: 1,
      changeCount,
      lastChangeAt,
    })
    .catch(() => undefined);
}

function scheduleTick(): void {
  if (debounceTimer !== null) {
    return;
  }
  debounceTimer = window.setTimeout(emitTick, WATCH_DEBOUNCE_MS);
}

export function startWatching(): { started: true } {
  if (observer !== null) {
    return { started: true };
  }
  changeCount = 0;
  lastChangeAt = 0;
  startedAt = Date.now();
  observer = new MutationObserver(() => {
    changeCount += 1;
    lastChangeAt = Date.now();
    scheduleTick();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  return { started: true };
}

export function stopWatching(): WatchData {
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (observer !== null) {
    observer.disconnect();
    observer = null;
  }
  const watchedMs = startedAt > 0 ? Date.now() - startedAt : 0;
  const result: WatchData = {
    stopped: true,
    changeCount,
    lastChangeAt,
    watchedMs,
  };
  startedAt = 0;
  changeCount = 0;
  lastChangeAt = 0;
  return result;
}