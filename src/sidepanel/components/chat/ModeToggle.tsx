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
      className="ef-mode-toggle"
      role="switch"
      aria-checked={care}
      aria-label="阅读模式：长者关怀"
      disabled={!modeReady}
      onClick={onToggle}
    >
      <span className="ef-mode-toggle-label">长者关怀</span>
      <span className="ef-mode-toggle-state">{care ? "已开启" : "已关闭"}</span>
      <span className="ef-mode-toggle-track" aria-hidden="true">
        <span className="ef-mode-toggle-thumb" />
      </span>
    </button>
  );
}