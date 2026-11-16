import {
  STEP_CARD_SHORT_MAX_WIDTH,
  STEP_CARD_SHORT_NAME_MAX_CHARS,
} from "../../../shared/constants";
import type {
  CompletionCondition,
  ElementRef,
  PageControl,
  PageSnapshot,
  TargetControl,
} from "../../../shared/types";

export type StepCardFallbackReason =
  | "no-target"
  | "stale-target"
  | "snapshot-mismatch"
  | "unparseable"
  | "ambiguous-date"
  | "ambiguous-timezone"
  | "ambiguous-time";

export interface StepCardCopyInput {
  targetControl: TargetControl;
  snapshot: PageSnapshot | null;
  completionCondition: CompletionCondition;
}

export interface StepCardCopy {
  shortText: string;
  rawLabel: string;
  targetRef: ElementRef;
  completionText: string;
  includesTime: boolean;
  includesDate: boolean;
  labelTruncated: boolean;
  fallbackReason: StepCardFallbackReason | null;
  sourceSnapshotId: string;
}

export interface CopySource {
  control: TargetControl;
  source: "snapshot" | "step";
  usable: boolean;
}

export interface DateContext {
  pageDates: PageControl[];
  selectedDate: PageControl | null;
}

interface ComposeResult {
  text: string;
  reason: StepCardFallbackReason | null;
  includesDate: boolean;
}

export const GENERIC_FALLBACK_TEXT = "现在请在网页上选择对应项";

export const TIME_TOKEN = /(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*(?:am|pm))?/i;
const TIME_PREFIX = /(上午|下午|凌晨|晚上)\s*$/;
const TZ_TOKEN = /(?:GMT|UTC)[+-]\d{1,2}(?::\d{2})?|\b(?:GMT|UTC)\b/i;
const FULL_YEAR_DATE = /((?:19|20)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/;
const CN_DATE = /(\d{1,2})月(\d{1,2})日/;
const EN_MONTH_FIRST =
  /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})/i;
const EN_DAY_FIRST =
  /(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)/i;
const MONTH_DAY = /(?:^|[^\d:])(\d{1,2})[\/-](\d{1,2})(?!\d)/;
const DAY_ONLY = /^(\d{1,2})(?:日)?$/;
const NEXT_ONLY = /^(next|continue|下一步|继续)$/i;
const MEANINGLESS_NAME = /^(select|choose|choose an option|option|请选择|选择|确定|ok|okay)$/i;
const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const TEMPLATE_DATE = "现在请选择 ";
const TEMPLATE_TIME = "现在请点网页上的 ";
const TEMPLATE_TIME_COMPACT = "请点 ";
const TEMPLATE_NEXT = "现在请点击网页上的";
const TEMPLATE_NEXT_COMPACT = "请点击";
const TEMPLATE_GENERIC = "现在请在网页上选择";
const TEMPLATE_GENERIC_COMPACT = "选择";

function withFallback(reason: StepCardFallbackReason): ComposeResult {
  return { text: GENERIC_FALLBACK_TEXT, reason, includesDate: false };
}

export function estimateCopyWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += /[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 1 : 0.6;
  }
  return Math.round(width);
}

export function extractTimeToken(label: string): string | null {
  const match = TIME_TOKEN.exec(label);
  if (match === null) {
    return null;
  }
  const token = match[0].replace(/\s+/g, " ").trim();
  const before = label.slice(Math.max(0, match.index - 6), match.index);
  const prefix = TIME_PREFIX.exec(before)?.[1];
  return prefix === undefined ? token : `${prefix}${token}`;
}

export function extractTimeZoneToken(label: string): string | null {
  const match = TZ_TOKEN.exec(label);
  return match === null ? null : match[0].toUpperCase().replace(/\s+/g, "");
}

function monthNumber(name: string): number {
  return MONTHS[name.slice(0, 3).toLowerCase()] ?? 0;
}

function padMonthDay(month: number, day: number): string {
  return `${month}月${day}日`;
}

function yearsOf(pageDates: PageControl[]): Set<string> {
  const years = new Set<string>();
  for (const date of pageDates) {
    const match = /((?:19|20)\d{2})年|((?:19|20)\d{2})[-/.]/.exec(date.label);
    const year = match?.[1] ?? match?.[2];
    if (year !== undefined) {
      years.add(year);
    }
  }
  return years;
}

function monthOfPageDates(pageDates: PageControl[]): number | null {
  const months = new Set<number>();
  for (const date of pageDates) {
    const cn = /(\d{1,2})月(\d{1,2})日/.exec(date.label);
    if (cn !== null) {
      months.add(Number(cn[1]));
      continue;
    }
    const en = EN_MONTH_FIRST.exec(date.label);
    if (en !== null) {
      const month = monthNumber(en[1] ?? "");
      if (month > 0) {
        months.add(month);
        continue;
      }
    }
    const md = FULL_YEAR_DATE.exec(date.label) ?? MONTH_DAY.exec(date.label);
    if (md !== null) {
      months.add(Number(md[2]));
    }
  }
  return months.size === 1 ? [...months][0] ?? null : null;
}

