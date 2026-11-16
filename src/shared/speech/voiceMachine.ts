import {
  MIC_ENTRY_LABEL,
  MIC_ENTRY_PURPOSE_TEXT,
  MIC_PAGE_OPEN_FAILED_TEXT,
  MIC_PAGE_OPENED_TEXT,
  MIC_PERMISSION_DENIED_TEXT,
  MIC_PERMISSION_STATE_TEXT,
  MIC_SETTING_HELP_TEXT,
  SPEECH_LOCAL_TEXTS,
  VOICE_BUTTON_TEXT,
  VOICE_STATUS_TEXT,
  speechIssueText,
} from "./copy";
import { describeSpeechDiagnostics } from "./diagnostics";
import type { SpeechDiagnosticsView } from "./diagnostics";
import type {
  InstallOutcome,
  InstallOutcomeDetail,
  InstallState,
  LocalAvailability,
} from "./localCapability";
import { installStateOf } from "./localCapability";
import type { MicPermissionState } from "./permission";
import { rawKindOfSpeechError, resolveRecognitionFailure } from "./policy";
import type {
  ErrorSource,
  RawErrorCode,
  RawSpeechErrorKind,
  RecognitionMode,
  SpeechErrorKind,
  TranscriptMerge,
  VoiceInputIssue,
  VoiceInputPhase,
} from "./types";

export type BrowserOnstartState = "not-started" | "reached" | "ended-without-start";
export type InstallFlow = "idle" | "installing" | "rechecking";

export interface VoiceInputState {
  phase: VoiceInputPhase;
  issue: VoiceInputIssue | null;
  revision: number;
  pendingText: string | null;
  disclosureShown: boolean;
  permission: MicPermissionState;
  permissionCheckedAt: number | null;
  pageOpened: boolean;
  micPageFailed: boolean;
  micGate: boolean;
  mode: RecognitionMode;
  lastRawErrorKind: RawSpeechErrorKind | null;
  lastRawErrorAt: number | null;
  lastRawErrorTimedOut: boolean;
  browserOnstart: BrowserOnstartState;
  localApiPresent: boolean | null;
  localAvailability: LocalAvailability | "checking";
  localCheckedAt: number | null;
  installState: InstallState;
  installAttempts: number;
  lastRawErrorCode: RawErrorCode | null;
  lastErrorSource: ErrorSource;
  installOutcome: InstallOutcome;
  installErrorName: string | null;
  installErrorBrief: string | null;
  installFlow: InstallFlow;
  installResultAt: number | null;
}

export type VoiceInputEvent =
  | { type: "start-requested"; supported: boolean }
  | { type: "adapter-started" }
  | { type: "adapter-final"; merge: TranscriptMerge }
  | {
      type: "adapter-error";
      kind: SpeechErrorKind;
      cancelledByUser: boolean;
      raw?: RawSpeechErrorKind;
      code?: RawErrorCode;
      errorSource?: "onerror" | "adapter";
      at?: number;
    }
  | { type: "adapter-ended"; at?: number }
  | { type: "timeout"; at?: number }
  | { type: "cancel-requested" }
  | { type: "composer-consumed" }
  | { type: "invalidate" }
  | { type: "permission-refreshed"; state: MicPermissionState; at: number }
  | { type: "mic-gate" }
  | { type: "mic-page-opened"; at: number }
  | { type: "mic-page-failed" }
  | { type: "browser-start" }
  | { type: "local-capability-checking" }
  | {
      type: "local-capability-checked";
      apiPresent: boolean;
      availability: LocalAvailability;
      at: number;
    }
  | { type: "install-state-changed"; state: InstallState }
  | { type: "install-flow-changed"; flow: InstallFlow }
  | { type: "install-settled"; detail: InstallOutcomeDetail; at: number }
  | { type: "mode-changed"; mode: RecognitionMode };

