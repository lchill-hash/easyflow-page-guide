import {
  HIGHLIGHT_PULSE_COUNT,
  HIGHLIGHT_PULSE_DURATION_MS,
  HIGHLIGHT_TTL_MS,
} from "../shared/constants";
import { isValidDomPath, normalizeWhitespace, textHash } from "../shared/domPath";
import type { ElementRef, HighlightResult, ViewportRect } from "../shared/types";
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

const MAX_HIGHLIGHT_BOXES = 60;
const BOX_PADDING = 2;
const MERGE_GAP = 8;

const HIGHLIGHT_BORDER_WIDTH = "3px";
const HIGHLIGHT_CARE_BORDER_WIDTH = "4px";
const HIGHLIGHT_BORDER_STYLE = "solid";
const HIGHLIGHT_BORDER_RADIUS = "4px";
const HIGHLIGHT_EASING = "ease-in-out";
const HIGHLIGHT_CARE_BORDER = "rgb(49, 46, 129)";
const HIGHLIGHT_CARE_FILL = "rgba(79, 70, 229, 0.22)";
const HIGHLIGHT_CARE_GLOW = "0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 0 6px rgba(79, 70, 229, 0.35)";

const HIGHLIGHT_COLORS = {
  border: "rgba(76, 29, 149, 0.95)",
  borderPeak: "rgb(49, 20, 110)",
  fillBase: "rgba(139, 92, 246, 0.14)",
  fillPeak: "rgba(196, 181, 253, 0.36)",
  fillStatic: "rgba(139, 92, 246, 0.30)",
  glowBase: "0 0 0 1px rgba(255, 255, 255, 0.9), 0 0 8px rgba(124, 58, 237, 0.22)",
  glowPeak:
    "0 0 0 1px rgba(255, 255, 255, 0.95), 0 0 20px rgba(124, 58, 237, 0.50), 0 0 28px rgba(250, 204, 21, 0.22)",
  glowStatic: "0 0 0 1px rgba(255, 255, 255, 0.95), 0 0 16px rgba(124, 58, 237, 0.42)",
} as const;

let overlayHost: HTMLDivElement | null = null;
let overlayShadow: ShadowRoot | null = null;
let overlayBoxes: HTMLDivElement[] = [];
let activeRange: Range | null = null;
let targetElement: Element | null = null;
let cleanupTimer: number | null = null;
let frameRequest: number | null = null;
let activeCareMode = false;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
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

  return merged.slice(0, MAX_HIGHLIGHT_BOXES);
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

function applyBoxStyle(box: HTMLDivElement, care: boolean): void {
  const staticHighlight = care || prefersReducedMotion() || typeof box.animate !== "function";
  box.style.borderWidth = care ? HIGHLIGHT_CARE_BORDER_WIDTH : HIGHLIGHT_BORDER_WIDTH;
  box.style.borderStyle = HIGHLIGHT_BORDER_STYLE;
  if (care) {
    box.style.borderColor = HIGHLIGHT_CARE_BORDER;
    box.style.backgroundColor = HIGHLIGHT_CARE_FILL;
    box.style.boxShadow = HIGHLIGHT_CARE_GLOW;
    return;
  }
  box.style.borderColor = HIGHLIGHT_COLORS.border;
  box.style.backgroundColor = staticHighlight
    ? HIGHLIGHT_COLORS.fillStatic
    : HIGHLIGHT_COLORS.fillBase;
  box.style.boxShadow = staticHighlight ? HIGHLIGHT_COLORS.glowStatic : HIGHLIGHT_COLORS.glowBase;
}

function createBoxElement(care: boolean): HTMLDivElement {
  const box = document.createElement("div");
  box.style.position = "absolute";
  box.style.boxSizing = "border-box";
  box.style.pointerEvents = "none";
  box.style.borderRadius = HIGHLIGHT_BORDER_RADIUS;
  applyBoxStyle(box, care);
  return box;
}

