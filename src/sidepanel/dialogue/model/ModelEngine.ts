import { MAX_ANSWER_CHARS, MAX_ANSWER_SENTENCES } from "../../../shared/constants";
import { MODEL_API_BASE_URL, MODEL_HEALTH_TIMEOUT_MS, MODEL_MAX_QUOTE_CHARS, MODEL_REQUEST_TIMEOUT_MS } from "../../../shared/model/config";
import { ModelFallbackError } from "../../../shared/model/fallback";
import { PROXY_CONTRACT, sanitizeOutbound } from "../../../shared/privacy/redact";
import type { OutboundPayload } from "../../../shared/privacy/redact";
import type { CitationAnchor, DialogueRequest, DialogueResponse, ElementRef, EngineDiagnostics, SemanticSegment } from "../../../shared/types";
import { assertDialogueRequest } from "../DialogueEngine";
import type { DialogueEngine } from "../DialogueEngine";

interface ModelEvidence {
  segmentId: string;
  quote: string;
}

interface ModelReply {
  kind: "answer" | "clarify" | "cannot-answer";
  answer: string;
  evidence: ModelEvidence[];
  question?: string;
}

const UNSAFE_STEP_TEXT = /(提交|支付|付款|验证码|密码|身份证号|银行卡号|代填|自动点击|自动提交|注销|删除账号)/;
const UNSAFE_AUTOMATION_TEXT = /(代填|自动点击|自动提交|(?:替你|帮你)(?:填写|勾选|提交|支付|付款))/;

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function isTimeout(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof Error && /^(TimeoutError|AbortError)$/.test(error.name));
}

function parseReply(value: unknown): ModelReply {
  const entry = recordOf(value);
  if (entry === null) throw new ModelFallbackError("model-invalid");
  if (entry.kind === "step") {
    const text = typeof entry.answer === "string" ? entry.answer : entry.text;
    throw new ModelFallbackError(typeof text === "string" && UNSAFE_STEP_TEXT.test(text)
      ? "unsafe-instruction" : "model-invalid");
  }
  if ((entry.kind !== "answer" && entry.kind !== "clarify" && entry.kind !== "cannot-answer") ||
    typeof entry.answer !== "string" || entry.answer.trim().length === 0 ||
    entry.answer.length > MAX_ANSWER_CHARS || !Array.isArray(entry.evidence) ||
    entry.evidence.length > 4 ||
    (entry.question !== undefined && (typeof entry.question !== "string" ||
      entry.question.trim().length === 0 || entry.question.length > MAX_ANSWER_CHARS))) {
    throw new ModelFallbackError("model-invalid");
  }
  if (UNSAFE_AUTOMATION_TEXT.test(entry.answer)) throw new ModelFallbackError("unsafe-instruction");
  const evidence = entry.evidence.map((value): ModelEvidence => {
    const item = recordOf(value);
    if (item === null || typeof item.segmentId !== "string" || item.segmentId.length === 0 ||
      typeof item.quote !== "string" || item.quote.trim().length === 0 ||
      item.quote.length > MODEL_MAX_QUOTE_CHARS) {
      throw new ModelFallbackError("model-invalid");
    }
    return { segmentId: item.segmentId, quote: item.quote.trim() };
  });
  const reply: ModelReply = { kind: entry.kind, answer: entry.answer.trim(), evidence };
  if (typeof entry.question === "string") reply.question = entry.question.trim();
  return reply;
}

interface SegmentPart {
  text: string;
  ref: ElementRef | undefined;
  role: "body" | "title";
}

function partsOf(segment: SemanticSegment): SegmentPart[] | null {
  const body: SegmentPart[] = segment.bodyTexts.map((text, index) => ({
    text, ref: segment.bodyRefs[index], role: "body",
  }));
  const titled: SegmentPart[] = [{ text: segment.titleText, ref: segment.titleRef, role: "title" }, ...body];
  if (titled.map((part) => part.text).join(" ") === segment.text) return titled;
  // semantic.ts fallback segments contain body text only; their first body is also the title ref.
  const first = body[0];
  if (first !== undefined && first.text === segment.titleText &&
    first.ref?.elementId === segment.titleRef.elementId &&
    first.ref?.domPath === segment.titleRef.domPath &&
    first.ref?.textHash === segment.titleRef.textHash &&
    body.map((part) => part.text).join(" ") === segment.text) return body;
  return null;
}

