import {
  MAX_SEGMENT_BODY_REFS,
  MAX_SEGMENT_CHARS,
  MAX_SEGMENTS,
} from "../shared/constants";
import { normalizeWhitespace } from "../shared/domPath";
import type { ElementItem, ElementRef, SemanticSegment } from "../shared/types";

function refOf(item: ElementItem): ElementRef {
  return {
    elementId: item.elementId,
    domPath: item.domPath,
    textHash: item.textHash,
  };
}

function isBoilerplate(item: ElementItem): boolean {
  const text = normalizeWhitespace(item.text);
  if (text.length === 0) {
    return true;
  }
  if (
    /^(日期|来源|分享|字号|扫一扫|打印|主办|承办|京ICP|京公网安备|政府网站标识码|客服信箱|政务服务热线|建议您使用|关于我们|建议意见|站点地图|法律声明)/.test(
      text,
    )
  ) {
    return true;
  }
  return /^\d{4}[-年]\d{1,2}[-月]\d{1,2}日?\s*\d{1,2}:\d{2}/.test(text);
}

function isTitleCandidate(item: ElementItem): boolean {
  if (isBoilerplate(item)) {
    return false;
  }
  if (item.titleCandidate === true || item.type === "heading") {
    return true;
  }
  return item.type === "paragraph" && item.text.length <= 30 && /[：:]$/.test(item.text);
}

function pathParts(domPath: string): string[] {
  return domPath.split(" > ").filter((part) => part.length > 0);
}

function commonPrefixLength(left: string[], right: string[]): number {
  const limit = Math.min(left.length, right.length);
  let count = 0;
  while (count < limit && left[count] === right[count]) {
    count += 1;
  }
  return count;
}

function sharesContainer(titlePath: string, bodyPath: string): boolean {
  const titleParts = pathParts(titlePath);
  const bodyParts = pathParts(bodyPath);
  const common = commonPrefixLength(titleParts, bodyParts);
  return common >= 1 && common >= titleParts.length - 1;
}

function isBodyType(item: ElementItem): boolean {
  return item.type === "paragraph";
}

function extractScopeHints(text: string): string[] {
  const matches = text.match(/\d{4}年|\d{1,2}周岁|[\u4e00-\u9fa5]{1,10}(?:区|县|街道|市|镇)/g) ?? [];
  return Array.from(new Set(matches)).slice(0, 5);
}

function hasScopeConflict(text: string): boolean {
  const years = text.match(/\d{4}年/g) ?? [];
  const ages = text.match(/\d{1,2}周岁/g) ?? [];
  return new Set(years).size > 1 || new Set(ages).size > 1;
}

function buildSegment(
  title: ElementItem,
  bodyItems: ElementItem[],
  orderRange: [number, number],
  truncated: boolean,
  segmentIndex: number,
): SemanticSegment {
  const bodyTexts = bodyItems.map((item) => item.text);
  const text = [title.text, ...bodyTexts].join(" ");
  return {
    segmentId: `seg-${segmentIndex + 1}`,
    text,
    titleRef: refOf(title),
    titleText: title.text,
    bodyRefs: bodyItems.map(refOf),
    bodyTexts,
    truncated,
    hasBody: bodyItems.length > 0,
    region: title.region,
    orderRange,
    scopeHints: extractScopeHints(text),
    scopeConflict: hasScopeConflict(text),
  };
}

function buildFallbackSegments(items: ElementItem[]): SemanticSegment[] {
  const paragraphs = items.filter((item) => item.type === "paragraph" && !isBoilerplate(item));
  if (paragraphs.length === 0) {
    return [];
  }
  const segments: SemanticSegment[] = [];
  let index = 0;
  while (index < paragraphs.length && segments.length < MAX_SEGMENTS) {
    const startItem = paragraphs[index];
    if (startItem === undefined) {
      break;
    }
    const group: ElementItem[] = [startItem];
    let chars = startItem.text.length;
    let cursor = index + 1;
    while (cursor < paragraphs.length && group.length < 3) {
      const next = paragraphs[cursor];
      if (next === undefined || next.region !== startItem.region) {
        break;
      }
      if (chars + 1 + next.textLength > MAX_SEGMENT_CHARS) {
        break;
      }
      group.push(next);
      chars += 1 + next.textLength;
      cursor += 1;
    }
    const title = group[0];
    if (title !== undefined) {
      const bodyTexts = group.map((item) => item.text);
      const text = bodyTexts.join(" ");
      segments.push({
        segmentId: `seg-${segments.length + 1}`,
        text,
        titleRef: refOf(title),
        titleText: title.text,
        bodyRefs: group.map(refOf),
        bodyTexts,
        truncated: group.some((item) => item.truncated),
        hasBody: true,
        region: title.region,
        orderRange: [title.order, group[group.length - 1]?.order ?? title.order],
        scopeHints: extractScopeHints(text),
        scopeConflict: hasScopeConflict(text),
      });
    }
    index = cursor;
  }
  return segments;
}

export function buildSegments(items: ElementItem[]): SemanticSegment[] {
  const segments: SemanticSegment[] = [];
  const total = items.length;

  for (let index = 0; index < total && segments.length < MAX_SEGMENTS; index += 1) {
    const title = items[index];
    if (title === undefined || !isTitleCandidate(title)) {
      continue;
    }

    const bodyItems: ElementItem[] = [];
    let chars = title.text.length;
    let truncated = title.truncated;
    let cursor = index + 1;

    while (cursor < total && bodyItems.length < MAX_SEGMENT_BODY_REFS) {
      const item = items[cursor];
      if (item === undefined) {
        break;
      }
      if (isTitleCandidate(item)) {
        break;
      }
      if (isBoilerplate(item)) {
        cursor += 1;
        continue;
      }
      if (item.region !== title.region && title.region !== "unknown") {
        break;
      }
      if (item.type === "link" || item.type === "button" || item.type === "inputLabel") {
        if (item.region === title.region || title.region === "unknown") {
          cursor += 1;
          continue;
        }
        break;
      }
      if (!isBodyType(item)) {
        cursor += 1;
        continue;
      }
      if (!sharesContainer(title.domPath, item.domPath)) {
        break;
      }
      if (chars + 1 + item.textLength > MAX_SEGMENT_CHARS) {
        truncated = true;
        break;
      }
      bodyItems.push(item);
      chars += 1 + item.textLength;
      if (item.truncated) {
        truncated = true;
      }
      cursor += 1;
    }

    const lastBodyOrder = bodyItems[bodyItems.length - 1]?.order ?? title.order;
    segments.push(buildSegment(title, bodyItems, [title.order, lastBodyOrder], truncated, segments.length));
  }

  if (segments.length === 0) {
    return buildFallbackSegments(items);
  }
  return segments;
}

export function titleCandidateOf(item: ElementItem): boolean {
  return isTitleCandidate(item);
}

export function segmentTextNormalized(segment: SemanticSegment): string {
  return normalizeWhitespace(segment.text);
}