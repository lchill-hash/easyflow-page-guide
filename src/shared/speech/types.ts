export type RecognitionSupport = "supported" | "unsupported";

export type RawSpeechErrorKind =
  | "no-speech"
  | "network"
  | "not-allowed"
  | "service-not-allowed"
  | "audio-capture"
  | "other";

export type RecognitionMode = "service" | "local";

export type RawErrorCode =
  | "no-speech"
  | "network"
  | "not-allowed"
  | "service-not-allowed"
  | "audio-capture"
  | "language-not-supported"
  | "aborted"
  | "unmapped";

export type ErrorSource = "none" | "onerror" | "onend" | "timeout" | "cancel";

export type SpeechErrorKind =
  | "unsupported"
  | "permission-denied"
  | "service-limited"
  | "no-audio-device"
  | "device-unavailable"
  | "no-speech"
  | "network"
  | "aborted"
  | "unknown";

export interface SpeechStartOptions {
  lang: "zh-CN";
  singleShot: true;
  interimResults: false;
  processLocally?: boolean;
}

export type RecognitionEvent =
  | { type: "started" }
  | { type: "browser-start" }
  | { type: "final"; text: string }
  | {
      type: "error";
      kind: SpeechErrorKind;
      raw?: RawSpeechErrorKind;
      code?: RawErrorCode;
      errorSource?: "onerror" | "adapter";
    }
  | { type: "ended" };

export interface RecognitionAdapter {
  start(options: SpeechStartOptions): void;
  cancel(): void;
  subscribe(listener: (event: RecognitionEvent) => void): () => void;
  dispose(): void;
}

export interface RecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

export interface RecognitionResultItemLike {
  isFinal?: boolean;
  length: number;
  [index: number]: RecognitionAlternativeLike | undefined;
}

export interface RecognitionResultsLike {
  length: number;
  [index: number]: RecognitionResultItemLike | undefined;
}

export interface RecognitionResultEventLike {
  resultIndex?: number;
  results: RecognitionResultsLike;
}

export interface RecognitionErrorLike {
  error?: string;
  message?: string;
}

export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  abort(): void;
  processLocally?: boolean;
}

export interface RecognitionCtorLike {
  new (): RecognitionLike;
}

export type TranscriptMerge =
  | { ok: true; text: string }
  | { ok: false; reason: "too-long" };

export type SpeakTextCheck =
  | { allowed: true; text: string }
  | { allowed: false; reason: "empty" | "sensitive" };

export interface SpeakOptions {
  text: string;
  lang: "zh-CN";
  rate: number;
}

export type SynthesisEvent =
  | { type: "started" }
  | { type: "ended" }
  | { type: "error"; kind: "unsupported" | "interrupted" | "unknown" };

export interface SynthesisAdapter {
  speak(options: SpeakOptions): void;
  stop(): void;
  subscribe(listener: (event: SynthesisEvent) => void): () => void;
  dispose(): void;
}

export interface SpeechVoiceLike {
  name: string;
  lang: string;
  default?: boolean;
}

export interface UtteranceLike {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  voice: SpeechVoiceLike | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
}

export interface UtteranceCtorLike {
  new (text: string): UtteranceLike;
}

export interface SynthesisLike {
  getVoices(): SpeechVoiceLike[];
  speak(utterance: UtteranceLike): void;
  cancel(): void;
}

export type VoiceInputPhase =
  | "idle"
  | "listening"
  | "recognized"
  | "no-speech"
  | "permission-denied"
  | "unsupported"
  | "failed"
  | "cancelled";

export type VoiceInputIssue =
  | "no-audio-device"
  | "service-limited"
  | "device-unavailable"
  | "network"
  | "timeout"
  | "too-long"
  | "interrupted"
  | "permission-conflict";

export type SpeakTextKind = "step-action" | "direct-answer";

export type SpeechSpeed = "normal" | "slow";

export interface SpeakRequest {
  kind: SpeakTextKind;
  text: string;
}

export type SpeakPhase = "idle" | "speaking" | "unsupported" | "failed" | "sensitive-skipped";

export type SpeakIssue = "sensitive" | "interrupted" | "start-failed";