function citationsForQuote(segment: SemanticSegment, quote: string, firstIndex: number): CitationAnchor[] | null {
  const parts = partsOf(segment);
  const quoteStart = segment.text.indexOf(quote);
  if (parts === null || quoteStart < 0) return null;
  const quoteEnd = quoteStart + quote.length;
  const citations: CitationAnchor[] = [];
  let partStart = 0;
  let coveredUntil = quoteStart;
  for (const part of parts) {
    const partEnd = partStart + part.text.length;
    const overlapStart = Math.max(partStart, quoteStart);
    const overlapEnd = Math.min(partEnd, quoteEnd);
    if (overlapStart < overlapEnd) {
      // Only the whitespace inserted between original elements may lack its own ref.
      if (/\S/.test(segment.text.slice(coveredUntil, overlapStart))) return null;
      const raw = part.text.slice(overlapStart - partStart, overlapEnd - partStart);
      const text = raw.trim();
      if (text.length > 0) {
        if (part.ref === undefined) return null;
        const start = overlapStart - partStart + raw.indexOf(text);
        citations.push({ citationId: `model-cite-${firstIndex + citations.length + 1}`,
          segmentId: segment.segmentId, role: part.role, text, start, end: start + text.length,
          status: "valid", ref: part.ref });
      }
      coveredUntil = overlapEnd;
    }
    partStart = partEnd + 1;
  }
  if (/\S/.test(segment.text.slice(coveredUntil, quoteEnd)) || citations.length === 0) return null;
  return citations;
}

function citationsFor(reply: ModelReply, request: DialogueRequest, outbound: OutboundPayload): CitationAnchor[] {
  if (reply.kind === "answer" && reply.evidence.length === 0) throw new ModelFallbackError("ungrounded");
  const citations: CitationAnchor[] = [];
  for (const item of reply.evidence) {
    const sent = outbound.segments.find((segment) => segment.segmentId === item.segmentId);
    const original = request.segments.find((segment) => segment.segmentId === item.segmentId);
    // The whole quote must have been sent unchanged. Map every non-whitespace character
    // to its original element; never restore redacted text or substitute an unrelated sentence.
    if (sent === undefined || original === undefined || !sent.text.includes(item.quote)) {
      throw new ModelFallbackError("ungrounded");
    }
    const mapped = citationsForQuote(original, item.quote, citations.length);
    if (mapped === null || citations.length + mapped.length > 4) throw new ModelFallbackError("ungrounded");
    citations.push(...mapped);
  }
  return citations;
}

export async function probeModelProxy(): Promise<boolean> {
  try {
    const response = await fetch(`${MODEL_API_BASE_URL}/health`, {
      method: "GET", signal: AbortSignal.timeout(MODEL_HEALTH_TIMEOUT_MS),
      credentials: "omit", cache: "no-store", redirect: "error",
    });
    if (!response.ok) return false;
    const data = recordOf(await response.json());
    return data?.ok === true && data.modelConfigured === true;
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
    const body = JSON.stringify(outbound.payload);
    const outboundBytes = new TextEncoder().encode(body).length;
    const signal = AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${MODEL_API_BASE_URL}/v1/dialogue`, { method: "POST", signal,
        credentials: "omit", cache: "no-store", redirect: "error",
        headers: { "Content-Type": "application/json" }, body });
    } catch (error) {
      throw new ModelFallbackError(isTimeout(error, signal) ? "timeout" : "network");
    }
    if (!response.ok) throw new ModelFallbackError("network");
    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new ModelFallbackError(isTimeout(error, signal) ? "timeout" : "model-invalid");
    }
    const reply = parseReply(recordOf(data)?.result);
    const citations = citationsFor(reply, request, outbound.payload);
    const diagnostics: EngineDiagnostics = { mode: "online-model",
      engineMs: Math.round(performance.now() - startedAt),
      retrievedSegments: new Set(citations.map((citation) => citation.segmentId)).size,
      citationCount: citations.length,
      intentKind: reply.kind === "answer" ? "page-fact" : "fallback-clarify",
      priorityHit: "deepseek-server", outboundBytes, sensitiveDetected: false };
    if (reply.kind === "answer") {
      const quoteText = citations.map((citation) => citation.text).join(" ");
      const numbers = reply.answer.match(/\d+/g) ?? [];
      const sentences = Math.max(1, reply.answer.match(/[。！？；]/g)?.length ?? 1);
      if (sentences > MAX_ANSWER_SENTENCES || numbers.some((number) => !quoteText.includes(number))) {
        throw new ModelFallbackError("ungrounded");
      }
      return { responseType: "direct-answer", text: reply.answer, citations, diagnostics };
    }
    if (reply.kind === "clarify") {
      return { responseType: "clarify", text: reply.answer, citations,
        clarify: { question: (reply.question ?? reply.answer).slice(0, 100) }, diagnostics };
    }
    return { responseType: "cannot-answer", text: reply.answer, citations,
      limitation: { reason: "no-evidence", advice: "可以换一种问法，或重新读取当前页面后再试。" }, diagnostics };
  }
}

export const modelEngine = new ModelDialogueEngine();
export { PROXY_CONTRACT };
