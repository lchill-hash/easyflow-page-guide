import {
  CONTENT_VERSION,
  HIGHLIGHT_BOX_POOL_MAX,

  HIGHLIGHT_HOST_ATTR,
  HIGHLIGHT_PULSE_COUNT,
  HIGHLIGHT_PULSE_DURATION_MS,
  HIGHLIGHT_ROUND_ATTR,
  HIGHLIGHT_TTL_MS,
} from "../shared/constants";
import { isValidDomPath, normalizeWhitespace, textHash } from "../shared/domPath";
import type {
  CleanupReason,
  ElementRef,
  HighlightResult,
  HighlightStats,
  ViewportRect,
} from "../shared/types";
import {
  createRoundState,
  isPulsing,
  reduceRound,
  type RoundConfig,
  type RoundEvent,
  type HighlightRoundState,
} from "./highlightRound";
import { lookup } from "./registry";

type LocateOutcome =
  | { status: "found"; element: Element }
  | { status: "folded" }
  | { status: "stale" };

export interface PageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const BOX_PADDING = 2;
const MERGE_GAP = 8;

const HIGHLIGHT_BORDER_WIDTH = "3px";
const HIGHLIGHT_CARE_BORDER_WIDTH = "4px";
const HIGHLIGHT_BORDER_STYLE = "solid";
const HIGHLIGHT_BORDER_RADIUS = "4px";
const HIGHLIGHT_EASING = "ease-in-out";
const HIGHLIGHT_CARE_BORDER = "rgb(30, 41, 89)";
const HIGHLIGHT_CARE_FILL = "rgba(49, 46, 129, 0.18)";
const HIGHLIGHT_CARE_GLOW = "0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 0 6px rgba(49, 46, 129, 0.35)";

const HIGHLIGHT_COLORS = {
  border: "rgba(49, 46, 129, 0.95)",
  borderPeak: "rgb(30, 41, 89)",
  fillBase: "rgba(79, 70, 229, 0.12)",
  fillPeak: "rgba(129, 140, 248, 0.30)",
  fillStatic: "rgba(79, 70, 229, 0.22)",
  glowBase: "0 0 0 1px rgba(255, 255, 255, 0.9), 0 0 8px rgba(79, 70, 229, 0.18)",
  glowPeak:
    "0 0 0 1px rgba(255, 255, 255, 0.95), 0 0 20px rgba(79, 70, 229, 0.40), 0 0 28px rgba(13, 148, 136, 0.18)",
  glowStatic: "0 0 0 1px rgba(255, 255, 255, 0.95), 0 0 16px rgba(79, 70, 229, 0.30)",
} as const;

interface OverlaySession {
  host: HTMLDivElement;
  shadow: ShadowRoot;
  boxes: HTMLDivElement[];
  range: Range | null;
  target: Element;
  roundId: number;
  care: boolean;
  animations: Animation[];
}

let session: OverlaySession | null = null;
let roundState: HighlightRoundState = createRoundState();
let refCalls = 0;
let frameRequest: number | null = null;
let ttlTimer: number | null = null;
let lastUiMode: "normal" | "care" = "normal";
let lastReducedMotion = false;

