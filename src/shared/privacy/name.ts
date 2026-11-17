export interface NameRisk {
  labeled: number;
  unlabeled: number;
}

const LABELED_NAME = /(姓名|名字|申请人|联系人|办理人|客户姓名)\s*[:：]\s*([\u4e00-\u9fa5·]{2,6})/g;
const HONORIFIC_NAME = /([\u4e00-\u9fa5·]{2,4})\s*(先生|女士|同志|老师)/g;

export function redactLabeledNames(text: string): string {
  return text.replace(LABELED_NAME, "$1：姓名");
}

export function detectNameRisk(text: string): NameRisk {
  const labeled = (text.match(LABELED_NAME) ?? []).length;
  const unlabeled = (text.match(HONORIFIC_NAME) ?? []).length;
  return { labeled, unlabeled };
}

export function sanitizeNameText(text: string): { text: string; risk: NameRisk; blocked: boolean } {
  const risk = detectNameRisk(text);
  const sanitized = redactLabeledNames(text);
  return {
    text: sanitized,
    risk,
    blocked: risk.unlabeled > 0,
  };
}