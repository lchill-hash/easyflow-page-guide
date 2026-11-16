import { MAX_TEXT_LENGTH } from "../shared/constants";
import { normalizeWhitespace } from "../shared/domPath";

export interface NormalizeResult {
  text: string;
  truncated: boolean;
}

const SYMBOL_ONLY = /^[\p{P}\p{S}]+$/u;

export function normalizeText(raw: string, maxLength: number = MAX_TEXT_LENGTH): NormalizeResult {
  const normalized = normalizeWhitespace(raw);
  if (normalized.length <= maxLength) {
    return { text: normalized, truncated: false };
  }
  const cut = Math.max(1, maxLength - 1);
  return { text: `${normalized.slice(0, cut)}…`, truncated: true };
}

export function isMeaningfulText(text: string, allowSingleChar = false): boolean {
  if (text.length === 0) {
    return false;
  }
  if (SYMBOL_ONLY.test(text)) {
    return false;
  }
  if (text.length === 1 && !allowSingleChar) {
    return false;
  }
  return true;
}