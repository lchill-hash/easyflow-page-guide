import { SPEECH_DIAGNOSTICS_TEXTS, SPEECH_MODE_TEXTS } from "./copy";
import { describeInstallOutcomeText } from "./installReport";
import type { InstallOutcome, LocalAvailability } from "./localCapability";
import type { MicPermissionState } from "./permission";
import type {
  ErrorSource,
  RawErrorCode,
  RawSpeechErrorKind,
  RecognitionMode,
} from "./types";

export interface SpeechDiagnosticsInput {
  permission: MicPermissionState;
  permissionCheckedAt: number | null;
  lastRawErrorKind: RawSpeechErrorKind | null;
  lastRawErrorCode: RawErrorCode | null;
  lastErrorSource: ErrorSource;
  lastRawErrorAt: number | null;
  lastRawErrorTimedOut: boolean;
  browserOnstart: "not-started" | "reached" | "ended-without-start";
  listening: boolean;
  localApiPresent: boolean | null;
  localAvailability: LocalAvailability | "checking";
  localCheckedAt: number | null;
  installState: import("./localCapability").InstallState;
  installOutcome: InstallOutcome;
  installErrorName: string | null;
  installErrorBrief: string | null;
  mode: RecognitionMode;
}

export interface SpeechDiagnosticsView {
  permissionText: string;
  permissionCheckedAgo: string;
  lastErrorText: string;
  lastErrorAgo: string;
  listeningText: string;
  onstartText: string;
  localApiText: string;
  localAvailabilityText: string;
  localCheckedAgo: string;
  installStateText: string;
  installOutcomeText: string;
  modeText: string;
  rawErrorCodeText: string;
}

export const PERMISSION_DIAG_LABEL: Record<MicPermissionState, string> = {
  granted: "已授权",
  prompt: "待询问",
  denied: "已拒绝",
  unknown: "未知",
  unsupported: "当前环境无法查询",
};

export const RAW_ERROR_LABEL: Record<RawSpeechErrorKind, string> = {
  "no-speech": "没有听到语音",
  network: "浏览器语音服务连接失败",
  "not-allowed": "浏览器拒绝本次识别",
  "service-not-allowed": "语音服务被限制",
  "audio-capture": "未检测到麦克风",
  other: "其他识别失败",
};

export const RAW_ERROR_CODE_LABEL: Record<RawErrorCode, string> = {
  "no-speech": "no-speech",
  network: "network",
  "not-allowed": "not-allowed",
  "service-not-allowed": "service-not-allowed",
  "audio-capture": "audio-capture",
  "language-not-supported": "language-not-supported",
  aborted: "aborted",
  unmapped: "其他（未映射）",
};

export const LOCAL_AVAILABILITY_LABEL: Record<LocalAvailability, string> = {
  available: "可用",
  downloadable: "可下载（或正在下载）",
  unavailable: "暂不支持中文",
  "unsupported-not-called": "未调用（不支持）",
  error: "无法判断",
};

export const INSTALL_STATE_LABEL: Record<
  import("./localCapability").InstallState,
  string
> = {
  idle: "未开始",
  requesting: "正在准备",
  succeeded: "已准备",
  failed: "准备失败",
  denied: "被拒绝",
  unsupported: "不支持",
};

export const ONSTART_LABEL = {
  reached: "是",
  "not-started": "否（未开始）",
  "ended-without-start": "否（会话已结束）",
} as const;

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export function formatRelativeTime(now: number, at: number | null): string {
  if (at === null) {
    return "未检测";
  }
  const diff = Math.max(0, now - at);
  if (diff < MINUTE_MS) {
    return "刚刚";
  }
  if (diff < HOUR_MS) {
    return `${Math.floor(diff / MINUTE_MS)} 分钟前`;
  }
  return "较早";
}

function lastErrorTextOf(input: SpeechDiagnosticsInput): string {
  switch (input.lastErrorSource) {
    case "onend":
      return SPEECH_DIAGNOSTICS_TEXTS.sessionEnded;
    case "timeout":
      return SPEECH_DIAGNOSTICS_TEXTS.timedOut;
    case "cancel":
      return SPEECH_DIAGNOSTICS_TEXTS.cancelled;
    case "onerror":
      if (input.lastRawErrorCode === "aborted") {
        return SPEECH_DIAGNOSTICS_TEXTS.interrupted;
      }
      return RAW_ERROR_LABEL[input.lastRawErrorKind ?? "other"];
    default:
      return SPEECH_DIAGNOSTICS_TEXTS.noError;
  }
}

function rawErrorCodeTextOf(input: SpeechDiagnosticsInput): string {
  if (input.lastErrorSource === "none") {
    return SPEECH_DIAGNOSTICS_TEXTS.noError;
  }
  if (input.lastRawErrorCode === null) {
    return SPEECH_DIAGNOSTICS_TEXTS.notProvided;
  }
  return RAW_ERROR_CODE_LABEL[input.lastRawErrorCode];
}

export function describeSpeechDiagnostics(
  input: SpeechDiagnosticsInput,
  now: number,
): SpeechDiagnosticsView {
  const localAvailabilityText =
    input.localAvailability === "checking"
      ? "检测中…"
      : LOCAL_AVAILABILITY_LABEL[input.localAvailability];
  return {
    permissionText: PERMISSION_DIAG_LABEL[input.permission],
    permissionCheckedAgo: formatRelativeTime(now, input.permissionCheckedAt),
    lastErrorText: lastErrorTextOf(input),
    lastErrorAgo: formatRelativeTime(now, input.lastRawErrorAt),
    listeningText: input.listening ? "是" : "否",
    onstartText: ONSTART_LABEL[input.browserOnstart],
    localApiText:
      input.localApiPresent === null
        ? "未检测"
        : input.localApiPresent
          ? "存在"
          : "不存在",
    localAvailabilityText,
    localCheckedAgo: formatRelativeTime(now, input.localCheckedAt),
    installStateText: INSTALL_STATE_LABEL[input.installState],
    installOutcomeText: describeInstallOutcomeText({
      outcome: input.installOutcome,
      errorName: input.installErrorName,
      errorBrief: input.installErrorBrief,
    }),
    modeText: SPEECH_MODE_TEXTS[input.mode],
    rawErrorCodeText: rawErrorCodeTextOf(input),
  };
}