function now(): number {
  return performance.now();
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function dispatch(event: RoundEvent): void {
  roundState = reduceRound(roundState, event);
}

function snapshotStats(mode: "normal" | "care"): HighlightStats {
  const counters = roundState.counters;
  const timing = roundState.timing;
  return {
    refCalls,
    roundStartCount: counters.roundStartCount,
    pulseStartCount: counters.pulseStartCount,
    pulseCompletedCount: counters.pulseCompletedCount,
    overlayCreateCount: counters.overlayCreateCount,
    overlayLiveCount: counters.overlayLiveCount,
    overlayLiveMax: counters.overlayLiveMax,
    legacyHostCount: counters.legacyHostCount,
    cleanupScheduledCount: counters.cleanupScheduledCount,
    cleanupFiredCount: counters.cleanupFiredCount,
    cleanupReplacedCount: counters.cleanupReplacedCount,
    cleanupNoopCount: counters.cleanupNoopCount,
    cleanupReason: timing.lastCleanupReason,
    positionUpdateCount: counters.positionUpdateCount,
    domTickCount: counters.domTickCount,
    boxCreateCount: counters.boxCreateCount,
    boxRemoveCount: counters.boxRemoveCount,
    boxCount: counters.boxCount,
    uiModeAtRequest: mode,
    reducedMotionAtRequest: lastReducedMotion,
    lastRoundStartAt: timing.lastRoundStartAt,
    lastRoundEndAt: timing.lastRoundEndAt,
    lastCleanupAt: timing.lastCleanupAt,
    highlightLifetimeMs: timing.highlightLifetimeMs,
    contentVersionSeen: "",
    expectedContentVersion: CONTENT_VERSION,
    pageInjectionCount: 0,
  };
}

function visibleTextOf(element: Element): string {
  const innerText = (element as HTMLElement).innerText;
  if (typeof innerText === "string") {
    return innerText;
  }
  return element.textContent ?? "";
}

function isElementVisible(element: Element): boolean {
  try {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return false;
    }
    if (Number.parseFloat(style.opacity) === 0) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  } catch {
    return false;
  }
}

function locate(ref: ElementRef): LocateOutcome {
  const registered = lookup(ref.elementId);
  if (registered !== undefined && registered.element.isConnected && registered.textHash === ref.textHash) {
    if (isElementVisible(registered.element)) {
      return { status: "found", element: registered.element };
    }
    return { status: "folded" };
  }

  if (isValidDomPath(ref.domPath)) {
    let byPath: Element | null = null;
    try {
      byPath = document.querySelector(ref.domPath);
    } catch {
      byPath = null;
    }
    if (byPath !== null && textHash(normalizeWhitespace(visibleTextOf(byPath))) === ref.textHash) {
      if (isElementVisible(byPath)) {
        return { status: "found", element: byPath };
      }
      return { status: "folded" };
    }
  }

  return { status: "stale" };
}

function rectOf(element: Element): ViewportRect {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function toPageBox(rect: DOMRect): PageBox {
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

export function mergeLineBoxes(boxes: PageBox[]): PageBox[] {
  const sorted = boxes.slice().sort((left, right) => left.top - right.top || left.left - right.left);
  const merged: PageBox[] = [];

  for (const box of sorted) {
    const existing = merged.find(
      (candidate) =>
        Math.abs(candidate.top - box.top) <= 2 &&
        Math.abs(candidate.height - box.height) <= 2 &&
        box.left <= candidate.left + candidate.width + MERGE_GAP &&
        box.left + box.width >= candidate.left - MERGE_GAP,
    );
    if (existing !== undefined) {
      const right = Math.max(existing.left + existing.width, box.left + box.width);
      const top = Math.min(existing.top, box.top);
      const bottom = Math.max(existing.top + existing.height, box.top + box.height);
      existing.left = Math.min(existing.left, box.left);
      existing.top = top;
      existing.width = right - existing.left;
      existing.height = bottom - top;
      continue;
    }
    merged.push({ ...box });
  }

  return merged.slice(0, HIGHLIGHT_BOX_POOL_MAX);
}

function readRangeBoxes(range: Range): PageBox[] {
  const boxes: PageBox[] = [];
  const list = range.getClientRects();
  for (let index = 0; index < list.length; index += 1) {
    const rect = list.item(index);
    if (rect === null || rect.width <= 0.5 || rect.height <= 0.5) {
      continue;
    }
    boxes.push(toPageBox(rect));
  }
  return mergeLineBoxes(boxes);
}

function resolveTextElement(element: Element): Element {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    const labels = element.labels;
    if (labels !== null && labels.length > 0) {
      const label = labels[0];
      if (label !== undefined && label.isConnected) {
        return label;
      }
    }
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy !== null) {
      for (const id of labelledBy.split(/\s+/)) {
        if (id.length === 0) {
          continue;
        }
        const labelTarget = document.getElementById(id);
        if (labelTarget !== null) {
          return labelTarget;
        }
      }
    }
  }
  return element;
}

