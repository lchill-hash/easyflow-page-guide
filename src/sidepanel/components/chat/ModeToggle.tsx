import type { UiMode } from "../../../shared/uiMode";

interface ModeToggleProps {
  uiMode: UiMode;
  modeReady: boolean;
  onToggle: () => void;
}

export function ModeToggle({ uiMode, modeReady, onToggle }: ModeToggleProps) {
  const care = uiMode === "care";
  return (
    <button
      type="button"
      className="ef-mode-toggle ef-icon-button"
      aria-pressed={care}
      aria-label={care ? "关闭简明大字模式" : "开启简明大字模式"}
      title={care ? "关闭简明大字模式" : "开启简明大字模式"}
      disabled={!modeReady}
      onClick={onToggle}
    >
      <span aria-hidden="true">Aa</span>
    </button>
  );
}
