import { MAX_CONTROL_LABEL_CHARS, MAX_PLAN_STEPS } from "../../shared/constants";
import { normalizeWhitespace, stripPunctuation } from "../../shared/domPath";
import { redactUrl } from "../../shared/privacy/redact";
import { hasBookingSuccessPath } from "./bookingSuccess";
import type {
  CompletionCondition,
  GuidePlan,
  GuideStep,
  PageControl,
  PageSnapshot,
  TargetControl,
} from "../../shared/types";

export type PlanFailure =
  | "no-controls"
  | "ambiguous"
  | "no-available-dates"
  | "no-available-times"
  | "no-preferred-times"
  | "time-controls-missing"
  | "personal-info"
  | "confirmation"
  | "calendar-incomplete";

export interface PlanResult {
  plan: GuidePlan | null;
  failure?: PlanFailure;
}

export type RelocateResult =
  | { status: "found"; control: PageControl }
  | { status: "missing" }
  | { status: "ambiguous"; candidates: PageControl[] }
  | { status: "restricted" };

const REGION_PATTERN = /(地区|城市|省|市|区|县|所在地)/;
const TYPE_PATTERN = /(类型|业务)/;
const SEARCH_PATTERN = /(查询|搜索|查找|检索)/;
const BOOKING_GOAL = /(预约|预订|约个时间|订个时间|订一个时间|book|meeting)/i;

function bookingUrlShape(href: string): string {
  try {
    return hasBookingSuccessPath(new URL(href).pathname) ? "booking-success-path" : "booking-path";
  } catch {
    return "booking-path";
  }
}

function safeControls(controls: PageControl[]): PageControl[] {
  return controls.filter(
    (control) =>
      control.visibility === "visible" &&
      control.disabled !== true &&
      control.riskFlags.length === 0 &&
      control.kind !== "form" &&
      !control.ambiguous,
  );
}

function findControl(
  controls: PageControl[],
  pattern: RegExp,
  allowedTypes: readonly PageControl["controlType"][],
): PageControl | undefined {
  return controls.find(
    (control) => allowedTypes.includes(control.controlType) && pattern.test(control.label),
  );
}

export type TimePreference = "any" | "morning" | "afternoon" | "earlier" | "later";

export function timePreferenceOf(utterance: string): TimePreference {
  if (/(下午|午后|afternoon)/i.test(utterance)) {
    return "afternoon";
  }
  if (/(上午|早上|morning)/i.test(utterance)) {
    return "morning";
  }
  if (/(更晚|晚一点|晚些|later)/i.test(utterance)) {
    return "later";
  }
  if (/(早一点|早些|earlier)/i.test(utterance)) {
    return "earlier";
  }
  return "any";
}

export function parseClockMinutes(label: string): number | undefined {
  const match = /(?:^|[^\d])(\d{1,2}):(\d{2})(?!\d)/.exec(label);
  if (match === null) {
    return undefined;
  }
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return undefined;
  }
  const start = match.index;
  const end = start + match[0].length;
  const before = label.slice(0, start + 1);
  const after = label.slice(end, end + 6);
  const pm = /pm|p\.m\./i.test(after) || /下午/.test(before);
  const am = /am|a\.m\./i.test(after) || /上午/.test(before);
  if (pm && hours < 12) {
    hours += 12;
  }
  if (am && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
}

export interface BookingPlanOptions {
  timePreference?: TimePreference;
  previousTimeLabel?: string;
}

function pickAvailableTime(
  times: PageControl[],
  preference: TimePreference,
  previousLabel: string | undefined,
): PageControl | undefined {
  const first = times[0];
  if (
    preference === "any" ||
    (previousLabel === undefined && preference !== "morning" && preference !== "afternoon")
  ) {
    return first;
  }
  const previous = previousLabel === undefined ? undefined : parseClockMinutes(previousLabel);
  const accepted = times.find((control) => {
    const minutes = parseClockMinutes(control.label);
    if (minutes === undefined) {
      return false;
    }
    switch (preference) {
      case "morning":
        return minutes < 12 * 60;
      case "afternoon":
        return minutes >= 12 * 60;
      case "later":
        return previous === undefined || minutes > previous;
      case "earlier":
        return previous === undefined || minutes < previous;
      default:
        return true;
    }
  });
  return accepted;
}

