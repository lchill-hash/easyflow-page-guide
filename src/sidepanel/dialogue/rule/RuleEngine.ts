import { normalizeWhitespace } from "../../../shared/domPath";
import type {
  AssistantMessage,
  CitationAnchor,
  DialogueRequest,
  DialogueResponse,
  ElementItem,
  EngineDiagnostics,
  GuidePlan,
  PageControl,
  PageSnapshot,
  PlanPatch,
  ResponseType,
  Slots,
} from "../../../shared/types";
import { composeAnswer } from "../answer/composer";
import { assertDialogueRequest } from "../DialogueEngine";
import type { DialogueEngine } from "../DialogueEngine";
import { classifyIntent } from "../intent/classifier";
import type { IntentResult } from "../intent/classifier";
import { buildQuery, retrieveSegments } from "../retrieval/segmentRetriever";
import { advancePlan, createPlan, currentStep, relocate, replan } from "../../guide/stepPlanner";
import type { PlanFailure } from "../../guide/stepPlanner";
import { evaluateCompletion } from "../../guide/completion";

function makeDiagnostics(
  intent: IntentResult,
  startedAt: number,
  overrides: Partial<EngineDiagnostics> = {},
): EngineDiagnostics {
  return {
    mode: "rule-demo",
    engineMs: Math.round(performance.now() - startedAt),
    retrievedSegments: 0,
    citationCount: 0,
    intentKind: intent.intentKind,
    priorityHit: intent.priorityHit,
    outboundBytes: 0,
    sensitiveDetected: false,
    ...overrides,
  };
}

function syntheticSnapshot(request: DialogueRequest): PageSnapshot {
  const items: ElementItem[] = [];
  let order = 0;
  for (const segment of request.segments) {
    items.push({
      elementId: segment.titleRef.elementId,
      type: "heading",
      text: segment.titleText,
      textLength: segment.titleText.length,
      truncated: segment.truncated,
      order,
      region: segment.region,
      domPath: segment.titleRef.domPath,
      textHash: segment.titleRef.textHash,
      tagName: "heading",
      titleCandidate: true,
    });
    order += 1;
    for (let index = 0; index < segment.bodyRefs.length; index += 1) {
      const ref = segment.bodyRefs[index];
      const text = segment.bodyTexts[index] ?? "";
      if (ref === undefined || text.length === 0) {
        continue;
      }
      items.push({
        elementId: ref.elementId,
        type: "paragraph",
        text,
        textLength: text.length,
        truncated: segment.truncated,
        order,
        region: segment.region,
        domPath: ref.domPath,
        textHash: ref.textHash,
        tagName: "paragraph",
      });
      order += 1;
    }
  }

  return {
    snapshotId: request.page.snapshotId,
    runId: request.turnId,
    schemaVersion: 1,
    url: request.page.url,
    origin: request.page.domain,
    domain: request.page.domain,
    title: request.page.title,
    titleMissing: request.page.title.length === 0,
    capturedAt: request.page.capturedAt,
    itemCount: items.length,
    items,
    segments: request.segments,
    controls: request.controls,
    truncated: false,
  };
}

function cannot(
  text: string,
  reason: NonNullable<DialogueResponse["limitation"]>["reason"],
  advice: string,
  diagnostics: EngineDiagnostics,
): DialogueResponse {
  return {
    responseType: "cannot-answer",
    text,
    citations: [],
    limitation: { reason, advice },
    diagnostics,
  };
}

function planFailureResponse(
  failure: PlanFailure | undefined,
  diagnostics: EngineDiagnostics,
): DialogueResponse | null {
  switch (failure) {
    case "no-available-dates":
      return cannot(
        "页面上可预约的日期都不可选。",
        "no-evidence",
        "请换一个日期范围，或稍后重试。",
        diagnostics,
      );
    case "no-available-times":
      return cannot(
        "这个日期目前没有可预约时间。",
        "no-evidence",
        "请换一个日期，或等页面加载完成后重试。",
        diagnostics,
      );
    case "no-preferred-times":
      return cannot(
        "目前没有符合你偏好（比如下午或更晚）的时段。",
        "no-evidence",
        "可以换一个日期，或者不限定时间再看一次。",
        diagnostics,
      );
    case "time-controls-missing":
      return cannot(
        "我还没看到这个日期的可用时段，可能还没渲染。",
        "no-evidence",
        "请滚动到时段区域后点“重新读取页面”，或换一个日期。",
        diagnostics,
      );
    case "personal-info":
      return cannot(
        "接下来需要你填写姓名、邮箱等个人信息；这一步需要你本人处理，我不会读取或代填。",
        "read-only-boundary",
        "填好后请你自己继续。",
        diagnostics,
      );
    case "confirmation":
      return cannot(
        "到了最终确认/提交步骤，需要你本人核对并提交，我不会代点。",
        "read-only-boundary",
        "确认无误后请你自己操作。",
        diagnostics,
      );
    case "calendar-incomplete":
      return cannot(
        "我还没看到可预约的日历或可靠的下一步入口。",
        "low-confidence",
        "等页面加载完成后重试，或手动查看页面。",
        diagnostics,
      );
    default:
      return null;
  }
}

