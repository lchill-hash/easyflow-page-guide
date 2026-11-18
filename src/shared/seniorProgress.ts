import { detectSensitive } from "./privacy/detect";
import { redactText } from "./privacy/redact";
import { sanitizeNameText } from "./privacy/name";

export const SENIOR_PROGRESS_STORAGE_KEY = "easyflow.senior.progress";
export const SENIOR_PROGRESS_SCHEMA_VERSION = 1;
export const SENIOR_PROGRESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const SENIOR_PROGRESS_MAX_GOAL_CHARS = 120;
export const SENIOR_PROGRESS_MAX_STEP_CHARS = 80;

export interface SeniorProgressInput {
  goal: string;
  stepLabel: string;
  domain: string;
  /** Zero-based, matching GuidePlan.currentIndex; zero when stepCount is zero. */
  stepIndex: number;
  stepCount: number;
}

/** A reminder only: no page content, control refs, conversation or success evidence. */
export interface SeniorProgress extends SeniorProgressInput {
  schemaVersion: 1;
  savedAt: number;
  requiresFreshRead: true;
}

const RECORD_KEYS = new Set([
  "schemaVersion", "goal", "stepLabel", "domain", "stepIndex", "stepCount", "savedAt", "requiresFreshRead",
]);
const CREDENTIAL_CONTEXT = /(?:api[ _-]?key|access[ _-]?token|secret|bearer|密码|口令|验证码|动态码|短信验证|证件号|身份证|护照号|银行卡|卡号)/i;
const HTML_OR_CONTROL = /<[^>]*>|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const EXTRA_PERSONAL_CONTEXT = /(?:我的?姓名是?|我的?名字是?|我叫|姓名[：:]?|申请人[：:]?|联系人[：:]?|办理人[：:]?|收件人[：:]?|详细地址[：:]?|家庭住址[：:]?)/;
const HONORIFIC_NAME_SUFFIX = /[\u4e00-\u9fa5·]{2,8}(?:先生|女士|同志|老师)/;

function sanitizeText(value: unknown, limit: number, required: boolean): string | null {
  if (typeof value !== "string" || value.length > 2000 || HTML_OR_CONTROL.test(value)) return null;
  if (CREDENTIAL_CONTEXT.test(value) || HONORIFIC_NAME_SUFFIX.test(value)) return null;
  // Inspect the whole input before limiting it, so truncation cannot split a secret.
  const names = sanitizeNameText(redactText(value));
  if (names.blocked || EXTRA_PERSONAL_CONTEXT.test(names.text)) return null;
  const clean = names.text.replace(/\s+/g, " ").trim();
  if (detectSensitive(clean).length > 0 || /\d{4,}/.test(clean)) return null;
  // URL paths, queries and userinfo may contain identifiers. Persist only a host.
  if (/\bhttps?:\/\/|www\.|[?&][\w-]+=/.test(clean)) return null;
  if (required && clean.length === 0) return null;
  return clean.slice(0, limit).trim();
}

function safeHostname(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  const clean = value.trim();
  if (clean.length === 0) return "";
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(clean) ? clean : `https://${clean}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username.length > 0 || url.password.length > 0) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname.length === 0 || hostname.length > 253 || detectSensitive(hostname).length > 0) return null;
    // Do not retain account IDs embedded in a subdomain.
    if (/\d{8,}/.test(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
}

function validStep(index: unknown, count: unknown): index is number {
  return typeof index === "number" && typeof count === "number" && Number.isInteger(index) &&
    Number.isInteger(count) && count >= 0 && count <= 12 && index >= 0 &&
    (count === 0 ? index === 0 : index < count);
}

/** Call only after the user opts in. Null means the task is unsuitable for storage. */
export function createProgress(input: SeniorProgressInput, now = Date.now()): SeniorProgress | null {
  if (!Number.isSafeInteger(now) || now <= 0 || input === null || typeof input !== "object") return null;
  if (!validStep(input.stepIndex, input.stepCount)) return null;
  const goal = sanitizeText(input.goal, SENIOR_PROGRESS_MAX_GOAL_CHARS, true);
  const stepLabel = input.stepCount === 0 ? "" : sanitizeText(input.stepLabel, SENIOR_PROGRESS_MAX_STEP_CHARS, false);
  const domain = safeHostname(input.domain);
  if (goal === null || stepLabel === null || domain === null) return null;
  return { schemaVersion: SENIOR_PROGRESS_SCHEMA_VERSION, goal, stepLabel, domain,
    stepIndex: input.stepIndex, stepCount: input.stepCount, savedAt: now, requiresFreshRead: true };
}

/** Fail closed on old schemas, unknown fields, corrupted values or expired reminders. */
export function parseProgress(raw: unknown, now = Date.now()): SeniorProgress | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw) || !Number.isSafeInteger(now) || now <= 0) return null;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).length !== RECORD_KEYS.size || Object.keys(value).some(key => !RECORD_KEYS.has(key))) return null;
  if (value.schemaVersion !== SENIOR_PROGRESS_SCHEMA_VERSION || value.requiresFreshRead !== true ||
    typeof value.savedAt !== "number" || !Number.isSafeInteger(value.savedAt) || value.savedAt <= 0 ||
    value.savedAt > now || now - value.savedAt >= SENIOR_PROGRESS_MAX_AGE_MS ||
    !validStep(value.stepIndex, value.stepCount)) return null;
  const candidate = createProgress({
    goal: value.goal as string, stepLabel: value.stepLabel as string, domain: value.domain as string,
    stepIndex: value.stepIndex, stepCount: value.stepCount as number,
  }, value.savedAt);
  // Stored fields must already be canonical. Never silently accept a tampered record.
  if (candidate === null || candidate.goal !== value.goal || candidate.stepLabel !== value.stepLabel ||
    candidate.domain !== value.domain) return null;
  return candidate;
}

/** Display as a reminder; do not automatically submit this text or restore a GuidePlan. */
export function resumePrompt(raw: unknown, now = Date.now()): string | null {
  const progress = parseProgress(raw, now);
  if (progress === null) return null;
  const step = progress.stepCount > 0
    ? `上次记录到第${progress.stepIndex + 1}步（共${progress.stepCount}步）${progress.stepLabel ? `：“${progress.stepLabel}”` : ""}。`
    : "";
  return `上次想做：“${progress.goal}”。${step}这是上次的记录，请先重新读取当前页面。预约是否完成、这一步能否继续，都要以当前页面重新核对。`;
}
