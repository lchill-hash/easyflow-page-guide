import type { UiMode } from "../../../shared/uiMode";
import { ModeToggle } from "./ModeToggle";

interface ChatHeaderProps {
  uiMode: UiMode;
  modeReady: boolean;
  onToggleMode: () => void;
}

export function ChatHeader({ uiMode, modeReady, onToggleMode }: ChatHeaderProps) {
  return (
    <header className="ef-header ef-chat-header">
      <div className="ef-brand">
        <span className="ef-logo" aria-hidden="true">
          EF
        </span>
        <div>
          <h1 className="ef-title">EasyFlow</h1>
          <p className="ef-subtitle">陪你办事</p>
        </div>
      </div>
      <ModeToggle uiMode={uiMode} modeReady={modeReady} onToggle={onToggleMode} />
    </header>
  );
}