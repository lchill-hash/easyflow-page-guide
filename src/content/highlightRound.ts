import type { CleanupReason } from "../shared/types";

export type { CleanupReason };

export type HighlightPhase = "idle" | "pulsing" | "static" | "cleared";

export interface RoundConfig {
  pulseDurationMs: number;
  pulseCount: number;
  ttlMs: number;
  care: boolean;
  reducedMotion: boolean;
  supportsAnimate: boolean;
}

export interface RoundCounters {
  roundStartCount: number;
  pulseStartCount: number;
  pulseCompletedCount: number;
  overlayCreateCount: number;
  overlayLiveCount: number;
  overlayLiveMax: number;
  legacyHostCount: number;
  cleanupScheduledCount: number;
  cleanupFiredCount: number;
  cleanupReplacedCount: number;
  cleanupNoopCount: number;
  positionUpdateCount: number;
  domTickCount: number;
  boxCreateCount: number;
  boxRemoveCount: number;
  boxCount: number;
}

export interface RoundTiming {
  lastRoundStartAt: number | null;
  lastRoundEndAt: number | null;
  lastCleanupAt: number | null;
  lastCleanupReason: CleanupReason | null;
  highlightLifetimeMs: number | null;
  ttlAt: number | null;
  pulseEndsAt: number | null;
}

export interface HighlightRoundState {
  phase: HighlightPhase;
  roundId: number;
  counters: RoundCounters;
  timing: RoundTiming;
}

export type RoundEvent =
  | { type: "round-start"; now: number; config: RoundConfig }
  | { type: "pulse-complete"; now: number }
  | { type: "position-updated"; now: number }
  | { type: "dom-tick"; now: number }
  | { type: "hosts-measured"; now: number; live: number; legacy: number }
  | {
      type: "boxes-synced";
      now: number;
      created: number;
      removed: number;
      visible: number;
    }
  | { type: "cleanup"; now: number; reason: CleanupReason };

export function createRoundState(): HighlightRoundState {
  return {
    phase: "idle",
    roundId: 0,
    counters: {
      roundStartCount: 0,
      pulseStartCount: 0,
      pulseCompletedCount: 0,
      overlayCreateCount: 0,
      overlayLiveCount: 0,
      overlayLiveMax: 0,
      legacyHostCount: 0,
      cleanupScheduledCount: 0,
      cleanupFiredCount: 0,
      cleanupReplacedCount: 0,
      cleanupNoopCount: 0,
      positionUpdateCount: 0,
      domTickCount: 0,
      boxCreateCount: 0,
      boxRemoveCount: 0,
      boxCount: 0,
    },
    timing: {
      lastRoundStartAt: null,
      lastRoundEndAt: null,
      lastCleanupAt: null,
      lastCleanupReason: null,
      highlightLifetimeMs: null,
      ttlAt: null,
      pulseEndsAt: null,
    },
  };
}

export function isPulsing(config: RoundConfig): boolean {
  return !config.care && !config.reducedMotion && config.supportsAnimate;
}

export function pulseTotalMs(config: RoundConfig): number {
  return config.pulseDurationMs * config.pulseCount;
}

export function reduceRound(
  state: HighlightRoundState,
  event: RoundEvent,
): HighlightRoundState {
  const counters = { ...state.counters };
  const timing = { ...state.timing };
  let phase = state.phase;
  let roundId = state.roundId;

  switch (event.type) {
    case "round-start": {
      const pulsing = isPulsing(event.config);
      roundId += 1;
      phase = pulsing ? "pulsing" : "static";
      counters.roundStartCount += 1;
      counters.cleanupScheduledCount += 1;
      counters.overlayCreateCount += 1;
      counters.overlayLiveCount = 1;
      counters.overlayLiveMax = Math.max(counters.overlayLiveMax, 1);
      if (pulsing) {
        counters.pulseStartCount += 1;
      }
      timing.lastRoundStartAt = event.now;
      timing.ttlAt = event.now + event.config.ttlMs;
      timing.pulseEndsAt = pulsing ? event.now + pulseTotalMs(event.config) : null;
      break;
    }
    case "pulse-complete": {
      if (
        phase !== "pulsing" ||
        timing.pulseEndsAt === null ||
        event.now < timing.pulseEndsAt
      ) {
        return state;
      }
      phase = "static";
      counters.pulseCompletedCount += 1;
      timing.lastRoundEndAt = event.now;
      timing.pulseEndsAt = null;
      break;
    }
    case "position-updated":
      counters.positionUpdateCount += 1;
      break;
    case "dom-tick":
      counters.domTickCount += 1;
      break;
    case "hosts-measured":
      counters.overlayLiveCount = event.live;
      counters.overlayLiveMax = Math.max(counters.overlayLiveMax, event.live);
      counters.legacyHostCount = event.legacy;
      break;
    case "boxes-synced":
      counters.boxCreateCount += event.created;
      counters.boxRemoveCount += event.removed;
      counters.boxCount = event.visible;
      break;
    case "cleanup": {
      if (phase === "idle" || phase === "cleared") {
        counters.cleanupNoopCount += 1;
        break;
      }
      if (event.reason === "replaced") {
        counters.cleanupReplacedCount += 1;
      } else {
        counters.cleanupFiredCount += 1;
      }
      phase = "cleared";
      counters.overlayLiveCount = 0;
      counters.boxCount = 0;
      timing.ttlAt = null;
      timing.pulseEndsAt = null;
      timing.lastCleanupAt = event.now;
      timing.lastCleanupReason = event.reason;
      timing.highlightLifetimeMs =
        timing.lastRoundStartAt === null ? null : event.now - timing.lastRoundStartAt;
      break;
    }
    default:
      return state;
  }

  return {
    phase,
    roundId,
    counters,
    timing,
  };
}