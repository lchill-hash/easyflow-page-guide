import {
  LOCAL_AVAILABILITY_LANGS,
  LOCAL_CAPABILITY_TIMEOUT_MS,
  LOCAL_INSTALL_LANGS,
} from "../../shared/speech/constants";
import { readInstallErrorDetail } from "../../shared/speech/installReport";
import {
  mapInstallOutcome,
  mapLocalAvailability,
} from "../../shared/speech/localCapability";
import type {
  InstallOutcomeDetail,
  LocalAvailability,
  LocalRecognitionApiLike,
} from "../../shared/speech/localCapability";

export interface LocalCapabilityProbe {
  check(): Promise<LocalAvailability>;
}

export interface LocalInstaller {
  install(): Promise<InstallOutcomeDetail>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function readLocalRecognitionApi(scope: unknown): LocalRecognitionApiLike | null {
  const root = asRecord(scope);
  if (root === null) {
    return null;
  }
  const candidate = root["SpeechRecognition"] ?? root["webkitSpeechRecognition"];
  if (typeof candidate !== "function") {
    return null;
  }
  const ctor = candidate as unknown as Record<string, unknown>;
  const available = ctor["available"];
  if (typeof available !== "function") {
    return null;
  }
  const install = ctor["install"];
  const api: LocalRecognitionApiLike = {
    available(options): Promise<unknown> {
      return (available as (this: unknown, next: typeof options) => Promise<unknown>).call(
        candidate,
        options,
      );
    },
  };
  if (typeof install === "function") {
    api.install = (options): Promise<unknown> =>
      (install as (this: unknown, next: typeof options) => Promise<unknown>).call(
        candidate,
        options,
      );
  }
  return api;
}

export function createLocalCapabilityProbe(
  api: LocalRecognitionApiLike | null,
  deps: { timeoutMs?: number } = {},
): LocalCapabilityProbe {
  const timeoutMs = deps.timeoutMs ?? LOCAL_CAPABILITY_TIMEOUT_MS;
  return {
    async check(): Promise<LocalAvailability> {
      if (api === null) {
        return "unsupported-not-called";
      }
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        const result = await Promise.race([
          api.available({ langs: LOCAL_AVAILABILITY_LANGS, processLocally: true }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error("local capability timeout"));
            }, timeoutMs);
          }),
        ]);
        return mapLocalAvailability(result);
      } catch {
        return "error";
      } finally {
        if (timer !== null) {
          clearTimeout(timer);
        }
      }
    },
  };
}

export function createLocalInstaller(api: LocalRecognitionApiLike | null): LocalInstaller {
  return {
    async install(): Promise<InstallOutcomeDetail> {
      if (api === null || api.install === undefined) {
        return { outcome: "unsupported", errorName: null, errorBrief: null };
      }
      const install = api.install;
      try {
        const raw = await install.call(api, { langs: LOCAL_INSTALL_LANGS });
        return { outcome: mapInstallOutcome(raw), errorName: null, errorBrief: null };
      } catch (error) {
        const detail = readInstallErrorDetail(error);
        return {
          outcome: "threw",
          errorName: detail.errorName,
          errorBrief: detail.errorBrief,
        };
      }
    },
  };
}