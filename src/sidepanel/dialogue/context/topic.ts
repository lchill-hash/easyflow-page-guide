import { normalizeWhitespace } from "../../../shared/domPath";

const PREFIXES = [
  "请问",
  "我想知道",
  "我想了解一下",
  "我想了解",
  "我想问一下",
  "我想问",
  "我想",
  "那么",
  "那",
  "这个",
  "那个",
].sort((left, right) => right.length - left.length);

const SUFFIXES = [
  "谁能申请",
  "谁可以申请",
  "什么人能申请",
  "哪些人能申请",
  "申请条件",
  "办理条件",
  "条件是什么",
  "需要什么条件",
  "怎么去申请",
  "怎么申请",
  "怎么去办",
  "怎么办理",
  "怎么办",
  "如何申请",
  "如何办理",
  "办理流程",
  "办理方式",
  "在哪里办理",
  "在哪办理",
  "线下办理",
  "线上办理",
  "需要带什么材料",
  "需要带什么",
  "需要什么材料",
  "需要什么",
  "要带什么",
  "带什么材料",
  "带什么",
  "准备什么",
  "下一步点哪里",
  "下一步",
  "多少钱",
  "办理指南",
  "申请指南",
  "服务指南",
  "办理流程",
  "申请流程",
  "政策问答",
  "指南",
  "通知",
  "公告",
  "问答",
].sort((left, right) => right.length - left.length);

const GENERIC_ONLY =
  /^(办理|申请|条件|材料|流程|时间|地点|电话|多少|什么|怎么|如何|谁|需要|带|要|能|可以|一下|这个|那个|找不到)$/;

const QUESTION_RESIDUE = /(谁能申请|谁可以申请|怎么办理|怎么去办|怎么申请|如何办理|如何申请|需要带什么|要带什么|条件是什么|办理流程|办理方式)/;

function clean(text: string): string {
  return normalizeWhitespace(text).replace(/[？?！!。；;，,、\s]/g, "");
}

function stripPrefixes(text: string): string {
  let result = text;
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of PREFIXES) {
      if (result.startsWith(prefix)) {
        result = result.slice(prefix.length);
        changed = true;
      }
    }
  }
  return result;
}

function stripSuffixes(text: string): string {
  let result = text;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of SUFFIXES) {
      if (result.endsWith(suffix)) {
        result = result.slice(0, result.length - suffix.length);
        changed = true;
      }
    }
  }
  return result;
}

export function sanitizeReusableObject(value: string): string | undefined {
  let text = stripSuffixes(stripPrefixes(clean(value)));
  text = text.replace(/^[的地得]+|[的地得]+$/g, "");
  if (text.length < 2 || text.length > 24) {
    return undefined;
  }
  if (GENERIC_ONLY.test(text) || QUESTION_RESIDUE.test(text)) {
    return undefined;
  }
  return text;
}

export function extractReusableObject(
  utterance: string,
  pageTitle: string,
  previousObject?: string,
): string | undefined {
  const current = sanitizeReusableObject(utterance);
  if (current !== undefined) {
    return current;
  }
  if (previousObject !== undefined) {
    const previous = sanitizeReusableObject(previousObject);
    if (previous !== undefined) {
      return previous;
    }
  }
  return sanitizeReusableObject(pageTitle);
}