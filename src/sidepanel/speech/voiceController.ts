import { MAX_TURN_CHARS } from "../../shared/constants";
import {
  LOCAL_CAPABILITY_CACHE_MS,
  MIC_PERMISSION_RECHECK_MIN_MS,
  SPEECH_LANG,
  SPEECH_NO_RESULT_TIMEOUT_MS,
} from "../../shared/speech/constants";
import { describeSpeechDiagnostics } from "../../shared/speech/diagnostics";
import type { SpeechDiagnosticsView } from "../../shared/speech/diagnostics";
import { installStateOf } from "../../shared/speech/localCapability";
import type { InstallOutcomeDetail } from "../../shared/speech/localCapability";
import { detectRecognitionSupport, mergeTranscript } from "../../shared/speech/policy";
import { toPermissionState } from "../../shared/speech/permission";
import type {
  MicPageOpenResult,
  MicPermissionPage,
  MicPermissionProbe,
  MicPermissionState,
  MicRequestOutcome,
} from "../../shared/speech/permission";
import type {
  RecognitionAdapter,
  RecognitionEvent,
  RecognitionMode,
  RecognitionSupport,
} from "../../shared/speech/types";
import {
  createVoiceInputState,
  describeVoiceInput,
  voiceInputReducer,
} from "../../shared/speech/voiceMachine";
import type {
  VoiceInputEvent,
  VoiceInputState,
  VoiceInputView,
} from "../../shared/speech/voiceMachine";
import type { LocalCapabilityProbe, LocalInstaller } from "./localCapability";

export interface VoiceControllerDeps {
  adapter: RecognitionAdapter | null;
  detect?: () => RecognitionSupport;
  limit?: number;
  probe?: MicPermissionProbe;
  micPage?: MicPermissionPage;
  now?: () => number;
  localCapability?: LocalCapabilityProbe;
  localInstaller?: LocalInstaller;
}

export type VoiceControllerView = VoiceInputView;

export class VoiceController {
  private readonly adapter: RecognitionAdapter | null;
  private readonly detect: () => RecognitionSupport;
  private readonly limit: number;
  private readonly probe: MicPermissionProbe | undefined;
  private readonly micPage: MicPermissionPage | undefined;
  private readonly now: () => number;
  private readonly localCapability: LocalCapabilityProbe | undefined;
  private readonly localInstaller: LocalInstaller | undefined;
  private readonly unsubscribeAdapter: () => void;
  private readonly listeners = new Set<() => void>();
  private state: VoiceInputState = createVoiceInputState();
  private viewCache: VoiceControllerView | null = null;
  private composerText = "";
  private sessionToken = 0;
  private activeSessionId = 0;
  private settledSessionId: number | null = null;
  private cancelRequested = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private starting = false;
  private opening = false;
  private localCheckPromise: Promise<void> | null = null;
  private pendingForceCheck = false;
  private installing = false;
  private lastRefreshAt: number | null = null;
  private disposed = false;

