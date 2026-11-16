import { MAX_GOAL_LENGTH } from "../../shared/constants";
import { stripPunctuation } from "../../shared/domPath";
import type {
  GuidanceCard,
  ItemType,
  MatchDiagnostics,
  MatchResult,
  MatchStrategy,
  PageSnapshot,
} from "../../shared/types";
import {
  MAX_CARDS,
  MAX_COUNTED_GROUPS,
  MAX_KEYWORD_GROUPS,
  MIN_SCORE,
  REGION_WEIGHTS,
  RELATIVE_THRESHOLD_FACTOR,
  STOP_PHRASES,
  SYNONYM_GROUPS,
  TITLE_BONUS,
} from "./lexicon";
import { buildExcerpt, buildSummary } from "./summarize";

interface KeywordGroup {
  terms: string[];
  primary: string[];
}

interface ScoredEntry {
  elementId: string;
  text: string;
  order: number;
  domPath: string;
  score: number;
  matchedKeywords: string[];
  type: ItemType;
}

function emptyDiagnostics(startedAt: number): MatchDiagnostics {
  return {
    matchMs: Math.round(performance.now() - startedAt),
    keywordGroups: 0,
    scoredCount: 0,
    topScore: 0,
    threshold: MIN_SCORE,
    dedupedCount: 0,
  };
}

function invalidGoal(goal: string, startedAt: number, message: string): MatchResult {
  const result: MatchResult = {
    status: "invalid-goal",
    cards: [],
    diagnostics: emptyDiagnostics(startedAt),
  };
  if (message.length > 0) {
    result.message = message;
  }
  return result;
}

export function normalizeGoal(goal: string): string {
  let text = goal.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  for (const phrase of STOP_PHRASES) {
    text = text.split(phrase).join("");
  }
  return text;
}

function collectNgrams(text: string): string[] {
  const grams = new Set<string>();
  for (let size = 4; size >= 2; size -= 1) {
    for (let index = 0; index + size <= text.length; index += 1) {
      grams.add(text.slice(index, index + size));
    }
  }
  return Array.from(grams).sort((left, right) => {
    if (left.length !== right.length) {
      return right.length - left.length;
    }
    return left.localeCompare(right);
  });
}

function buildKeywordGroups(normalizedGoal: string): KeywordGroup[] {
  const groups: KeywordGroup[] = [];
  const seen = new Set<string>();

  for (const gram of collectNgrams(normalizedGoal)) {
    const synonym = SYNONYM_GROUPS.find((terms) => terms.includes(gram));
    if (synonym !== undefined) {
      const key = synonym[0] ?? gram;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const primary = synonym.filter((term) => normalizedGoal.includes(term));
      groups.push({
        terms: synonym.slice(0, 8),
        primary: primary.length > 0 ? primary : [gram],
      });
      if (groups.length >= MAX_KEYWORD_GROUPS) {
        return groups;
      }
      continue;
    }

    if (seen.has(gram)) {
      continue;
    }
    if (
      groups.some((group) =>
        group.primary.some((primary) => primary.includes(gram) || gram.includes(primary)),
      )
    ) {
      continue;
    }
    seen.add(gram);
    groups.push({ terms: [gram], primary: [gram] });
    if (groups.length >= MAX_KEYWORD_GROUPS) {
      return groups;
    }
  }

  return groups;
}

function lengthDamp(length: number): number {
  if (length <= 120) {
    return 1.0;
  }
  if (length <= 300) {
    return 0.9;
  }
  return 0.8;
}