function makeStep(
  index: number,
  goal: string,
  control: PageControl,
  completion: CompletionCondition,
  redactedUrl: string,
  observedState: string,
): GuideStep {
  return {
    stepId: `step-${index + 1}`,
    index,
    goal,
    redactedUrl,
    observedState,
    state: "current",
    evidence: "",
    targetControl: control as TargetControl,
    completion,
  };
}

function bookingPlan(goal: string, step: GuideStep, snapshot: PageSnapshot): PlanResult {
  return {
    plan: {
      planId: `plan-${snapshot.snapshotId}-booking-1`,
      version: 1,
      goal: goal.trim().slice(0, 500),
      status: "active",
      steps: [step].slice(0, MAX_PLAN_STEPS),
      currentIndex: 0,
    },
  };
}

function createBookingPlan(
  goal: string,
  snapshot: PageSnapshot,
  controls: PageControl[],
  redactedUrl: string,
  options: BookingPlanOptions = {},
): PlanResult {
  const visible = controls.filter((control) => control.visibility === "visible");
  const dates = visible.filter((control) => control.kind === "date");
  const times = visible.filter((control) => control.kind === "time");
  const forms = visible.filter((control) => control.kind === "form");
  const next = visible.find(
    (control) =>
      control.kind === "next" &&
      control.disabled !== true &&
      !control.ambiguous &&
      control.riskFlags.length === 0,
  );
  const submit = visible.find(
    (control) =>
      control.riskFlags.includes("submit") ||
      control.riskFlags.includes("payment") ||
      control.riskFlags.includes("delete"),
  );

  if (forms.length > 0) {
    return { plan: null, failure: "personal-info" };
  }

  if (times.length === 0) {
    const selectedDate = dates.find((control) => control.selected === true);
    if (selectedDate !== undefined) {
      return { plan: null, failure: "time-controls-missing" };
    }
    const availableDates = dates.filter(
      (control) => control.disabled !== true && !control.ambiguous,
    );
    if (availableDates.length > 0) {
      const date = availableDates[0];
      if (date === undefined) {
        return { plan: null, failure: "calendar-incomplete" };
      }
      return bookingPlan(
        goal,
        makeStep(
          0,
          "选择可用日期",
          date,
          { kind: "time-controls-appear" },
          redactedUrl,
          `找到 ${availableDates.length} 个可点击日期`,
        ),
        snapshot,
      );
    }
    if (dates.length > 0) {
      return { plan: null, failure: "no-available-dates" };
    }
    return { plan: null, failure: "calendar-incomplete" };
  }

  const selectedTime = times.find((control) => control.selected === true);
  if (selectedTime === undefined) {
    const availableTimes = times.filter(
      (control) => control.disabled !== true && !control.ambiguous,
    );
    if (availableTimes.length > 0) {
      const time = pickAvailableTime(
        availableTimes,
        options.timePreference ?? "any",
        options.previousTimeLabel,
      );
      if (time === undefined) {
        return { plan: null, failure: "no-preferred-times" };
      }
      return bookingPlan(
        goal,
        makeStep(
          0,
          "选择可用时间",
          time,
          { kind: "control-selected", controlRef: time.ref },
          redactedUrl,
          `找到 ${availableTimes.length} 个可用时间`,
        ),
        snapshot,
      );
    }
    return { plan: null, failure: "no-available-times" };
  }

  if (next !== undefined) {
    return bookingPlan(
      goal,
      makeStep(
        0,
        "点击继续进入下一步",
        next,
        { kind: "form-controls-appear" },
        redactedUrl,
        "时间已选中，页面出现下一步入口",
      ),
      snapshot,
    );
  }

  if (submit !== undefined) {
    return { plan: null, failure: "confirmation" };
  }

  return { plan: null, failure: "calendar-incomplete" };
}