  constructor(deps: VoiceControllerDeps) {
    this.adapter = deps.adapter;
    this.detect = deps.detect ?? (() => detectRecognitionSupport(globalThis));
    this.limit = deps.limit ?? MAX_TURN_CHARS;
    this.probe = deps.probe;
    this.micPage = deps.micPage;
    this.now = deps.now ?? (() => Date.now());
    this.localCapability = deps.localCapability;
    this.localInstaller = deps.localInstaller;
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

  getView = (): VoiceControllerView => {
    if (this.viewCache === null) {
      this.viewCache = describeVoiceInput(this.state, this.now());
    }
    return this.viewCache;
  };

  getDiagnostics(): SpeechDiagnosticsView {
    return this.getView().diagnostics;
  }

  setComposerText(text: string): void {
    this.composerText = text;
  }

  async start(): Promise<void> {
    if (this.disposed || this.state.phase === "listening" || this.starting) {
      return;
    }
    if (this.state.mode === "local" && this.state.localAvailability !== "available") {
      return;
    }
    const supported = this.detect() === "supported" && this.adapter !== null;
    if (this.probe === undefined) {
      this.apply({ type: "start-requested", supported });
      if (!supported || this.adapter === null) {
        return;
      }
      this.beginListening();
      return;
    }
    if (!supported || this.adapter === null) {
      this.apply({ type: "start-requested", supported: false });
      return;
    }
    this.starting = true;
    const token = (this.sessionToken += 1);
    try {
      const permission = await this.refreshPermission();
      if (this.disposed || token !== this.sessionToken) {
        return;
      }
      if (permission === "granted") {
        this.apply({ type: "start-requested", supported: true });
        this.beginListening();
        return;
      }
      this.apply({ type: "mic-gate" });
    } finally {
      this.starting = false;
    }
  }

  async refreshPermission(): Promise<MicPermissionState> {
    if (this.probe === undefined) {
      return "unknown";
    }
    const now = this.now();
    if (this.lastRefreshAt !== null && now - this.lastRefreshAt < MIC_PERMISSION_RECHECK_MIN_MS) {
      return this.state.permission;
    }
    const permission = await this.probe.query();
    if (this.disposed) {
      return permission;
    }
    this.lastRefreshAt = now;
    this.apply({ type: "permission-refreshed", state: permission, at: now });
    return permission;
  }

  async requestMicPermission(): Promise<void> {
    if (this.disposed || this.opening) {
      return;
    }
    this.opening = true;
    try {
      const permission = await this.refreshPermission();
      if (this.disposed) {
        return;
      }
      if (permission === "granted") {
        return;
      }
      if (this.micPage === undefined) {
        this.apply({ type: "mic-page-failed" });
        return;
      }
      const result: MicPageOpenResult = await this.micPage.open();
      if (this.disposed) {
        return;
      }
      if (result === "failed") {
        this.apply({ type: "mic-page-failed" });
      } else {
        this.apply({ type: "mic-page-opened", at: this.now() });
      }
    } catch {
      this.apply({ type: "mic-page-failed" });
    } finally {
      this.opening = false;
    }
  }

  applyMicResult(result: MicRequestOutcome, at: number): void {
    if (this.disposed) {
      return;
    }
    const checkedAt = this.state.permissionCheckedAt;
    if (checkedAt !== null && at < checkedAt) {
      return;
    }
    const permission = toPermissionState(result);
    if (permission !== null) {
      this.apply({ type: "permission-refreshed", state: permission, at });
    }
  }

  getPermission(): MicPermissionState {
    return this.state.permission;
  }

  async ensureLocalCapability(force = false): Promise<void> {
    if (this.disposed) {
      return;
    }
    const now = this.now();
    if (
      !force &&
      this.state.localCheckedAt !== null &&
      now - this.state.localCheckedAt < LOCAL_CAPABILITY_CACHE_MS
    ) {
      return;
    }
    if (this.localCheckPromise !== null) {
      if (force) {
        this.pendingForceCheck = true;
      }
      return this.localCheckPromise;
    }
    this.localCheckPromise = (async () => {
      try {
        if (this.localCapability === undefined) {
          this.apply({
            type: "local-capability-checked",
            apiPresent: false,
            availability: "unsupported-not-called",
            at: now,
          });
          return;
        }
        this.apply({ type: "local-capability-checking" });
        const availability = await this.localCapability.check();
        if (this.disposed) {
          return;
        }
        this.apply({
          type: "local-capability-checked",
          apiPresent: true,
          availability,
          at: this.now(),
        });
      } finally {
        this.localCheckPromise = null;
        const pending = this.pendingForceCheck;
        this.pendingForceCheck = false;
        if (pending && !this.disposed) {
          void Promise.resolve().then(() => this.ensureLocalCapability(true));
        }
      }
    })();
    return this.localCheckPromise;
  }

  async recheckLocalCapability(): Promise<void> {
    await this.ensureLocalCapability(true);
  }

  async requestLocalInstall(): Promise<void> {
    if (
      this.disposed ||
      this.installing ||
      this.state.installFlow !== "idle" ||
      this.state.localAvailability !== "downloadable"
    ) {
      return;
    }
    this.installing = true;
    try {
      if (this.localInstaller === undefined) {
        const detail: InstallOutcomeDetail = {
          outcome: "unsupported",
          errorName: null,
          errorBrief: null,
        };
        this.apply({ type: "install-settled", detail, at: this.now() });
        this.apply({ type: "install-flow-changed", flow: "idle" });
        return;
      }
      this.apply({ type: "install-state-changed", state: "requesting" });
      this.apply({ type: "install-flow-changed", flow: "installing" });
      const detail = await this.localInstaller.install();
      if (this.disposed) {
        return;
      }
      this.apply({ type: "install-settled", detail, at: this.now() });
      this.apply({ type: "install-state-changed", state: installStateOf(detail) });
      if (detail.outcome === "unsupported") {
        this.apply({ type: "install-flow-changed", flow: "idle" });
        return;
      }
      this.apply({ type: "install-flow-changed", flow: "rechecking" });
      await this.ensureLocalCapability(true);
      if (!this.disposed) {
        this.apply({ type: "install-flow-changed", flow: "idle" });
      }
    } finally {
      this.installing = false;
    }
  }

  setRecognitionMode(mode: RecognitionMode): void {
    if (this.disposed || this.state.mode === mode) {
      return;
    }
    if (this.state.phase === "listening") {
      this.cancel();
    }
    this.apply({ type: "mode-changed", mode });
  }

  private beginListening(): void {
    if (this.adapter === null) {
      return;
    }
    const id = (this.sessionToken += 1);
    this.activeSessionId = id;
    this.settledSessionId = null;
    this.cancelRequested = false;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.onTimeout();
    }, SPEECH_NO_RESULT_TIMEOUT_MS);
    const base = {
      lang: SPEECH_LANG,
      singleShot: true as const,
      interimResults: false as const,
    };
    const options =
      this.state.mode === "local" ? { ...base, processLocally: true } : base;
    try {
      this.adapter.start(options);
    } catch {
      this.clearTimer();
      this.apply({
        type: "adapter-error",
        kind: "unknown",
        cancelledByUser: false,
        raw: "other",
        at: this.now(),
      });
    }
  }

  cancel(): void {
    if (this.disposed || this.state.phase !== "listening") {
      return;
    }
    this.cancelRequested = true;
    this.clearTimer();
    this.settledSessionId = this.activeSessionId;
    this.sessionToken += 1;
    this.adapter?.cancel();
    this.apply({ type: "cancel-requested" });
  }

  invalidate(): void {
    if (this.disposed) {
      return;
    }
    const listening = this.state.phase === "listening";
    this.sessionToken += 1;
    this.settledSessionId = this.activeSessionId;
    this.cancelRequested = false;
    this.clearTimer();
    if (listening) {
      try {
        this.adapter?.cancel();
      } catch {
        // 适配器已停止时取消可忽略。
      }
    }
    this.apply({ type: "invalidate" });
  }

  consumePending(): void {
    this.apply({ type: "composer-consumed" });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.invalidate();
    this.disposed = true;
    this.starting = false;
    this.opening = false;
    this.localCheckPromise = null;
    this.pendingForceCheck = false;
    this.installing = false;
    this.settledSessionId = null;
    this.unsubscribeAdapter();
    this.adapter?.dispose();
    this.listeners.clear();
  }

  private onAdapterEvent(event: RecognitionEvent): void {
    if (this.disposed) {
      return;
    }
    const token = this.sessionToken;
    if (token !== this.sessionToken) {
      return;
    }
    switch (event.type) {
      case "started":
        this.apply({ type: "adapter-started" });
        return;
      case "browser-start":
        this.apply({ type: "browser-start" });
        return;
      case "final":
        if (token !== this.sessionToken || this.settledSessionId === this.activeSessionId) {
          return;
        }
        this.settledSessionId = this.activeSessionId;
        this.clearTimer();
        this.apply({
          type: "adapter-final",
          merge: mergeTranscript(this.composerText, event.text, this.limit),
        });
        return;
      case "error":
        if (token !== this.sessionToken || this.settledSessionId === this.activeSessionId) {
          return;
        }
        this.settledSessionId = this.activeSessionId;
        this.clearTimer();
        this.apply({
          type: "adapter-error",
          kind: event.kind,
          cancelledByUser: this.cancelRequested,
          ...(event.raw === undefined ? {} : { raw: event.raw }),
          ...(event.code === undefined ? {} : { code: event.code }),
          ...(event.errorSource === undefined ? {} : { errorSource: event.errorSource }),
          at: this.now(),
        });
        return;
      case "ended":
        if (token !== this.sessionToken || this.settledSessionId === this.activeSessionId) {
          return;
        }
        this.settledSessionId = this.activeSessionId;
        this.clearTimer();
        this.apply({ type: "adapter-ended", at: this.now() });
        return;
      default:
        return;
    }
  }

  private onTimeout(): void {
    if (this.disposed || this.state.phase !== "listening") {
      return;
    }
    this.timer = null;
    this.settledSessionId = this.activeSessionId;
    try {
      this.adapter?.cancel();
    } catch {
      // 忽略取消失败，仍进入超时状态。
    }
    this.apply({ type: "timeout", at: this.now() });
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private apply(event: VoiceInputEvent): void {
    if (this.disposed) {
      return;
    }
    const next = voiceInputReducer(this.state, event);
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