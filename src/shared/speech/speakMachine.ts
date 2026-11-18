import { SPEECH_REPEAT_WINDOW_MS } from "./constants";
import { SPEAK_NOTE_TEXT, SPEAK_UNAVAILABLE_TEXT } from "./copy";
import type {
  SpeakIssue,
  SpeakPhase,
  SpeakRequest,
  SpeakTextCheck,
  SpeakTextKind,
  SpeechSpeed,
} from "./types";

export interface SpeakState {
  phase: SpeakPhase;
  key: string | null;
  kind: SpeakTextKind | null;
  text: string | null;
  issue: SpeakIssue | null;
  lastCompletedKey: string | null;
  lastCompletedAt: number;
  replayRequest: SpeakRequest | null;
  speed: SpeechSpeed;
}

export type SpeakEvent =
  | {
      type: "speak-requested";
      request: SpeakRequest;
      check: SpeakTextCheck;
      supported: boolean;
      now: number;
      replay?: boolean;
    }
  | { type: "adapter-started" }
  | { type: "adapter-ended"; now: number }
  | { type: "adapter-error"; kind: SpeakIssue }
  | { type: "stop-requested" }
  | { type: "speed-changed"; speed: SpeechSpeed }
  | { type: "invalidate" };

export interface SpeakView {
  phase: SpeakPhase;
  speakingKey: string | null;
  note: string | null;
  canSpeak: boolean;
  replayKey: string | null;
  canReplay: boolean;
  speed: SpeechSpeed;
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
    replayRequest: null,
    speed: "normal",
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
            replayRequest: null,
          };
        }
        return state;
      }
      if (!event.supported) {
        return { ...state, phase: "unsupported", key: null, issue: null };
      }
      const key = speakKeyOf(event.request);
      if (!event.replay && state.phase === "speaking" && state.key === key) {
        return state;
      }
      if (
        !event.replay && state.lastCompletedKey === key &&
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
        replayRequest: { ...event.request },
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
    case "speed-changed":
      return state.speed === event.speed ? state : { ...state, speed: event.speed };
    case "invalidate":
      if (
        state.phase === "idle" &&
        state.key === null &&
        state.issue === null &&
        state.replayRequest === null &&
        state.lastCompletedKey === null
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
        replayRequest: null,
        lastCompletedKey: null,
        lastCompletedAt: 0,
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
    replayKey: state.replayRequest === null ? null : speakKeyOf(state.replayRequest),
    canReplay: state.replayRequest !== null && state.phase !== "unsupported",
    speed: state.speed,
  };
}
