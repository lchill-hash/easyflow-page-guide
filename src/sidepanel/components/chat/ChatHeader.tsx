import type { UiMode } from "../../../shared/uiMode";
import { BRAND_NAME, BRAND_TAGLINE } from "../../../shared/brand";
import { BrandMark } from "./BrandMark";
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
          <BrandMark />
        </span>
        <div>
          <h1 className="ef-title">{BRAND_NAME}</h1>
          <p className="ef-subtitle">{BRAND_TAGLINE}</p>
        </div>
      </div>
      <div className="ef-header-actions">
        <ModeToggle uiMode={uiMode} modeReady={modeReady} onToggle={onToggleMode} />
        <button type="button" className="ef-icon-button" aria-label="打开使用帮助与设置" title="使用帮助与设置" onClick={onOpenSettings}><Icon name="settings" /></button>
      </div>
    </header>
  );
}