function buildTextHighlight(element: Element): { range: Range; boxes: PageBox[] } | null {
  const textElement = resolveTextElement(element);
  if (!textElement.isConnected) {
    return null;
  }
  const range = document.createRange();
  try {
    range.selectNodeContents(textElement);
  } catch {
    return null;
  }
  const boxes = readRangeBoxes(range);
  if (boxes.length === 0) {
    return null;
  }
  return { range, boxes };
}

function fallbackPageBox(element: Element): PageBox | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0.5 || rect.height <= 0.5) {
    return null;
  }
  return toPageBox(rect);
}

function applyStaticStyle(box: HTMLDivElement, care: boolean): void {
  box.style.borderWidth = care ? HIGHLIGHT_CARE_BORDER_WIDTH : HIGHLIGHT_BORDER_WIDTH;
  box.style.borderStyle = HIGHLIGHT_BORDER_STYLE;
  box.style.borderColor = care ? HIGHLIGHT_CARE_BORDER : HIGHLIGHT_COLORS.border;
  box.style.backgroundColor = care ? HIGHLIGHT_CARE_FILL : HIGHLIGHT_COLORS.fillStatic;
  box.style.boxShadow = care ? HIGHLIGHT_CARE_GLOW : HIGHLIGHT_COLORS.glowStatic;
}

function createBoxElement(care: boolean): HTMLDivElement {
  const box = document.createElement("div");
  box.style.position = "absolute";
  box.style.boxSizing = "border-box";
  box.style.pointerEvents = "none";
  box.style.borderRadius = HIGHLIGHT_BORDER_RADIUS;
  box.style.display = "none";
  applyStaticStyle(box, care);
  return box;
}

function countLiveHosts(): number {
  let live = 0;
  for (const child of Array.from(document.documentElement.children)) {
    if (child.hasAttribute(HIGHLIGHT_HOST_ATTR)) {
      live += 1;
    }
  }
  return live;
}

function countLegacyHosts(): number {
  let legacy = 0;
  for (const child of Array.from(document.documentElement.children)) {
    if (child.hasAttribute(HIGHLIGHT_HOST_ATTR)) {
      continue;
    }
    const element = child as HTMLElement;
    if (
      element.style.position === "absolute" &&
      element.style.zIndex === "2147483647" &&
      element.style.pointerEvents === "none" &&
      (element.style.width === "0px" || element.style.width === "0") &&
      (element.style.height === "0px" || element.style.height === "0")
    ) {
      legacy += 1;
    }
  }
  return legacy;
}

function syncHosts(): void {
  dispatch({
    type: "hosts-measured",
    now: now(),
    live: countLiveHosts(),
    legacy: countLegacyHosts(),
  });
}

function ensureBoxPool(count: number): void {
  if (session === null) {
    return;
  }
  let created = 0;
  while (session.boxes.length < count && session.boxes.length < HIGHLIGHT_BOX_POOL_MAX) {
    const box = createBoxElement(session.care);
    session.shadow.appendChild(box);
    session.boxes.push(box);
    created += 1;
  }
  for (let index = 0; index < session.boxes.length; index += 1) {
    const box = session.boxes[index];
    if (box === undefined) {
      continue;
    }
    if (index < count) {
      box.style.display = "block";
    } else {
      box.style.display = "none";
      for (const animation of box.getAnimations()) {
        animation.cancel();
      }
    }
  }
  dispatch({
    type: "boxes-synced",
    now: now(),
    created,
    removed: 0,
    visible: Math.min(count, session.boxes.length),
  });
}