export interface VoiceInputView {
  phase: VoiceInputPhase;
  statusText: string;
  buttonLabel: string;
  canStart: boolean;
  canCancel: boolean;
  showDisclosure: boolean;
  pendingText: string | null;
  revision: number;
  permission: MicPermissionState;
  permissionCheckedAt: number | null;
  showMicEntry: boolean;
  micEntryLabel: string;
  micEntryPurpose: string;
  settingHelpText: string | null;
  pageOpened: boolean;
  micPageFailed: boolean;
  mode: RecognitionMode;
  showModeSelector: boolean;
  localOptionVisible: boolean;
  installButtonVisible: boolean;
  installInProgress: boolean;
  localNoticeText: string | null;
  diagnostics: SpeechDiagnosticsView;
}

export function createVoiceInputState(): VoiceInputState {
  return {
    phase: "idle",
    issue: null,
    revision: 0,
    pendingText: null,
    disclosureShown: false,
    permission: "unknown",
    permissionCheckedAt: null,
    pageOpened: false,
    micPageFailed: false,
    micGate: false,
    mode: "service",
    lastRawErrorKind: null,
    lastRawErrorAt: null,
    lastRawErrorTimedOut: false,
    browserOnstart: "not-started",
    localApiPresent: null,
    localAvailability: "checking",
    localCheckedAt: null,
    installState: "idle",
    installAttempts: 0,
    lastRawErrorCode: null,
    lastErrorSource: "none",
    installOutcome: "none",
    installErrorName: null,
    installErrorBrief: null,
    installFlow: "idle",
    installResultAt: null,
  };
}

