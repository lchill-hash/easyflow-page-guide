import type { ConversationContext, IntentKind, Slots } from "../../../shared/types";
import {
  ELLIPSIS,
  FACT_WH,
  FEEDBACK_DONE,
  FEEDBACK_MISCLICK,
  FEEDBACK_NOT_FOUND,
  PROCESS_VERBS,
  SAFETY_VERBS,
  SLOT_TERMS,
  TASK_SWITCH,
} from "../../match/lexicon";
import { normalizeGoal } from "../../match/ruleMatcher";

export interface PageSignals {
  readable: boolean;
  segmentCount: number;
  controlCount: number;
  iframeCount: number;
}

export type FeedbackKind = "not-found" | "misclick" | "done";

export interface IntentResult {
  intentKind: IntentKind;
  priorityHit: string;
  matchedSignals: string[];
  slots: Slots;
  feedbackKind?: FeedbackKind;
}

function findTerm(text: string, terms: readonly string[]): string | null {
  for (const term of terms) {
    if (text.includes(term)) {
      return term;
    }
  }
  return null;
}

function buildSlots(utterance: string, context: ConversationContext): Slots {
  const slots: Slots = {};
  const normalized = normalizeGoal(utterance);
  const object = context.lastObject ?? (normalized.length > 0 ? normalized.slice(0, 24) : "");

  if (object.length > 0) {
    slots.object = object;
  }
  for (const slot of ["condition", "material", "location", "time", "contact", "amount", "action"] as const) {
    if (findTerm(utterance, SLOT_TERMS[slot]) !== null) {
      slots[slot] = findTerm(utterance, SLOT_TERMS[slot]) ?? slot;
    }
  }
  return slots;
}

export function isCompletionUtterance(utterance: string): boolean {
  return findTerm(utterance, FEEDBACK_DONE) !== null;
}

export function classifyIntent(
  utterance: string,
  context: ConversationContext,
  pageSignals: PageSignals,
): IntentResult {
  const slots = buildSlots(utterance, context);
  const matchedSignals: string[] = [];

  const safety = findTerm(utterance, SAFETY_VERBS);
  if (safety !== null) {
    matchedSignals.push(safety);
    return {
      intentKind: "safety-boundary",
      priorityHit: safety,
      matchedSignals,
      slots,
    };
  }

  const taskSwitch = findTerm(utterance, TASK_SWITCH);
  if (taskSwitch !== null) {
    matchedSignals.push(taskSwitch);
    return {
      intentKind: "task-switch",
      priorityHit: taskSwitch,
      matchedSignals,
      slots,
    };
  }

  const notFound = findTerm(utterance, FEEDBACK_NOT_FOUND);
  if (notFound !== null) {
    matchedSignals.push(notFound);
    return {
      intentKind: "context-feedback",
      priorityHit: notFound,
      matchedSignals,
      slots,
      feedbackKind: "not-found",
    };
  }

  const misclick = findTerm(utterance, FEEDBACK_MISCLICK);
  if (misclick !== null) {
    matchedSignals.push(misclick);
    return {
      intentKind: "context-feedback",
      priorityHit: misclick,
      matchedSignals,
      slots,
      feedbackKind: "misclick",
    };
  }

  const done = findTerm(utterance, FEEDBACK_DONE);
  if (done !== null) {
    matchedSignals.push(done);
    return {
      intentKind: "context-feedback",
      priorityHit: done,
      matchedSignals,
      slots,
      feedbackKind: "done",
    };
  }

  const process = findTerm(utterance, PROCESS_VERBS);
  if (process !== null) {
    matchedSignals.push(process);
    return {
      intentKind: "process-goal",
      priorityHit: process,
      matchedSignals,
      slots,
    };
  }

  const fact = findTerm(utterance, FACT_WH);
  if (fact !== null) {
    matchedSignals.push(fact);
    return {
      intentKind: "page-fact",
      priorityHit: fact,
      matchedSignals,
      slots,
    };
  }

  const ellipsis = findTerm(utterance, ELLIPSIS);
  if (ellipsis !== null) {
    matchedSignals.push(ellipsis);
    return {
      intentKind: "ellipsis-reference",
      priorityHit: ellipsis,
      matchedSignals,
      slots,
    };
  }

  if (!pageSignals.readable) {
    matchedSignals.push("page-unreadable");
  }
  return {
    intentKind: "fallback-clarify",
    priorityHit: "fallback",
    matchedSignals,
    slots,
  };
}