export const MIC_PERMISSION_STATES = [
  "unknown",
  "granted",
  "prompt",
  "denied",
  "unsupported",
] as const;

export type MicPermissionState = (typeof MIC_PERMISSION_STATES)[number];

export const MIC_REQUEST_OUTCOMES = [
  "granted",
  "permission-denied",
  "no-audio-device",
  "device-unavailable",
  "unknown",
  "unsupported",
] as const;

export type MicRequestOutcome = (typeof MIC_REQUEST_OUTCOMES)[number];

export type MicPageOpenResult = "opened" | "already-open" | "failed";

export interface MicPermissionProbe {
  query(): Promise<MicPermissionState>;
}

export interface MicPermissionPage {
  open(): Promise<MicPageOpenResult>;
}

export interface MediaStreamTrackLike {
  stop(): void;
}

export interface MediaStreamLike {
  getTracks(): readonly MediaStreamTrackLike[];
}


export function mapPermissionState(raw: unknown): MicPermissionState {
  return raw === "granted" || raw === "prompt" || raw === "denied" ? raw : "unknown";
}

function errorNameOf(raw: unknown): string {
  if (typeof raw === "string") {
    return raw;
  }
  if (typeof raw === "object" && raw !== null) {
    const name = (raw as { name?: unknown }).name;
    return typeof name === "string" ? name : "";
  }
  return "";
}

export function mapMicRequestError(raw: unknown): MicRequestOutcome {
  switch (errorNameOf(raw)) {
    case "NotAllowedError":
    case "SecurityError":
      return "permission-denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "no-audio-device";
    case "NotReadableError":
    case "TrackStartError":
      return "device-unavailable";
    default:
      return "unknown";
  }
}

export function toPermissionState(outcome: MicRequestOutcome): MicPermissionState | null {
  if (outcome === "granted") {
    return "granted";
  }
  if (outcome === "permission-denied") {
    return "denied";
  }
  return null;
}

export function releaseStream(stream: MediaStreamLike): { stopped: number; failed: number } {
  let tracks: readonly MediaStreamTrackLike[];
  try {
    tracks = stream.getTracks();
  } catch {
    return { stopped: 0, failed: 1 };
  }
  let stopped = 0;
  let failed = 0;
  for (const track of tracks) {
    try {
      track.stop();
      stopped += 1;
    } catch {
      failed += 1;
    }
  }
  return { stopped, failed };
}