function positionBoxes(boxes: PageBox[]): void {
  if (session === null) {
    return;
  }
  ensureBoxPool(boxes.length);
  for (let index = 0; index < boxes.length; index += 1) {
    const box = session.boxes[index];
    const rect = boxes[index];
    if (box === undefined || rect === undefined) {
      continue;
    }
    box.style.left = `${rect.left - BOX_PADDING}px`;
    box.style.top = `${rect.top - BOX_PADDING}px`;
    box.style.width = `${rect.width + BOX_PADDING * 2}px`;
    box.style.height = `${rect.height + BOX_PADDING * 2}px`;
  }
}

function startPulse(boxes: PageBox[]): void {
  if (session === null) {
    return;
  }
  const target = session;
  ensureBoxPool(boxes.length);
  const startTime = document.timeline.currentTime;
  for (let index = 0; index < boxes.length; index += 1) {
    const box = target.boxes[index];
    if (box === undefined) {
      continue;
    }
    for (const animation of box.getAnimations()) {
      animation.cancel();
    }
    const animation = box.animate(
      [
        {
          backgroundColor: HIGHLIGHT_COLORS.fillBase,
          borderColor: HIGHLIGHT_COLORS.border,
          boxShadow: HIGHLIGHT_COLORS.glowBase,
        },
        {
          backgroundColor: HIGHLIGHT_COLORS.fillPeak,
          borderColor: HIGHLIGHT_COLORS.borderPeak,
          boxShadow: HIGHLIGHT_COLORS.glowPeak,
        },
        {
          backgroundColor: HIGHLIGHT_COLORS.fillBase,
          borderColor: HIGHLIGHT_COLORS.border,
          boxShadow: HIGHLIGHT_COLORS.glowBase,
        },
      ],
      {
        duration: HIGHLIGHT_PULSE_DURATION_MS,
        iterations: HIGHLIGHT_PULSE_COUNT,
        easing: HIGHLIGHT_EASING,
      },
    );
    if (typeof startTime === "number") {
      animation.startTime = startTime;
    }
    target.animations.push(animation);
  }
  const roundId = target.roundId;
  void Promise.allSettled(
    target.animations.map((animation) => animation.finished.catch(() => undefined)),
  ).then(() => {
    if (session === null || session.roundId !== roundId || roundState.phase !== "pulsing") {
      return;
    }
    dispatch({ type: "pulse-complete", now: now() });
    for (const box of session.boxes) {
      applyStaticStyle(box, session.care);
    }
    session.animations = [];
  });
}

function updateOverlayPositions(): void {
  if (session === null) {
    return;
  }
  if (!session.target.isConnected) {
    finish("unroute");
    return;
  }
  let boxes: PageBox[] = [];
  if (session.range !== null) {
    if (session.range.startContainer.isConnected) {
      boxes = readRangeBoxes(session.range);
    } else {
      session.range = null;
    }
  }
  if (boxes.length === 0) {
    const fallback = fallbackPageBox(session.target);
    if (fallback !== null) {
      boxes = [fallback];
    }
  }
  if (boxes.length === 0) {
    finish("unroute");
    return;
  }
  dispatch({ type: "position-updated", now: now() });
  positionBoxes(boxes);
}

function scheduleOverlayUpdate(): void {
  if (frameRequest !== null) {
    return;
  }
  frameRequest = window.requestAnimationFrame(() => {
    frameRequest = null;
    updateOverlayPositions();
  });
}

function onPageHide(): void {
  finish("pagehide");
}

function createSessionHost(roundId: number, care: boolean): { host: HTMLDivElement; shadow: ShadowRoot } {
  const host = document.createElement("div");
  host.style.position = "absolute";
  host.style.top = "0";
  host.style.left = "0";
  host.style.width = "0";
  host.style.height = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";
  host.setAttribute(HIGHLIGHT_HOST_ATTR, "v1");
  host.setAttribute(HIGHLIGHT_ROUND_ATTR, String(roundId));
  const shadow = host.attachShadow({ mode: "closed" });
  document.documentElement.appendChild(host);
  return { host, shadow };
}