function clarify(text: string, question: string, diagnostics: EngineDiagnostics): DialogueResponse {
  return {
    responseType: "clarify",
    text,
    citations: [],
    clarify: { question },
    diagnostics,
  };
}

const NEXT_STEP_LEAD = "我按当前页面接着来。";
const NEXT_STEP_CREATED_LEAD = "我按当前页面找到了下一步。";

function nextStepResponse(
  plan: GuidePlan,
  text: string,
  diagnostics: EngineDiagnostics,
  patch?: PlanPatch,
): DialogueResponse | null {
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
    diagnostics: { ...diagnostics, citationCount: 0 },
  };
  if (patch !== undefined) {
    response.planPatch = patch;
  }
  return response;
}

function abandonPlan(plan: GuidePlan): GuidePlan {
  return { ...plan, status: "abandoned" };
}

function citationForControl(control: PageControl, index: number): CitationAnchor {
  const text = normalizeWhitespace(control.label).slice(0, 240);
  return {
    citationId: `cite-field-${index + 1}`,
    segmentId: "fields",
    role: "body",
    text,
    start: 0,
    end: text.length,
    status: "valid",
    ref: control.ref,
  };
}

function findNamedControl(request: DialogueRequest, utterance: string): PageControl | undefined {
  const byLabel = request.controls.find(
    (control) => control.label.length > 0 && utterance.includes(control.label),
  );
  if (byLabel !== undefined) {
    return byLabel;
  }
  const keywords = ["手机号", "身份证", "证件", "银行卡", "验证码", "密码", "姓名"];
  return request.controls.find(
    (control) =>
      control.controlType === "input-label" &&
      keywords.some((keyword) => utterance.includes(keyword) && control.label.includes(keyword)),
  );
}

function answerFact(
  request: DialogueRequest,
  query: string,
  slots: Slots,
  intent: IntentResult,
  startedAt: number,
): DialogueResponse {
  const hits = retrieveSegments(query, request.segments, 3, slots, request.utterance);
  if (hits.length === 0) {
    if (/(填什么|要填|填写|字段|资料)/.test(request.utterance)) {
      const fields = request.controls
        .filter((control) => control.controlType === "input-label" && control.label.length > 0)
        .slice(0, 2);
      if (fields.length > 0) {
        return {
          responseType: "direct-answer",
          text: `页面上能看到的填写项有：${fields.map((control) => control.label).join("、")}。我只读标签，不会读取你已填的内容。`,
          citations: fields.map(citationForControl),
          diagnostics: makeDiagnostics(intent, startedAt, { citationCount: fields.length }),
        };
      }
    }
    const reason = request.segments.length === 0 && request.page.iframeCount > 0 ? "iframe-or-map" : "no-evidence";
    const advice =
      reason === "iframe-or-map"
        ? "这部分可能在内嵌框架或地图里，我读不到。你可以在主页面找找文字入口。"
        : "可以换一种问法，或打开包含这项信息的页面后再试。";
    return cannot(
      "当前页面没有找到这项信息。",
      reason,
      advice,
      makeDiagnostics(intent, startedAt, { retrievedSegments: 0 }),
    );
  }

  const composed = composeAnswer(hits, slots);
  if (!composed.ok) {
    if (composed.reason === "title-only") {
      return cannot(
        `页面只写了“${composed.titleText ?? "这个标题"}”，后面没有具体说明。`,
        "no-evidence",
        "可以展开网页依据查看标题位置，或换一个更具体的问题。",
        makeDiagnostics(intent, startedAt, { retrievedSegments: hits.length }),
      );
    }
    return cannot(
      "当前页面没有找到这项信息。",
      "no-evidence",
      "可以换一种问法，或打开包含这项信息的页面后再试。",
      makeDiagnostics(intent, startedAt, { retrievedSegments: hits.length }),
    );
  }

  return {
    responseType: "direct-answer",
    text: composed.data.text,
    citations: composed.data.citations,
    diagnostics: makeDiagnostics(intent, startedAt, {
      retrievedSegments: hits.length,
      citationCount: composed.data.citations.length,
    }),
  };
}

