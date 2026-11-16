import { MIN_SCORE, REGION_WEIGHTS, RELATIVE_THRESHOLD_FACTOR, SYNONYM_GROUPS } from "../../match/lexicon";
import { normalizeGoal } from "../../match/ruleMatcher";
import { stripPunctuation } from "../../../shared/domPath";
import type { GoalSlot, SemanticSegment, Slots } from "../../../shared/types";

export interface SegmentHit {
  segment: SemanticSegment;
  score: number;
  matchedKeywords: string[];
}

const PAGE_METADATA = /^(日期|来源|分享|字号|扫一扫|打印|主办|承办|京ICP|京公网安备|政府网站标识码|客服信箱|政务服务热线|建议您使用)/;

const SECTION_PATTERNS: ReadonlyArray<{ slot: GoalSlot; pattern: RegExp }> = [
  { slot: "condition", pattern: /(条件|资格|对象|要求)/ },
  { slot: "action", pattern: /(流程|步骤|方式|网上申请|现场申请)/ },
  { slot: "material", pattern: /(材料|证件|证明|所需)/ },
  { slot: "location", pattern: /(地点|地址|窗口|线下|现场)/ },
  { slot: "time", pattern: /(时间|时限|工作日)/ },
  { slot: "contact", pattern: /(电话|联系|咨询)/ },
  { slot: "amount", pattern: /(标准|金额|补贴|津贴|补助)/ },
];

function selectSectionSegments(segments: SemanticSegment[], slots: Slots): SemanticSegment[] {
  for (const section of SECTION_PATTERNS) {
    if (slots[section.slot] === undefined) {
      continue;
    }
    const preferred = segments.filter(
      (segment) => segment.hasBody && section.pattern.test(segment.titleText),
    );
    if (preferred.length > 0) {
      return preferred;
    }
  }
  if (slots.material !== undefined) {
    const flowSegments = segments.filter(
      (segment) => segment.hasBody && /(流程|步骤|方式|网上申请|现场申请)/.test(segment.titleText),
    );
    if (flowSegments.length > 0) {
      return flowSegments;
    }
  }
  return [];
}

function inferSectionSlots(query: string): Slots {
  const normalized = normalizeGoal(query);
  const slots: Slots = {};
  if (/(条件|资格|对象|要求|谁)/.test(normalized)) {
    slots.condition = "inferred";
  }
  if (/(流程|步骤|方式|网上申请|现场申请|办理)/.test(normalized)) {
    slots.action = "inferred";
  }
  if (/(材料|证件|证明|所需)/.test(normalized)) {
    slots.material = "inferred";
  }
  if (/(地点|地址|窗口|线下|现场)/.test(normalized)) {
    slots.location = "inferred";
  }
  if (/(时间|时限|工作日)/.test(normalized)) {
    slots.time = "inferred";
  }
  if (/(电话|联系|咨询)/.test(normalized)) {
    slots.contact = "inferred";
  }
  if (/(标准|金额|补贴|津贴|补助)/.test(normalized)) {
    slots.amount = "inferred";
  }
  return slots;
}

const GENERIC_TERMS = new Set([
  "条件",
  "资格",
  "对象",
  "要求",
  "标准",
  "材料",
  "证件",
  "证明",
  "流程",
  "步骤",
  "方式",
  "办理",
  "申请",
  "窗口",
  "地点",
  "地址",
  "时间",
  "电话",
  "多少",
  "什么",
  "谁",
  "哪里",
  "需要",
  "可以",
]);

const QUESTION_RESIDUE = /(谁|怎么|如何|什么|哪里|多少|需要|带|吗|呢|吧|那|这|个|能|请|要|可|多|钱|是)/;

function extractRequiredTerms(utterance: string, slots: Slots): string[] {
  const normalized = normalizeGoal(utterance);
  const object = slots.object === undefined ? "" : normalizeGoal(slots.object);
  const terms = collectNgrams(normalized).filter((term) => {
    if (term.length < 2 || GENERIC_TERMS.has(term)) {
      return false;
    }
    if (object.length > 0 && object.includes(term)) {
      return false;
    }
    return !QUESTION_RESIDUE.test(term);
  });
  return Array.from(new Set(terms)).slice(0, 3);
}

function segmentHaystack(segment: SemanticSegment): string {
  return stripPunctuation([segment.titleText, ...segment.bodyTexts].join(" "));
}

