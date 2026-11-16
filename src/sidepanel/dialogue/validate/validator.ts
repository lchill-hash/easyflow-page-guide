import { MAX_ANSWER_CHARS, MAX_ANSWER_SENTENCES, MAX_CITATION_CHARS } from "../../../shared/constants";
import { normalizeWhitespace } from "../../../shared/domPath";
import type {
  DialogueResponse,
  GuidePlan,
  PageSnapshot,
  RejectReason,
  ValidationResult,
} from "../../../shared/types";

const RESPONSE_TYPES = new Set(["direct-answer", "clarify", "next-step", "cannot-answer"]);
const COMPLETION_KINDS = new Set([
  "text-appears",
  "element-appears",
  "element-disappears",
  "url-changed",
  "control-state-changed",
  "time-controls-appear",
  "control-selected",
  "form-controls-appear",
  "user-confirmed",
]);
const LIMITATION_REASONS = new Set([
  "no-evidence",
  "read-only-boundary",
  "cross-origin",
  "iframe-or-map",
  "login-or-captcha",
  "read-failed",
  "low-confidence",
]);

const PAGE_METADATA = /^(日期|来源|分享|字号|扫一扫|打印|主办|承办|京ICP|京公网安备|政府网站标识码|客服信箱|政务服务热线|建议您使用)/;

function rejected(reason: RejectReason): ValidationResult {
  return { status: "rejected", reason };
}

function sentenceCount(text: string): number {
  const matches = text.match(/[。！？；]/g);
  return Math.max(1, matches?.length ?? 1);
}

function numbersIn(text: string): string[] {
  return text.match(/\d+/g) ?? [];
}

function citationUnion(response: DialogueResponse): string {
  return response.citations.map((citation) => normalizeWhitespace(citation.text)).join(" ");
}

function validateDirectAnswer(response: DialogueResponse, snapshot: PageSnapshot): ValidationResult {
  if (response.citations.length < 1 || response.citations.length > 4) {
    return rejected("citation-count-invalid");
  }
  if (response.text.length > MAX_ANSWER_CHARS || sentenceCount(response.text) > MAX_ANSWER_SENTENCES) {
    return rejected("answer-too-long");
  }

  const union = citationUnion(response);
  for (const citation of response.citations) {
    if (citation.text.length === 0 || citation.text.length > MAX_CITATION_CHARS) {
      return rejected("citation-mismatch");
    }
    if (PAGE_METADATA.test(normalizeWhitespace(citation.text))) {
      return rejected("citation-mismatch");
    }
    const item = snapshot.items.find((entry) => entry.elementId === citation.ref.elementId);
    if (item === undefined) {
      return rejected("citation-missing");
    }
    if (item.tagName === "body" || item.tagName === "html" || item.tagName === "main") {
      return rejected("citation-too-broad");
    }
    if (!normalizeWhitespace(item.text).includes(normalizeWhitespace(citation.text))) {
      return rejected("citation-mismatch");
    }
    if (citation.role === "title") {
      const titleLike =
        item.titleCandidate === true || item.type === "heading" || item.type === "paragraph";
      if (!titleLike) {
        return rejected("citation-role-invalid");
      }
    }
  }

  for (const number of numbersIn(response.text)) {
    if (!union.includes(number)) {
      return rejected("fact-unsupported");
    }
  }
  return { status: "passed" };
}

function validateNextStep(response: DialogueResponse, snapshot: PageSnapshot): ValidationResult {
  if (response.targetControl === undefined || response.completionCondition === undefined) {
    return rejected("control-invalid");
  }
  if (!COMPLETION_KINDS.has(response.completionCondition.kind)) {
    return rejected("completion-invalid");
  }
  if (response.completionCondition.kind === "text-appears") {
    if (
      response.completionCondition.expectedText === undefined ||
      response.completionCondition.expectedText.length === 0 ||
      response.completionCondition.expectedText.length > 40
    ) {
      return rejected("completion-invalid");
    }
  }

  const controls = snapshot.controls ?? [];
  const control = controls.find(
    (entry) =>
      entry.controlId === response.targetControl?.controlId ||
      entry.ref.elementId === response.targetControl?.ref.elementId,
  );
  if (control === undefined || control.visibility !== "visible" || control.riskFlags.length > 0) {
    return rejected("control-invalid");
  }
  if (control.ambiguous) {
    return rejected("control-invalid");
  }
  if (response.citations.length !== 0) {
    return rejected("citation-count-invalid");
  }
  return { status: "passed" };
}

function validateClarify(response: DialogueResponse): ValidationResult {
  if (response.clarify === undefined || response.clarify.question.trim().length === 0) {
    return rejected("low-confidence" as RejectReason);
  }
  if ((response.clarify.options?.length ?? 0) > 3) {
    return rejected("citation-count-invalid");
  }
  return { status: "passed" };
}

function validateCannotAnswer(response: DialogueResponse): ValidationResult {
  if (response.limitation === undefined) {
    return rejected("low-confidence" as RejectReason);
  }
  if (!LIMITATION_REASONS.has(response.limitation.reason)) {
    return rejected("low-confidence" as RejectReason);
  }
  if (response.limitation.advice.trim().length === 0) {
    return rejected("low-confidence" as RejectReason);
  }
  return { status: "passed" };
}

export function validateResponse(
  response: DialogueResponse,
  snapshot: PageSnapshot,
  plan: GuidePlan | null,
): ValidationResult {
  if (!RESPONSE_TYPES.has(response.responseType)) {
    return rejected("mode-mismatch");
  }
  if (response.text.trim().length === 0) {
    return rejected("low-confidence" as RejectReason);
  }
  if (response.planPatch !== undefined && plan !== null && response.planPatch.plan.version < plan.version) {
    return rejected("mode-mismatch");
  }

  if (response.responseType === "direct-answer") {
    return validateDirectAnswer(response, snapshot);
  }
  if (response.responseType === "next-step") {
    return validateNextStep(response, snapshot);
  }
  if (response.responseType === "clarify") {
    return validateClarify(response);
  }
  return validateCannotAnswer(response);
}