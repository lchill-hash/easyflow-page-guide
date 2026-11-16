export type SensitiveKind =
  | "id-card"
  | "phone"
  | "bank-card"
  | "otp"
  | "email"
  | "password";

export interface SensitiveHit {
  kind: SensitiveKind;
  index: number;
  length: number;
}

interface SensitivePattern {
  kind: SensitiveKind;
  pattern: RegExp;
}

export const SENSITIVE_PATTERNS: readonly SensitivePattern[] = [
  { kind: "id-card", pattern: /\b\d{17}[\dXx]\b/g },
  { kind: "phone", pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g },
  { kind: "bank-card", pattern: /\b\d{16,19}\b/g },
  { kind: "email", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
];

const OTP_CONTEXT = /(验证码|动态码|短信验证)/;
const OTP_VALUE = /(?<!\d)\d{4,6}(?!\d)/g;
const PASSWORD_CONTEXT = /(密码|口令)\s*[:：]?\s*\S*/g;

function collectMatches(text: string, pattern: RegExp, kind: SensitiveKind, hits: SensitiveHit[]): void {
  const regex = new RegExp(pattern.source, pattern.flags);
  let match = regex.exec(text);
  while (match !== null) {
    hits.push({ kind, index: match.index, length: match[0].length });
    match = regex.exec(text);
  }
}

export function detectSensitive(text: string): SensitiveHit[] {
  const hits: SensitiveHit[] = [];
  for (const entry of SENSITIVE_PATTERNS) {
    collectMatches(text, entry.pattern, entry.kind, hits);
  }
  if (OTP_CONTEXT.test(text)) {
    collectMatches(text, OTP_VALUE, "otp", hits);
  }
  collectMatches(text, PASSWORD_CONTEXT, "password", hits);
  return hits.sort((left, right) => left.index - right.index || right.length - left.length);
}

export function containsSensitive(text: string): boolean {
  return detectSensitive(text).length > 0;
}