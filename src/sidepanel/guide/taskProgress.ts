import type { GuidePlan, GuideStep, PageSnapshot } from "../../shared/types";

export type TaskStageStatus = "done" | "current" | "next";

export interface TaskProgressStage {
  key: string;
  label: string;
  status: TaskStageStatus;
}

const BOOKING_GOAL = /(预约|预订|约个时间|book|meeting)/i;
const RESCHEDULE_PATH = /reschedule/i;

function withStatuses(labels: string[], currentIndex: number, allDone: boolean): TaskProgressStage[] {
  return labels.map((label, index) => ({
    key: `${index}:${label}`,
    label,
    status: allDone || index < currentIndex ? "done" : index === currentIndex ? "current" : "next",
  }));
}

function stageFromCues(
  snapshot: PageSnapshot,
  step: GuideStep | null,
  isBooking: boolean,
): { index: number; labels: string[] } | null {
  const kinds = new Set((snapshot.controls ?? []).map((control) => control.kind));
  // Only labels are inspected. Input values may contain private information.
  const labels = snapshot.items.filter((item) => item.type === "inputLabel").map((item) => item.text)
    .concat((snapshot.controls ?? []).filter((control) => control.kind === "form").map((control) => control.label));
  const hasFormLabels = labels.some((label) => /姓名|name/i.test(label)) &&
    labels.some((label) => /邮箱|邮件|email/i.test(label));
  const hasForm = kinds.has("form") || hasFormLabels ||
    (RESCHEDULE_PATH.test(snapshot.url) && labels.some((label) => /重新安排|原因|reason/i.test(label)));
  const hasTime = kinds.has("time");
  const hasDate = kinds.has("date");
  const reschedule = RESCHEDULE_PATH.test(snapshot.url);
  if (!isBooking) return null;
  let index = 0;
  if (hasForm) index = 2;
  else if (hasTime) index = 1;
  else if (hasDate) index = 0;
  const kind = step?.targetControl.kind;
  if (kind === "date") index = 0;
  if (kind === "time") index = 1;
  if (kind === "next" || kind === "form") index = 2;
  if (reschedule) return { index, labels: ["选择日期", "选择时间", "填写信息", "确认重新安排"] };
  return { index, labels: ["选择日期", "选择时间", "填写信息", "确认预约"] };
}

export function buildTaskProgress(
  plan: GuidePlan | null,
  step: GuideStep | null,
  success: boolean,
  snapshot: PageSnapshot | null = null,
): TaskProgressStage[] | null {
  const goal = plan?.goal ?? "";
  const snapshotBooking = snapshot !== null &&
    (snapshot.controls ?? []).some((control) => control.kind === "date" || control.kind === "time");
  const isBooking = BOOKING_GOAL.test(goal) || snapshotBooking ||
    (snapshot !== null && (RESCHEDULE_PATH.test(snapshot.url) || BOOKING_GOAL.test(snapshot.title)));
  if (success) {
    const labels = snapshot !== null && RESCHEDULE_PATH.test(snapshot.url)
      ? ["选择日期", "选择时间", "填写信息", "确认重新安排"]
      : ["选择日期", "选择时间", "填写信息", "确认预约"];
    return withStatuses(labels, labels.length, true);
  }
  if (isBooking && step !== null) {
    const reschedule = snapshot !== null && RESCHEDULE_PATH.test(snapshot.url);
    const labels = reschedule
      ? ["选择日期", "选择时间", "填写信息", "确认重新安排"]
      : ["选择日期", "选择时间", "填写信息", "确认预约"];
    const kind = step.targetControl.kind;
    const index = kind === "time" ? 1 : kind === "next" || kind === "form" ? 2 : 0;
    return withStatuses(labels, index, false);
  }
  if (snapshot !== null && isBooking) {
    const cued = stageFromCues(snapshot, step, isBooking);
    if (cued !== null) return withStatuses(cued.labels, cued.index, false);
  }
  if (plan === null || step === null || plan.steps.length === 0) return null;
  const labels = plan.steps.map((item) => item.goal).filter((label) => label.trim().length > 0);
  if (labels.length === 0) return null;
  return withStatuses(labels, plan.currentIndex, plan.status === "completed");
}
