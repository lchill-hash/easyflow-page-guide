import type { CitationAnchor, ElementItem, PageSnapshot } from "../../../shared/types";
import { detectSensitive } from "../../../shared/privacy/detect";

export interface PreparationEntry {
  id: string;
  text: string;
  citation: CitationAnchor;
}

export interface HelpLink {
  id: string;
  text: string;
  citation: CitationAnchor;
}

export interface PageQuestion {
  id: string;
  label: string;
  prompt: string;
}

const REQUIREMENT = /(需要|须|必须|应当|请携带|请准备|准备材料|所需材料|办理条件|申请条件|提交材料|材料要求|提供证明)/;
const FORM_OR_SECRET = /(请输入|填写|证件号码|身份证号|手机号|手机号码|银行卡号|验证码|动态码|密码)/;
const OFFICIAL_HELP = /(客服|服务热线|服务电话|联系我们|帮助中心|在线咨询|人工服务)/;

const QUESTION_RULES: Array<{ id: string; label: string; prompt: string; pattern: RegExp }> = [
  { id: "requirements", label: "看看办理条件", prompt: "请告诉我当前网页写的办理条件，并指出原文。", pattern: /(办理条件|申请条件|资格要求|符合条件)/ },
  { id: "materials", label: "需要准备什么", prompt: "请告诉我当前网页写的准备材料，并指出原文。", pattern: /(所需材料|准备材料|携带材料|证明材料|申请材料)/ },
  { id: "steps", label: "看看办理流程", prompt: "请用简单的话说明当前网页写的办理流程，并指出原文。", pattern: /(办理流程|办事流程|办理步骤|申请步骤)/ },
  { id: "fees", label: "要不要收费", prompt: "当前网页有没有写收费或费用信息？请只依据原文回答。", pattern: /(收费|费用|价格)/ },
  { id: "schedule", label: "看看时间安排", prompt: "请告诉我当前网页写的办理时间或可选时段，并指出原文。", pattern: /(办理时间|预约时间|可选时段|开放时间|预约)/ },
];

export function pageQuestions(snapshot: PageSnapshot | null): PageQuestion[] {
  if (snapshot === null) return [];
  const text = (snapshot.segments ?? []).map((segment) => segment.titleText).join(" ");
  return QUESTION_RULES.filter((rule) => rule.pattern.test(text))
    .slice(0, 3)
    .map(({ id, label, prompt }) => ({ id, label, prompt }));
}

export function preparationEntries(snapshot: PageSnapshot | null): PreparationEntry[] {
  if (snapshot === null) return [];
  const result: PreparationEntry[] = [];
  for (const segment of snapshot.segments ?? []) {
    if (segment.truncated) continue;
    for (let index = 0; index < segment.bodyTexts.length; index += 1) {
      const text = segment.bodyTexts[index]?.replace(/\s+/g, " ").trim() ?? "";
      const ref = segment.bodyRefs[index];
      if (ref === undefined || text.length < 8 || text.length > 220 || detectSensitive(text).length > 0 ||
        !REQUIREMENT.test(text) || FORM_OR_SECRET.test(text)) continue;
      result.push({
        id: `${snapshot.snapshotId}:${segment.segmentId}:${index}`,
        text,
        citation: {
          citationId: `prep:${snapshot.snapshotId}:${segment.segmentId}:${index}`,
          segmentId: segment.segmentId,
          role: "body",
          text,
          start: 0,
          end: text.length,
          status: "valid",
          ref,
        },
      });
      if (result.length === 4) return result;
    }
  }
  return result;
}

export function officialHelpLinks(snapshot: PageSnapshot | null): HelpLink[] {
  if (snapshot === null) return [];
  const items = snapshot.items.filter((item: ElementItem) =>
    (item.type === "link" || item.type === "button") && OFFICIAL_HELP.test(item.text) &&
      detectSensitive(item.text).length === 0,
  );
  return items.slice(0, 3).map((item) => ({
    id: `${snapshot.snapshotId}:${item.elementId}`,
    text: item.text.slice(0, 100),
    citation: {
      citationId: `help:${snapshot.snapshotId}:${item.elementId}`,
      segmentId: `help:${snapshot.snapshotId}`,
      role: "body",
      text: item.text,
      start: 0,
      end: item.text.length,
      status: "valid",
      ref: { elementId: item.elementId, domPath: item.domPath, textHash: item.textHash },
    },
  }));
}
