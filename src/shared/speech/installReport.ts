import {
  INSTALL_ERROR_BRIEF_MAX_CHARS,
  INSTALL_ERROR_INPUT_MAX_CHARS,
} from "./constants";
import { INSTALL_ERROR_TEXTS, INSTALL_OUTCOME_TEXTS } from "./copy";
import { INSTALL_BRIEF_FORBIDDEN_WORDS } from "./forbidden";
import type { InstallOutcomeDetail } from "./localCapability";

export const INSTALL_ERROR_NAMES = [
  "NotAllowedError",
  "SecurityError",
  "NotSupportedError",
  "NetworkError",
  "AbortError",
  "InvalidStateError",
  "UnknownError",
  "TypeError",
  "RangeError",
  "Error",
] as const;

export type InstallErrorName = (typeof INSTALL_ERROR_NAMES)[number];

const NAME_SET = new Set<string>(INSTALL_ERROR_NAMES);

export function normalizeInstallErrorName(raw: unknown): string {
  try {
    if (typeof raw !== "string") {
      return INSTALL_ERROR_TEXTS.unknownName;
    }
    if (raw.length === 0 || raw.length > 40 || !/^[A-Za-z]+$/.test(raw)) {
      return INSTALL_ERROR_TEXTS.unknownName;
    }
    return NAME_SET.has(raw) ? raw : INSTALL_ERROR_TEXTS.unknownName;
  } catch {
    return INSTALL_ERROR_TEXTS.unknownName;
  }
}

function truncateCodePoints(text: string, limit: number): string {
  const codePoints = Array.from(text);
  if (codePoints.length <= limit) {
    return text;
  }
  return codePoints.slice(0, limit).join("");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FORBIDDEN_PATTERN = new RegExp(
  INSTALL_BRIEF_FORBIDDEN_WORDS.map(escapeRegExp).join("|"),
  "gi",
);

const ONLY_PUNCTUATION = /^[\s….,;:!?\-–—·、，。；：！？（）()\[\]{}"']*$/u;

export function sanitizeInstallErrorBrief(rawMessage: unknown): string {
  try {
    if (typeof rawMessage !== "string" || rawMessage.length === 0) {
      return INSTALL_ERROR_TEXTS.emptyBrief;
    }
    let text = truncateCodePoints(rawMessage, INSTALL_ERROR_INPUT_MAX_CHARS);
    text = text.replace(/\s+/g, " ").trim();
    text = text.replace(/[A-Za-z][A-Za-z0-9+.-]*:\/\/\S+/g, "");
    text = text.replace(/[A-Za-z]:\\\S+/g, "");
    text = text.replace(/\b[a-p]{32}\b/g, "");
    text = text.replace(/\b[A-Za-z0-9_.-]{20,}\b/g, "");
    text = text.replace(/\d{6,}/g, "");
    text = text.replace(FORBIDDEN_PATTERN, "…");
    text = text.replace(/…+/g, "…").trim();
    if (text.length === 0 || ONLY_PUNCTUATION.test(text)) {
      return INSTALL_ERROR_TEXTS.emptyBrief;
    }
    if (Array.from(text).length > INSTALL_ERROR_BRIEF_MAX_CHARS) {
      text = `${truncateCodePoints(text, INSTALL_ERROR_BRIEF_MAX_CHARS)}…`;
    }
    return text;
  } catch {
    return INSTALL_ERROR_TEXTS.emptyBrief;
  }
}

export function readInstallErrorDetail(error: unknown): {
  errorName: string;
  errorBrief: string;
} {
  if (typeof error !== "object" || error === null) {
    return {
      errorName: INSTALL_ERROR_TEXTS.unknownName,
      errorBrief: INSTALL_ERROR_TEXTS.emptyBrief,
    };
  }
  let name: unknown;
  let message: unknown;
  try {
    name = (error as { name?: unknown }).name;
  } catch {
    name = undefined;
  }
  try {
    message = (error as { message?: unknown }).message;
  } catch {
    message = undefined;
  }
  return {
    errorName: normalizeInstallErrorName(name),
    errorBrief: sanitizeInstallErrorBrief(message),
  };
}

export function describeInstallOutcomeText(detail: InstallOutcomeDetail): string {
  const label = INSTALL_OUTCOME_TEXTS[detail.outcome];
  if (detail.outcome === "threw") {
    return `${label} · ${detail.errorName ?? INSTALL_ERROR_TEXTS.noneValue} · ${
      detail.errorBrief ?? INSTALL_ERROR_TEXTS.noneValue
    }`;
  }
  return `${label} · ${INSTALL_ERROR_TEXTS.noneValue} · ${INSTALL_ERROR_TEXTS.noneValue}`;
}