function collectNgrams(text: string): string[] {
  const grams = new Set<string>();
  for (let size = 4; size >= 2; size -= 1) {
    for (let index = 0; index + size <= text.length; index += 1) {
      grams.add(text.slice(index, index + size));
    }
  }
  return Array.from(grams);
}

function expandSynonyms(normalized: string): string[] {
  const extra: string[] = [];
  for (const group of SYNONYM_GROUPS) {
    if (group.some((term) => normalized.includes(term))) {
      extra.push(...group);
    }
  }
  return extra;
}

export function buildQuery(utterance: string, slots: Slots, contextGoal: string): string {
  const normalized = normalizeGoal(utterance);
  const parts: string[] = [normalized];
  if (slots.object !== undefined) {
    parts.push(slots.object);
  }
  if (slots.material !== undefined) {
    parts.push("材料", "证件", "证明", "身份证", "户口簿", "原件");
  }
  if (slots.condition !== undefined) {
    parts.push("条件", "资格", "对象");
  }
  if (slots.location !== undefined) {
    parts.push("地点", "窗口", "线下");
  }
  if (slots.time !== undefined) {
    parts.push("时间");
  }
  if (slots.contact !== undefined) {
    parts.push("电话", "联系");
  }
  if (slots.amount !== undefined) {
    parts.push("标准", "金额", "补贴", "津贴");
  }
  if (slots.action !== undefined) {
    parts.push("办理流程", "步骤", "方式", "网上申请", "现场申请", "办理");
  }
  if (parts.join("").length === 0) {
    parts.push(normalizeGoal(contextGoal));
  }
  return parts.join(" ");
}

export function retrieveSegments(
  query: string,
  segments: SemanticSegment[],
  maxResults = 3,
  slots: Slots = {},
  utterance?: string,
): SegmentHit[] {
  const normalized = normalizeGoal(query);
  if (normalized.length === 0) {
    return [];
  }
  const effectiveSlots = Object.keys(slots).length > 0 ? slots : inferSectionSlots(query);
  if (utterance !== undefined) {
    const requiredTerms = extractRequiredTerms(utterance, effectiveSlots);
    const allHaystack = segments.map(segmentHaystack).join(" ");
    if (requiredTerms.some((term) => !allHaystack.includes(stripPunctuation(term)))) {
      return [];
    }
  }
  const sectionSegments = selectSectionSegments(segments, effectiveSlots);
  const candidates = sectionSegments.length > 0 ? sectionSegments : segments;
  const terms = Array.from(new Set([...collectNgrams(normalized), ...expandSynonyms(normalized)]))
    .filter((term) => term.length >= 2)
    .sort((left, right) => right.length - left.length || left.localeCompare(right));

  const scored: SegmentHit[] = [];
  for (const segment of candidates) {
    if (!segment.hasBody || PAGE_METADATA.test(segment.titleText)) {
      continue;
    }
    const haystack = stripPunctuation(segment.text);
    const titleHaystack = stripPunctuation(segment.titleText);
    const matched: string[] = [];
    let base = 0;
    for (const term of terms) {
      const needle = stripPunctuation(term);
      if (needle.length === 0 || !haystack.includes(needle)) {
        continue;
      }
      if (matched.includes(term)) {
        continue;
      }
      matched.push(term);
      base += 1;
      if (matched.length >= 3) {
        break;
      }
    }
    if (base === 0) {
      continue;
    }
    const titleBonus = matched.some((term) => titleHaystack.includes(stripPunctuation(term))) ? 1.25 : 1;
    const regionWeight = REGION_WEIGHTS[segment.region] ?? 0.9;
    const lengthDamp = segment.text.length <= 120 ? 1 : segment.text.length <= 300 ? 0.9 : 0.8;
    const score = Math.round(base * titleBonus * regionWeight * lengthDamp * 100) / 100;
    if (score >= MIN_SCORE) {
      scored.push({ segment, score, matchedKeywords: matched });
    }
  }

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.segment.orderRange[0] - right.segment.orderRange[0];
  });

  const topScore = scored[0]?.score ?? 0;
  const threshold = Math.max(MIN_SCORE, topScore * RELATIVE_THRESHOLD_FACTOR);
  const filtered = scored.filter((hit) => hit.score >= threshold);

  const seen = new Set<string>();
  const results: SegmentHit[] = [];
  for (const hit of filtered) {
    if (seen.has(hit.segment.segmentId)) {
      continue;
    }
    seen.add(hit.segment.segmentId);
    results.push(hit);
    if (results.length >= maxResults) {
      break;
    }
  }
  return results;
}