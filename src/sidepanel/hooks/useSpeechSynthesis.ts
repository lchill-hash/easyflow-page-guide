import { useEffect, useRef, useSyncExternalStore } from "react";
import { detectSynthesisSupport } from "../../shared/speech/policy";
import type { SpeakRequest, SpeechSpeed } from "../../shared/speech/types";
import { SpeechController } from "../speech/speechController";
import { createSynthesisAdapter } from "../speech/synthesis";

export interface SpeechUi {
  supported: boolean;
  speakingKey: string | null;
  note: string | null;
  replayKey: string | null;
  canReplay: boolean;
  speed: SpeechSpeed;
  phase: "idle" | "speaking" | "unsupported" | "failed" | "sensitive-skipped";
  isSpeaking: (key: string) => boolean;
  speak: (request: SpeakRequest) => void;
  stop: () => void;
  replay: () => void;
  setSpeed: (speed: SpeechSpeed) => void;
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
    replayKey: view.replayKey,
    canReplay: view.canReplay,
    speed: view.speed,
    phase: view.phase,
    isSpeaking: (key: string) => view.speakingKey === key,
    speak: (request: SpeakRequest) => {
      controller.speak(request);
    },
    stop: () => {
      controller.stop();
    },
    replay: () => {
      controller.replay();
    },
    setSpeed: (speed: SpeechSpeed) => {
      controller.setSpeed(speed);
    },
    invalidate: () => {
      controller.invalidate();
    },
  };
}
