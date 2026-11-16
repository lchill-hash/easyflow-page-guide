import { mapMicRequestError, releaseStream } from "../shared/speech/permission";
import type { MediaStreamLike, MicRequestOutcome } from "../shared/speech/permission";

interface MediaDevicesLike {
  getUserMedia(constraints: { audio: true }): Promise<MediaStreamLike>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function readMediaDevices(scope: unknown): MediaDevicesLike | null {
  const root = asRecord(scope);
  if (root === null) {
    return null;
  }
  const navigatorLike = asRecord(root["navigator"]);
  if (navigatorLike === null) {
    return null;
  }
  const mediaDevices = asRecord(navigatorLike["mediaDevices"]);
  if (mediaDevices === null) {
    return null;
  }
  const request = mediaDevices["getUserMedia"];
  if (typeof request !== "function") {
    return null;
  }
  const requestFn = request as (
    this: unknown,
    constraints: { audio: true },
  ) => Promise<MediaStreamLike>;
  return {
    getUserMedia(constraints: { audio: true }) {
      return requestFn.call(mediaDevices, constraints);
    },
  };
}

export async function requestMicrophone(
  media: MediaDevicesLike | null,
): Promise<MicRequestOutcome> {
  if (media === null) {
    return "unsupported";
  }
  try {
    const stream = await media.getUserMedia({ audio: true });
    releaseStream(stream);
    return "granted";
  } catch (error) {
    return mapMicRequestError(error);
  }
}