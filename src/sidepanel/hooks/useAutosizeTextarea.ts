import { useLayoutEffect, type RefObject } from "react";
import { inputMaxHeightPx } from "../layout/constants";

export function useAutosizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const style = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(style.lineHeight) || 20;
    const padding =
      (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
    const minHeight = lineHeight * 2 + padding;
    const maxHeight = inputMaxHeightPx(window.innerHeight, lineHeight, padding);
    element.style.height = "auto";
    const next = Math.min(Math.max(element.scrollHeight, minHeight), maxHeight);
    if (Math.abs(element.clientHeight - next) > 0.5) {
      element.style.height = `${next}px`;
    }
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [ref, value]);
}