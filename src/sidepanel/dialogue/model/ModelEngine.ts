import { MAX_ANSWER_CHARS, MAX_CITATION_CHARS } from "../../../shared/constants";
import { normalizeWhitespace } from "../../../shared/domPath";
import { ModelFallbackError } from "../../../shared/model/fallback";
import { PROXY_CONTRACT, redactUrl, sanitizeOutbound } from "../../../shared/privacy/redact";
import type { CitationAnchor, CompletionCondition, DialogueRequest, DialogueResponse, EngineDiagnostics, GuidePlan, PageControl, SemanticSegment } from "../../../shared/types";
import { assertDialogueRequest } from "../DialogueEngine";
import type { DialogueEngine } from "../DialogueEngine";

const baseUrl = "http://127.0.0.1:8765";
interface ModelReply {
  kind: "answer" | "step" | "clarify";
  text: string;
  segmentIds?: string[];
  controlId?: string;
  question?: string;
}

const UNSAFE_STEP_TEXT = /(提交|支付|付款|验证码|密码|身份证号|银行卡号|代填|自动点击|自动提交|注销|删除账号)/;
const UNSAFE_CONTROL_LABEL = /(提交|支付|付款|发送验证码|确认提交|注销|删除)/;

function isModelReply(value: unknown): value is ModelReply {
  if (value === null || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (entry.kind === "answer" || entry.kind === "step" || entry.kind === "clarify") &&
    typeof entry.text === "string" && entry.text.trim().length > 0;
}

function citationFor(segment: SemanticSegment, index: number): CitationAnchor | null {
  const bodyIndex = segment.bodyTexts.findIndex((text) => normalizeWhitespace(text).length > 0);
  const ref = bodyIndex < 0 ? segment.titleRef : segment.bodyRefs[bodyIndex];
  const raw = bodyIndex < 0 ? segment.titleText : segment.bodyTexts[bodyIndex];
  if (ref === undefined || raw === undefined) return null;
  const text = normalizeWhitespace(raw).slice(0, MAX_CITATION_CHARS);
  if (text.length === 0) return null;
  return { citationId: `model-cite-${index + 1}`, segmentId: segment.segmentId,
    role: bodyIndex < 0 ? "title" : "body", text, start: 0, end: text.length,
    status: "valid", ref };
}

function completionFor(control: PageControl): CompletionCondition {
  if (control.kind === "date") return { kind: "time-controls-appear" };
  if (control.kind === "time") return { kind: "control-selected", controlRef: control.ref };
  if (control.kind === "next" || control.controlType === "link") return { kind: "url-changed" };
  return { kind: "user-confirmed" };
}

function planFor(request: DialogueRequest, control: PageControl): GuidePlan {
  const version = (request.plan?.version ?? 0) + 1;
  const completion = completionFor(control);
  return { planId: `plan-${request.page.snapshotId}-model-${version}`, version,
    goal: request.context.currentGoal || request.utterance, status: "active", currentIndex: 0,
    steps: [{ stepId: `step-model-${version}`, index: 0, goal: request.utterance,
      redactedUrl: redactUrl(request.page.url), observedState: "模型依据当前页面控件给出下一步",
      state: "current", evidence: control.label, targetControl: control, completion }] };
}

export async function probeModelProxy(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    const data = (await response.json()) as { ready?: unknown };
    return data.ready === true;
  } catch { return false; }
}

export class ModelDialogueEngine implements DialogueEngine {
  readonly mode = "online-model" as const;

  async respond(request: DialogueRequest): Promise<DialogueResponse> {
    assertDialogueRequest(request);
    const startedAt = performance.now();
    const outbound = sanitizeOutbound({ utterance: request.utterance, domain: request.page.domain,
      title: request.page.title, url: request.page.url, segments: request.segments,
      controls: request.controls });
    if (outbound.status === "blocked") throw new ModelFallbackError("outbound-blocked");
    const outboundBytes = new TextEncoder().encode(JSON.stringify(outbound.payload)).length;
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/dialogue`, { method: "POST",
        signal: AbortSignal.timeout(PROXY_CONTRACT.timeoutMs + 2000),
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(outbound.payload) });
    } catch {
      throw new ModelFallbackError("network");
    }
    if (!response.ok) throw new ModelFallbackError("network");
    const data = (await response.json()) as { result?: unknown };
    if (!isModelReply(data.result)) throw new ModelFallbackError("model-invalid");
    const reply = data.result;
    const diagnostics: EngineDiagnostics = { mode: "online-model",
      engineMs: Math.round(performance.now() - startedAt), retrievedSegments: 0,
      citationCount: 0, intentKind: reply.kind === "answer" ? "page-fact" :
        reply.kind === "step" ? "process-goal" : "fallback-clarify",
      priorityHit: "deepseek-proxy", outboundBytes,
      sensitiveDetected: false };
    if (reply.text.length > MAX_ANSWER_CHARS) throw new ModelFallbackError("model-invalid");
    if (reply.kind === "answer") {
      const ids = Array.isArray(reply.segmentIds) ? reply.segmentIds.slice(0, 4) : [];
      const citations = ids.flatMap((id, index) => {
        const segment = request.segments.find((item) => item.segmentId === id);
        const citation = segment === undefined ? null : citationFor(segment, index);
        return citation === null ? [] : [citation];
      });
      if (citations.length === 0) throw new ModelFallbackError("ungrounded");
      return { responseType: "direct-answer", text: reply.text.trim(), citations,
        diagnostics: { ...diagnostics, retrievedSegments: citations.length, citationCount: citations.length } };
    }
    if (reply.kind === "step") {
      if (UNSAFE_STEP_TEXT.test(reply.text)) throw new ModelFallbackError("unsafe-instruction");
      const control = request.controls.find((item) => item.controlId === reply.controlId);
      if (control === undefined || control.visibility !== "visible" || control.disabled === true ||
        control.ambiguous || control.riskFlags.length > 0 || control.kind === "form" ||
        UNSAFE_CONTROL_LABEL.test(control.label)) {
        throw new ModelFallbackError("unsafe-control");
      }
      const plan = planFor(request, control);
      return { responseType: "next-step", text: reply.text.slice(0, MAX_ANSWER_CHARS),
        citations: [], targetControl: control, completionCondition: plan.steps[0]!.completion,
        planPatch: { kind: request.plan === null ? "create" : "supersede", plan }, diagnostics };
    }
    const question = typeof reply.question === "string" && reply.question.trim()
      ? reply.question.trim() : reply.text.trim();
    return { responseType: "clarify", text: reply.text.slice(0, MAX_ANSWER_CHARS),
      citations: [], clarify: { question: question.slice(0, 100) }, diagnostics };
  }
}

export const modelEngine = new ModelDialogueEngine();
export { PROXY_CONTRACT };