function clearSessionResources(target: OverlaySession): void {
  for (const animation of target.animations) {
    animation.cancel();
  }
  for (const box of target.boxes) {
    for (const animation of box.getAnimations()) {
      animation.cancel();
    }
  }
}

function finish(reason: CleanupReason): void {
  if (session === null) {
    dispatch({ type: "cleanup", now: now(), reason: "noop" });
    return;
  }
  const target = session;
  clearSessionResources(target);
  if (ttlTimer !== null) {
    window.clearTimeout(ttlTimer);
    ttlTimer = null;
  }
  if (frameRequest !== null) {
    window.cancelAnimationFrame(frameRequest);
    frameRequest = null;
  }
  window.removeEventListener("scroll", scheduleOverlayUpdate, true);
  window.removeEventListener("resize", scheduleOverlayUpdate);
  window.removeEventListener("pagehide", onPageHide);
  target.host.remove();
  session = null;
  dispatch({ type: "cleanup", now: now(), reason });
  syncHosts();
}

export function cleanupHighlight(reason: CleanupReason = "noop"): void {
  finish(reason);
}

export function noteDomTick(): void {
  dispatch({ type: "dom-tick", now: now() });
}

function measure(element: Element): { range: Range | null; boxes: PageBox[] } | null {
  element.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: "auto",
  });
  const textHighlight = buildTextHighlight(element);
  let boxes: PageBox[] = textHighlight?.boxes ?? [];
  if (boxes.length === 0) {
    const fallback = fallbackPageBox(element);
    if (fallback !== null) {
      boxes = [fallback];
    }
  }
  if (boxes.length === 0) {
    return null;
  }
  return { range: textHighlight?.range ?? null, boxes };
}

export function highlightRef(
  ref: ElementRef,
  mode: "normal" | "care" = "normal",
): HighlightResult {
  refCalls += 1;
  if (session !== null) {
    finish("replaced");
  }
  const located = locate(ref);
  if (located.status === "stale") {
    return { status: "stale", stats: snapshotStats(mode) };
  }
  if (located.status === "folded") {
    return { status: "folded", stats: snapshotStats(mode) };
  }

  const element = located.element;
  const measured = measure(element);
  if (measured === null) {
    return { status: "stale", stats: snapshotStats(mode) };
  }

  const care = mode === "care";
  const reducedMotion = prefersReducedMotion();
  lastUiMode = mode;
  lastReducedMotion = reducedMotion;
  const roundId = roundState.roundId + 1;
  const { host, shadow } = createSessionHost(roundId, care);
  session = {
    host,
    shadow,
    boxes: [],
    range: measured.range,
    target: element,
    roundId,
    care,
    animations: [],
  };

  const config: RoundConfig = {
    pulseDurationMs: HIGHLIGHT_PULSE_DURATION_MS,
    pulseCount: HIGHLIGHT_PULSE_COUNT,
    ttlMs: HIGHLIGHT_TTL_MS,
    care,
    reducedMotion,
    supportsAnimate: typeof host.animate === "function" || typeof HTMLDivElement.prototype.animate === "function",
  };
  const pulsing = isPulsing(config);
  dispatch({ type: "round-start", now: now(), config });
  positionBoxes(measured.boxes);
  syncHosts();
  if (pulsing) {
    startPulse(measured.boxes);
  } else {
    for (const box of session.boxes) {
      applyStaticStyle(box, care);
    }
  }

  window.addEventListener("scroll", scheduleOverlayUpdate, { passive: true, capture: true });
  window.addEventListener("resize", scheduleOverlayUpdate);
  window.addEventListener("pagehide", onPageHide);
  ttlTimer = window.setTimeout(() => {
    finish("ttl");
  }, HIGHLIGHT_TTL_MS);

  return {
    status: "highlighted",
    rect: rectOf(element),
    stats: snapshotStats(lastUiMode),
  };
}