import { HIGHLIGHT_HOST_ATTR, WATCH_DEBOUNCE_MS } from "../shared/constants";
import { MSG } from "../shared/messages";
import type { WatchData } from "../shared/messages";
import { noteDomTick } from "./highlight";

let observer: MutationObserver | null = null;
let startedAt = 0;
let changeCount = 0;
let lastChangeAt = 0;
let debounceTimer: number | null = null;

function isHighlightHost(node: Node): boolean {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).hasAttribute(HIGHLIGHT_HOST_ATTR)
  );
}

function isHighlightOnlyRecord(record: MutationRecord): boolean {
  if (record.type === "attributes") {
    return (
      record.target.nodeType === Node.ELEMENT_NODE &&
      (record.target as Element).hasAttribute(HIGHLIGHT_HOST_ATTR)
    );
  }
  const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
  return nodes.length > 0 && nodes.every(isHighlightHost);
}

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
  observer = new MutationObserver((records) => {
    if (records.every(isHighlightOnlyRecord)) {
      return;
    }
    changeCount += 1;
    lastChangeAt = Date.now();
    noteDomTick();
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