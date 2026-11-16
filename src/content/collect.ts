import {
  CHAR_BUDGET,
  CONTENT_VERSION,
  MAX_ITEMS,
  MAX_SEGMENTS,
  MAX_TEXT_LENGTH,
} from "../shared/constants";
import { buildDomPath, normalizeWhitespace, textHash } from "../shared/domPath";
import type {
  CollectDiagnostics,
  ControlContext,
  ControlDiagnostic,
  ElementItem,
  ItemType,
  LabelSource,
  PageSnapshot,
  Region,
} from "../shared/types";
import { annotateControls, classifyControlSemantic } from "./controls";
import { isMeaningfulText, normalizeText } from "./normalize";
import { getOrCreateRegistration } from "./registry";
import { buildSegments, titleCandidateOf } from "./semantic";

interface TypeSelector {
  type: ItemType;
  selector: string;
}

interface Candidate {
  element: Element;
  type: ItemType;
  text: string;
  visibleText: string;
  truncated: boolean;
  labelSource?: LabelSource;
  accessibleName?: string;
}

export interface BudgetResult {
  items: ElementItem[];
  truncated: boolean;
  droppedByBudget: number;
}

const TYPE_SELECTORS: readonly TypeSelector[] = [
  { type: "heading", selector: "h1,h2,h3,h4,h5,h6,[role=heading]" },
  { type: "paragraph", selector: "p,li,dd,dt,blockquote,figcaption,div,span" },
  { type: "link", selector: "a[href]" },
  {
    type: "button",
    selector:
      'button,[role=button],[role="option"],[role="radio"],[role="menuitemradio"],input[type=button],input[type=submit],input[type=reset]',
  },
  {
    type: "inputLabel",
    selector: "input:not([type=hidden]):not([type=password]),textarea,select",
  },
];

const HEADING_INNER = "h1,h2,h3,h4,h5,h6,[role=heading]";
const PARAGRAPH_INNER = "p,li,dd,dt,blockquote,figcaption,div";
const BLOCK_CHILD_SELECTOR = "div,p,ul,ol,li,table,section,article,header,footer,nav,form";
const CALENDAR_HINT =
  /(calendar|datepicker|date-picker|date picker|rdp|month|day-picker|\bday\b|\bgrid\b)/i;
const TIME_HINT =
  /(time-slot|timeslot|time slot|time-list|available-time|slot-list|\bslot\b|\btime\b|listbox)/i;
const FORM_HINT = /(form|field|booking-form)/i;
const DATE_LABEL_LIKE =
  /(\b(19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b|\d{1,2}\s*(月|日)|^\d{1,2}$)/i;
const TIME_LABEL_LIKE =
  /\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*(?:am|pm))?\b|\b(?:1[0-2]|0?[1-9])\s*(?:am|pm)\b|上午|下午|凌晨|晚上/i;
const FORMAT_TOGGLE =
  /(12\s*小时|24\s*小时|12\s*h(?:ou)?rs?|24\s*h(?:ou)?rs?|hour\s*format|12-hour|24-hour|时间格式|小时制)/i;
const SENSITIVE_LABEL = /(身份证|证件号|手机号|银行卡|验证码|密码|姓名|邮箱|\b(name|email|phone|address)\b)/i;

interface ContextMatch {
  context: ControlContext;
  reason: string;
}

function isElementVisible(element: Element): boolean {
  if (element.closest("[hidden],template") !== null) {
    return false;
  }
  if (element.getAttribute("aria-hidden") === "true") {
    return false;
  }
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
    return false;
  }
  if (Number.parseFloat(style.opacity) === 0) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function labelTextOf(control: Element): { text: string; source: LabelSource } | null {
  const withLabels = control as HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null };
  const labels = withLabels.labels;
  if (labels !== null && labels !== undefined && labels.length > 0) {
    const first = labels[0];
    if (first !== undefined) {
      const text = normalizeWhitespace(first.innerText);
      if (text.length > 0) {
        return { text, source: "label" };
      }
    }
  }

  const ariaLabel = control.getAttribute("aria-label");
  if (ariaLabel !== null && normalizeWhitespace(ariaLabel).length > 0) {
    return { text: ariaLabel, source: "aria-label" };
  }

  const labelledBy = control.getAttribute("aria-labelledby");
  if (labelledBy !== null) {
    const parts: string[] = [];
    for (const id of labelledBy.split(/\s+/)) {
      if (id.length === 0) {
        continue;
      }
      const target = document.getElementById(id);
      if (target !== null) {
        parts.push(target.innerText);
      }
    }
    const text = normalizeWhitespace(parts.join(" "));
    if (text.length > 0) {
      return { text, source: "aria-labelledby" };
    }
  }

  const placeholder = control.getAttribute("placeholder");
  if (placeholder !== null && normalizeWhitespace(placeholder).length > 0) {
    return { text: placeholder, source: "placeholder" };
  }

  const label = control.closest("label");
  if (label !== null) {
    const text = normalizeWhitespace((label as HTMLElement).innerText);
    if (text.length > 0) {
      return { text, source: "nearby" };
    }
  }

  const cell = control.closest("td,th");
  if (cell !== null) {
    const text = normalizeWhitespace((cell as HTMLElement).innerText);
    if (text.length > 0) {
      return { text, source: "nearby" };
    }
  }

  return null;
}

