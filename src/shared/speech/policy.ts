import { detectSensitive } from "../privacy/detect";
import type { MicPermissionState } from "./permission";
import type {
  RawErrorCode,
  RawSpeechErrorKind,
  RecognitionSupport,
  SpeakRequest,
  SpeakTextCheck,
  SpeechErrorKind,
  SpeechVoiceLike,
  TranscriptMerge,
  VoiceInputIssue,
  VoiceInputPhase,
} from "./types";

export function mergeTranscript(
  current: string,
  incoming: string,
  limit: number,
): TranscriptMerge {
  const normalized = incoming.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return { ok: true, text: current };
  }
  const needsSpace =
    current.length > 0 && /[A-Za-z0-9]$/.test(current) && /^[A-Za-z0-9]/.test(normalized);
  const merged =
    current.length === 0 ? normalized : `${current}${needsSpace ? " " : ""}${normalized}`;
  if (merged.length > limit) {
    return { ok: false, reason: "too-long" };
  }
  return { ok: true, text: merged };
}

export function checkSpeakText(request: SpeakRequest): SpeakTextCheck {
  if (request.text.trim().length === 0) {
    return { allowed: false, reason: "empty" };
  }
  if (detectSensitive(request.text).length > 0) {
    return { allowed: false, reason: "sensitive" };
  }
  return { allowed: true, text: request.text };
}

export function pickChineseVoice(voices: readonly SpeechVoiceLike[]): {
  voice: SpeechVoiceLike | null;
  matched: "zh-CN" | "zh" | "default" | "none";
} {
  const normalized = voices.map((voice) => ({
    voice,
    lang: voice.lang.toLowerCase().replace(/_/g, "-"),
  }));
  const exact = normalized.find((item) => item.lang === "zh-cn");
  if (exact !== undefined) {
    return { voice: exact.voice, matched: "zh-CN" };
  }
  const zh = normalized.find((item) => item.lang.startsWith("zh"));
  if (zh !== undefined) {
    return { voice: zh.voice, matched: "zh" };
  }
  const fallback = voices.find((voice) => voice.default === true);
  if (fallback !== undefined) {
    return { voice: fallback, matched: "default" };
  }
  return { voice: null, matched: "none" };
}

function asRecord(scope: unknown): Record<string, unknown> | null {
  if (typeof scope !== "object" || scope === null) {
    return null;
  }
  return scope as Record<string, unknown>;
}

export function detectRecognitionSupport(scope: unknown): RecognitionSupport {
  const record = asRecord(scope);
  if (record === null) {
    return "unsupported";
  }
  return typeof record["SpeechRecognition"] === "function" ||
    typeof record["webkitSpeechRecognition"] === "function"
    ? "supported"
    : "unsupported";
}

export function detectSynthesisSupport(scope: unknown): RecognitionSupport {
  const record = asRecord(scope);
  if (record === null) {
    return "unsupported";
  }
  const synthesis = record["speechSynthesis"];
  return typeof synthesis === "object" &&
    synthesis !== null &&
    typeof record["SpeechSynthesisUtterance"] === "function"
    ? "supported"
    : "unsupported";
}

export function mapRecognitionError(raw: string | undefined): SpeechErrorKind {
  switch (raw) {
    case "not-allowed":
      return "permission-denied";
    case "service-not-allowed":
      return "service-limited";
    case "audio-capture":
      return "no-audio-device";
    case "no-speech":
    case "bad-grammar":
      return "no-speech";
    case "network":
      return "network";
    case "aborted":
      return "aborted";
    case "language-not-supported":
      return "unsupported";
    default:
      return "unknown";
  }
}

export function mapRawErrorCode(raw: string | undefined): RawErrorCode | null {
  switch (raw) {
    case "no-speech":
    case "network":
    case "not-allowed":
    case "service-not-allowed":
    case "audio-capture":
    case "language-not-supported":
    case "aborted":
      return raw;
    case undefined:
      return null;
    default:
      return "unmapped";
  }
}

export function mapRawErrorKind(raw: string | undefined): RawSpeechErrorKind {
  switch (raw) {
    case "no-speech":
    case "bad-grammar":
      return "no-speech";
    case "network":
      return "network";
    case "not-allowed":
      return "not-allowed";
    case "service-not-allowed":
      return "service-not-allowed";
    case "audio-capture":
      return "audio-capture";
    default:
      return "other";
  }
}

export function rawKindOfSpeechError(kind: SpeechErrorKind): RawSpeechErrorKind {
  switch (kind) {
    case "no-speech":
      return "no-speech";
    case "network":
      return "network";
    case "permission-denied":
      return "not-allowed";
    case "service-limited":
      return "service-not-allowed";
    case "no-audio-device":
      return "audio-capture";
    default:
      return "other";
  }
}

export interface RecognitionFailureOutcome {
  phase: VoiceInputPhase;
  issue: VoiceInputIssue | null;
  gate: boolean;
}

export function resolveRecognitionFailure(input: {
  permission: MicPermissionState;
  kind: SpeechErrorKind;
  raw: RawSpeechErrorKind;
}): RecognitionFailureOutcome {
  if (input.kind === "aborted") {
    return { phase: "cancelled", issue: null, gate: false };
  }
  if (input.kind === "unsupported") {
    return { phase: "unsupported", issue: null, gate: false };
  }
  if (input.kind === "device-unavailable") {
    return { phase: "failed", issue: "device-unavailable", gate: false };
  }
  if (input.permission === "denied") {
    return { phase: "permission-denied", issue: null, gate: false };
  }
  if (input.permission === "prompt" || input.permission === "unsupported") {
    return { phase: "idle", issue: null, gate: true };
  }
  if (input.raw === "no-speech") {
    return { phase: "no-speech", issue: null, gate: false };
  }
  if (input.permission === "granted") {
    switch (input.raw) {
      case "network":
        return { phase: "failed", issue: "network", gate: false };
      case "not-allowed":
        return { phase: "failed", issue: "permission-conflict", gate: false };
      case "service-not-allowed":
        return { phase: "failed", issue: "service-limited", gate: false };
      case "audio-capture":
        return { phase: "permission-denied", issue: "no-audio-device", gate: false };
      default:
        return { phase: "failed", issue: null, gate: false };
    }
  }
  switch (input.raw) {
    case "network":
      return { phase: "failed", issue: "network", gate: false };
    case "not-allowed":
      return { phase: "permission-denied", issue: null, gate: false };
    case "service-not-allowed":
      return { phase: "failed", issue: "service-limited", gate: false };
    case "audio-capture":
      return { phase: "permission-denied", issue: "no-audio-device", gate: false };
    default:
      return { phase: "failed", issue: null, gate: false };
  }
}