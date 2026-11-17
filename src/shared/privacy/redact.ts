import { MAX_OUTBOUND_CHARS, MAX_OUTBOUND_CONTROLS, MAX_OUTBOUND_SEGMENTS } from "../constants";
import type { PageControl, SemanticSegment, Slots } from "../types";
import { detectSensitive } from "./detect";
import type { SensitiveHit, SensitiveKind } from "./detect";
import { detectNameRisk, sanitizeNameText } from "./name";

const PLACEHOLDER: Record<SensitiveKind, string> = {
  "id-card": "证件号",
  phone: "手机号",
  "bank-card": "银行卡号",
  otp: "验证码",
  email: "邮箱",
  password: "密码",
};

export const PROXY_CONTRACT = {
  endpoint: "POST http://127.0.0.1:8765/v1/dialogue",
  localOnly: true,
  timeoutMs: 8000,
  requestsPerMinute: 20,
  maxOutputTokens: 1200,
  envKeys: [
    "EASYFLOW_MODEL_SECRET",
    "EASYFLOW_MODEL_NAME",
    "EASYFLOW_MODEL_TIMEOUT_MS",
    "EASYFLOW_MODEL_MAX_OUTPUT_TOKENS",
    "EASYFLOW_EXTENSION_ID",
  ],
  audit: "仅记录请求 ID、耗时、字节数、拒绝原因，不记录正文",
} as const;

export function redactUrl(href: string): string {
  try {
    const url = new URL(href);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return "";
  }
}

function nonOverlapping(hits: SensitiveHit[]): SensitiveHit[] {
  const kept: SensitiveHit[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.index < cursor) {
      continue;
    }
    kept.push(hit);
    cursor = hit.index + hit.length;
  }
  return kept;
}

export function redactText(text: string): string {
  const hits = nonOverlapping(detectSensitive(text));
  if (hits.length === 0) {
    return text;
  }
  let result = "";
  let cursor = 0;
  for (const hit of hits) {
    result += text.slice(cursor, hit.index);
    result += PLACEHOLDER[hit.kind];
    cursor = hit.index + hit.length;
  }
  result += text.slice(cursor);
  return result;
}

export interface OutboundSource {
  utterance: string;
  domain: string;
  title: string;
  url: string;
  segments: SemanticSegment[];
  controls: PageControl[];
  slots?: Slots;
}

export interface OutboundPayload {
  utterance: string;
  page: { domain: string; title: string; url: string };
  segments: Array<{ segmentId: string; text: string }>;
  controls: Array<{ controlId: string; label: string; controlType: string; kind: string; disabled: boolean; risky: boolean }>;
  truncated: boolean;
}

export type OutboundResult =
  | { status: "pass"; payload: OutboundPayload }
  | { status: "blocked"; reason: string };

export function sanitizeOutbound(source: OutboundSource): OutboundResult {
  let truncated = false;
  let usedChars = 0;
  const segments: Array<{ segmentId: string; text: string }> = [];

  const utterance = sanitizeNameText(redactText(source.utterance));
  if (utterance.blocked) {
    return { status: "blocked", reason: "name-risk" };
  }
  const title = sanitizeNameText(redactText(source.title));
  if (title.blocked) {
    return { status: "blocked", reason: "name-risk" };
  }

  for (const segment of source.segments.slice(0, MAX_OUTBOUND_SEGMENTS)) {
    const remaining = MAX_OUTBOUND_CHARS - usedChars;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const sanitized = sanitizeNameText(redactText(segment.text));
    if (sanitized.blocked) {
      truncated = true;
      continue;
    }
    const text = sanitized.text.slice(0, remaining);
    if (text.length < segment.text.length) {
      truncated = true;
    }
    usedChars += text.length;
    segments.push({ segmentId: segment.segmentId, text });
  }

  const controls = source.controls
    .slice(0, MAX_OUTBOUND_CONTROLS)
    .flatMap((control) => {
      const label = sanitizeNameText(redactText(control.label));
      if (label.blocked) {
        return [];
      }
      return [{
        controlId: control.controlId,
        label: label.text,
        controlType: control.controlType,
        kind: control.kind ?? "generic",
        disabled: control.disabled === true,
        risky: control.riskFlags.length > 0 || control.ambiguous || control.visibility !== "visible",
      }];
    });

  const payload: OutboundPayload = {
    utterance: utterance.text,
    page: {
      domain: source.domain,
      title: title.text,
      url: redactUrl(source.url),
    },
    segments,
    controls,
    truncated,
  };
  const check = assertNoSensitive(payload);
  if (check.status === "blocked") {
    return check;
  }
  return { status: "pass", payload };
}

export function assertNoSensitive(payload: unknown): OutboundResult | { status: "pass" } {
  let serialized = "";
  try {
    serialized = JSON.stringify(payload);
  } catch {
    return { status: "blocked", reason: "payload-serialization-failed" };
  }
  if (/<[a-z][\s\S]*>/i.test(serialized) || /"value"\s*:/.test(serialized)) {
    return { status: "blocked", reason: "html-or-value-detected" };
  }
  if (detectSensitive(serialized).length > 0) {
    return { status: "blocked", reason: "sensitive-data-detected" };
  }
  if (detectNameRisk(serialized).unlabeled > 0) {
    return { status: "blocked", reason: "name-risk" };
  }
  return { status: "pass" };
}