function textOfElement(element: Element, type: ItemType): { text: string; source?: LabelSource } {
  if (type === "inputLabel") {
    const label = labelTextOf(element);
    if (label === null) {
      return { text: "" };
    }
    return { text: label.text, source: label.source };
  }

  const htmlElement = element as HTMLElement;
  const innerText = typeof htmlElement.innerText === "string" ? htmlElement.innerText : "";
  if (type === "button" && normalizeWhitespace(innerText).length === 0 && element instanceof HTMLInputElement) {
    const typeValue = element.type.toLowerCase();
    if (typeValue === "button" || typeValue === "submit" || typeValue === "reset") {
      return { text: element.value };
    }
  }
  return { text: innerText };
}

function regionOf(element: Element): Region {
  const match = element.closest("main,article,nav,header,footer,aside");
  if (match === null) {
    return "unknown";
  }
  switch (match.tagName) {
    case "MAIN":
    case "ARTICLE":
      return "main";
    case "NAV":
      return "nav";
    case "HEADER":
      return "header";
    case "FOOTER":
      return "footer";
    case "ASIDE":
      return "aside";
    default:
      return "unknown";
  }
}

function hasNestedHeading(element: Element): boolean {
  return element.querySelector(HEADING_INNER) !== null;
}

function isParagraphDuplicate(candidate: Candidate): boolean {
  const inner = candidate.element.querySelector(PARAGRAPH_INNER);
  if (inner === null) {
    return false;
  }
  const innerElement = inner as HTMLElement;
  if (typeof innerElement.innerText !== "string") {
    return false;
  }
  const innerText = normalizeWhitespace(innerElement.innerText);
  return innerText.length >= candidate.text.length * 0.8 && candidate.text.includes(innerText);
}

function directTextLength(element: Element): number {
  let text = "";
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
    }
  }
  return normalizeWhitespace(text).length;
}

function isDivContainerNoise(element: Element): boolean {
  if (element.tagName !== "DIV") {
    return false;
  }
  if (element.querySelector(BLOCK_CHILD_SELECTOR) === null) {
    return false;
  }
  return directTextLength(element) < 20;
}

function contextMatchOf(element: Element, type: ItemType): ContextMatch {
  if (type === "inputLabel") {
    return { context: "form", reason: "input-label" };
  }
  let node: Element | null = element;
  let depth = 0;
  while (node !== null && depth < 8) {
    const testId = node.getAttribute("data-testid") ?? "";
    const role = node.getAttribute("role") ?? "";
    const ariaLabel = node.getAttribute("aria-label") ?? "";
    const className = node.getAttribute("class") ?? "";
    const id = node.id;
    const haystack = `${testId} ${role} ${ariaLabel} ${className} ${id}`;
    if (TIME_HINT.test(haystack)) {
      return { context: "time-list", reason: "time ancestor" };
    }
    if (CALENDAR_HINT.test(haystack)) {
      return { context: "calendar", reason: "calendar ancestor" };
    }
    if (FORM_HINT.test(haystack)) {
      return { context: "form", reason: "form ancestor" };
    }
    node = node.parentElement;
    depth += 1;
  }
  return { context: "unknown", reason: "no matching ancestor" };
}

function labelledByText(element: Element): string {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy === null) {
    return "";
  }
  const parts: string[] = [];
  for (const id of labelledBy.split(/\s+/)) {
    if (id.length === 0) {
      continue;
    }
    const target = document.getElementById(id);
    if (target !== null) {
      parts.push(target.innerText || target.textContent || "");
    }
  }
  return normalizeWhitespace(parts.join(" "));
}

