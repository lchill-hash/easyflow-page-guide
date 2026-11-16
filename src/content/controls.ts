import { MAX_CONTROL_LABEL_CHARS } from "../shared/constants";
import { normalizeWhitespace, stripPunctuation } from "../shared/domPath";
import type {
  ControlContext,
  ControlSemantic,
  ControlType,
  ElementItem,
  ElementRef,
  PageControl,
  RiskFlag,
} from "../shared/types";

const PERSONAL_INFO = /(身份证|证件号|手机号|银行卡|验证码|密码|姓名|住址|\b(name|email|phone|address)\b)/i;
const SUBMIT = /(提交|确认|保存|完成申请|\b(book|schedule|confirm|submit)\b)/i;
const PAYMENT = /(支付|付款|缴费|转账|\b(pay|payment|purchase)\b)/i;
const DELETE = /(删除|注销|撤销|\b(cancel|delete|remove)\b)/i;
const CAPTCHA = /(验证码|短信验证|动态码|\bcaptcha\b)/i;
const PASSWORD = /(密码|口令|\bpassword\b)/i;

const FULL_DATE_LABEL =
  /(\b(19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b.*\b\d{1,2}\b|\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b|\d{1,2}\s*(月|日))/i;
const NUMERIC_DAY = /^\d{1,2}$/;
const TIME_LABEL =
  /\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*(?:am|pm))?\b|\b(?:1[0-2]|0?[1-9])\s*(?:am|pm)\b|上午|下午|凌晨|晚上/i;
const FORMAT_TOGGLE =
  /(12\s*小时|24\s*小时|12\s*h(?:ou)?rs?|24\s*h(?:ou)?rs?|hour\s*format|12-hour|24-hour|时间格式|小时制)/i;
const NEXT_LABEL = /(next|continue|下一步|继续)/i;
const COMPOSITE_TIME_LABEL = /\([^)]*[A-Za-z]+\/[A-Za-z]+[^)]*\)/;

function refOf(item: ElementItem): ElementRef {
  return {
    elementId: item.elementId,
    domPath: item.domPath,
    textHash: item.textHash,
  };
}

function controlTypeOf(item: ElementItem): ControlType | null {
  if (item.type === "button") {
    return "button";
  }
  if (item.type === "link") {
    return "link";
  }
  if (item.type === "inputLabel") {
    return "input-label";
  }
  return null;
}

export function classifyControlRisk(label: string, type: ControlType): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (SUBMIT.test(label)) {
    flags.push("submit");
  }
  if (PAYMENT.test(label)) {
    flags.push("payment");
  }
  if (DELETE.test(label)) {
    flags.push("delete");
  }
  if (CAPTCHA.test(label)) {
    flags.push("captcha");
  }
  if (PASSWORD.test(label)) {
    flags.push("password");
  }
  if (PERSONAL_INFO.test(label)) {
    flags.push("personal-info");
  }
  return Array.from(new Set(flags));
}

export function classifyControlSemantic(
  label: string,
  type: ControlType,
  context: ControlContext,
  riskFlags: RiskFlag[],
  role?: string,
): ControlSemantic {
  if (FORMAT_TOGGLE.test(label)) {
    return "generic";
  }
  if (type === "input-label" && riskFlags.includes("personal-info")) {
    return "form";
  }
  if (type === "input-label") {
    return "generic";
  }
  const timeLabel = TIME_LABEL.test(label);
  const dateLabel = FULL_DATE_LABEL.test(label);
  const roleIsOption = role === "option" || role === "radio" || role === "menuitemradio";
  const compositeTime = timeLabel && dateLabel && (COMPOSITE_TIME_LABEL.test(label) || roleIsOption);
  if (timeLabel && (context === "time-list" || compositeTime)) {
    return "time";
  }
  if (context === "calendar" && (dateLabel || NUMERIC_DAY.test(label))) {
    return "date";
  }
  if (dateLabel && !NUMERIC_DAY.test(label)) {
    return "date";
  }
  if (NEXT_LABEL.test(label) && !riskFlags.includes("submit") && !riskFlags.includes("payment")) {
    return "next";
  }
  return "generic";
}

export function annotateControls(items: ElementItem[]): PageControl[] {
  const controls: PageControl[] = [];
  const counts = new Map<string, number>();

  for (const item of items) {
    const type = controlTypeOf(item);
    if (type === null) {
      continue;
    }
    const rawLabel = normalizeWhitespace(item.accessibleName ?? item.text);
    const label = rawLabel.slice(0, MAX_CONTROL_LABEL_CHARS);
    if (label.length === 0) {
      continue;
    }
    const key = `${type}:${stripPunctuation(label)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const riskFlags = classifyControlRisk(label, type);
    const context: ControlContext = item.controlContext ?? "unknown";
    controls.push({
      controlId: `ctl-${controls.length + 1}`,
      ref: refOf(item),
      label,
      labelTruncated: rawLabel.length > MAX_CONTROL_LABEL_CHARS,
      controlType: type,
      visibility: "visible",
      riskFlags,
      region: item.region,
      ambiguous: false,
      kind: classifyControlSemantic(label, type, context, riskFlags, item.role),
      disabled: item.disabled === true,
      selected: item.selected === true,
      isToday: item.isToday === true,
      context,
      contextReason: item.controlContextReason ?? "unknown",
    });
  }

  for (const control of controls) {
    const key = `${control.controlType}:${stripPunctuation(control.label)}`;
    control.ambiguous = (counts.get(key) ?? 0) > 1;
  }

  return controls;
}

export function isSafeTarget(control: PageControl): boolean {
  return (
    control.visibility === "visible" &&
    control.disabled !== true &&
    control.kind !== "form" &&
    control.riskFlags.length === 0
  );
}

export function targetableControls(controls: PageControl[]): PageControl[] {
  return controls.filter(isSafeTarget);
}