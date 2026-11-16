import { mapRawErrorCode, mapRawErrorKind, mapRecognitionError } from "../../shared/speech/policy";
import type {
  RecognitionAdapter,
  RecognitionCtorLike,
  RecognitionEvent,
  RecognitionLike,
  RecognitionResultEventLike,
  SpeechStartOptions,
} from "../../shared/speech/types";

type Listener = (event: RecognitionEvent) => void;

function readCtor(scope: unknown): RecognitionCtorLike | null {
  if (typeof scope !== "object" || scope === null) {
    return null;
  }
  const record = scope as Record<string, unknown>;
  const candidate = record["SpeechRecognition"] ?? record["webkitSpeechRecognition"];
  return typeof candidate === "function" ? (candidate as RecognitionCtorLike) : null;
}

function firstFinalText(event: RecognitionResultEventLike): string | null {
  const results = event.results;
  const start = event.resultIndex ?? 0;
  for (let index = start; index < results.length; index += 1) {
    const item = results[index];
    if (item?.isFinal !== true) {
      continue;
    }
    const text = item[0]?.transcript?.trim() ?? "";
    if (text.length > 0) {
      return text;
    }
  }
  return null;
}

class BrowserRecognitionAdapter implements RecognitionAdapter {
  private readonly scope: unknown;
  private listener: Listener | null = null;
  private instance: RecognitionLike | null = null;
  private token = 0;
  private settled = false;
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

  start(options: SpeechStartOptions): void {
    if (this.disposed) {
      return;
    }
    this.detach();
    const token = (this.token += 1);
    this.settled = false;
    const ctor = readCtor(this.scope);
    if (ctor === null) {
      this.emit({ type: "error", kind: "unsupported", raw: "other", errorSource: "adapter" });
      this.emit({ type: "ended" });
      return;
    }
    let instance: RecognitionLike;
    try {
      instance = new ctor();
    } catch {
      this.emit({ type: "error", kind: "unsupported", raw: "other", errorSource: "adapter" });
      this.emit({ type: "ended" });
      return;
    }
    this.instance = instance;
    instance.lang = options.lang;
    instance.continuous = false;
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    instance.onresult = (event) => {
      if (this.disposed || token !== this.token || this.settled) {
        return;
      }
      const text = firstFinalText(event);
      if (text !== null) {
        this.settled = true;
        this.emit({ type: "final", text });
      }
    };
    instance.onerror = (event) => {
      if (this.disposed || token !== this.token || this.settled) {
        return;
      }
      this.settled = true;
      const code = mapRawErrorCode(event.error);
      this.emit({
        type: "error",
        kind: mapRecognitionError(event.error),
        raw: mapRawErrorKind(event.error),
        errorSource: "onerror",
        ...(code === null ? {} : { code }),
      });
    };
    instance.onend = () => {
      if (this.disposed || token !== this.token) {
        return;
      }
      this.settled = true;
      this.emit({ type: "ended" });
    };
    instance.onstart = () => {
      if (this.disposed || token !== this.token || this.settled) {
        return;
      }
      this.emit({ type: "browser-start" });
    };
    try {
      if (options.processLocally === true) {
        instance.processLocally = true;
      }
      instance.start();
    } catch {
      this.settled = true;
      this.emit({ type: "error", kind: "unknown", raw: "other", errorSource: "adapter" });
      this.emit({ type: "ended" });
      return;
    }
    this.emit({ type: "started" });
  }

  cancel(): void {
    if (this.disposed || this.instance === null || this.settled) {
      return;
    }
    this.settled = true;
    this.token += 1;
    try {
      this.instance.abort();
    } catch {
      // 浏览器已结束该会话时 abort 可能抛错，取消仍然视为成功。
    }
    this.detach();
  }

  dispose(): void {
    this.disposed = true;
    this.token += 1;
    this.detach();
    this.listener = null;
  }

  private detach(): void {
    if (this.instance !== null) {
      this.instance.onresult = null;
      this.instance.onerror = null;
      this.instance.onend = null;
      this.instance.onstart = null;
      this.instance = null;
    }
  }

  private emit(event: RecognitionEvent): void {
    if (!this.disposed) {
      this.listener?.(event);
    }
  }
}

export function createRecognitionAdapter(scope: unknown = globalThis): RecognitionAdapter {
  return new BrowserRecognitionAdapter(scope);
}