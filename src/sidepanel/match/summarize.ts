import { MAX_EXCERPT, MAX_SUMMARY } from "../../shared/constants";

export interface ExcerptResult {
  text: string;
  truncated: boolean;
}

export function buildSummary(sourceText: string, keywords: readonly string[]): string {
  const text = sourceText;
  let position = -1;
  for (const keyword of keywords) {
    const needle = keyword.trim();
    if (needle.length === 0) {
      continue;
    }
    const index = text.indexOf(needle);
    if (index >= 0 && (position < 0 || index < position)) {
      position = index;
    }
  }

  const start = position > 0 ? Math.max(0, position - 8) : 0;
  const prefix = start > 0 ? "…" : "";
  let end = Math.min(text.length, start + MAX_SUMMARY);
  let suffix = end < text.length ? "…" : "";
  let budget = MAX_SUMMARY - prefix.length - suffix.length;
  if (budget < 1) {
    end = Math.min(text.length, start + 1);
    suffix = end < text.length ? "…" : "";
    budget = MAX_SUMMARY - prefix.length - suffix.length;
  }

  const core = text.slice(start, Math.min(text.length, start + Math.max(1, budget))).trim();
  const summary = `${prefix}${core}${suffix}`;

  if (summary.length <= MAX_SUMMARY) {
    return summary;
  }
  return summary.slice(0, MAX_SUMMARY);
}

export function buildExcerpt(sourceText: string): ExcerptResult {
  if (sourceText.length <= MAX_EXCERPT) {
    return { text: sourceText, truncated: false };
  }
  return {
    text: `${sourceText.slice(0, MAX_EXCERPT - 1)}…`,
    truncated: true,
  };
}