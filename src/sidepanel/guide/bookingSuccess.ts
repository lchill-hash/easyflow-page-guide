import { normalizeWhitespace } from "../../shared/domPath";
import type {
  BookingSuccessReason,
  BookingSuccessSignals,
  CitationAnchor,
  DialogueResponse,
  ElementItem,
  EngineDiagnostics,
  PageSnapshot,
} from "../../shared/types";

export interface BookingSuccessEvidence {
  ok: boolean;
  reason: BookingSuccessReason | null;
  titleItem: ElementItem | null;
  pathShape: "success" | "other" | "unavailable";
  checkedAt: number;
  snapshotId: string;
}

export const BOOKING_SUCCESS_TITLES: readonly string[] = [
  "该会议已安排",
  "会议已安排",
  "this meeting is scheduled",
  "meeting is scheduled",
];

export const BOOKING_SUCCESS_PATH_SEGMENTS: readonly string[] = [
  "booking",
  "bookings",
  "confirmation",
  "confirmed",
  "success",
];

export const BOOKING_SUCCESS_PATH =
  /(?:^|\/)(?:booking|bookings|confirmation|confirmed|success)(?:\/|$)/i;

export const BOOKING_COMPLETE_NOTICE = "预约已完成。请以网页和确认邮件中的信息为准。";
export const BOOKING_DONE_ANSWER = "页面显示预约已安排。请以网页和确认邮件中的信息为准。";
export const BOOKING_UNCONFIRMED_TEXT = "我在当前页面没看到预约成功的提示。";
export const BOOKING_UNCONFIRMED_ADVICE =
  "请确认网页已显示预约结果，或点“重新读取页面”后再试。";
export const BOOKING_AFTER_SUCCESS_TEXT = "这一步已经结束，接下来以网页和确认邮件为准。";

const EXACT_TITLES = new Set(BOOKING_SUCCESS_TITLES);

function makeDiagnostics(priorityHit: string, citationCount: number): EngineDiagnostics {
  return {
    mode: "rule-demo",
    engineMs: 0,
    retrievedSegments: 0,
    citationCount,
    intentKind: "context-feedback",
    priorityHit,
    outboundBytes: 0,
    sensitiveDetected: false,
  };
}

function evidence(
  ok: boolean,
  reason: BookingSuccessReason | null,
  pathShape: BookingSuccessEvidence["pathShape"],
  snapshotId: string,
  checkedAt: number,
  titleItem: ElementItem | null = null,
): BookingSuccessEvidence {
  return { ok, reason, titleItem, pathShape, checkedAt, snapshotId };
}

export function normalizeSuccessTitle(text: string): string {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[。.！!]+$/, "");
}

export function hasBookingSuccessPath(pathname: string): boolean {
  return BOOKING_SUCCESS_PATH.test(pathname);
}

export function evaluateBookingSuccess(
  snapshot: PageSnapshot | null,
  signals: BookingSuccessSignals = {},
): BookingSuccessEvidence {
  if (snapshot === null) {
    return evidence(false, "read-failed", "unavailable", "none", 0);
  }
  const snapshotId = snapshot.snapshotId;
  const checkedAt = snapshot.capturedAt;
  let pathname = "";
  try {
    pathname = new URL(snapshot.url).pathname;
  } catch {
    return evidence(false, "read-failed", "unavailable", snapshotId, checkedAt);
  }
  if (snapshot.items.length === 0 || signals.snapshotTruncated === true) {
    return evidence(false, "read-failed", "other", snapshotId, checkedAt);
  }
  if (!hasBookingSuccessPath(pathname)) {
    return evidence(false, "path-mismatch", "other", snapshotId, checkedAt);
  }
  const candidates = snapshot.items
    .filter((item) => item.type === "heading" || item.type === "paragraph")
    .slice()
    .sort((left, right) => left.order - right.order);
  const exact = candidates.find((item) => EXACT_TITLES.has(normalizeSuccessTitle(item.text)));
  if (exact !== undefined) {
    return evidence(true, null, "success", snapshotId, checkedAt, exact);
  }
  const near = candidates.some((item) => {
    const normalized = normalizeSuccessTitle(item.text);
    return BOOKING_SUCCESS_TITLES.some((title) => normalized.indexOf(title) >= 0);
  });
  if (near) {
    return evidence(false, "title-mismatch", "success", snapshotId, checkedAt);
  }
  if (
    (signals.droppedHidden ?? 0) > 0 ||
    (signals.iframeCount ?? 0) > 0 ||
    (signals.openShadowRoots ?? 0) > 0
  ) {
    return evidence(false, "title-not-visible", "success", snapshotId, checkedAt);
  }
  return evidence(false, "title-mismatch", "success", snapshotId, checkedAt);
}

export function isBookingSuccessPage(snapshot: PageSnapshot | null): boolean {
  return evaluateBookingSuccess(snapshot).ok;
}

export function buildSuccessCitation(titleItem: ElementItem, snapshotId: string): CitationAnchor {
  const text = normalizeWhitespace(titleItem.text);
  return {
    citationId: `cite-booking-title-${snapshotId}`,
    segmentId: `seg-${snapshotId}-booking-title`,
    role: "title",
    text,
    start: 0,
    end: text.length,
    status: "valid",
    ref: {
      elementId: titleItem.elementId,
      domPath: titleItem.domPath,
      textHash: titleItem.textHash,
    },
  };
}

export function buildBookingDoneResponse(
  completion: BookingSuccessEvidence,
): DialogueResponse {
  if (!completion.ok || completion.titleItem === null) {
    return buildBookingUnconfirmedResponse(completion.reason);
  }
  return {
    responseType: "direct-answer",
    text: BOOKING_DONE_ANSWER,
    citations: [buildSuccessCitation(completion.titleItem, completion.snapshotId)],
    diagnostics: makeDiagnostics("booking-success", 1),
  };
}

export function buildBookingUnconfirmedResponse(
  reason: BookingSuccessReason | null,
): DialogueResponse {
  const readFailed = reason === "read-failed";
  return {
    responseType: "cannot-answer",
    text: readFailed ? "我还没读到当前页面，不能确认预约是否完成。" : BOOKING_UNCONFIRMED_TEXT,
    citations: [],
    limitation: {
      reason: readFailed ? "read-failed" : "no-evidence",
      advice: readFailed ? "确认页面已打开后点“重试”，我再读一次。" : BOOKING_UNCONFIRMED_ADVICE,
    },
    diagnostics: makeDiagnostics("booking-unconfirmed", 0),
  };
}

export function buildBookingAfterSuccessResponse(
  completion: BookingSuccessEvidence,
): DialogueResponse {
  if (!completion.ok || completion.titleItem === null) {
    return buildBookingUnconfirmedResponse(completion.reason);
  }
  return {
    responseType: "direct-answer",
    text: BOOKING_AFTER_SUCCESS_TEXT,
    citations: [buildSuccessCitation(completion.titleItem, completion.snapshotId)],
    diagnostics: makeDiagnostics("booking-success", 1),
  };
}