export function createPlan(
  goal: string,
  snapshot: PageSnapshot,
  options: BookingPlanOptions = {},
): PlanResult {
  const allControls = snapshot.controls ?? [];
  const hasCalendarControls = allControls.some(
    (control) => control.kind === "date" || control.kind === "time",
  );
  const hasBookingControls = allControls.some(
    (control) =>
      control.kind === "date" ||
      control.kind === "time" ||
      control.kind === "form" ||
      control.kind === "next",
  );
  if (
    hasCalendarControls ||
    (BOOKING_GOAL.test(goal) && (hasBookingControls || allControls.length === 0))
  ) {
    return createBookingPlan(goal, snapshot, allControls, bookingUrlShape(snapshot.url), options);
  }

  const controls = safeControls(allControls);
  if (controls.length === 0) {
    return { plan: null, failure: "no-controls" };
  }

  const region = findControl(controls, REGION_PATTERN, ["input-label", "button", "tab"]);
  const type = findControl(controls, TYPE_PATTERN, ["input-label", "button", "tab"]);
  const search = findControl(controls, SEARCH_PATTERN, ["button"]);

  const used = new Set<string>();
  const steps: GuideStep[] = [];
  const redactedUrl = redactUrl(snapshot.url);

  if (region !== undefined && !used.has(region.controlId)) {
    used.add(region.controlId);
    steps.push(
      makeStep(
        steps.length,
        "先选择所在城市或地区",
        region,
        { kind: "control-state-changed" },
        redactedUrl,
        `页面有「${region.label}」控件`,
      ),
    );
  }
  if (type !== undefined && !used.has(type.controlId)) {
    used.add(type.controlId);
    steps.push(
      makeStep(
        steps.length,
        "选择营业网点类型",
        type,
        { kind: "control-state-changed" },
        redactedUrl,
        `页面有「${type.label}」控件`,
      ),
    );
  }
  if (search !== undefined && !used.has(search.controlId)) {
    used.add(search.controlId);
    steps.push(
      makeStep(
        steps.length,
        "由你点击查询按钮",
        search,
        { kind: "text-appears", expectedText: "查询结果" },
        redactedUrl,
        `页面有「${search.label}」按钮`,
      ),
    );
  }

  if (steps.length === 0) {
    return { plan: null, failure: "no-controls" };
  }

  return {
    plan: {
      planId: `plan-${snapshot.snapshotId}-1`,
      version: 1,
      goal: goal.trim().slice(0, 500),
      status: "active",
      steps: steps.slice(0, MAX_PLAN_STEPS),
      currentIndex: 0,
    },
  };
}

export function replan(goal: string, snapshot: PageSnapshot, current: GuidePlan): PlanResult {
  const next = createPlan(goal, snapshot);
  if (next.plan === null) {
    return next;
  }
  return {
    plan: {
      ...next.plan,
      planId: `plan-${snapshot.snapshotId}-${current.version + 1}`,
      version: current.version + 1,
    },
  };
}

export function advancePlan(plan: GuidePlan, verified: boolean): PlanPatchResult {
  const steps = plan.steps.map((step, index) => {
    if (index !== plan.currentIndex) {
      return step;
    }
    return {
      ...step,
      state: verified ? ("done-verified" as const) : ("done-user-unverified" as const),
    };
  });
  const nextIndex = plan.currentIndex + 1;
  const nextStep = steps[nextIndex];
  if (nextIndex >= steps.length || nextStep === undefined) {
    return {
      plan: {
        ...plan,
        steps,
        currentIndex: plan.currentIndex,
        status: "completed",
      },
      completed: true,
    };
  }
  steps[nextIndex] = { ...nextStep, state: "current" };
  return {
    plan: {
      ...plan,
      steps,
      currentIndex: nextIndex,
      status: "active",
    },
    completed: false,
  };
}

export interface PlanPatchResult {
  plan: GuidePlan;
  completed: boolean;
}

export function locateTargetInSnapshot(
  target: TargetControl,
  controls: PageControl[],
): PageControl | undefined {
  const byId = controls.find(
    (control) => control.ref.elementId === target.ref.elementId && isUsableControl(control),
  );
  if (byId !== undefined) {
    return byId;
  }
  const expected = labelKey(target.label);
  const sameLabel = controls.filter(
    (control) =>
      isUsableControl(control) &&
      control.controlType === target.controlType &&
      labelKey(control.label) === expected,
  );
  if (sameLabel.length === 1) {
    return sameLabel[0];
  }
  return undefined;
}

