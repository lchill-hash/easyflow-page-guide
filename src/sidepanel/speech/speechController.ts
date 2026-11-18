import { SPEECH_LANG, SPEECH_RATE, SPEECH_SLOW_RATE } from "../../shared/speech/constants";
import { checkSpeakText } from "../../shared/speech/policy";
import type { SpeakRequest, SpeechSpeed, SynthesisAdapter, SynthesisEvent } from "../../shared/speech/types";
import {
  createSpeakState,
  describeSpeak,
  speakReducer,
} from "../../shared/speech/speakMachine";
import type { SpeakEvent, SpeakView, SpeakState } from "../../shared/speech/speakMachine";

export interface SpeechControllerDeps {
  adapter: SynthesisAdapter | null;
  now?: () => number;
}

export type SpeechControllerView = SpeakView;

export class SpeechController {
  private readonly adapter: SynthesisAdapter | null;
  private readonly now: () => number;
  private readonly unsubscribeAdapter: () => void;
  private readonly listeners = new Set<() => void>();
  private state: SpeakState = createSpeakState();
  private viewCache: SpeechControllerView | null = null;
  private disposed = false;

  constructor(deps: SpeechControllerDeps) {
    this.adapter = deps.adapter;
    this.now = deps.now ?? (() => Date.now());
    this.unsubscribeAdapter = this.adapter?.subscribe((event) => {
      this.onAdapterEvent(event);
    }) ?? (() => undefined);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getView = (): SpeechControllerView => {
    if (this.viewCache === null) {
      this.viewCache = describeSpeak(this.state);
    }
    return this.viewCache;
  };

  speak(request: SpeakRequest): void {
    this.requestSpeak(request, false);
  }

  replay(): void {
    const request = this.state.replayRequest;
    if (request !== null) this.requestSpeak(request, true);
  }

  setSpeed(speed: SpeechSpeed): void {
    if (this.disposed || this.state.speed === speed) return;
    const restart = this.state.phase === "speaking";
    this.apply({ type: "speed-changed", speed });
    if (restart) this.replay();
  }

  private requestSpeak(request: SpeakRequest, replay: boolean): void {
    if (this.disposed) {
      return;
    }
    const previous = this.state;
    const check = checkSpeakText(request);
    const next = speakReducer(previous, {
      type: "speak-requested",
      request,
      check,
      supported: this.adapter !== null,
      now: this.now(),
      replay,
    });
    if (next === previous) {
      return;
    }
    if (previous.phase === "speaking") this.adapter?.stop();
    this.state = next;
    this.viewCache = null;
    for (const listener of this.listeners) {
      listener();
    }
    if (next.phase !== "speaking" || this.adapter === null) {
      return;
    }
    try {
      this.adapter.speak({
        text: request.text,
        lang: SPEECH_LANG,
        rate: next.speed === "slow" ? SPEECH_SLOW_RATE : SPEECH_RATE,
      });
    } catch {
      this.apply({ type: "adapter-error", kind: "start-failed" });
    }
  }

  stop(): void {
    if (this.disposed) {
      return;
    }
    const previous = this.state;
    const next = speakReducer(previous, { type: "stop-requested" });
    if (next === previous) {
      return;
    }
    this.state = next;
    this.viewCache = null;
    for (const listener of this.listeners) {
      listener();
    }
    this.adapter?.stop();
  }

  invalidate(): void {
    if (this.disposed) {
      return;
    }
    const wasSpeaking = this.state.phase === "speaking";
    const next = speakReducer(this.state, { type: "invalidate" });
    if (next === this.state) {
      return;
    }
    this.state = next;
    this.viewCache = null;
    for (const listener of this.listeners) {
      listener();
    }
    if (wasSpeaking) {
      this.adapter?.stop();
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.invalidate();
    this.disposed = true;
    this.unsubscribeAdapter();
    this.adapter?.dispose();
    this.listeners.clear();
  }

  private onAdapterEvent(event: SynthesisEvent): void {
    if (this.disposed) {
      return;
    }
    switch (event.type) {
      case "started":
        this.apply({ type: "adapter-started" });
        return;
      case "ended":
        this.apply({ type: "adapter-ended", now: this.now() });
        return;
      case "error":
        this.apply({ type: "adapter-error", kind: event.kind === "interrupted" ? "interrupted" : "start-failed" });
        return;
      default:
        return;
    }
  }

  private apply(event: SpeakEvent): void {
    if (this.disposed) {
      return;
    }
    const next = speakReducer(this.state, event);
    if (next === this.state) {
      return;
    }
    this.state = next;
    this.viewCache = null;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
