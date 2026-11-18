import type { ElementRef } from "../shared/types";

const HOST_ID = "ef-page-focus-host";

export type PageFocusStatus = "applied" | "no-target" | "failed";

function injectFocus(paths: string[]): PageFocusStatus {
  const old = document.getElementById("ef-page-focus-host");
  if (old !== null) {
    old.dispatchEvent(new Event("ef-focus-clear"));
    old.remove();
  }
  const elements: Element[] = [];
  for (const path of paths.slice(0, 8)) {
    try {
      const element = document.querySelector(path);
      if (element !== null) {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0) {
          elements.push(element);
        }
      }
    } catch {
      // Ignore an invalid selector from a stale snapshot.
    }
  }
  if (elements.length === 0) return "no-target";
  const host = document.createElement("div");
  host.id = "ef-page-focus-host";
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.zIndex = "2147483646";
  host.style.pointerEvents = "none";
  const render = (): void => {
    host.replaceChildren();
    const rects = elements.map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight);
    if (rects.length === 0) return;
    const left = Math.max(0, Math.min(...rects.map((rect) => rect.left)));
    const top = Math.max(0, Math.min(...rects.map((rect) => rect.top)));
    const right = Math.min(window.innerWidth, Math.max(...rects.map((rect) => rect.right)));
    const bottom = Math.min(window.innerHeight, Math.max(...rects.map((rect) => rect.bottom)));
    const mask = (x: number, y: number, w: number, h: number): void => {
      if (w <= 0 || h <= 0) return;
      const node = document.createElement("div");
      node.style.position = "fixed";
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
      node.style.background = "rgba(250, 248, 255, 0.68)";
      host.appendChild(node);
    };
    mask(0, 0, window.innerWidth, top);
    mask(0, bottom, window.innerWidth, window.innerHeight - bottom);
    mask(0, top, left, bottom - top);
    mask(right, top, window.innerWidth - right, bottom - top);
    for (const rect of rects) {
    const outline = document.createElement("div");
    outline.style.position = "fixed";
    outline.style.left = `${rect.left - 3}px`;
    outline.style.top = `${rect.top - 3}px`;
    outline.style.width = `${rect.width + 6}px`;
    outline.style.height = `${rect.height + 6}px`;
    outline.style.border = "3px solid #5b42ed";
    outline.style.borderRadius = "14px";
    outline.style.boxShadow = "0 0 0 2px rgba(255,255,255,0.95), 0 0 18px rgba(91,66,237,0.35)";
    host.appendChild(outline);
    }
  };
  const onMove = (): void => { if (host.isConnected) requestAnimationFrame(render); };
  host.addEventListener("ef-focus-clear", () => {
    window.removeEventListener("scroll", onMove, true);
    window.removeEventListener("resize", onMove);
  });
  document.documentElement.appendChild(host);
  window.addEventListener("scroll", onMove, true);
  window.addEventListener("resize", onMove);
  elements[0]?.scrollIntoView({ block: "center", inline: "nearest" });
  render();
  requestAnimationFrame(render);
  return "applied";
}

function removeFocus(): void {
  const host = document.getElementById("ef-page-focus-host");
  host?.dispatchEvent(new Event("ef-focus-clear"));
  host?.remove();
}

export async function applyPageFocus(tabId: number, refs: ElementRef[]): Promise<PageFocusStatus> {
  if (refs.length === 0) return "no-target";
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: injectFocus,
      args: [refs.map((ref) => ref.domPath)],
    });
    const value = results[0]?.result;
    return value === "applied" || value === "no-target" ? value : "failed";
  } catch {
    return "failed";
  }
}

export async function clearPageFocus(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: removeFocus });
  } catch {
    // Page may be gone; nothing to clear.
  }
}
