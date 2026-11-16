import { MAX_ANSWER_CHARS, MAX_ANSWER_SENTENCES, MAX_CITATION_CHARS } from "../../../shared/constants";
import type { CitationAnchor, GoalSlot, SemanticSegment, Slots } from "../../../shared/types";
import type { SegmentHit } from "../retrieval/segmentRetriever";

export interface ComposedAnswer {
  text: string;
  citations: CitationAnchor[];
  usedSegments: number;
}

export type ComposeResult =
  | { ok: true; data: ComposedAnswer }
  | { ok: false; reason: "title-only" | "no-evidence"; titleText?: string };

const SLOT_SENTENCE_TERMS: Partial<Record<GoalSlot, readonly string[]>> = {
  condition: ["条件", "资格", "对象", "标准", "要求"],
  material: ["材料", "证件", "证明", "复印件", "照片", "身份证", "户口簿", "原件"],
  location: ["地点", "窗口", "线下", "现场", "地址"],
  time: ["时间", "工作日", "时限"],
  contact: ["电话", "联系", "咨询"],
  amount: ["金额", "标准", "补贴", "津贴"],
  action: ["办理流程", "流程", "步骤", "方式", "网上申请", "现场申请", "申请", "办理", "窗口"],
};

function splitSentences(text: string): string[] {
  return (text.match(/[^。！？；\n]+[。！？；]?/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 4);
}

function sentenceScore(sentence: string, matchedKeywords: string[], slots: Slots): number {
  let score = 0;
  for (const keyword of matchedKeywords) {
    if (keyword.length >= 2 && sentence.includes(keyword)) {
      score += 3;
    }
  }
  for (const slot of Object.keys(slots) as GoalSlot[]) {
    const terms = SLOT_SENTENCE_TERMS[slot];
    if (terms === undefined) {
      continue;
    }
    for (const term of terms) {
      if (sentence.includes(term)) {
        score += term.length >= 4 ? 3 : 1;
      }
    }
  }
  return score;
}

function sentenceCount(text: string): number {
  const matches = text.match(/[。！？；]/g);
  return Math.max(1, matches?.length ?? 1);
}

function makeCitation(
  citationId: string,
  segment: SemanticSegment,
  role: "title" | "body",
  text: string,
  index: number,
): CitationAnchor {
  const bodyRef = segment.bodyRefs[index];
  return {
    citationId,
    segmentId: segment.segmentId,
    role,
    text: text.slice(0, MAX_CITATION_CHARS),
    start: 0,
    end: Math.min(text.length, MAX_CITATION_CHARS),
    status: "valid",
    ref: role === "title" ? segment.titleRef : (bodyRef ?? segment.titleRef),
  };
}

interface SelectedSentence {
  sentence: string;
  segment: SemanticSegment;
  bodyIndex: number;
  score: number;
}

export function composeAnswer(hits: SegmentHit[], slots: Slots): ComposeResult {
  const selected: SelectedSentence[] = [];
  const seenSentences = new Set<string>();
  const usedSegmentIds = new Set<string>();

  for (const hit of hits) {
    const segment = hit.segment;
    if (!segment.hasBody || segment.bodyTexts.length === 0) {
      continue;
    }

    const candidates: SelectedSentence[] = [];
    for (let bodyIndex = 0; bodyIndex < segment.bodyTexts.length; bodyIndex += 1) {
      const bodyText = segment.bodyTexts[bodyIndex];
      if (bodyText === undefined) {
        continue;
      }
      for (const sentence of splitSentences(bodyText)) {
        if (seenSentences.has(sentence)) {
          continue;
        }
        candidates.push({
          sentence,
          segment,
          bodyIndex,
          score: sentenceScore(sentence, hit.matchedKeywords, slots),
        });
      }
    }

    candidates.sort((left, right) => right.score - left.score || left.bodyIndex - right.bodyIndex);
    let taken = 0;
    for (const candidate of candidates) {
      if (selected.length >= MAX_ANSWER_SENTENCES || taken >= 2) {
        break;
      }
      if (seenSentences.has(candidate.sentence)) {
        continue;
      }
      seenSentences.add(candidate.sentence);
      selected.push(candidate);
      usedSegmentIds.add(segment.segmentId);
      taken += 1;
    }
    if (selected.length >= MAX_ANSWER_SENTENCES) {
      break;
    }
  }

  if (selected.length === 0) {
    const fallbackTitle = hits.find((hit) => hit.segment.titleText.length > 0)?.segment.titleText;
    if (fallbackTitle !== undefined) {
      return { ok: false, reason: "title-only", titleText: fallbackTitle };
    }
    return { ok: false, reason: "no-evidence" };
  }

  const prefix = "页面写明：";
  let chosen = selected.slice(0, MAX_ANSWER_SENTENCES);
  let answer = `${prefix}${chosen.map((item) => item.sentence).join("")}`;
  while (answer.length > MAX_ANSWER_CHARS && chosen.length > 1) {
    chosen = chosen.slice(0, -1);
    answer = `${prefix}${chosen.map((item) => item.sentence).join("")}`;
  }
  if (answer.length > MAX_ANSWER_CHARS) {
    const first = chosen[0]?.sentence ?? "";
    answer = `${prefix}页面信息较多，我先说最关键的一条：${first}`;
    if (answer.length > MAX_ANSWER_CHARS) {
      answer = `${answer.slice(0, MAX_ANSWER_CHARS - 1)}…`;
    }
  }

  const citations: CitationAnchor[] = [];
  const firstSelected = chosen[0];
  if (firstSelected !== undefined) {
    citations.push(
      makeCitation(`cite-${citations.length + 1}`, firstSelected.segment, "title", firstSelected.segment.titleText, -1),
    );
  }
  for (const item of chosen) {
    if (citations.length >= 4) {
      break;
    }
    citations.push(
      makeCitation(`cite-${citations.length + 1}`, item.segment, "body", item.sentence, item.bodyIndex),
    );
  }

  return {
    ok: true,
    data: {
      text: answer,
      citations,
      usedSegments: usedSegmentIds.size,
    },
  };
}