import { SPEECH_PITCH, SPEECH_RATE } from "../../shared/speech/constants";
import { pickChineseVoice } from "../../shared/speech/policy";
import type {
  SpeakOptions,
  SynthesisAdapter,
  SynthesisEvent,
  SynthesisLike,
  UtteranceCtorLike,
  UtteranceLike,
} from "../../shared/speech/types";

type Listener = (event: SynthesisEvent) => void;

function asRecord(scope: unknown): Record<string, unknown> | null {
  if (typeof scope !== "object" || scope === null) {
    return null;
  }
  return scope as Record<string, unknown>;
}

function readSynthesis(scope: unknown): SynthesisLike | null {
  const record = asRecord(scope);
  if (record === null) {
    return null;
  }
  const candidate = record["speechSynthesis"];
  return typeof candidate === "object" && candidate !== null
    ? (candidate as SynthesisLike)
    : null;
}

function readUtteranceCtor(scope: unknown): UtteranceCtorLike | null {
  const record = asRecord(scope);
  if (record === null) {
    return null;
  }
  const candidate = record["SpeechSynthesisUtterance"];
  return typeof candidate === "function" ? (candidate as UtteranceCtorLike) : null;
}

class BrowserSynthesisAdapter implements SynthesisAdapter {
  private readonly scope: unknown;
  private listener: Listener | null = null;
  private generation = 0;
  private disposed = false;

  constructor(scope: unknown) {
    this.scope = scope;
  }

  subscribe(listener: Listener): () => void {
    this.listener = listener;
    return () => {
      if (this.listener === listener) {
        this.listener = null;
      }
    };
  }

  speak(options: SpeakOptions): void {
    if (this.disposed) {
      return;
    }
    const synthesis = readSynthesis(this.scope);
    const ctor = readUtteranceCtor(this.scope);
    if (synthesis === null || ctor === null) {
      this.emit({ type: "error", kind: "unsupported" });
      return;
    }
    this.generation += 1;
    const generation = this.generation;
    let utterance: UtteranceLike;
    try {
      utterance = new ctor(options.text);
    } catch {
      this.emit({ type: "error", kind: "unknown" });
      return;
    }
    utterance.lang = options.lang;
    utterance.rate = options.rate;
    utterance.pitch = SPEECH_PITCH;
    try {
      const picked = pickChineseVoice(synthesis.getVoices());
      if (picked.voice !== null) {
        utterance.voice = picked.voice;
      }
    } catch {
      // 部分浏览器在语音列表未就绪时可能抛错，仍以 lang 继续朗读。
    }
    utterance.onstart = () => {
      if (!this.disposed && generation === this.generation) {
        this.emit({ type: "started" });
      }
    };
    utterance.onend = () => {
      if (!this.disposed && generation === this.generation) {
        this.emit({ type: "ended" });
      }
    };
    utterance.onerror = (event) => {
      if (!this.disposed && generation === this.generation) {
        this.emit({ type: "error", kind: event?.error === "interrupted" || event?.error === "canceled" ? "interrupted" : "unknown" });
      }
    };
    try {
      synthesis.cancel();
      synthesis.speak(utterance);
    } catch {
      this.emit({ type: "error", kind: "unknown" });
    }
  }

  stop(): void {
    if (this.disposed) {
      return;
    }
    this.generation += 1;
    const synthesis = readSynthesis(this.scope);
    try {
      synthesis?.cancel();
    } catch {
      // 取消失败不影响 UI 的停止语义。
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.generation += 1;
    this.listener = null;
  }

  private emit(event: SynthesisEvent): void {
    if (!this.disposed) {
      this.listener?.(event);
    }
  }
}

export function createSynthesisAdapter(scope: unknown = globalThis): SynthesisAdapter {
  return new BrowserSynthesisAdapter(scope);
}