export class RuleDialogueEngine implements DialogueEngine {
  readonly mode = "rule-demo" as const;

  async respond(request: DialogueRequest): Promise<DialogueResponse> {
    assertDialogueRequest(request);
    return this.answer(request);
  }

  answer(request: DialogueRequest): DialogueResponse {
    const startedAt = performance.now();
    const snapshot = syntheticSnapshot(request);
    const intent = classifyIntent(request.utterance, request.context, {
      readable: request.page.readable,
      segmentCount: request.segments.length,
      controlCount: request.controls.length,
      iframeCount: request.page.iframeCount,
    });
    const diagnostics = makeDiagnostics(intent, startedAt);

    if (!request.page.readable) {
      return cannot(
        "我现在还读不到这个页面。",
        "read-failed",
        "等页面加载好后点“重试”，我再看看。",
        diagnostics,
      );
    }

    const pendingStep = request.plan === null ? null : currentStep(request.plan);
    if (
      (request.context.pageChanged || pendingStep?.state === "needs-review") &&
      intent.intentKind !== "context-feedback"
    ) {
      return cannot(
        "页面刚变过，我先核对当前进度。",
        "read-failed",
        "等我核对完，或点重试后再继续。",
        diagnostics,
      );
    }

    const namedControl = findNamedControl(request, request.utterance);
    if (
      namedControl !== undefined &&
      intent.intentKind !== "safety-boundary" &&
      intent.intentKind !== "task-switch" &&
      /(指给我看|指一下|指一指|哪一栏|那一栏)/.test(request.utterance)
    ) {
      return {
        responseType: "direct-answer",
        text: `我在页面上看到了「${namedControl.label}」这一栏。我只读标签，不会读取或代填内容；点下面的网页依据可以定位。`,
        citations: [citationForControl(namedControl, 0)],
        diagnostics: makeDiagnostics(intent, startedAt, { citationCount: 1 }),
      };
    }

    if (intent.intentKind === "safety-boundary") {
      return cannot(
        "这类填写、勾选、提交、验证码或密码操作需要你本人完成，我不能代做。",
        "read-only-boundary",
        "你自己操作时，我可以继续把页面上的位置指给你看。",
        diagnostics,
      );
    }

    if (intent.intentKind === "task-switch") {
      const response = clarify(
        "好，我们换个任务。",
        "你想了解页面上的什么，或想完成什么？",
        diagnostics,
      );
      if (request.plan !== null) {
        response.planPatch = { kind: "abandon", plan: abandonPlan(request.plan) };
      }
      return response;
    }

    if (intent.intentKind === "context-feedback") {
      const step = currentStep(request.plan);
      if (intent.feedbackKind === "not-found") {
        if (request.plan === null || step === null) {
          return cannot(
            "我还不知道你在找哪一步。",
            "low-confidence",
            "先告诉我你想完成什么，我再把入口指给你看。",
            diagnostics,
          );
        }
        const located = relocate(step, snapshot);
        if (located.status === "found") {
          const response = nextStepResponse(
            request.plan,
            `我重新找到了这个入口。你可以点下面的“指给我看”。`,
            diagnostics,
          );
          return response ?? clarify("你想让我指哪一步？", "你现在卡在哪一步？", diagnostics);
        }
        if (located.status === "ambiguous") {
          return clarify(
            "页面上有不止一个相似入口。",
            `你指的是“${step.targetControl.label}”这一类中的哪一个？`,
            diagnostics,
          );
        }
        return cannot(
          "这个页面现在没有找到那个入口。",
          "low-confidence",
          "页面可能改版了，或者这部分在内嵌框架里。你可以刷新后再试。",
          diagnostics,
        );
      }

      if (intent.feedbackKind === "misclick") {
        if (request.plan === null) {
          return clarify("没关系。", "你想重新完成什么？我按当前页面再看一遍。", diagnostics);
        }
        const planned = replan(request.plan.goal, snapshot, request.plan);
        if (planned.plan === null) {
          return cannot(
            "我按当前页面重新看了一遍，但没有找到可以执行的入口。",
            "low-confidence",
            "你可以换一个页面，或告诉我你想完成的具体动作。",
            diagnostics,
          );
        }
        const response = nextStepResponse(
          planned.plan,
          "好，我按当前页面重新规划了一下。",
          diagnostics,
          { kind: "supersede", plan: planned.plan },
        );
        return response ?? clarify("我重新看了一遍页面。", "你想先做哪一步？", diagnostics);
      }

      if (intent.feedbackKind === "done") {
        if (request.plan === null || step === null) {
          return clarify("我还没有正在陪办的步骤。", "你想先了解页面上的什么？", diagnostics);
        }
        const completion = evaluateCompletion(step, snapshot, true);
        if (completion.status === "blocked") {
          return cannot(
            "页面刚刚读不到，我还不能确认这一步。",
            "read-failed",
            "刷新页面后点“重试”，我再核对。",
            diagnostics,
          );
        }
        const advanced = advancePlan(request.plan, completion.status === "done-verified");
        if (advanced.completed) {
          const response = clarify(
            "这一步我先记下了。",
            "这一步完成后，页面还有需要我指的地方吗？",
            diagnostics,
          );
          response.planPatch = { kind: "complete", plan: advanced.plan };
          return response;
        }
        const prefix =
          completion.status === "done-verified"
            ? "这一步完成了。"
            : "按你的确认继续，页面未能验证。";
        const response = nextStepResponse(
          advanced.plan,
          prefix,
          diagnostics,
          { kind: "advance", plan: advanced.plan },
        );
        return response ?? clarify("我已经记下这一步。", "接下来你想做什么？", diagnostics);
      }
    }

    if (intent.intentKind === "process-goal") {
      if (request.plan !== null && request.plan.status === "active") {
        const response = nextStepResponse(
          request.plan,
          NEXT_STEP_LEAD,
          diagnostics,
        );
        if (response !== null) {
          return response;
        }
      }
      const planned = createPlan(request.utterance, snapshot);
      if (planned.plan === null) {
        const mappedFailure = planFailureResponse(planned.failure, diagnostics);
        if (mappedFailure !== null) {
          return mappedFailure;
        }
        const iframe = request.page.iframeCount > 0;
        const external = request.segments.some((segment) =>
          /(在线申请|去办理|前往办理|跳转到)/.test(segment.text),
        );
        return cannot(
          iframe
            ? "这个页面里可能包含内嵌框架或地图，我读不到里面的操作入口。"
            : external
              ? "这一步可能在另一个网站完成，我不能替你跳转。"
              : "这个页面没有找到可以一步步操作的入口。",
          iframe ? "iframe-or-map" : external ? "cross-origin" : "low-confidence",
          iframe
            ? "你可以在主页面找找文字入口，或者换一个页面。"
            : external
              ? "你在浏览器里打开那个页面后，我再接着看。"
              : "打开有筛选、查询控件的页面后再试。",
          diagnostics,
        );
      }
      const response = nextStepResponse(
        planned.plan,
        NEXT_STEP_CREATED_LEAD,
        diagnostics,
        { kind: "create", plan: planned.plan },
      );
      return response ?? cannot("这个页面没有可执行的步骤。", "low-confidence", "换一个页面后再试。", diagnostics);
    }

    if (intent.intentKind === "page-fact") {
      const query = buildQuery(request.utterance, intent.slots, request.context.currentGoal);
      return answerFact(request, query, intent.slots, intent, startedAt);
    }

    if (intent.intentKind === "ellipsis-reference") {
      const base =
        request.context.lastObject ??
        request.context.currentGoal ??
        request.context.currentStepGoal ??
        "";
      if (base.length === 0) {
        return clarify("我不确定你指的是哪一项。", "你指的是页面上的哪一项？", diagnostics);
      }
      if (request.plan !== null && request.plan.status === "active" && request.context.currentStepState === "done-verified") {
        const response = nextStepResponse(request.plan, NEXT_STEP_LEAD, diagnostics);
        if (response !== null) {
          return response;
        }
      }
      const query = buildQuery(`${base} ${request.utterance}`, { ...intent.slots, object: base }, base);
      return answerFact(request, query, { ...intent.slots, object: base }, intent, startedAt);
    }

    return clarify(
      "我可以回答页面上的问题，也可以一步一步陪你办。",
      "你想了解页面上的什么，或者想完成什么？",
      diagnostics,
    );
  }
}

export const ruleEngine = new RuleDialogueEngine();
export type { AssistantMessage, ResponseType };