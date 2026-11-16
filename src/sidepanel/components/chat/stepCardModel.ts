export type StepCardMode = "current" | "expired" | "ended";

export type StepCardAction = "locate" | "not-found" | "misclicked" | "done" | "switch-task";

export interface StepCardLayout {
  primary: "locate" | null;
  secondary: StepCardAction[];
  showDetails: boolean;
  showStateText: boolean;
  showSpeak: boolean;
}

export interface StepCardModeInput {
  ended: boolean;
  expired: boolean;
}

export function resolveStepCardMode(input: StepCardModeInput): StepCardMode {
  if (input.ended) {
    return "ended";
  }
  if (input.expired) {
    return "expired";
  }
  return "current";
}

export function stepCardLayout(mode: StepCardMode): StepCardLayout {
  if (mode !== "current") {
    return {
      primary: null,
      secondary: [],
      showDetails: false,
      showStateText: true,
      showSpeak: false,
    };
  }
  return {
    primary: "locate",
    secondary: ["not-found", "misclicked", "done", "switch-task"],
    showDetails: true,
    showStateText: false,
    showSpeak: true,
  };
}

export function stepCardActions(mode: StepCardMode): StepCardAction[] {
  if (mode !== "current") {
    return [];
  }
  return ["locate", "not-found", "misclicked", "done", "switch-task"];
}

export function shouldShowCompletion(mode: StepCardMode): boolean {
  return mode === "current";
}

export function stepCardStateTag(mode: StepCardMode): string {
  switch (mode) {
    case "ended":
      return "这一步已结束";
    case "expired":
      return "这一步已过期";
    default:
      return "当前步骤";
  }
}

// 既有测试兼容值，不再驱动当前卡渲染。
export function stepCardLabel(mode: StepCardMode): string {
  switch (mode) {
    case "ended":
      return "这一步已结束";
    case "expired":
      return "这一步已过期";
    default:
      return "现在这一步";
  }
}