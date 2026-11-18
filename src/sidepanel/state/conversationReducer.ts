import type {
  AssistantMessage,
  BookingCheck,
  CollectDiagnostics,
  ConversationDiagnostics,
  DialogueMessage,
  DialogueMode,
  GuidePlan,
  PageSnapshot,
  PageState,
  SessionPhase,
  SystemNotice,
  UserMessage,
  VoiceState,
} from "../../shared/types";
import type { EfErrorCode } from "../../shared/errors";

export interface ConversationState {
  phase: SessionPhase;
  pageState: PageState;
  tabId: number | null;
  snapshot: PageSnapshot | null;
  collectDiagnostics: CollectDiagnostics | null;
  mode: DialogueMode;
  voiceState: VoiceState;
  messages: DialogueMessage[];
  plan: GuidePlan | null;
  currentCardMessageId: string | null;
  pageSuccess: "none" | "confirmed";
  lastBookingCheck: BookingCheck | null;
  goal: string;
  diagnostics: ConversationDiagnostics[];
  busy: boolean;
  slowHint: boolean;
  canRetry: boolean;
  autoRechecks: number;
  readMs: number;
  iframeCount: number;
  readErrorCode: EfErrorCode | null;
  readErrorText: string;
  lastObject?: string;
  lastMaterial?: string;
}

export type ConversationAction =
  | { type: "read-start" }
  | {
      type: "read-ok";
      snapshot: PageSnapshot;
      tabId: number;
      readMs: number;
      iframeCount: number;
      diagnostics: CollectDiagnostics;
    }
  | { type: "read-fail"; text: string; code?: EfErrorCode }
  | { type: "user-add"; message: UserMessage }
  | { type: "assistant-add"; message: AssistantMessage }
  | { type: "system-add"; message: SystemNotice }
  | { type: "plan-set"; plan: GuidePlan | null }
  | { type: "goal-set"; goal: string }
  | { type: "page-changed" }
  | { type: "citation-stale" }
  | { type: "busy"; busy: boolean }
  | { type: "slow-hint"; slowHint: boolean }
  | { type: "diag-add"; diagnostics: ConversationDiagnostics }
  | { type: "auto-recheck-inc" }
  | { type: "booking-check"; check: BookingCheck }
  | { type: "booking-success"; plan: GuidePlan | null; message: SystemNotice }
  | { type: "last-object"; object: string; material?: string };

function appendMessage(messages: DialogueMessage[], message: DialogueMessage): DialogueMessage[] {
  const next = [...messages, message];
  if (next.length <= 200) {
    return next;
  }
  const systemIndex = next.findIndex((item) => item.role === "system");
  if (systemIndex >= 0) {
    return next.filter((_, index) => index !== systemIndex);
  }
  return next.slice(next.length - 200);
}

function markCitationsStale(messages: DialogueMessage[]): DialogueMessage[] {
  return messages.map((message) => {
    if (message.role !== "assistant") {
      return message;
    }
    return {
      ...message,
      citations: message.citations.map((citation) => ({ ...citation, status: "stale" as const })),
    };
  });
}

export function createConversationState(): ConversationState {
  return {
    phase: "greeting",
    pageState: "readable",
    tabId: null,
    snapshot: null,
    collectDiagnostics: null,
    mode: "rule-demo",
    voiceState: "disabled",
    messages: [],
    plan: null,
    currentCardMessageId: null,
    pageSuccess: "none",
    lastBookingCheck: null,
    goal: "",
    diagnostics: [],
    busy: false,
    slowHint: false,
    canRetry: false,
    autoRechecks: 0,
    readMs: 0,
    iframeCount: 0,
    readErrorCode: null,
    readErrorText: "",
  };
}

export function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case "read-start":
      return {
        ...state,
        phase: "reading",
        pageState: state.snapshot === null ? "readable" : "rechecking",
        busy: true,
        slowHint: false,
        readErrorCode: null,
        readErrorText: "",
      };
    case "read-ok":
      return {
        ...state,
        phase: "ready",
        pageState: "readable",
        snapshot: action.snapshot,
        tabId: action.tabId,
        readMs: action.readMs,
        iframeCount: action.iframeCount,
        collectDiagnostics: action.diagnostics,
        busy: false,
        slowHint: false,
        canRetry: false,
        autoRechecks: 0,
        readErrorCode: null,
        readErrorText: "",
      };
    case "read-fail":
      return {
        ...state,
        phase: "read-blocked",
        pageState: "restricted",
        busy: false,
        slowHint: false,
        canRetry: true,
        snapshot: null,
        tabId: null,
        collectDiagnostics: null,
        currentCardMessageId: null,
        readErrorCode: action.code ?? null,
        readErrorText: action.text,
      };
    case "user-add":
      return { ...state, messages: appendMessage(state.messages, action.message) };
    case "assistant-add":
      return {
        ...state,
        messages: appendMessage(state.messages, action.message),
        currentCardMessageId:
          action.message.targetControl === undefined
            ? state.currentCardMessageId
            : action.message.messageId,
      };
    case "system-add":
      return { ...state, messages: appendMessage(state.messages, action.message) };
    case "plan-set": {
      const active = action.plan !== null && action.plan.status === "active";
      return {
        ...state,
        plan: action.plan,
        autoRechecks: 0,
        currentCardMessageId: active ? state.currentCardMessageId : null,
      };
    }
    case "goal-set":
      return { ...state, goal: action.goal };
    case "page-changed": {
      const currentPlan = state.plan;
      const plan =
        currentPlan === null
          ? null
          : {
              ...currentPlan,
              steps: currentPlan.steps.map((step, index) =>
                index === currentPlan.currentIndex ? { ...step, state: "needs-review" as const } : step,
              ),
            };
      return {
        ...state,
        phase: "reviewing",
        pageState: "changed",
        snapshot: null,
        tabId: null,
        collectDiagnostics: null,
        pageSuccess: "none",
        lastBookingCheck: null,
        busy: true,
        slowHint: false,
        readErrorCode: null,
        readErrorText: "",
        plan,
        canRetry: true,
        messages: markCitationsStale(state.messages),
      };
    }
    case "citation-stale":
      return { ...state, messages: markCitationsStale(state.messages) };
    case "busy":
      return { ...state, busy: action.busy };
    case "slow-hint":
      return { ...state, slowHint: action.slowHint };
    case "diag-add":
      return { ...state, diagnostics: [action.diagnostics, ...state.diagnostics].slice(0, 20) };
    case "auto-recheck-inc":
      return { ...state, autoRechecks: state.autoRechecks + 1 };
    case "booking-check":
      return { ...state, lastBookingCheck: action.check };
    case "booking-success": {
      const completedPlan: GuidePlan | null =
        action.plan === null ? null : { ...action.plan, status: "completed" };
      const hasNotice = state.messages.some(
        (message) => message.role === "system" && message.noticeKind === "booking-complete",
      );
      return {
        ...state,
        plan: completedPlan,
        currentCardMessageId: null,
        pageSuccess: "confirmed",
        messages: hasNotice ? state.messages : appendMessage(state.messages, action.message),
        phase: "ready",
        busy: false,
        slowHint: false,
        canRetry: false,
      };
    }
    case "last-object": {
      const next: ConversationState = { ...state, lastObject: action.object };
      if (action.material !== undefined) {
        next.lastMaterial = action.material;
      }
      return next;
    }
    default:
      return state;
  }
}
