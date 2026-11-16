import { useEffect, useRef, useSyncExternalStore } from "react";
import { detectSynthesisSupport } from "../../shared/speech/policy";
import type { SpeakRequest } from "../../shared/speech/types";
import { SpeechController } from "../speech/speechController";
import { createSynthesisAdapter } from "../speech/synthesis";

export interface SpeechUi {
  supported: boolean;
  speakingKey: string | null;
  note: string | null;
  phase: "idle" | "speaking" | "unsupported" | "failed" | "sensitive-skipped";
  isSpeaking: (key: string) => boolean;
  speak: (request: SpeakRequest) => void;
  stop: () => void;
  invalidate: () => void;
}

export function useSpeechSynthesis(): SpeechUi {
  const supportedRef = useRef(detectSynthesisSupport(globalThis) === "supported");
  const ref = useRef<SpeechController | null>(null);
  if (ref.current === null) {
    ref.current = new SpeechController({
      adapter: supportedRef.current ? createSynthesisAdapter() : null,
    });
  }
  const controller = ref.current;
  const view = useSyncExternalStore(
    controller.subscribe,
    controller.getView,
    controller.getView,
  );

  useEffect(() => {
    return () => {
      controller.stop();
      controller.dispose();
    };
  }, [controller]);

  return {
    supported: supportedRef.current,
    speakingKey: view.speakingKey,
    note: view.note,
    phase: view.phase,
    isSpeaking: (key: string) => view.speakingKey === key,
    speak: (request: SpeakRequest) => {
      controller.speak(request);
    },
    stop: () => {
      controller.stop();
    },
    invalidate: () => {
      controller.invalidate();
    },
  };
}