import { SPEECH_REPEAT_WINDOW_MS } from "./constants";
import { SPEAK_NOTE_TEXT, SPEAK_UNAVAILABLE_TEXT } from "./copy";
import type {
  SpeakIssue,
  SpeakPhase,
  SpeakRequest,
  SpeakTextCheck,
  SpeakTextKind,
} from "./types";

export interface SpeakState {
  phase: SpeakPhase;
  key: string | null;
  kind: SpeakTextKind | null;
  text: string | null;
  issue: SpeakIssue | null;
  lastCompletedKey: string | null;
  lastCompletedAt: number;
}

export type SpeakEvent =
  | {
      type: "speak-requested";
      request: SpeakRequest;
      check: SpeakTextCheck;
      supported: boolean;
      now: number;
    }
  | { type: "adapter-started" }
  | { type: "adapter-ended"; now: number }
  | { type: "adapter-error"; kind: SpeakIssue }
  | { type: "stop-requested" }
  | { type: "invalidate" };

export interface SpeakView {
  phase: SpeakPhase;
  speakingKey: string | null;
  note: string | null;
  canSpeak: boolean;
}

export function createSpeakState(): SpeakState {
  return {
    phase: "idle",
    key: null,
    kind: null,
    text: null,
    issue: null,
    lastCompletedKey: null,
    lastCompletedAt: 0,
  };
}

export function speakKeyOf(request: SpeakRequest): string {
  return `${request.kind}:${request.text}`;
}

export function speakReducer(state: SpeakState, event: SpeakEvent): SpeakState {
  switch (event.type) {
    case "speak-requested": {
      if (!event.check.allowed) {
        if (event.check.reason === "sensitive") {
          return {
            ...state,
            phase: "sensitive-skipped",
            key: null,
            kind: null,
            text: null,
            issue: "sensitive",
          };
        }
        return state;
      }
      if (!event.supported) {
        return { ...state, phase: "unsupported", key: null, issue: null };
      }
      const key = speakKeyOf(event.request);
      if (state.phase === "speaking" && state.key === key) {
        return state;
      }
      if (
        state.lastCompletedKey === key &&
        event.now - state.lastCompletedAt < SPEECH_REPEAT_WINDOW_MS
      ) {
        return state;
      }
      return {
        ...state,
        phase: "speaking",
        key,
        kind: event.request.kind,
        text: event.request.text,
        issue: null,
      };
    }
    case "adapter-started":
      return state.phase === "speaking" ? state : state;
    case "adapter-ended":
      if (state.phase !== "speaking") {
        return state;
      }
      return {
        ...state,
        phase: "idle",
        key: null,
        kind: null,
        text: null,
        lastCompletedKey: state.key,
        lastCompletedAt: event.now,
      };
    case "adapter-error":
      if (state.phase !== "speaking") {
        return state;
      }
      return { ...state, phase: "failed", issue: event.kind, key: null };
    case "stop-requested":
      if (state.phase !== "speaking") {
        return state;
      }
      return { ...state, phase: "idle", key: null, kind: null, text: null, issue: null };
    case "invalidate":
      if (
        state.phase === "idle" &&
        state.key === null &&
        state.issue === null
      ) {
        return state;
      }
      return {
        ...state,
        phase: "idle",
        key: null,
        kind: null,
        text: null,
        issue: null,
      };
    default:
      return state;
  }
}

export function describeSpeak(state: SpeakState): SpeakView {
  let note: string | null = null;
  if (state.phase === "sensitive-skipped") {
    note = SPEAK_NOTE_TEXT.sensitive;
  } else if (state.phase === "failed") {
    note = state.issue === "interrupted" ? SPEAK_NOTE_TEXT.interrupted : SPEAK_NOTE_TEXT["start-failed"];
  } else if (state.phase === "unsupported") {
    note = SPEAK_UNAVAILABLE_TEXT;
  }
  return {
    phase: state.phase,
    speakingKey: state.phase === "speaking" ? state.key : null,
    note,
    canSpeak: state.phase !== "unsupported",
  };
}