export function voiceInputReducer(
  state: VoiceInputState,
  event: VoiceInputEvent,
): VoiceInputState {
  switch (event.type) {
    case "start-requested":
      if (!event.supported) {
        return {
          ...state,
          phase: "unsupported",
          issue: null,
          pendingText: null,
          disclosureShown: true,
        };
      }
      if (state.phase === "listening") {
        return state;
      }
      return {
        ...state,
        phase: "listening",
        issue: null,
        disclosureShown: true,
        browserOnstart: "not-started",
      };
    case "browser-start":
      if (state.phase !== "listening" || state.browserOnstart === "reached") {
        return state;
      }
      return { ...state, browserOnstart: "reached" };
    case "adapter-final":
      if (state.phase !== "listening") {
        return state;
      }
      if (!event.merge.ok) {
        return { ...state, phase: "failed", issue: "too-long", pendingText: null };
      }
      return {
        ...state,
        phase: "recognized",
        issue: null,
        pendingText: event.merge.text,
        revision: state.revision + 1,
      };
    case "adapter-error": {
      if (state.phase !== "listening") {
        return state;
      }
      const raw = event.raw ?? rawKindOfSpeechError(event.kind);
      const diagnosis = {
        lastRawErrorKind: raw,
        lastRawErrorAt: event.at ?? state.lastRawErrorAt,
        lastRawErrorTimedOut: false,
      };
      if (event.errorSource === "adapter") {
        const outcome = resolveRecognitionFailure({
          permission: state.permission,
          kind: event.kind,
          raw,
        });
        return {
          ...state,
          ...diagnosis,
          phase: outcome.phase,
          issue: outcome.issue,
          pendingText: null,
          micGate: outcome.gate ? true : state.micGate,
        };
      }
      if (event.kind === "aborted" && event.cancelledByUser) {
        return {
          ...state,
          ...diagnosis,
          lastErrorSource: "cancel",
          lastRawErrorCode: null,
          phase: "cancelled",
          issue: null,
          pendingText: null,
        };
      }
      if (event.kind === "aborted") {
        return {
          ...state,
          ...diagnosis,
          lastErrorSource: "onerror",
          lastRawErrorCode: event.code ?? null,
          phase: "cancelled",
          issue: "interrupted",
          pendingText: null,
        };
      }
      const outcome = resolveRecognitionFailure({
        permission: state.permission,
        kind: event.kind,
        raw,
      });
      return {
        ...state,
        ...diagnosis,
        lastErrorSource: "onerror",
        lastRawErrorCode: event.code ?? null,
        phase: outcome.phase,
        issue: outcome.issue,
        pendingText: null,
        micGate: outcome.gate ? true : state.micGate,
      };
    }
    case "adapter-ended":
      if (state.phase !== "listening") {
        return state;
      }
      return {
        ...state,
        phase: "no-speech",
        issue: null,
        pendingText: null,
        lastErrorSource: "onend",
        lastRawErrorCode: null,
        lastRawErrorKind: "no-speech",
        lastRawErrorTimedOut: false,
        lastRawErrorAt: event.at ?? state.lastRawErrorAt,
        browserOnstart:
          state.browserOnstart === "not-started" ? "ended-without-start" : state.browserOnstart,
      };
    case "timeout":
      if (state.phase !== "listening") {
        return state;
      }
      return {
        ...state,
        phase: "no-speech",
        issue: "timeout",
        pendingText: null,
        lastErrorSource: "timeout",
        lastRawErrorCode: null,
        lastRawErrorKind: "other",
        lastRawErrorTimedOut: true,
        lastRawErrorAt: event.at ?? state.lastRawErrorAt,
        browserOnstart:
          state.browserOnstart === "not-started" ? "ended-without-start" : state.browserOnstart,
      };
    case "cancel-requested":
      if (state.phase !== "listening") {
        return state;
      }
      return {
        ...state,
        phase: "cancelled",
        issue: null,
        pendingText: null,
        lastErrorSource: "cancel",
        lastRawErrorCode: null,
      };
    case "composer-consumed":
      if (state.pendingText === null) {
        return state;
      }
      return { ...state, pendingText: null };
    case "permission-refreshed": {
      const granted = event.state === "granted";
      return {
        ...state,
        permission: event.state,
        permissionCheckedAt: event.at,
        issue: granted ? null : state.issue,
        micGate: granted ? false : state.micGate,
        phase: granted && state.phase === "permission-denied" ? "idle" : state.phase,
      };
    }
    case "mic-gate":
      if (state.permission === "granted" || state.micGate) {
        return state;
      }
      return { ...state, micGate: true };
    case "mic-page-opened":
      return {
        ...state,
        pageOpened: true,
        micPageFailed: false,
        permissionCheckedAt: event.at,
      };
    case "mic-page-failed":
      if (state.micPageFailed) {
        return state;
      }
      return { ...state, micPageFailed: true };
    case "local-capability-checking":
      if (state.localAvailability === "checking") {
        return state;
      }
      return { ...state, localAvailability: "checking" };
    case "local-capability-checked":
      return {
        ...state,
        localApiPresent: event.apiPresent,
        localAvailability: event.availability,
        localCheckedAt: event.at,
      };
    case "install-state-changed":
      return {
        ...state,
        installState: event.state,
        installAttempts:
          event.state === "requesting" ? state.installAttempts + 1 : state.installAttempts,
      };
    case "install-flow-changed":
      if (state.installFlow === event.flow) {
        return state;
      }
      return { ...state, installFlow: event.flow };
    case "install-settled":
      return {
        ...state,
        installOutcome: event.detail.outcome,
        installErrorName: event.detail.errorName,
        installErrorBrief: event.detail.errorBrief,
        installState: installStateOf(event.detail),
        installResultAt: event.at,
      };
    case "mode-changed":
      if (state.mode === event.mode) {
        return state;
      }
      return { ...state, mode: event.mode };
    case "invalidate":
      if (
        state.phase === "idle" &&
        state.issue === null &&
        state.pendingText === null &&
        !state.micGate &&
        !state.micPageFailed
      ) {
        return state;
      }
      return {
        ...state,
        phase: "idle",
        issue: null,
        pendingText: null,
        micGate: false,
        micPageFailed: false,
      };
    default:
      return state;
  }
}

