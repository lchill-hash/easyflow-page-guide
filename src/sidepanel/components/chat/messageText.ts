import { normalizeWhitespace } from "../../../shared/domPath";

export const STEP_LEAD_PATTERNS: readonly string[] = [
  "先做这一步",
  "先完成这一步",
  "现在这一步",
  "现在这一步是",
  "现在请",
  "下一步",
  "继续下一步",
  "好，我按当前页面重新规划了一下。先做这一步",
];

export const STEP_CHANGE_SIGNALS: readonly string[] = [
  "原来",
  "变化",
  "不在页面",
  "最早",
  "现在可选",
];

export interface StepDedupeInput {
  text: string;
  stepGoal: string;
  shortText: string;
  responseType: string;
  cardActive: boolean;
}

export interface StepDedupeResult {
  text: string;
  hidden: boolean;
  removed: number;
}

const EDGE_PUNCTUATION = /^[。！？；：、“”"'‘’\s]+|[。！？；：、“”"'‘’\s]+$/g;

function normalizeForCompare(text: string): string {
  return normalizeWhitespace(text).replace(EDGE_PUNCTUATION, "");
}

function hasLeadPrefix(text: string, base: string): boolean {
  const normalizedText = normalizeForCompare(text);
  const normalizedBase = normalizeForCompare(base);
  if (normalizedBase.length === 0 || !normalizedText.endsWith(normalizedBase)) {
    return false;
  }
  const prefix = normalizeForCompare(
    normalizedText.slice(0, normalizedText.length - normalizedBase.length),
  );
  return STEP_LEAD_PATTERNS.some(
    (pattern) => prefix === pattern || prefix.startsWith(pattern),
  );
}

function actionTokenOf(shortText: string): string {
  return shortText.match(/\d{1,2}:\d{2}/)?.[0] ?? "";
}

function isRestatement(
  sentence: string,
  input: StepDedupeInput,
  token: string,
): boolean {
  const normalized = normalizeForCompare(sentence);
  if (normalized === normalizeForCompare(input.shortText)) {
    return true;
  }
  if (normalized === normalizeForCompare(input.stepGoal)) {
    return true;
  }
  if (hasLeadPrefix(sentence, input.stepGoal) || hasLeadPrefix(sentence, input.shortText)) {
    return true;
  }
  return (
    token.length > 0 &&
    sentence.includes(token) &&
    STEP_LEAD_PATTERNS.some((pattern) => normalized.startsWith(pattern))
  );
}

export function stripDuplicateStepText(input: StepDedupeInput): StepDedupeResult {
  if (
    input.cardActive !== true ||
    input.responseType !== "next-step" ||
    input.stepGoal.trim().length === 0 ||
    input.shortText.trim().length === 0 ||
    input.text.trim().length === 0
  ) {
    return { text: input.text, hidden: false, removed: 0 };
  }
  const sentences = input.text.match(/[^。！？；]+[。！？；]?/g) ?? [input.text];
  const token = actionTokenOf(input.shortText);
  const kept: string[] = [];
  let removed = 0;
  for (const sentence of sentences) {
    const hasSignal = STEP_CHANGE_SIGNALS.some((signal) => sentence.includes(signal));
    if (!hasSignal && isRestatement(sentence, input, token)) {
      removed += 1;
      continue;
    }
    kept.push(sentence);
  }
  const text = kept.join("").trim();
  if (text.length === 0) {
    return { text: "", hidden: true, removed };
  }
  return { text, hidden: false, removed };
}