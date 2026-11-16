import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  ENGINE_SLOW_HINT_MS,
  MAX_AUTO_RECHECK_PER_STEP,
  MAX_GOAL_LENGTH,
  MAX_TURN_CHARS,
  RECHECK_MIN_INTERVAL_MS,
} from "../../shared/constants";
import { createEfError, toEfError } from "../../shared/errors";
import type { EfError } from "../../shared/errors";
import { MSG, createRequestId, fail } from "../../shared/messages";
import type {
  CollectData,
  EfResponse,
  GetContextData,
  HighlightData,
  LoadGoalData,
  SaveGoalData,
  SidePanelRequest,
  WatchData,
} from "../../shared/messages";
import { detectSensitive } from "../../shared/privacy/detect";
import { redactText } from "../../shared/privacy/redact";
import type { UiMode } from "../../shared/uiMode";
import type {
  AssistantMessage,
  BookingCheck,
  BookingSuccessSignals,
  CitationAnchor,
  ConversationContext,
  ConversationContextTurn,
  ConversationDiagnostics,
  DialogueRequest,
  DialogueResponse,
  ElementRef,
  GuidePlan,
  PageSnapshot,
  ResponseType,
  SystemNotice,
  UserMessage,
} from "../../shared/types";
import { ruleEngine } from "../dialogue/rule/RuleEngine";
import { isCompletionUtterance } from "../dialogue/intent/classifier";
import { validateResponse } from "../dialogue/validate/validator";
import {
  advancePlan,
  createPlan,
  currentStep,
  isBookingPlan,
  reconcileBookingPlan,
  timePreferenceOf,
} from "../guide/stepPlanner";
import type { PlanFailure, ReconcileResult } from "../guide/stepPlanner";
import {
  BOOKING_COMPLETE_NOTICE,
  buildBookingAfterSuccessResponse,
  buildBookingDoneResponse,
  buildBookingUnconfirmedResponse,
  evaluateBookingSuccess,
} from "../guide/bookingSuccess";
import { evaluateCompletion } from "../guide/completion";

import { conversationReducer, createConversationState } from "../state/conversationReducer";
import { extractReusableObject, sanitizeReusableObject } from "../dialogue/context/topic";

async function callBackground<T>(request: SidePanelRequest): Promise<EfResponse<T>> {
  try {
    const response = (await chrome.runtime.sendMessage(request)) as EfResponse<T> | undefined;
    if (response === undefined) {
      return fail(request.requestId, createEfError("EF-E007", "后台无响应"));
    }
    return response;
  } catch (error) {
    return fail(request.requestId, toEfError(error));
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function failureDiagnostics(message: string): DialogueResponse["diagnostics"] {
  return {
    mode: "rule-demo",
    engineMs: 0,
    retrievedSegments: 0,
    citationCount: 0,
    intentKind: "fallback-clarify",
    priorityHit: "runtime",
    outboundBytes: 0,
    sensitiveDetected: false,
    rejectReason: "low-confidence",
  };
}

function makeCannotResponse(
  text: string,
  reason: NonNullable<DialogueResponse["limitation"]>["reason"],
  advice: string,
): DialogueResponse {
  return {
    responseType: "cannot-answer",
    text,
    citations: [],
    limitation: { reason, advice },
    diagnostics: failureDiagnostics(text),
  };
}

function makeAssistantMessage(
  response: DialogueResponse,
  turnId: string,
  snapshotId: string,
  validation: "passed" | "rejected",
  rejectReason?: DialogueResponse["diagnostics"]["rejectReason"],
): AssistantMessage {
  const message: AssistantMessage = {
    messageId: makeId("msg"),
    turnId,
    role: "assistant",
    kind: "response",
    createdAt: Date.now(),
    snapshotId,
    responseType: response.responseType,
    text: response.text,
    validation,
    citations: response.citations,
    diagnostics: response.diagnostics,
  };
  if (response.targetControl !== undefined) {
    message.targetControl = response.targetControl;
  }
  if (response.completionCondition !== undefined) {
    message.completionCondition = response.completionCondition;
  }
  if (response.clarify !== undefined) {
    message.clarify = response.clarify;
  }
  if (response.limitation !== undefined) {
    message.limitation = response.limitation;
  }
  if (rejectReason !== undefined) {
    message.rejectReason = rejectReason;
  }
  if (response.limitation?.reason === "read-failed") {
    message.canRetry = true;
  }
  return message;
}

function makeUserMessage(text: string, redacted: boolean, turnId: string, snapshotId: string): UserMessage {
  return {
    messageId: makeId("msg"),
    turnId,
    role: "user",
    kind: "utterance",
    createdAt: Date.now(),
    snapshotId,
    text,
    redacted,
  };
}

function makeSystemMessage(
  text: string,
  noticeKind: SystemNotice["noticeKind"],
  snapshotId: string,
): SystemNotice {
  return {
    messageId: makeId("msg"),
    turnId: makeId("turn"),
    role: "system",
    kind: "system",
    createdAt: Date.now(),
    snapshotId,
    noticeKind,
    text,
  };
}

function replanNoticeText(result: ReconcileResult): string {
  const previous = result.previousTarget;
  const next = result.step;
  const previousLabel = previous?.label ?? "";
  const nextLabel = next?.targetControl.label ?? "";
  const prefix =
    previousLabel.length > 0
      ? `原来要点的“${previousLabel}”现在已经不在页面上了。`
      : "页面变化了，原来的步骤已经不在页面上了。";
  if (
    result.preference === "any" &&
    previous?.kind === "time" &&
    next?.targetControl.kind === "time" &&
    nextLabel.length > 0
  ) {
    return `${prefix}目前可选的最早时段是“${nextLabel}”。`;
  }
  if (nextLabel.length > 0) {
    return `${prefix}我按当前页面重新看了一遍。`;
  }
  return `${prefix}我按当前页面重新看了一遍。`;
}

function isPageChangedNotification(value: unknown): value is { type: typeof MSG.PAGE_CHANGED; tabId: number } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.type === MSG.PAGE_CHANGED && typeof record.tabId === "number";
}

function isWatchTickNotification(
  value: unknown,
): value is { type: typeof MSG.WATCH_TICK; tabId: number; changeCount: number; lastChangeAt: number } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.type === MSG.WATCH_TICK && typeof record.tabId === "number";
}