function localNoticeOf(state: VoiceInputState): string | null {
  if (state.installFlow === "installing") {
    return SPEECH_LOCAL_TEXTS.installing;
  }
  if (state.mode === "local" && state.localAvailability !== "available") {
    return SPEECH_LOCAL_TEXTS.modeUnavailable;
  }
  if (state.installOutcome === "returned-false") {
    return SPEECH_LOCAL_TEXTS.installReturnedFalse;
  }
  if (state.installOutcome === "returned-unknown") {
    return SPEECH_LOCAL_TEXTS.installReturnedUnknown;
  }
  if (state.installOutcome === "threw") {
    return SPEECH_LOCAL_TEXTS.installThrew;
  }
  if (state.installOutcome === "unsupported") {
    return SPEECH_LOCAL_TEXTS.installUnsupported;
  }
  if (state.installOutcome === "succeeded" && state.localAvailability === "downloadable") {
    return SPEECH_LOCAL_TEXTS.stillDownloadable;
  }
  if (state.localAvailability === "downloadable") {
    return SPEECH_LOCAL_TEXTS.downloadable;
  }
  if (state.localAvailability === "unavailable" || state.localAvailability === "unsupported-not-called") {
    return SPEECH_LOCAL_TEXTS.unavailable;
  }
  if (state.localAvailability === "error") {
    return SPEECH_LOCAL_TEXTS.error;
  }
  return null;
}

export function describeVoiceInput(state: VoiceInputState, now = 0): VoiceInputView {
  const issueText = state.issue === null ? "" : speechIssueText(state.issue, state.permission);
  let statusText = issueText;
  if (statusText.length === 0) {
    if (state.micPageFailed) {
      statusText = MIC_PAGE_OPEN_FAILED_TEXT;
    } else if (state.pageOpened && state.permission !== "granted") {
      statusText = MIC_PAGE_OPENED_TEXT;
    } else if (state.permission === "denied") {
      statusText = MIC_PERMISSION_DENIED_TEXT;
    } else if (state.micGate && state.permission !== "granted") {
      statusText = MIC_PERMISSION_STATE_TEXT[state.permission];
    } else {
      statusText = VOICE_STATUS_TEXT[state.phase];
    }
  }
  const diagnostics = describeSpeechDiagnostics(
    {
      permission: state.permission,
      permissionCheckedAt: state.permissionCheckedAt,
      lastRawErrorKind: state.lastRawErrorKind,
      lastRawErrorCode: state.lastRawErrorCode,
      lastErrorSource: state.lastErrorSource,
      lastRawErrorAt: state.lastRawErrorAt,
      lastRawErrorTimedOut: state.lastRawErrorTimedOut,
      browserOnstart: state.browserOnstart,
      listening: state.phase === "listening",
      localApiPresent: state.localApiPresent,
      localAvailability: state.localAvailability,
      localCheckedAt: state.localCheckedAt,
      installState: state.installState,
      installOutcome: state.installOutcome,
      installErrorName: state.installErrorName,
      installErrorBrief: state.installErrorBrief,
      mode: state.mode,
    },
    now,
  );
  const installFlow = state.installFlow;
  const installButtonVisible =
    installFlow !== "idle"
      ? state.installOutcome !== "unsupported"
      : state.localAvailability === "downloadable" &&
        state.installOutcome !== "unsupported";
  return {
    phase: state.phase,
    statusText,
    buttonLabel: VOICE_BUTTON_TEXT[state.phase],
    canStart: state.phase !== "unsupported",
    canCancel: state.phase === "listening",
    showDisclosure: state.disclosureShown,
    pendingText: state.pendingText,
    revision: state.revision,
    permission: state.permission,
    permissionCheckedAt: state.permissionCheckedAt,
    showMicEntry:
      state.permissionCheckedAt !== null &&
      state.permission !== "granted" &&
      state.phase !== "listening",
    micEntryLabel: MIC_ENTRY_LABEL,
    micEntryPurpose: MIC_ENTRY_PURPOSE_TEXT,
    settingHelpText: state.permission === "denied" ? MIC_SETTING_HELP_TEXT : null,
    pageOpened: state.pageOpened,
    micPageFailed: state.micPageFailed,
    mode: state.mode,
    showModeSelector: state.localApiPresent === true,
    localOptionVisible:
      state.localApiPresent === true && state.localAvailability === "available",
    installButtonVisible,
    installInProgress: installFlow !== "idle",
    localNoticeText: localNoticeOf(state),
    diagnostics,
  };
}