export function extractDateToken(label: string, context: DateContext): string | null {
  const multiYear = yearsOf(context.pageDates).size > 1;
  const full = FULL_YEAR_DATE.exec(label);
  if (full !== null) {
    const year = Number(full[1]);
    const month = Number(full[2]);
    const day = Number(full[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return multiYear ? `${year}年${padMonthDay(month, day)}` : padMonthDay(month, day);
    }
  }
  const cn = CN_DATE.exec(label);
  if (cn !== null) {
    const yearMatch = /((?:19|20)\d{2})年/.exec(label);
    const month = Number(cn[1]);
    const day = Number(cn[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return yearMatch !== null && multiYear
        ? `${yearMatch[1]}年${padMonthDay(month, day)}`
        : padMonthDay(month, day);
    }
  }
  const enFirst = EN_MONTH_FIRST.exec(label);
  if (enFirst !== null) {
    const month = monthNumber(enFirst[1] ?? "");
    const day = Number(enFirst[2]);
    if (month > 0 && day >= 1 && day <= 31) {
      return padMonthDay(month, day);
    }
  }
  const enDay = EN_DAY_FIRST.exec(label);
  if (enDay !== null) {
    const month = monthNumber(enDay[2] ?? "");
    const day = Number(enDay[1]);
    if (month > 0 && day >= 1 && day <= 31) {
      return padMonthDay(month, day);
    }
  }
  const md = MONTH_DAY.exec(label);
  if (md !== null) {
    const month = Number(md[1]);
    const day = Number(md[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return padMonthDay(month, day);
    }
  }
  const dayOnly = DAY_ONLY.exec(label.trim());
  if (dayOnly !== null) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      const month = monthOfPageDates(context.pageDates);
      if (month !== null) {
        return padMonthDay(month, day);
      }
    }
  }
  return null;
}

function shortNameOf(label: string): string {
  const cleaned = label.replace(/[。.!！]+$/g, "").trim();
  return Array.from(cleaned).slice(0, STEP_CARD_SHORT_NAME_MAX_CHARS).join("");
}

function chooseText(candidates: string[]): string {
  const fitting = candidates.find((text) => estimateCopyWidth(text) <= STEP_CARD_SHORT_MAX_WIDTH);
  return fitting ?? candidates[candidates.length - 1] ?? GENERIC_FALLBACK_TEXT;
}

function composeTime(
  control: TargetControl,
  timeToken: string,
  dateToken: string | null,
  dateContext: DateContext,
  pageTimes: PageControl[],
): ComposeResult {
  const multiDate = dateContext.pageDates.length > 1;
  let dateQualifier: string | null = null;
  if (multiDate) {
    const selected = dateContext.selectedDate;
    if (selected === null) {
      return withFallback("ambiguous-date");
    }
    dateQualifier = dateToken ?? extractDateToken(selected.label, dateContext);
    if (dateQualifier === null) {
      return withFallback("ambiguous-date");
    }
  }
  const pageZones = pageTimes
    .map((item) => extractTimeZoneToken(item.label))
    .filter((value): value is string => value !== null);
  const multiZone = new Set(pageZones).size > 1;
  const zone = extractTimeZoneToken(control.label);
  if (multiZone && zone === null) {
    return withFallback("ambiguous-timezone");
  }
  const sameTimeCount = pageTimes.filter(
    (item) => extractTimeToken(item.label) === timeToken,
  ).length;
  if (sameTimeCount > 1 && dateQualifier === null && !(multiZone && zone !== null)) {
    return withFallback("ambiguous-time");
  }
  if (dateQualifier === null && zone === null) {
    return {
      text: chooseText([
        `${TEMPLATE_TIME}${timeToken}`,
        `${TEMPLATE_TIME_COMPACT}${timeToken}`,
      ]),
      reason: null,
      includesDate: false,
    };
  }
  const constrained = [dateQualifier, timeToken].filter((part): part is string => part !== null).join(" ");
  const withZone = zone === null ? constrained : `${constrained}（${zone}）`;
  return {
    text: chooseText([`现在请点 ${withZone}`, `${TEMPLATE_TIME_COMPACT}${withZone}`]),
    reason: null,
    includesDate: dateQualifier !== null,
  };
}

function composeText(
  control: TargetControl,
  dateContext: DateContext,
  pageTimes: PageControl[],
): ComposeResult {
  const label = control.label;
  const timeToken = extractTimeToken(label);
  const kind = control.kind ?? "generic";

  if (kind === "time") {
    if (timeToken === null) {
      return withFallback("unparseable");
    }
    const dateToken = extractDateToken(label, dateContext);
    return composeTime(control, timeToken, dateToken, dateContext, pageTimes);
  }

  if (kind === "date") {
    const dateToken = extractDateToken(label, dateContext);
    if (dateToken === null) {
      return withFallback("unparseable");
    }
    return {
      text: chooseText([`${TEMPLATE_DATE}${dateToken}`, dateToken]),
      reason: null,
      includesDate: true,
    };
  }

  if (kind === "next") {
    if (NEXT_ONLY.test(label.trim())) {
      return {
        text: `${TEMPLATE_NEXT}下一步按钮`,
        reason: null,
        includesDate: false,
      };
    }
    const name = shortNameOf(label);
    if (name.length === 0) {
      return withFallback("unparseable");
    }
    return {
      text: chooseText([`${TEMPLATE_NEXT}${name}`, `${TEMPLATE_NEXT_COMPACT}${name}`]),
      reason: null,
      includesDate: false,
    };
  }

  const name = shortNameOf(label);
  if (name.length === 0 || MEANINGLESS_NAME.test(name)) {
    return withFallback("unparseable");
  }
  return {
    text: chooseText([`${TEMPLATE_GENERIC}${name}`, `${TEMPLATE_GENERIC_COMPACT}${name}`]),
    reason: null,
    includesDate: false,
  };
}

export function resolveCopySource(
  targetControl: TargetControl,
  snapshot: PageSnapshot | null,
): CopySource {
  if (snapshot === null) {
    return { control: targetControl, source: "step", usable: false };
  }
  const controls = snapshot.controls ?? [];
  const match = controls.find(
    (control) => control.ref.elementId === targetControl.ref.elementId,
  );
  if (match === undefined) {
    return { control: targetControl, source: "step", usable: false };
  }
  const usable =
    match.visibility === "visible" && match.disabled !== true && match.label.trim().length > 0;
  return { control: match, source: "snapshot", usable };
}

export function completionTextOf(condition: CompletionCondition): string {
  switch (condition.kind) {
    case "text-appears":
      return `页面上出现“${condition.expectedText ?? "结果"}”`;
    case "element-appears":
      return "页面上出现指定入口";
    case "element-disappears":
      return "指定入口从页面消失";
    case "url-changed":
      return "页面地址发生变化";
    case "control-state-changed":
      return "你在网页上完成选择后告诉我";
    case "user-confirmed":
      return "完成后点“我已完成”";
    default:
      return "完成这一步";
  }
}

export function buildStepCardCopy(input: StepCardCopyInput): StepCardCopy {
  const completionText = completionTextOf(input.completionCondition);
  const rawLabel = input.targetControl.label;
  const fallbackBase: StepCardCopy = {
    shortText: GENERIC_FALLBACK_TEXT,
    rawLabel,
    targetRef: input.targetControl.ref,
    completionText,
    includesTime: false,
    includesDate: false,
    labelTruncated: input.targetControl.labelTruncated === true,
    fallbackReason: "unparseable",
    sourceSnapshotId: input.snapshot?.snapshotId ?? "",
  };
  try {
    const resolved = resolveCopySource(input.targetControl, input.snapshot);
    const control = resolved.control;
    const snapshot = input.snapshot;
    const pageDates = (snapshot?.controls ?? []).filter(
      (item) => item.visibility === "visible" && item.disabled !== true && item.kind === "date",
    );
    const pageTimes = (snapshot?.controls ?? []).filter(
      (item) => item.visibility === "visible" && item.disabled !== true && item.kind === "time",
    );
    const selected = pageDates.filter((item) => item.selected === true);
    const dateContext: DateContext = {
      pageDates,
      selectedDate: selected.length === 1 ? selected[0] ?? null : null,
    };
    const base: StepCardCopy = {
      shortText: GENERIC_FALLBACK_TEXT,
      rawLabel: control.label,
      targetRef: input.targetControl.ref,
      completionText,
      includesTime: false,
      includesDate: false,
      labelTruncated: control.labelTruncated === true,
      fallbackReason: null,
      sourceSnapshotId: snapshot?.snapshotId ?? "",
    };
    if (!resolved.usable) {
      return {
        ...base,
        fallbackReason: resolved.source === "snapshot" ? "stale-target" : "snapshot-mismatch",
      };
    }
    if (control.label.trim().length === 0) {
      return { ...base, fallbackReason: "unparseable" };
    }
    const composed = composeText(control, dateContext, pageTimes);
    if (composed.reason !== null) {
      return { ...base, fallbackReason: composed.reason };
    }
    return {
      ...base,
      shortText: composed.text,
      includesTime: extractTimeToken(control.label) !== null,
      includesDate: composed.includesDate,
    };
  } catch {
    return fallbackBase;
  }
}