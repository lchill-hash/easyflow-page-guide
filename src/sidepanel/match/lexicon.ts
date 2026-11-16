import type { GoalSlot, Region } from "../../shared/types";

export const STOP_PHRASES: readonly string[] = [
  "我想知道",
  "我想了解",
  "我想问一下",
  "帮我看看",
  "麻烦问一下",
  "请问",
  "怎么",
  "如何",
  "怎样",
  "什么",
  "哪些",
  "是否",
  "可以",
  "需要",
  "能够",
  "这个",
  "那个",
  "一下",
  "我们",
  "我",
  "的",
  "了",
  "吗",
  "呢",
  "吧",
  "和",
  "与",
  "及",
  "或",
];

export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["申请条件", "条件", "资格", "对象", "标准", "要求"],
  ["线下办理", "办理", "窗口", "受理", "现场", "地点"],
  ["申请材料", "材料", "证件", "证明", "所需"],
  ["办理流程", "流程", "步骤", "程序"],
  ["联系方式", "电话", "咨询", "联系"],
  ["办理时间", "时间", "工作日", "时限"],
  ["补贴标准", "金额", "补助", "津贴", "标准"],
];

export const REGION_WEIGHTS: Record<Region, number> = {
  main: 1.0,
  unknown: 0.9,
  header: 0.8,
  nav: 0.6,
  aside: 0.6,
  footer: 0.6,
};

export const TITLE_BONUS = 1.25;
export const MIN_SCORE = 1.0;
export const RELATIVE_THRESHOLD_FACTOR = 0.35;
export const MAX_KEYWORD_GROUPS = 8;
export const MAX_COUNTED_GROUPS = 3;
export const MAX_CARDS = 5;

export const SAFETY_VERBS: readonly string[] = [
  "帮我填",
  "帮我选",
  "帮我勾",
  "帮我提交",
  "帮我支付",
  "帮我删",
  "代填",
  "代选",
  "代提交",
  "输入验证码",
  "告诉验证码",
  "帮我登录",
  "验证码是多少",
  "身份证号",
  "银行卡号",
  "密码",
];

export const TASK_SWITCH: readonly string[] = [
  "换一个任务",
  "换个任务",
  "重新开始",
  "不办这个了",
  "另外问",
  "换个事",
];

export const PROCESS_VERBS: readonly string[] = [
  "我要办",
  "我想办",
  "第一次办",
  "准备办",
  "我想预约",
  "我要预约",
  "帮我预约",
  "预约这个",
  "预订这个",
  "订个时间",
  "约个时间",
  "订一个时间",
  "先点哪里",
  "一步一步",
  "一步步",
  "带我预约",
  "教我预约",
  "怎么预约",
  "如何预约",
  "帮我找",
  "带我去",
  "下一步",
  "继续",
  "先做什么",
  "办借记卡",
  "找营业网点",
];

export const FEEDBACK_NOT_FOUND: readonly string[] = [
  "我找不到",
  "找不到",
  "没看到",
  "在哪里点",
  "看不到",
  "没有看到",
];

export const FEEDBACK_MISCLICK: readonly string[] = [
  "我点错了",
  "点错",
  "不是这个",
];

export const FEEDBACK_DONE: readonly string[] = [
  "我已完成",
  "已完成",
  "完成了",
  "弄好了",
  "好了",
];

export const FACT_WH: readonly string[] = [
  "谁",
  "什么",
  "哪些",
  "哪里",
  "在哪",
  "多少",
  "多久",
  "几点",
  "需要带",
  "要不要",
  "是否",
  "能不能",
  "条件",
  "材料",
  "时间",
  "地点",
  "电话",
  "怎么办理",
  "怎么去办",
  "怎么去申请",
  "如何申请",
  "如何办理",
  "怎么申请",
  "办理流程",
  "办理方式",
];

export const ELLIPSIS: readonly string[] = [
  "那",
  "这个呢",
  "然后呢",
  "还要什么",
  "上面说的",
];

export const SLOT_TERMS: Record<GoalSlot, readonly string[]> = {
  object: [],
  condition: ["条件", "资格", "对象", "要求", "谁"],
  material: ["材料", "证件", "证明", "复印件", "照片", "需要带", "带什么"],
  location: ["哪里", "在哪", "地点", "窗口", "线下", "地址", "现场"],
  time: ["时间", "几点", "多久", "什么时候", "工作日", "时限"],
  contact: ["电话", "联系", "咨询"],
  amount: ["多少", "金额", "标准", "补贴", "津贴"],
  action: ["办理", "申请", "办", "找", "查询", "搜索"],
};