function readFailureText(error: EfError): string {
  switch (error.code) {
    case "EF-E001":
      return "先打开你想问的那个网页，我再接着看。";
    case "EF-E002":
      return "这个页面我不能读取，因为浏览器不允许扩展访问。换到普通公开网页后点重试。";
    case "EF-E003":
      return "我还没拿到这个页面的访问许可。点一下扩展图标，我再试。";
    case "EF-E004":
      return "这个页面已经关掉了，重新打开后告诉我。";
    case "EF-E005":
      return "页面里的脚本没能启动。刷新一下页面再点重试。";
    case "EF-E006":
      return "页面还没读完，可能加载较慢。可以点重试。";
    case "EF-E007":
      return "页面刚刚刷新过，我重新读一次。";
    default:
      return "我暂时读不到这个页面，可以点重试。";
  }
}

function buildContext(state: {
  messages: Array<{ role: string; text: string; responseType?: string }>;
  goal: string;
  plan: GuidePlan | null;
  pageState: string;
  lastObject?: string | undefined;
  lastMaterial?: string | undefined;
}): ConversationContext {
  const reusableObject =
    state.lastObject === undefined ? undefined : sanitizeReusableObject(state.lastObject);
  const recent: ConversationContextTurn[] = [];
  for (const message of state.messages.slice(-6)) {
    if (message.role === "user") {
      recent.push({ role: "user", summary: message.text.slice(0, 40) });
    } else if (message.role === "assistant" && message.responseType !== undefined) {
      const turn: ConversationContextTurn = {
        role: "assistant",
        summary: message.text.slice(0, 40),
      };
      const responseType = message.responseType;
      if (responseType !== undefined) {
        turn.responseType = responseType as ResponseType;
      }
      if (reusableObject !== undefined) {
        turn.slots = { object: reusableObject };
      }
      recent.push(turn);
    }
  }
  const step = currentStep(state.plan);
  const context: ConversationContext = {
    recent,
    currentGoal: state.goal,
    pageChanged: state.pageState === "changed",
  };
  if (step !== null) {
    context.currentStepGoal = step.goal;
    context.currentStepState = step.state;
  }
  if (reusableObject !== undefined) {
    context.lastObject = reusableObject;
  }
  if (state.lastMaterial !== undefined) {
    context.lastMaterial = state.lastMaterial;
  }
  return context;
}

