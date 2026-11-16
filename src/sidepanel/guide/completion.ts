import { redactUrl } from "../../shared/privacy/redact";
import type { GuideStep, PageSnapshot } from "../../shared/types";

export type CompletionStatus = "done-verified" | "done-user-unverified" | "unconfirmed" | "blocked";

export interface CompletionResult {
  status: CompletionStatus;
  evidence: string;
}

function textAppears(expectedText: string, snapshot: PageSnapshot): boolean {
  const needle = expectedText.trim();
  if (needle.length === 0) {
    return false;
  }
  if (snapshot.items.some((item) => item.text.includes(needle))) {
    return true;
  }
  return (snapshot.controls ?? []).some((control) => control.label.includes(needle));
}

export function evaluateCompletion(
  step: GuideStep,
  snapshot: PageSnapshot | null,
  userConfirmed: boolean,
): CompletionResult {
  if (snapshot === null) {
    return { status: "blocked", evidence: "read-failed" };
  }

  const condition = step.completion;
  if (condition.kind === "text-appears") {
    if (textAppears(condition.expectedText ?? "", snapshot)) {
      return { status: "done-verified", evidence: "text-appears" };
    }
    if (userConfirmed) {
      return { status: "done-user-unverified", evidence: "user-confirmed-without-text" };
    }
    return { status: "unconfirmed", evidence: "text-not-found" };
  }

  if (condition.kind === "element-appears" || condition.kind === "element-disappears") {
    const expectedId = condition.controlRef?.elementId;
    const exists = expectedId !== undefined && (snapshot.controls ?? []).some((control) => control.ref.elementId === expectedId);
    if (condition.kind === "element-appears" && exists) {
      return { status: "done-verified", evidence: "element-appears" };
    }
    if (condition.kind === "element-disappears" && !exists) {
      return { status: "done-verified", evidence: "element-disappears" };
    }
    if (userConfirmed) {
      return { status: "done-user-unverified", evidence: "user-confirmed-without-element" };
    }
    return { status: "unconfirmed", evidence: "element-unconfirmed" };
  }

  if (condition.kind === "url-changed") {
    if (redactUrl(snapshot.url) !== step.redactedUrl) {
      return { status: "done-verified", evidence: "url-changed" };
    }
    if (userConfirmed) {
      return { status: "done-user-unverified", evidence: "user-confirmed-without-url" };
    }
    return { status: "unconfirmed", evidence: "url-unchanged" };
  }

  if (condition.kind === "time-controls-appear") {
    const hasTime = (snapshot.controls ?? []).some(
      (control) => control.kind === "time" && control.visibility === "visible",
    );
    if (hasTime) {
      return { status: "done-verified", evidence: "time-controls-appeared" };
    }
    if (userConfirmed) {
      return { status: "done-user-unverified", evidence: "user-confirmed-without-time-controls" };
    }
    return { status: "unconfirmed", evidence: "time-controls-not-appeared" };
  }

  if (condition.kind === "form-controls-appear") {
    const hasForm = (snapshot.controls ?? []).some(
      (control) => control.kind === "form" && control.visibility === "visible",
    );
    if (hasForm) {
      return { status: "done-verified", evidence: "form-controls-appeared" };
    }
    if (userConfirmed) {
      return { status: "done-user-unverified", evidence: "user-confirmed-without-form" };
    }
    return { status: "unconfirmed", evidence: "form-controls-not-appeared" };
  }

  if (condition.kind === "control-selected") {
    const controls = snapshot.controls ?? [];
    const targetId = condition.controlRef?.elementId;
    const target = targetId === undefined ? undefined : controls.find((control) => control.ref.elementId === targetId);
    if (target?.selected === true) {
      return { status: "done-verified", evidence: "control-selected" };
    }
    const formVisible = controls.some(
      (control) => control.kind === "form" && control.visibility === "visible",
    );
    const nextVisible = controls.some(
      (control) => control.kind === "next" && control.visibility === "visible",
    );
    if (target?.kind === "time" && (formVisible || nextVisible)) {
      return { status: "done-verified", evidence: "time-selection-followed-by-next-stage" };
    }
    if (userConfirmed) {
      return { status: "done-user-unverified", evidence: "user-confirmed-without-selection" };
    }
    return { status: "unconfirmed", evidence: "selection-not-observed" };
  }

  if (condition.kind === "user-confirmed") {
    return userConfirmed
      ? { status: "done-user-unverified", evidence: "user-confirmed" }
      : { status: "unconfirmed", evidence: "waiting-user-confirmation" };
  }

  if (userConfirmed) {
    return { status: "done-user-unverified", evidence: "user-confirmed-control-state" };
  }
  return { status: "unconfirmed", evidence: "control-state-not-observed" };
}