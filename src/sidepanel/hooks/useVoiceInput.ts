import { useEffect, useRef, useSyncExternalStore } from "react";
import { MAX_TURN_CHARS } from "../../shared/constants";
import { detectRecognitionSupport } from "../../shared/speech/policy";
import type { RecognitionMode } from "../../shared/speech/types";
import {
  createLocalCapabilityProbe,
  createLocalInstaller,
  readLocalRecognitionApi,
} from "../speech/localCapability";
import { subscribeMicPermissionResult } from "../speech/micMessages";
import { createMicPermissionPage, readMicRuntime } from "../speech/micPage";
import { createMicPermissionProbe, readMicPermissions } from "../speech/microphone";
import { createRecognitionAdapter } from "../speech/recognition";
import { VoiceController } from "../speech/voiceController";
import type { VoiceControllerView } from "../speech/voiceController";

export interface VoiceInputHandle {
  view: VoiceControllerView;
  start: () => void;
  cancel: () => void;
  invalidate: () => void;
  consumePending: () => void;
  onComposerTextChange: (text: string) => void;
  requestMicPermission: () => void;
  setMode: (mode: RecognitionMode) => void;
  installLocal: () => void;
  ensureLocalCapability: () => void;
  recheckLocalCapability: () => void;
}

export function useVoiceInput(): VoiceInputHandle {
  const ref = useRef<VoiceController | null>(null);
  if (ref.current === null) {
    const runtime = readMicRuntime(globalThis);
    const micPage = runtime === null ? undefined : createMicPermissionPage({ runtime });
    const localApi = readLocalRecognitionApi(globalThis);
    const localCapability = localApi === null ? undefined : createLocalCapabilityProbe(localApi);
    const localInstaller = localApi === null ? undefined : createLocalInstaller(localApi);
    ref.current = new VoiceController({
      adapter: createRecognitionAdapter(),
      detect: () => detectRecognitionSupport(globalThis),
      limit: MAX_TURN_CHARS,
      probe: createMicPermissionProbe(readMicPermissions(globalThis)),
      ...(micPage === undefined ? {} : { micPage }),
      ...(localCapability === undefined ? {} : { localCapability }),
      ...(localInstaller === undefined ? {} : { localInstaller }),
      now: () => Date.now(),
    });
  }
  const controller = ref.current;
  const view = useSyncExternalStore(
    controller.subscribe,
    controller.getView,
    controller.getView,
  );

  useEffect(() => {
    void controller.refreshPermission();
    const refresh = (): void => {
      void controller.refreshPermission();
    };
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    const unsubscribeMessages = subscribeMicPermissionResult((result, at) => {
      controller.applyMicResult(result, at);
    });
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribeMessages();
      controller.cancel();
      controller.dispose();
    };
  }, [controller]);

  return {
    view,
    start: () => {
      void controller.start();
    },
    cancel: () => {
      controller.cancel();
    },
    invalidate: () => {
      controller.invalidate();
    },
    consumePending: () => {
      controller.consumePending();
    },
    onComposerTextChange: (text: string) => {
      controller.setComposerText(text);
    },
    requestMicPermission: () => {
      void controller.requestMicPermission();
    },
    setMode: (mode: RecognitionMode) => {
      controller.setRecognitionMode(mode);
    },
    installLocal: () => {
      void controller.requestLocalInstall();
    },
    ensureLocalCapability: () => {
      void controller.ensureLocalCapability();
    },
    recheckLocalCapability: () => {
      void controller.recheckLocalCapability();
    },
  };
}