export function useConversation(uiMode: UiMode) {
  const [state, dispatch] = useReducer(conversationReducer, undefined, createConversationState);
  const stateRef = useRef(state);
  const uiModeRef = useRef<UiMode>("normal");
  const slowTimer = useRef<number | null>(null);
  const lastRecheckAt = useRef(0);
  const autoRechecks = useRef(0);
  const bookingSuccessHandled = useRef(false);

  useEffect(() => {
    uiModeRef.current = uiMode;
  }, [uiMode]);
  const lastPageChange = useRef({ key: "", at: 0 });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const appendSystem = useCallback((text: string, noticeKind: SystemNotice["noticeKind"]): void => {
    const current = stateRef.current;
    dispatch({
      type: "system-add",
      message: makeSystemMessage(text, noticeKind, current.snapshot?.snapshotId ?? "none"),
    });
  }, []);

  const appendSystemOnce = useCallback(
    (text: string, noticeKind: SystemNotice["noticeKind"]): void => {
      const current = stateRef.current;
      const last = current.messages[current.messages.length - 1];
      if (last?.role === "system" && last.text === text) {
        return;
      }
      appendSystem(text, noticeKind);
    },
    [appendSystem],
  );

  const appendFailure = useCallback(
    (error: EfError, retryable = true): void => {
      const current = stateRef.current;
      const last = current.messages[current.messages.length - 1];
      const text = readFailureText(error);
      if (last?.role === "assistant" && last.responseType === "cannot-answer" && last.text === text) {
        return;
      }
      const response = makeCannotResponse(text, "read-failed", "确认页面已打开后，点重试。");
      const message = makeAssistantMessage(
        response,
        makeId("turn"),
        current.snapshot?.snapshotId ?? "none",
        "passed",
      );
      message.canRetry = retryable;
      dispatch({ type: "assistant-add", message });
    },
    [],
  );

  const stopWatch = useCallback(async (): Promise<void> => {
    const tabId = stateRef.current.tabId;
    if (tabId === null) {
      return;
    }
    await callBackground<WatchData>({
      type: MSG.WATCH_STOP,
      v: 1,
      requestId: createRequestId(),
      tabId,
    });
  }, []);

  const recordBookingCheck = useCallback((check: BookingCheck): void => {
    dispatch({ type: "booking-check", check });
  }, []);

  const finalizeBookingSuccess = useCallback(
    (snapshot: PageSnapshot): void => {
      if (bookingSuccessHandled.current || stateRef.current.pageSuccess === "confirmed") {
        return;
      }
      bookingSuccessHandled.current = true;
      const message = makeSystemMessage(
        BOOKING_COMPLETE_NOTICE,
        "booking-complete",
        snapshot.snapshotId,
      );
      dispatch({ type: "booking-success", plan: stateRef.current.plan, message });
      void stopWatch();
    },
    [stopWatch],
  );

  const readPage = useCallback(
    async (reason: "initial" | "refresh" | "recheck"): Promise<PageSnapshot | null> => {
      dispatch({ type: "read-start" });
      const context = await callBackground<GetContextData>({
        type: MSG.GET_CONTEXT,
        v: 1,
        requestId: createRequestId(),
      });
      if (!context.ok) {
        if (!bookingSuccessHandled.current && stateRef.current.pageSuccess !== "confirmed") {
          recordBookingCheck({
            result: "failed",
            reason: "read-failed",
            snapshotId: "none",
            checkedAt: Date.now(),
          });
        }
        dispatch({ type: "read-fail", text: context.error.message });
        appendFailure(context.error);
        return null;
      }
      const collected = await callBackground<CollectData>({
        type: MSG.COLLECT,
        v: 1,
        requestId: createRequestId(),
        tabId: context.data.tabId,
        reason,
      });
      if (!collected.ok) {
        if (!bookingSuccessHandled.current && stateRef.current.pageSuccess !== "confirmed") {
          recordBookingCheck({
            result: "failed",
            reason: "read-failed",
            snapshotId: "none",
            checkedAt: Date.now(),
          });
        }
        dispatch({ type: "read-fail", text: collected.error.message });
        appendFailure(collected.error);
        return null;
      }
      const diagnostics = collected.data.diagnostics;
      const snapshot = collected.data.snapshot;
      dispatch({
        type: "read-ok",
        snapshot,
        tabId: context.data.tabId,
        readMs: diagnostics.collectMs,
        iframeCount: diagnostics.iframeCount ?? 0,
        diagnostics,
      });
      if (!bookingSuccessHandled.current && stateRef.current.pageSuccess !== "confirmed") {
        const signals: BookingSuccessSignals = {
          iframeCount: diagnostics.iframeCount ?? 0,
          openShadowRoots: diagnostics.openShadowRoots ?? 0,
          snapshotTruncated: snapshot.truncated,
        };
        if (diagnostics.droppedHidden !== undefined) {
          signals.droppedHidden = diagnostics.droppedHidden;
        }
        const result = evaluateBookingSuccess(snapshot, signals);
        recordBookingCheck({
          result: result.ok ? "passed" : "failed",
          reason: result.reason,
          snapshotId: snapshot.snapshotId,
          checkedAt: result.checkedAt,
        });
        if (result.ok) {
          finalizeBookingSuccess(snapshot);
        }
      }
      return snapshot;
    },
    [appendFailure, finalizeBookingSuccess, recordBookingCheck],
  );


  const startWatch = useCallback(async (): Promise<void> => {
    const tabId = stateRef.current.tabId;
    if (tabId === null) {
      return;
    }
    await callBackground<WatchData>({
      type: MSG.WATCH_START,
      v: 1,
      requestId: createRequestId(),
      tabId,
    });
  }, []);

  const nextStepMessage = useCallback(
    (plan: GuidePlan, text: string, snapshotId: string, turnId: string): AssistantMessage | null => {
      const step = currentStep(plan);
      if (step === null) {
        return null;
      }
      const response: DialogueResponse = {
        responseType: "next-step",
        text,
        citations: [],
        targetControl: step.targetControl,
        completionCondition: step.completion,
        diagnostics: failureDiagnostics("next-step"),
      };
      return makeAssistantMessage(response, turnId, snapshotId, "passed");
    },
    [],
  );

  const appendBookingFailure = useCallback(
    (failure: PlanFailure | undefined, snapshotId: string): void => {
      const map: Record<
        string,
        {
          text: string;
          reason: NonNullable<DialogueResponse["limitation"]>["reason"];
          advice: string;
        }
      > = {
        "no-available-dates": {
          text: "页面上可预约的日期都不可选。",
          reason: "no-evidence",
          advice: "请换一个日期范围，或稍后重试。",
        },
        "no-available-times": {
          text: "这个日期目前没有可预约时间。",
          reason: "no-evidence",
          advice: "请换一个日期，或等页面加载完成后重试。",
        },
        "no-preferred-times": {
          text: "目前没有符合你偏好（比如下午或更晚）的时段。",
          reason: "no-evidence",
          advice: "可以换一个日期，或者不限定时间再看一次。",
        },
        "time-controls-missing": {
          text: "我还没看到这个日期的可用时段，可能还没渲染。",
          reason: "no-evidence",
          advice: "请滚动到时段区域后点“重新读取页面”，或换一个日期。",
        },
        "personal-info": {
          text: "接下来需要你填写姓名、邮箱等个人信息；这一步需要你本人处理，我不会读取或代填。",
          reason: "read-only-boundary",
          advice: "填好后请你自己继续。",
        },
        confirmation: {
          text: "到了最终确认/提交步骤，需要你本人核对并提交，我不会代点。",
          reason: "read-only-boundary",
          advice: "确认无误后请你自己操作。",
        },
        "calendar-incomplete": {
          text: "我还没看到可预约的日历或可靠的下一步入口。",
          reason: "low-confidence",
          advice: "等页面加载完成后重试，或手动查看页面。",
        },
      };
      const entry = failure === undefined ? undefined : map[failure];
      if (entry === undefined) {
        return;
      }
      const response = makeCannotResponse(entry.text, entry.reason, entry.advice);
      const message = makeAssistantMessage(response, makeId("turn"), snapshotId, "passed");
      dispatch({ type: "assistant-add", message });
    },
    [],
  );

  const handleRecheck = useCallback(
    (snapshot: PageSnapshot): void => {
      if (bookingSuccessHandled.current || stateRef.current.pageSuccess === "confirmed") {
        return;
      }
      const plan = stateRef.current.plan;
      if (plan === null) {
        return;
      }
      let effectivePlan = plan;
      if (isBookingPlan(plan)) {
        const reconciled = reconcileBookingPlan(plan, snapshot);
        if (reconciled.status === "replanned" && reconciled.plan !== null) {
          dispatch({ type: "plan-set", plan: reconciled.plan });
          const message = nextStepMessage(
            reconciled.plan,
            replanNoticeText(reconciled),
            snapshot.snapshotId,
            makeId("turn"),
          );
          if (message !== null) {
            dispatch({ type: "assistant-add", message });
          }
          void startWatch();
          return;
        }
        if (reconciled.status === "unavailable") {
          dispatch({ type: "plan-set", plan: reconciled.plan });
          appendBookingFailure(reconciled.failure, snapshot.snapshotId);
          void stopWatch();
          return;
        }
        if (reconciled.status === "updated" && reconciled.plan !== null) {
          dispatch({ type: "plan-set", plan: reconciled.plan });
          effectivePlan = reconciled.plan;
        }
      }
      const step = currentStep(effectivePlan);
      if (step === null) {
        return;
      }
      const completion = evaluateCompletion(step, snapshot, false);
      if (completion.status === "done-verified") {
        if (isBookingPlan(effectivePlan)) {
          const nextPlan = createPlan(effectivePlan.goal, snapshot);
          if (nextPlan.plan !== null) {
            dispatch({ type: "plan-set", plan: nextPlan.plan });
            const message = nextStepMessage(
              nextPlan.plan,
              "这一步完成了。",
              snapshot.snapshotId,
              makeId("turn"),
            );
            if (message !== null) {
              dispatch({ type: "assistant-add", message });
            }
            void startWatch();
            return;
          }
          dispatch({ type: "plan-set", plan: { ...effectivePlan, status: "superseded" } });
          appendBookingFailure(nextPlan.failure, snapshot.snapshotId);
          void stopWatch();
          return;
        }
        const advanced = advancePlan(effectivePlan, true);
        dispatch({ type: "plan-set", plan: advanced.plan });
        if (advanced.completed) {
          appendSystemOnce("这一步完成了。页面还有需要我指的地方吗？", "recheck-done");
          void stopWatch();
        } else {
          const message = nextStepMessage(
            advanced.plan,
            "这一步完成了。",
            snapshot.snapshotId,
            makeId("turn"),
          );
          if (message !== null) {
            dispatch({ type: "assistant-add", message });
          }
          void startWatch();
        }
        return;
      }
      const reviewedPlan: GuidePlan = {
        ...effectivePlan,
        steps: effectivePlan.steps.map((item, index) =>
          index === effectivePlan.currentIndex ? { ...item, state: "current" } : item,
        ),
      };
      dispatch({ type: "plan-set", plan: reviewedPlan });
      appendSystemOnce("我还不能确认这一步是否完成。你操作完后可以点“我已完成”。", "rechecking");
    },
    [appendBookingFailure, appendSystemOnce, nextStepMessage, startWatch, stopWatch],
  );

  const runTurn = useCallback(
    async (utterance: string, snapshotOverride?: PageSnapshot): Promise<void> => {
      const trimmed = utterance.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_TURN_CHARS) {
        return;
      }
      const current = stateRef.current;
      const snapshot = snapshotOverride ?? current.snapshot;
      const turnId = makeId("turn");
      const snapshotId = snapshot?.snapshotId ?? "none";

      if (detectSensitive(trimmed).length > 0) {
        dispatch({
          type: "user-add",
          message: makeUserMessage(redactText(trimmed), true, turnId, snapshotId),
        });
        const response = makeCannotResponse(
          "这类信息不用发给我。请你自己在网页里填写，我不会读取或保存。",
          "read-only-boundary",
          "需要的话，我可以把对应栏目指给你看，但不会代填或代提交。",
        );
        dispatch({
          type: "assistant-add",
          message: makeAssistantMessage(response, turnId, snapshotId, "passed"),
        });
        return;
      }

      dispatch({ type: "user-add", message: makeUserMessage(trimmed, false, turnId, snapshotId) });
      dispatch({ type: "goal-set", goal: trimmed.slice(0, MAX_GOAL_LENGTH) });
      void callBackground<SaveGoalData>({
        type: MSG.SAVE_GOAL,
        v: 1,
        requestId: createRequestId(),
        goal: trimmed.slice(0, MAX_GOAL_LENGTH),
      });

      if (snapshot === null) {
        const response = makeCannotResponse(
          "我还没读到当前页面。",
          "read-failed",
          "确认页面已打开后，点重试。",
        );
        const message = makeAssistantMessage(response, turnId, snapshotId, "passed");
        message.canRetry = true;
        dispatch({ type: "assistant-add", message });
        return;
      }

      let activeSnapshot = snapshot;
      let activePlan = current.plan;
      const completionUtterance = isCompletionUtterance(trimmed);
      const wantsFreshRead =
        snapshotOverride === undefined &&
        (completionUtterance ||
          /(预约|预订|约个时间|订个时间|book|meeting)/i.test(trimmed) ||
          /(找不到|指给我看|在哪里|哪一步)/.test(trimmed) ||
          (current.plan !== null && isBookingPlan(current.plan)));
      if (wantsFreshRead) {
        const fresh = await readPage("recheck");
        if (fresh === null) {
          return;
        }
        activeSnapshot = fresh;
      }

      const bookingEvidence = evaluateBookingSuccess(activeSnapshot);
      const successActive =
        bookingSuccessHandled.current || stateRef.current.pageSuccess === "confirmed";
      const hasActiveStep =
        activePlan !== null &&
        activePlan.status === "active" &&
        currentStep(activePlan) !== null;

      const finishBookingReply = (response: DialogueResponse): void => {
        const validation = validateResponse(response, activeSnapshot, activePlan);
        let finalResponse = response;
        let validationStatus: "passed" | "rejected" = validation.status;
        if (validation.status === "rejected") {
          finalResponse = makeCannotResponse(
            "我暂时不能可靠回答，页面内容可能刚变过。",
            "low-confidence",
            "换一种问法，或重新读取页面。",
          );
          if (validation.reason !== undefined) {
            finalResponse.diagnostics.rejectReason = validation.reason;
          }
          validationStatus = "rejected";
        }
        dispatch({
          type: "assistant-add",
          message: makeAssistantMessage(
            finalResponse,
            turnId,
            activeSnapshot.snapshotId,
            validationStatus,
            validation.reason,
          ),
        });
      };

      if (completionUtterance && bookingEvidence.ok) {
        finishBookingReply(buildBookingDoneResponse(bookingEvidence));
        return;
      }
      if (completionUtterance && !hasActiveStep) {
        finishBookingReply(buildBookingUnconfirmedResponse(bookingEvidence.reason));
        return;
      }
      if (successActive) {
        if (/(然后呢|还要做什么|下一步|继续|还要)/.test(trimmed)) {
          finishBookingReply(
            bookingEvidence.ok
              ? buildBookingAfterSuccessResponse(bookingEvidence)
              : buildBookingUnconfirmedResponse(bookingEvidence.reason),
          );
          return;
        }
        if (/(找不到|点错|指给我看)/.test(trimmed)) {
          finishBookingReply(
            bookingEvidence.ok
              ? buildBookingAfterSuccessResponse(bookingEvidence)
              : buildBookingUnconfirmedResponse(bookingEvidence.reason),
          );
          return;
        }
      }

      if (activePlan !== null && activePlan.status === "active" && isBookingPlan(activePlan)) {
        const reconciled = reconcileBookingPlan(
          activePlan,
          activeSnapshot,
          timePreferenceOf(trimmed),
        );
        if (reconciled.status === "replanned" && reconciled.plan !== null) {
          dispatch({ type: "plan-set", plan: reconciled.plan });
          const message = nextStepMessage(
            reconciled.plan,
            replanNoticeText(reconciled),
            activeSnapshot.snapshotId,
            turnId,
          );
          if (message !== null) {
            dispatch({ type: "assistant-add", message });
          }
          void startWatch();
          return;
        }
        if (reconciled.status === "unavailable") {
          dispatch({ type: "plan-set", plan: reconciled.plan });
          appendBookingFailure(reconciled.failure, activeSnapshot.snapshotId);
          void stopWatch();
          return;
        }
        if (reconciled.plan !== null) {
          activePlan = reconciled.plan;
          if (reconciled.status === "updated") {
            dispatch({ type: "plan-set", plan: reconciled.plan });
          }
        }
      }

      dispatch({ type: "busy", busy: true });
      dispatch({ type: "slow-hint", slowHint: false });
      if (slowTimer.current !== null) {
        window.clearTimeout(slowTimer.current);
      }
      slowTimer.current = window.setTimeout(() => {
        dispatch({ type: "slow-hint", slowHint: true });
      }, ENGINE_SLOW_HINT_MS);

      const context = buildContext({
        messages: current.messages,
        goal: current.goal.length > 0 ? current.goal : trimmed,
        plan: activePlan,
        pageState: current.pageState,
        lastObject: current.lastObject,
        lastMaterial: current.lastMaterial,
      });

      const request: DialogueRequest = {
        schemaVersion: 1,
        turnId,
        utterance: trimmed,
        context,
        page: {
          snapshotId: activeSnapshot.snapshotId,
          url: activeSnapshot.url,
          domain: activeSnapshot.domain,
          title: activeSnapshot.title,
          readable: current.pageState !== "restricted",
          capturedAt: activeSnapshot.capturedAt,
          iframeCount: current.iframeCount,
        },
        segments: activeSnapshot.segments ?? [],
        controls: activeSnapshot.controls ?? [],
        plan: activePlan,
        capabilities: { modelConfigured: false, voiceEnabled: false },
      };

      let response: DialogueResponse;
      try {
        response = await ruleEngine.respond(request);
      } catch (error) {
        response = makeCannotResponse(
          "我暂时不能可靠回答，页面内容可能刚变过。",
          "low-confidence",
          "换一种问法，或重新读取页面。",
        );
        console.warn("[EF]", { phase: "dialogue-engine-failed", detail: String(error) });
      }

      if (
        successActive &&
        (response.responseType === "next-step" ||
          (response.planPatch !== undefined &&
            (response.planPatch.kind === "create" || response.planPatch.kind === "advance")))
      ) {
        response = bookingEvidence.ok
          ? buildBookingAfterSuccessResponse(bookingEvidence)
          : buildBookingUnconfirmedResponse(bookingEvidence.reason);
      }

      const validation = validateResponse(response, activeSnapshot, activePlan);
      let validationStatus: "passed" | "rejected" = validation.status;
      if (validation.status === "rejected") {
        response = makeCannotResponse(
          "我暂时不能可靠回答，页面内容可能刚变过。",
          "low-confidence",
          "换一种问法，或重新读取页面。",
        );
        if (validation.reason !== undefined) {
          response.diagnostics.rejectReason = validation.reason;
        }
        validationStatus = "rejected";
      }

      const message = makeAssistantMessage(
        response,
        turnId,
        activeSnapshot.snapshotId,
        validationStatus,
        validation.reason,
      );
      dispatch({ type: "assistant-add", message });

      if (response.planPatch !== undefined) {
        dispatch({ type: "plan-set", plan: response.planPatch.plan });
        autoRechecks.current = 0;
        lastRecheckAt.current = Date.now();
        if (response.planPatch.plan.status === "active") {
          void startWatch();
        } else {
          void stopWatch();
        }
      } else if (response.responseType === "next-step" && activePlan !== null) {
        void startWatch();
      }

      if (response.responseType === "direct-answer") {
        const object = extractReusableObject(trimmed, activeSnapshot.title, current.lastObject);
        if (object !== undefined) {
          const material = /材料|带什么|证件|证明|复印件/.test(trimmed) ? "material" : undefined;
          const action: { type: "last-object"; object: string; material?: string } = {
            type: "last-object",
            object,
          };
          if (material !== undefined) {
            action.material = material;
          }
          dispatch(action);
        }
      }

      const diagnostics: ConversationDiagnostics = {
        turnId,
        mode: "rule-demo",
        readMs: current.readMs,
        engineMs: response.diagnostics.engineMs,
        itemCount: activeSnapshot.itemCount,
        segmentCount: activeSnapshot.segments?.length ?? 0,
        controlCount: activeSnapshot.controls?.length ?? 0,
        citationCount: response.citations.length,
        validation: validationStatus,
        outboundBytes: 0,
        sensitiveDetected: false,
      };
      if (validation.reason !== undefined) {
        diagnostics.rejectReason = validation.reason;
      }
      dispatch({ type: "diag-add", diagnostics });
      dispatch({ type: "busy", busy: false });
      dispatch({ type: "slow-hint", slowHint: false });
      if (slowTimer.current !== null) {
        window.clearTimeout(slowTimer.current);
        slowTimer.current = null;
      }
    },
    [startWatch, stopWatch],
  );

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const stored = await callBackground<LoadGoalData>({
        type: MSG.LOAD_GOAL,
        v: 1,
        requestId: createRequestId(),
      });
      if (!disposed && stored.ok && stored.data.goal !== null) {
        dispatch({ type: "goal-set", goal: stored.data.goal });
      }
      if (!disposed) {
        await readPage("initial");
      }
    })();
    return () => {
      disposed = true;
      void stopWatch();
    };
  }, [readPage, stopWatch]);

  useEffect(() => {
    const listener = (message: unknown): void => {
      if (isPageChangedNotification(message)) {
        if (bookingSuccessHandled.current || stateRef.current.pageSuccess === "confirmed") {
          return;
        }
        const key = `${message.tabId}`;
        const now = Date.now();
        if (lastPageChange.current.key === key && now - lastPageChange.current.at < 1500) {
          return;
        }
        lastPageChange.current = { key, at: now };
        dispatch({ type: "page-changed" });
        appendSystemOnce("页面变了，我先核对当前进度。", "page-changed");
        void readPage("recheck").then((snapshot) => {
          if (snapshot !== null) {
            appendSystemOnce("页面已更新，我重新核对了进度。", "recheck-done");
            handleRecheck(snapshot);
          }
        });
        return;
      }
      if (isWatchTickNotification(message) && message.tabId === stateRef.current.tabId) {
        const plan = stateRef.current.plan;
        if (plan === null || plan.status !== "active") {
          return;
        }
        if (
          autoRechecks.current >= MAX_AUTO_RECHECK_PER_STEP ||
          Date.now() - lastRecheckAt.current < RECHECK_MIN_INTERVAL_MS
        ) {
          return;
        }
        autoRechecks.current += 1;
        lastRecheckAt.current = Date.now();
        dispatch({ type: "auto-recheck-inc" });
        void readPage("recheck").then((snapshot) => {
          if (snapshot !== null) {
            handleRecheck(snapshot);
          }
        });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [appendSystemOnce, handleRecheck, readPage]);

  const retry = useCallback(async (): Promise<void> => {
    if (bookingSuccessHandled.current || stateRef.current.pageSuccess === "confirmed") {
      return;
    }
    const snapshot = await readPage("refresh");
    if (snapshot !== null) {
      handleRecheck(snapshot);
    }
  }, [handleRecheck, readPage]);

  const send = useCallback(
    (text: string): void => {
      void runTurn(text);
    },
    [runTurn],
  );

  const markDone = useCallback(async (): Promise<void> => {
    const snapshot = await readPage("recheck");
    if (snapshot !== null) {
      await runTurn("我已完成", snapshot);
    }
  }, [readPage, runTurn]);

  const notFound = useCallback((): void => {
    void readPage("recheck").then((snapshot) => {
      if (snapshot !== null) {
        void runTurn("我找不到", snapshot);
      }
    });
  }, [readPage, runTurn]);

  const misclicked = useCallback((): void => {
    void readPage("recheck").then((snapshot) => {
      if (snapshot !== null) {
        void runTurn("我点错了", snapshot);
      }
    });
  }, [readPage, runTurn]);

  const switchTask = useCallback((): void => {
    void runTurn("换一个任务");
  }, [runTurn]);

  const highlight = useCallback(async (ref: ElementRef): Promise<void> => {
    const current = stateRef.current;
    if (current.tabId === null) {
      appendSystemOnce("我还没读到当前页面。点重试后再试。", "citation-stale");
      return;
    }
    const response = await callBackground<HighlightData>({
      type: MSG.HIGHLIGHT,
      v: 1,
      requestId: createRequestId(),
      tabId: current.tabId,
      ref,
      mode: uiModeRef.current,
    });
    if (!response.ok) {
      appendSystemOnce(response.error.message, "citation-stale");
      return;
    }
    const status = response.data.status;
    if (status === "folded") {
      appendSystemOnce("这段内容被折叠了，展开后我再指给你看。", "citation-stale");
    } else if (status === "partial") {
      appendSystemOnce("我找到了其中一部分位置。", "citation-stale");
    } else if (status === "stale") {
      appendSystemOnce("这个位置已经不在页面上了，我重新看一下页面。", "citation-stale");
      const snapshot = await readPage("recheck");
      if (snapshot !== null) {
        handleRecheck(snapshot);
      }
    }
  }, [appendSystemOnce, handleRecheck, readPage]);

  const locateCitation = useCallback(
    (citation: CitationAnchor): void => {
      void highlight(citation.ref);
    },
    [highlight],
  );

  const locateControl = useCallback(
    (ref: ElementRef): void => {
      const current = stateRef.current;
      if (bookingSuccessHandled.current || current.pageSuccess === "confirmed") {
        appendSystemOnce("这一步已经结束，不需要再定位。", "citation-stale");
        return;
      }
      const plan = current.plan;
      if (plan === null || plan.status !== "active" || !isBookingPlan(plan)) {
        void highlight(ref);
        return;
      }
      void (async () => {
        const snapshot = await readPage("recheck");
        if (snapshot === null) {
          return;
        }
        if (bookingSuccessHandled.current || stateRef.current.pageSuccess === "confirmed") {
          appendSystemOnce("这一步已经结束，不需要再定位。", "citation-stale");
          return;
        }
        const reconciled = reconcileBookingPlan(plan, snapshot);
        if (reconciled.status === "replanned" && reconciled.plan !== null) {
          dispatch({ type: "plan-set", plan: reconciled.plan });
          const message = nextStepMessage(
            reconciled.plan,
            replanNoticeText(reconciled),
            snapshot.snapshotId,
            makeId("turn"),
          );
          if (message !== null) {
            dispatch({ type: "assistant-add", message });
          }
          void startWatch();
          return;
        }
        if (reconciled.status === "unavailable") {
          dispatch({ type: "plan-set", plan: reconciled.plan });
          appendBookingFailure(reconciled.failure, snapshot.snapshotId);
          void stopWatch();
          return;
        }
        if (reconciled.plan !== null) {
          dispatch({ type: "plan-set", plan: reconciled.plan });
        }
        const step = currentStep(reconciled.plan ?? plan);
        if (step === null) {
          appendSystemOnce("当前没有可以指给你的步骤。", "citation-stale");
          return;
        }
        void highlight(step.targetControl.ref);
      })();
    },
    [
      appendBookingFailure,
      appendSystemOnce,
      handleRecheck,
      highlight,
      nextStepMessage,
      readPage,
      startWatch,
      stopWatch,
    ],
  );

  return {
    state,
    send,
    retry,
    markDone,
    notFound,
    misclicked,
    switchTask,
    locateCitation,
    locateControl,
  };
}