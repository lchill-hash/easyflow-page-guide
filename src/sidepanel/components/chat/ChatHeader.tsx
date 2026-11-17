import type { UiMode } from "../../../shared/uiMode";
import { ModeToggle } from "./ModeToggle";

interface ChatHeaderProps {
  uiMode: UiMode;
  modeReady: boolean;
  onToggleMode: () => void;
  modelEnabled: boolean;
  modelReady: boolean;
  onToggleModel: () => void;
}

export function ChatHeader({ uiMode, modeReady, onToggleMode, modelEnabled, modelReady, onToggleModel }: ChatHeaderProps) {
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
      <div className="ef-header-modes">
        <button type="button" className="ef-model-toggle" role="switch" aria-checked={modelEnabled}
          onClick={onToggleModel} title="开启后，脱敏页面摘要会经本机代理发送给 DeepSeek">
          {modelEnabled ? (modelReady ? "在线智能已开启" : "在线智能待连接") : "本地规则"}
        </button>
        <ModeToggle uiMode={uiMode} modeReady={modeReady} onToggle={onToggleMode} />
      </div>
    </header>
  );
}