function trigrams(text: string): Set<string> {
  const normalized = stripPunctuation(text);
  const result = new Set<string>();
  for (let index = 0; index + 3 <= normalized.length; index += 1) {
    result.add(normalized.slice(index, index + 3));
  }
  return result;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const gram of left) {
    if (right.has(gram)) {
      intersection += 1;
    }
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isAncestorPath(ancestor: string, descendant: string): boolean {
  return ancestor.length > 0 && descendant.startsWith(`${ancestor} > `);
}

function isDuplicate(left: ScoredEntry, right: ScoredEntry): boolean {
  if (jaccard(trigrams(left.text), trigrams(right.text)) >= 0.75) {
    return true;
  }
  const relatedPaths = isAncestorPath(left.domPath, right.domPath) || isAncestorPath(right.domPath, left.domPath);
  if (!relatedPaths) {
    return false;
  }
  return left.text.includes(right.text) || right.text.includes(left.text);
}

function scoreItems(
  snapshot: PageSnapshot,
  groups: KeywordGroup[],
): { entries: ScoredEntry[]; scoredCount: number } {
  const entries: ScoredEntry[] = [];

  for (const item of snapshot.items) {
    const haystack = stripPunctuation(item.text);
    if (haystack.length === 0) {
      continue;
    }

    let base = 0;
    let countedGroups = 0;
    const matchedKeywords: string[] = [];

    for (const group of groups) {
      let groupScore = 0;
      let matchedTerm = "";
      for (const term of group.terms) {
        const needle = stripPunctuation(term);
        if (needle.length === 0 || !haystack.includes(needle)) {
          continue;
        }
        const isPrimary = group.primary.includes(term);
        const termScore = isPrimary ? 1.0 : 0.5;
        if (termScore > groupScore) {
          groupScore = termScore;
          matchedTerm = term;
        }
      }
      if (groupScore > 0 && countedGroups < MAX_COUNTED_GROUPS) {
        base += groupScore;
        countedGroups += 1;
        matchedKeywords.push(matchedTerm);
      }
    }

    if (base === 0) {
      continue;
    }

    const titleBonus = item.type === "heading" ? TITLE_BONUS : 1.0;
    const regionWeight = REGION_WEIGHTS[item.region] ?? 0.6;
    const score = Math.round(base * titleBonus * regionWeight * lengthDamp(item.text.length) * 100) / 100;
    if (score < MIN_SCORE) {
      continue;
    }

    entries.push({
      elementId: item.elementId,
      text: item.text,
      order: item.order,
      domPath: item.domPath,
      score,
      matchedKeywords,
      type: item.type,
    });
  }

  return { entries, scoredCount: entries.length };
}

export function matchGoal(
  goal: string,
  snapshot: PageSnapshot,
  startedAt: number,
): MatchResult {
  const trimmed = goal.trim();
  if (trimmed.length === 0) {
    return invalidGoal(goal, startedAt, "请先输入你想了解的内容");
  }
  if (trimmed.length > MAX_GOAL_LENGTH) {
    return invalidGoal(goal, startedAt, `目标过长，请精简到 ${MAX_GOAL_LENGTH} 字以内`);
  }

  const normalized = normalizeGoal(trimmed);
  if (normalized.length === 0) {
    return invalidGoal(goal, startedAt, "请补充更具体的关键词后重试");
  }

  const groups = buildKeywordGroups(normalized);
  if (groups.length === 0) {
    return invalidGoal(goal, startedAt, "请补充更具体的关键词后重试");
  }

  const { entries, scoredCount } = scoreItems(snapshot, groups);
  entries.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.order - right.order;
  });

  const topScore = entries[0]?.score ?? 0;
  const threshold = Math.max(MIN_SCORE, Math.round(topScore * RELATIVE_THRESHOLD_FACTOR * 100) / 100);
  const filtered = entries.filter((entry) => entry.score >= threshold);

  const selected: ScoredEntry[] = [];
  for (const candidate of filtered) {
    if (selected.some((existing) => isDuplicate(existing, candidate))) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= MAX_CARDS) {
      break;
    }
  }

  const diagnostics: MatchDiagnostics = {
    matchMs: Math.round(performance.now() - startedAt),
    keywordGroups: groups.length,
    scoredCount,
    topScore,
    threshold,
    dedupedCount: filtered.length - selected.length,
  };

  if (selected.length === 0) {
    const result: MatchResult = {
      status: "no-evidence",
      cards: [],
      diagnostics,
    };
    result.message = "当前页面未找到依据";
    return result;
  }

  const cards: GuidanceCard[] = selected.map((entry, index) => {
    const excerpt = buildExcerpt(entry.text);
    return {
      cardId: `card-${Date.now()}-${index + 1}`,
      elementId: entry.elementId,
      summary: buildSummary(entry.text, entry.matchedKeywords),
      excerpt: excerpt.text,
      excerptTruncated: excerpt.truncated,
      matchedKeywords: entry.matchedKeywords,
      score: entry.score,
      rank: index + 1,
    };
  });

  if (cards.length < 3) {
    const result: MatchResult = {
      status: "partial",
      cards,
      diagnostics,
    };
    result.message = "仅找到少量相关片段";
    return result;
  }

  return {
    status: "success",
    cards,
    diagnostics,
  };
}

export const ruleMatcher: MatchStrategy = {
  mode: "rule-demo",
  match(goal: string, snapshot: PageSnapshot): MatchResult {
    return matchGoal(goal, snapshot, performance.now());
  },
};