function accessibleNameOf(element: Element, fallback: string): string {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel !== null) {
    const normalized = normalizeWhitespace(ariaLabel);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  const labelledBy = labelledByText(element);
  if (labelledBy.length > 0) {
    return labelledBy;
  }
  const title = element.getAttribute("title");
  if (title !== null) {
    const normalized = normalizeWhitespace(title);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  const visible = normalizeWhitespace(fallback);
  if (visible.length > 0) {
    return visible;
  }
  if (element instanceof HTMLInputElement) {
    const typeValue = element.type.toLowerCase();
    if (typeValue === "button" || typeValue === "submit" || typeValue === "reset") {
      return normalizeWhitespace(element.value);
    }
  }
  return "";
}

function isDisabledControl(element: Element): boolean {
  if (element.hasAttribute("disabled")) {
    return true;
  }
  if (element.getAttribute("aria-disabled") === "true") {
    return true;
  }
  if (element.getAttribute("data-disabled") === "true") {
    return true;
  }
  return element.getAttribute("data-state") === "disabled";
}

export function isSelectedControl(element: Element): boolean {
  if (element.getAttribute("aria-selected") === "true" || element.getAttribute("aria-pressed") === "true") {
    return true;
  }
  const state = element.getAttribute("data-state");
  return state === "selected" || state === "checked" || state === "on";
}

function isTodayControl(element: Element): boolean {
  return element.getAttribute("aria-current") === "date";
}

function compareDocumentOrder(left: Candidate, right: Candidate): number {
  if (left.element === right.element) {
    return 0;
  }
  const relation = left.element.compareDocumentPosition(right.element);
  if ((relation & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) {
    return -1;
  }
  if ((relation & Node.DOCUMENT_POSITION_PRECEDING) !== 0) {
    return 1;
  }
  return 0;
}

export function applyBudget(
  items: ElementItem[],
  maxItems: number = MAX_ITEMS,
  charBudget: number = CHAR_BUDGET,
): BudgetResult {
  const kept: ElementItem[] = [];
  let characters = 0;
  let droppedByBudget = 0;
  for (const item of items) {
    if (kept.length >= maxItems || characters + item.textLength > charBudget) {
      droppedByBudget += 1;
      continue;
    }
    kept.push(item);
    characters += item.textLength;
  }
  return {
    items: kept,
    truncated: droppedByBudget > 0,
    droppedByBudget,
  };
}

function countOpenShadowRoots(root: Document | ShadowRoot): number {
  let count = 0;
  for (const element of Array.from(root.querySelectorAll("*"))) {
    const shadow = element.shadowRoot;
    if (shadow !== null) {
      count += 1;
      count += countOpenShadowRoots(shadow);
    }
  }
  return count;
}

function collectButtonDiagnostics(): {
  buttonCandidates: number;
  filteredEmptyButtons: number;
  filteredHiddenButtons: number;
  filteredDisabledButtons: number;
  dateCandidates: ControlDiagnostic[];
  timeCandidates: ControlDiagnostic[];
} {
  const buttons = Array.from(
    document.querySelectorAll(
      'button,[role="button"],input[type="button"],input[type="submit"],input[type="reset"]',
    ),
  );
  const optionCandidates = Array.from(
    document.querySelectorAll('[role="option"],[role="radio"],[role="menuitemradio"]'),
  );
  const controls = Array.from(new Set([...buttons, ...optionCandidates]));
  let filteredEmptyButtons = 0;
  let filteredHiddenButtons = 0;
  let filteredDisabledButtons = 0;
  const dateCandidates: ControlDiagnostic[] = [];
  const timeCandidates: ControlDiagnostic[] = [];

  for (const element of controls) {
    const extracted = textOfElement(element, "button");
    const label = normalizeWhitespace(accessibleNameOf(element, extracted.text));
    const visible = isElementVisible(element);
    const disabled = isDisabledControl(element);
    if (label.length === 0) {
      filteredEmptyButtons += 1;
    }
    if (!visible) {
      filteredHiddenButtons += 1;
    }
    if (disabled) {
      filteredDisabledButtons += 1;
    }

    const context = contextMatchOf(element, "button");
    const numericDate = /^\d{1,2}$/.test(label);
    const dateLike =
      (context.context === "calendar" && (label.length === 0 || DATE_LABEL_LIKE.test(label))) ||
      (DATE_LABEL_LIKE.test(label) && !numericDate);
    const formatToggle = FORMAT_TOGGLE.test(label);
    const timeLike = TIME_LABEL_LIKE.test(label);
    const timeContext = context.context === "time-list";

    if (dateLike && dateCandidates.length < 8 && !SENSITIVE_LABEL.test(label)) {
      const candidate: ControlDiagnostic = {
        label: label.length > 0 ? label : "(empty)",
        role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
        tagName: element.tagName.toLowerCase(),
        visible,
        disabled,
        selected: isSelectedControl(element),
        isToday: isTodayControl(element),
        context: context.context,
        contextReason: context.reason,
        semantic: "date",
      };
      if (!visible) {
        candidate.filterReason = "hidden";
      } else if (label.length === 0) {
        candidate.filterReason = "empty-text";
      } else if (disabled) {
        candidate.filterReason = "disabled";
      }
      dateCandidates.push(candidate);
    }

    const timeCandidateLike = timeLike || formatToggle || (timeContext && label.length === 0);
    if (timeCandidateLike && timeCandidates.length < 12 && !SENSITIVE_LABEL.test(label)) {
      const semantic = formatToggle
        ? "format-toggle"
        : classifyControlSemantic(
            label,
            "button",
            context.context,
            [],
            element.getAttribute("role") ?? undefined,
          );
      const candidate: ControlDiagnostic = {
        label: label.length > 0 ? label : "(empty)",
        role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
        tagName: element.tagName.toLowerCase(),
        visible,
        disabled,
        selected: isSelectedControl(element),
        isToday: isTodayControl(element),
        context: context.context,
        contextReason: context.reason,
        semantic,
      };
      if (!visible) {
        candidate.filterReason = "hidden";
      } else if (label.length === 0) {
        candidate.filterReason = "empty-text";
      } else if (disabled) {
        candidate.filterReason = "disabled";
      } else if (formatToggle) {
        candidate.filterReason = "format-toggle";
      } else if (semantic !== "time" && timeLike) {
        candidate.filterReason = "time-context-missing";
      }
      timeCandidates.push(candidate);
    }
  }

  return {
    buttonCandidates: buttons.length,
    filteredEmptyButtons,
    filteredHiddenButtons,
    filteredDisabledButtons,
    dateCandidates,
    timeCandidates,
  };
}

export function collectPage(
  snapshotId: string,
  runId: string,
  maxItems: number = MAX_ITEMS,
  maxTextLength: number = MAX_TEXT_LENGTH,
): { snapshot: PageSnapshot; diagnostics: CollectDiagnostics } {
  const startedAt = performance.now();
  const seen = new Set<Element>();
  const candidates: Candidate[] = [];
  const buttonDiagnostics = collectButtonDiagnostics();
  let candidateCount = 0;
  let droppedHidden = 0;

  for (const group of TYPE_SELECTORS) {
    let elements: Element[];
    try {
      elements = Array.from(document.querySelectorAll(group.selector));
    } catch {
      continue;
    }
    for (const element of elements) {
      if (seen.has(element)) {
        continue;
      }
      seen.add(element);
      candidateCount += 1;

      if (group.type === "heading" && hasNestedHeading(element)) {
        droppedHidden += 1;
        continue;
      }
      if (!isElementVisible(element)) {
        droppedHidden += 1;
        continue;
      }
      if (group.type === "paragraph" && isDivContainerNoise(element)) {
        continue;
      }
      if (group.type === "paragraph" && element.tagName === "SPAN") {
        if (
          element.closest("div,p,li,dd,dt,blockquote,figcaption,td,th,section,article") !== null
        ) {
          continue;
        }
        const display = getComputedStyle(element).display;
        if (
          display === "inline" ||
          display === "inline-block" ||
          display === "inline-flex" ||
          display === "inline-grid" ||
          display === "contents"
        ) {
          continue;
        }
      }

      const extracted = textOfElement(element, group.type);
      const visibleText = normalizeText(extracted.text, maxTextLength).text;
      let rawText = extracted.text;
      let accessibleName = "";
      if (
        group.type === "button" ||
        group.type === "link" ||
        group.type === "inputLabel"
      ) {
        accessibleName = accessibleNameOf(element, extracted.text);
        if (accessibleName.length > 0) {
          rawText = accessibleName;
        }
      }
      const normalized = normalizeText(rawText, maxTextLength);
      if (!isMeaningfulText(normalized.text, group.type === "button")) {
        continue;
      }

      const candidate: Candidate = {
        element,
        type: group.type,
        text: normalized.text,
        visibleText,
        truncated: normalized.truncated,
      };
      if (accessibleName.length > 0) {
        candidate.accessibleName = accessibleName;
      }
      if (extracted.source !== undefined) {
        candidate.labelSource = extracted.source;
      }
      if (group.type === "paragraph" && isParagraphDuplicate(candidate)) {
        continue;
      }
      candidates.push(candidate);
    }
  }

  candidates.sort(compareDocumentOrder);

  const items: ElementItem[] = [];
  for (let order = 0; order < candidates.length; order += 1) {
    const candidate = candidates[order];
    if (candidate === undefined) {
      continue;
    }
    const hashSource = candidate.visibleText.length > 0 ? candidate.visibleText : candidate.text;
    const hash = textHash(hashSource);
    const registration = getOrCreateRegistration(candidate.element, candidate.type, hash);
    const item: ElementItem = {
      elementId: registration.elementId,
      type: candidate.type,
      text: candidate.text,
      textLength: candidate.text.length,
      truncated: candidate.truncated,
      order,
      region: regionOf(candidate.element),
      domPath: buildDomPath(candidate.element),
      textHash: hash,
      tagName: candidate.element.tagName.toLowerCase(),
    };
    if (candidate.labelSource !== undefined) {
      item.labelSource = candidate.labelSource;
    }
    if (titleCandidateOf(item)) {
      item.titleCandidate = true;
    }
    if (
      candidate.type === "button" ||
      candidate.type === "link" ||
      candidate.type === "inputLabel"
    ) {
      item.accessibleName =
        candidate.accessibleName ?? accessibleNameOf(candidate.element, candidate.visibleText);
      item.disabled = isDisabledControl(candidate.element);
      item.selected = isSelectedControl(candidate.element);
      item.isToday = isTodayControl(candidate.element);
      item.role = candidate.element.getAttribute("role") ?? candidate.element.tagName.toLowerCase();
      const context = contextMatchOf(candidate.element, candidate.type);
      item.controlContext = context.context;
      item.controlContextReason = context.reason;
    }
    items.push(item);
  }

  const budget = applyBudget(items, maxItems, CHAR_BUDGET);
  const segmentsStartedAt = performance.now();
  const segments = buildSegments(budget.items);
  const controls = annotateControls(budget.items);
  const segmentsMs = Math.round(performance.now() - segmentsStartedAt);
  const domain = location.hostname.length > 0 ? location.hostname : "unknown";
  const rawTitle = normalizeWhitespace(document.title);
  const titleMissing = rawTitle.length === 0;
  const iframeCount = document.querySelectorAll("iframe").length;
  const openShadowRoots = countOpenShadowRoots(document);

  const snapshot: PageSnapshot = {
    snapshotId,
    runId,
    schemaVersion: 1,
    url: location.href,
    origin: location.origin,
    domain,
    title: titleMissing ? domain : rawTitle,
    titleMissing,
    capturedAt: Date.now(),
    itemCount: budget.items.length,
    items: budget.items,
    segments,
    controls,
    truncated: budget.truncated || segments.length >= MAX_SEGMENTS,
  };

  const collectMs = Math.round(performance.now() - startedAt);
  const diagnostics: CollectDiagnostics = {
    collectMs,
    candidateCount,
    visibleCount: candidates.length,
    droppedHidden,
    droppedByBudget: budget.droppedByBudget,
    contentVersion: CONTENT_VERSION,
    segmentsMs,
    segmentCount: segments.length,
    controlCount: controls.length,
    iframeCount,
    buttonCandidates: buttonDiagnostics.buttonCandidates,
    buttonCollected: budget.items.filter((item) => item.type === "button").length,
    dateControlCount: controls.filter((control) => control.kind === "date").length,
    timeControlCount: controls.filter((control) => control.kind === "time").length,
    filteredEmptyButtons: buttonDiagnostics.filteredEmptyButtons,
    filteredHiddenButtons: buttonDiagnostics.filteredHiddenButtons,
    filteredDisabledButtons: buttonDiagnostics.filteredDisabledButtons,
    openShadowRoots,
    controlsTruncated: budget.truncated,
    dateCandidates: buttonDiagnostics.dateCandidates,
    timeCandidates: buttonDiagnostics.timeCandidates,
    availableDateCount: controls.filter(
      (control) => control.kind === "date" && control.disabled !== true && !control.ambiguous,
    ).length,
    capturedAt: snapshot.capturedAt,
  };
  const selectedDate = controls.find(
    (control) => control.kind === "date" && control.selected === true,
  );
  if (selectedDate !== undefined) {
    diagnostics.selectedDateLabel = selectedDate.label;
  }
  const selectedTime = controls.find(
    (control) => control.kind === "time" && control.selected === true,
  );
  if (selectedTime !== undefined) {
    diagnostics.selectedTimeLabel = selectedTime.label;
  }

  console.debug("[EF]", {
    phase: "collect",
    runId,
    ms: collectMs,
    counts: {
      candidate: candidateCount,
      visible: candidates.length,
      kept: budget.items.length,
    },
  });

  return { snapshot, diagnostics };
}