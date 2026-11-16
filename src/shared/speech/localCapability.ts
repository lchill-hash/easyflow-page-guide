export const LOCAL_AVAILABILITY_STATES = [
  "available",
  "downloadable",
  "unavailable",
  "unsupported-not-called",
  "error",
] as const;

export type LocalAvailability = (typeof LOCAL_AVAILABILITY_STATES)[number];

export const INSTALL_STATES = [
  "idle",
  "requesting",
  "succeeded",
  "failed",
  "denied",
  "unsupported",
] as const;

export type InstallState = (typeof INSTALL_STATES)[number];

export const INSTALL_OUTCOMES = [
  "none",
  "requesting",
  "succeeded",
  "returned-false",
  "returned-unknown",
  "threw",
  "unsupported",
] as const;

export type InstallOutcome = (typeof INSTALL_OUTCOMES)[number];

export interface InstallOutcomeDetail {
  outcome: InstallOutcome;
  errorName: string | null;
  errorBrief: string | null;
}

export interface LocalAvailableOptions {
  langs: readonly ["zh-CN"];
  processLocally: true;
}

export interface LocalInstallOptions {
  langs: readonly ["zh-CN"];
}

export interface LocalRecognitionApiLike {
  available(options: LocalAvailableOptions): Promise<unknown>;
  install?(options: LocalInstallOptions): Promise<unknown>;
}

export function mapLocalAvailability(raw: unknown): LocalAvailability {
  if (raw === "available") {
    return "available";
  }
  if (raw === "downloadable" || raw === "downloading") {
    return "downloadable";
  }
  if (raw === "unavailable") {
    return "unavailable";
  }
  return "error";
}

export function mapInstallResult(raw: unknown): InstallState {
  if (raw === true) {
    return "succeeded";
  }
  if (typeof raw === "object" && raw !== null) {
    if ((raw as { ok?: unknown }).ok === true) {
      return "succeeded";
    }
  }
  return "failed";
}
export function mapInstallOutcome(raw: unknown): InstallOutcome {
  if (raw === true) {
    return "succeeded";
  }
  if (raw === false) {
    return "returned-false";
  }
  if (typeof raw === "object" && raw !== null) {
    try {
      if ((raw as { ok?: unknown }).ok === true) {
        return "succeeded";
      }
    } catch {
      return "returned-unknown";
    }
  }
  return "returned-unknown";
}

export function installStateOf(detail: InstallOutcomeDetail): InstallState {
  switch (detail.outcome) {
    case "succeeded":
      return "succeeded";
    case "returned-false":
    case "returned-unknown":
      return "failed";
    case "threw":
      return detail.errorName === "NotAllowedError" || detail.errorName === "SecurityError"
        ? "denied"
        : "failed";
    case "unsupported":
      return "unsupported";
    case "requesting":
      return "requesting";
    default:
      return "idle";
  }
}