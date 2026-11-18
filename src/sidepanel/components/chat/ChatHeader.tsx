import type { UiMode } from "../../../shared/uiMode";
import { ModeToggle } from "./ModeToggle";
import { Icon } from "./Icon";

interface ChatHeaderProps {
  uiMode: UiMode;
  modeReady: boolean;
  onToggleMode: () => void;
  onOpenSettings: () => void;
}

export function ChatHeader({ uiMode, modeReady, onToggleMode, onOpenSettings }: ChatHeaderProps) {
  return (
    <header className="ef-header ef-chat-header">
      <div className="ef-brand">
        <span className="ef-logo" aria-hidden="true">
          e
        </span>
        <div>
          <h1 className="ef-title">EasyFlow</h1>
          <p className="ef-subtitle">陪你看懂，也陪你办。</p>
        </div>
      </div>
      <div className="ef-header-actions">
        <ModeToggle uiMode={uiMode} modeReady={modeReady} onToggle={onToggleMode} />
        <button type="button" className="ef-icon-button" aria-label="打开使用帮助与设置" title="使用帮助与设置" onClick={onOpenSettings}><Icon name="settings" /></button>
      </div>
    </header>
  );
}
