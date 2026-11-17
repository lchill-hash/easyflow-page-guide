export type ModelFallbackReason =
  | "disabled"
  | "not-ready"
  | "timeout"
  | "network"
  | "outbound-blocked"
  | "model-invalid"
  | "ungrounded"
  | "unsafe-control"
  | "unsafe-instruction"
  | "validation";

export class ModelFallbackError extends Error {
  readonly reason: ModelFallbackReason;

  constructor(reason: ModelFallbackReason) {
    super(`model-fallback:${reason}`);
    this.name = "ModelFallbackError";
    this.reason = reason;
  }
}

export function shouldUseOnlineModel(enabled: boolean, ready: boolean): boolean {
  return enabled && ready;
}

export function fallbackNotice(reason: ModelFallbackReason): string {
  switch (reason) {
    case "disabled":
    case "not-ready":
      return "在线智能尚未就绪，已改用本地规则。";
    case "outbound-blocked":
      return "页面内容含隐私信息，未发送给在线模型，已改用本地规则。";
    case "unsafe-control":
    case "unsafe-instruction":
      return "在线模型给出了不安全操作，已改用本地规则。";
    case "ungrounded":
      return "在线模型回答缺少页面依据，已改用本地规则。";
    case "timeout":
    case "network":
      return "在线模型暂时不可用，已改用本地规则，可以直接继续输入。";
    case "validation":
    case "model-invalid":
      return "在线模型结果未通过校验，已改用本地规则。";
    default:
      return "已改用本地规则。";
  }
}

export function fallbackReasonOf(error: unknown): ModelFallbackReason {
  if (error instanceof ModelFallbackError) {
    return error.reason;
  }
  const message = error instanceof Error ? error.message : "";
  if (/timeout|abort/i.test(message)) {
    return "timeout";
  }
  if (/outbound-/.test(message)) {
    return "outbound-blocked";
  }
  if (/unsafe-control/.test(message)) {
    return "unsafe-control";
  }
  if (/unsafe-instruction/.test(message)) {
    return "unsafe-instruction";
  }
  if (/ungrounded/.test(message)) {
    return "ungrounded";
  }
  if (/invalid|empty/.test(message)) {
    return "model-invalid";
  }
  return "network";
}