export function relocate(step: GuideStep, snapshot: PageSnapshot): RelocateResult {
  const controls = snapshot.controls ?? [];
  const byId = controls.find(
    (control) => control.ref.elementId === step.targetControl.ref.elementId && isUsableControl(control),
  );
  if (byId !== undefined) {
    return { status: "found", control: byId };
  }
  const expected = labelKey(step.targetControl.label);
  const sameLabel = controls.filter(
    (control) =>
      isUsableControl(control) &&
      control.controlType === step.targetControl.controlType &&
      labelKey(control.label) === expected,
  );
  if (sameLabel.length === 1) {
    const found = sameLabel[0];
    if (found !== undefined) {
      return { status: "found", control: found };
    }
  }
  if (sameLabel.length > 1) {
    return { status: "ambiguous", candidates: sameLabel };
  }
  return { status: "missing" };
}

function labelKey(label: string): string {
  return stripPunctuation(normalizeWhitespace(label).slice(0, MAX_CONTROL_LABEL_CHARS));
}

function isUsableControl(control: PageControl): boolean {
  return (
    control.visibility === "visible" &&
    control.disabled !== true &&

    control.riskFlags.length === 0 &&
    control.kind !== "form" &&
    !control.ambiguous
  );
}

function withLocatedTarget(step: GuideStep, control: PageControl): GuideStep {
  const completion: CompletionCondition =
    step.completion.controlRef === undefined
      ? step.completion
      : { ...step.completion, controlRef: control.ref };
  return {
    ...step,
    targetControl: control as TargetControl,
    completion,
    observedState: `页面重新渲染后仍能定位到同一入口`,
  };
}

export type ReconcileStatus = "inactive" | "unchanged" | "updated" | "replanned" | "unavailable";

export interface ReconcileResult {
  status: ReconcileStatus;
  plan: GuidePlan | null;
  step: GuideStep | null;
  previousTarget?: TargetControl;
  failure?: PlanFailure;
  preference: TimePreference;
}

export function reconcileBookingPlan(
  plan: GuidePlan,
  snapshot: PageSnapshot,
  preference: TimePreference = "any",
): ReconcileResult {
  const step = currentStep(plan);
  if (step === null) {
    return { status: "inactive", plan, step: null, preference };
  }
  const previousTarget = step.targetControl;
  const same = locateTargetInSnapshot(previousTarget, snapshot.controls ?? []);
  if (same !== undefined) {
    if (same.ref.elementId === previousTarget.ref.elementId) {
      return { status: "unchanged", plan, step, preference };
    }
    const updatedPlan: GuidePlan = {
      ...plan,
      steps: plan.steps.map((item, index) =>
        index === plan.currentIndex ? withLocatedTarget(item, same) : item,
      ),
    };
    return {
      status: "updated",
      plan: updatedPlan,
      step: currentStep(updatedPlan),
      previousTarget,
      preference,
    };
  }
  const next = createPlan(plan.goal, snapshot, {
    timePreference: preference,
    previousTimeLabel: previousTarget.label,
  });
  if (next.plan === null) {
    const superseded: GuidePlan = { ...plan, status: "superseded" };
    const result: ReconcileResult = {
      status: "unavailable",
      plan: superseded,
      step: null,
      previousTarget,
      preference,
    };
    if (next.failure !== undefined) {
      result.failure = next.failure;
    }
    return result;
  }
  const nextPlan: GuidePlan = {
    ...next.plan,
    planId: `plan-${snapshot.snapshotId}-${plan.version + 1}`,
    version: plan.version + 1,
  };
  return {
    status: "replanned",
    plan: nextPlan,
    step: currentStep(nextPlan),
    previousTarget,
    preference,
  };
}

export function currentStep(plan: GuidePlan | null): GuideStep | null {
  if (plan === null || plan.status !== "active") {
    return null;
  }
  return plan.steps[plan.currentIndex] ?? null;
}

export function isBookingPlan(plan: GuidePlan): boolean {
  return (
    BOOKING_GOAL.test(plan.goal) ||
    plan.steps.some(
      (step) =>
        step.targetControl.kind === "date" ||
        step.targetControl.kind === "time" ||
        step.targetControl.kind === "next",
    )
  );
}
export function completeBookingPlan(plan: GuidePlan): GuidePlan {
  return { ...plan, status: "completed" };
}

export { isBookingSuccessPage } from "./bookingSuccess";