function restartPulse(box: HTMLDivElement, care: boolean): void {
  applyBoxStyle(box, care);
  for (const animation of box.getAnimations()) {
    animation.cancel();
  }
  if (care || prefersReducedMotion() || typeof box.animate !== "function") {
    return;
  }
  box.animate(
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
}

function ensureBoxes(count: number): void {
  if (overlayShadow === null) {
    return;
  }
  while (overlayBoxes.length < count) {
    const box = createBoxElement(activeCareMode);
    overlayShadow.appendChild(box);
    overlayBoxes.push(box);
  }
  while (overlayBoxes.length > count) {
    const box = overlayBoxes.pop();
    box?.remove();
  }
}

function positionBoxes(boxes: PageBox[], animate: boolean): void {
  ensureBoxes(boxes.length);
  for (let index = 0; index < boxes.length; index += 1) {
    const box = overlayBoxes[index];
    const rect = boxes[index];
    if (box === undefined || rect === undefined) {
      continue;
    }
    box.style.left = `${rect.left - BOX_PADDING}px`;
    box.style.top = `${rect.top - BOX_PADDING}px`;
    box.style.width = `${rect.width + BOX_PADDING * 2}px`;
    box.style.height = `${rect.height + BOX_PADDING * 2}px`;
  }
  if (!animate) {
    return;
  }
  for (const box of overlayBoxes) {
    restartPulse(box, activeCareMode);
  }
}

function updateOverlayPositions(): void {
  if (targetElement === null || !targetElement.isConnected) {
    cleanupHighlight();
    return;
  }

  let boxes: PageBox[] = [];
  if (activeRange !== null) {
    if (activeRange.startContainer.isConnected) {
      boxes = readRangeBoxes(activeRange);
      if (boxes.length === 0) {
        return;
      }
    } else {
      activeRange = null;
    }
  }
  if (boxes.length === 0) {
    const fallback = fallbackPageBox(targetElement);
    if (fallback !== null) {
      boxes = [fallback];
    }
  }
  if (boxes.length === 0) {
    cleanupHighlight();
    return;
  }
  positionBoxes(boxes, false);
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

function createOverlay(
  element: Element,
  range: Range | null,
  initialBoxes: PageBox[],
  care: boolean,
): void {
  const host = document.createElement("div");
  host.style.position = "absolute";
  host.style.top = "0";
  host.style.left = "0";
  host.style.width = "0";
  host.style.height = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";

  const shadow = host.attachShadow({ mode: "closed" });
  document.documentElement.appendChild(host);

  overlayHost = host;
  overlayShadow = shadow;
  activeRange = range;
  targetElement = element;
  activeCareMode = care;

  positionBoxes(initialBoxes, true);

  window.addEventListener("scroll", scheduleOverlayUpdate, { passive: true, capture: true });
  window.addEventListener("resize", scheduleOverlayUpdate);
  cleanupTimer = window.setTimeout(cleanupHighlight, HIGHLIGHT_TTL_MS);
}

export function cleanupHighlight(): void {
  if (cleanupTimer !== null) {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
  if (frameRequest !== null) {
    window.cancelAnimationFrame(frameRequest);
    frameRequest = null;
  }
  window.removeEventListener("scroll", scheduleOverlayUpdate, true);
  window.removeEventListener("resize", scheduleOverlayUpdate);
  if (overlayHost !== null) {
    overlayHost.remove();
  }
  overlayHost = null;
  overlayShadow = null;
  overlayBoxes = [];
  activeRange = null;
  targetElement = null;
  activeCareMode = false;
}

export function highlightRef(
  ref: ElementRef,
  mode: "normal" | "care" = "normal",
): HighlightResult {
  cleanupHighlight();

  const located = locate(ref);
  if (located.status === "stale") {
    return { status: "stale" };
  }
  if (located.status === "folded") {
    return { status: "folded" };
  }

  const element = located.element;
  const textHighlight = buildTextHighlight(element);
  let initialBoxes: PageBox[] = textHighlight?.boxes ?? [];
  if (initialBoxes.length === 0) {
    const fallback = fallbackPageBox(element);
    if (fallback !== null) {
      initialBoxes = [fallback];
    }
  }
  if (initialBoxes.length === 0) {
    return { status: "stale" };
  }

  const reducedMotion = prefersReducedMotion();
  const care = mode === "care";
  element.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: care || reducedMotion ? "auto" : "smooth",
  });
  createOverlay(element, textHighlight?.range ?? null, initialBoxes, care);

  return {
    status: "highlighted",
    rect: rectOf(element),
  };
}