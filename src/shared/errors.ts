export type EfErrorCode =
  | "EF-E001"
  | "EF-E002"
  | "EF-E003"
  | "EF-E004"
  | "EF-E005"
  | "EF-E006"
  | "EF-E007"
  | "EF-E008"
  | "EF-E009"
  | "EF-E010"
  | "EF-E011"
  | "EF-E012"
  | "EF-E013";

export interface EfError {
  code: EfErrorCode;
  message: string;
  retryable: boolean;
  action: string;
  detail?: string;
}

export type EfResult<T> = { ok: true; data: T } | { ok: false; error: EfError };

interface ErrorDefinition {
  message: string;
  retryable: boolean;
  action: string;
}

const DEFINITIONS: Record<EfErrorCode, ErrorDefinition> = {
  "EF-E001": {
    message: "未检测到活动网页，请先打开目标网页",
    retryable: true,
    action: "打开网页后点击扩展图标",
  },
  "EF-E002": {
    message: "当前页面不支持读取，请切换到普通公开网页后重试",
    retryable: true,
    action: "切换到普通网页后点击重新读取页面",
  },
  "EF-E003": {
    message: "未获得当前页面访问授权，请点击扩展图标后重试",
    retryable: true,
    action: "重新点击扩展图标后再读取",
  },
  "EF-E004": {
    message: "当前标签页已关闭，请重新打开目标网页",
    retryable: true,
    action: "重新打开网页并点击扩展图标",
  },
  "EF-E005": {
    message: "页面脚本注入失败，请刷新页面后重试",
    retryable: true,
    action: "刷新页面后点击重新读取页面",
  },
  "EF-E006": {
    message: "页面读取超时，请点击重新读取页面",
    retryable: true,
    action: "点击重新读取页面",
  },
  "EF-E007": {
    message: "页面已刷新或切换，请重新读取页面",
    retryable: true,
    action: "点击重新读取页面",
  },
  "EF-E008": {
    message: "该依据已不在页面中，请点击重新读取页面",
    retryable: true,
    action: "点击重新读取页面后再查看原文",
  },
  "EF-E009": {
    message: "目标内容被折叠，请展开后重试",
    retryable: true,
    action: "展开页面中的折叠区域后再次查看原文",
  },
  "EF-E010": {
    message: "请先输入你想了解的内容",
    retryable: true,
    action: "补充 1—200 字的目标后重试",
  },
  "EF-E011": {
    message: "当前页面未找到依据（页面可读内容过少，可能未加载完成）",
    retryable: true,
    action: "等待页面加载完成后点击重新读取页面",
  },
  "EF-E012": {
    message: "当前页面未找到依据",
    retryable: true,
    action: "更换关键词或点击重新读取页面",
  },
  "EF-E013": {
    message: "目标记忆已停用（不影响分析）",
    retryable: false,
    action: "无需处理，分析功能不受影响",
  },
};

const CODES = new Set<EfErrorCode>(Object.keys(DEFINITIONS) as EfErrorCode[]);

export function createEfError(code: EfErrorCode, detail?: string): EfError {
  const definition = DEFINITIONS[code];
  const error: EfError = {
    code,
    message: definition.message,
    retryable: definition.retryable,
    action: definition.action,
  };
  if (typeof detail === "string" && detail.length > 0) {
    error.detail = detail.slice(0, 160);
  }
  return error;
}

export function isEfError(value: unknown): value is EfError {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.code === "string" &&
    CODES.has(record.code as EfErrorCode) &&
    typeof record.message === "string"
  );
}

export function toEfError(error: unknown): EfError {
  if (isEfError(error)) {
    return error;
  }
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  if (/chrome:\/\/|edge:\/\/|chrome-extension:\/\/|extensions gallery|webstore|view-source:|about:|cannot be scripted/i.test(rawMessage)) {
    return createEfError("EF-E002", rawMessage);
  }
  if (/activeTab|manifest must request permission|missing host permission|not granted|not allowed to access|denied|Cannot access contents of (?:the )?(?:page|url)/i.test(rawMessage)) {
    return createEfError("EF-E003", rawMessage);
  }
  if (/Cannot access|cannot be scripted/i.test(rawMessage)) {
    return createEfError("EF-E002", rawMessage);
  }
  if (/No tab with id|tab was closed|No tab/i.test(rawMessage)) {
    return createEfError("EF-E004", rawMessage);
  }
  if (/Could not establish connection|Receiving end does not exist|message port closed/i.test(rawMessage)) {
    return createEfError("EF-E007", rawMessage);
  }
  return createEfError("EF-E005", rawMessage);
}
