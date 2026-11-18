import type { ConversationState } from "../../state/conversationReducer";
import { Icon } from "./Icon";

interface PageStatusLineProps {
  state: ConversationState;
  simpleMode: boolean;
  simpleHint: string | null;
  onToggleSimple: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export function PageStatusLine({ state, simpleMode, simpleHint, onToggleSimple, onRefresh, onOpenSettings }: PageStatusLineProps) {
  const blocked = state.phase === "read-blocked";
  const needsAccess = blocked && state.readErrorCode === "EF-E003";
  const restricted = blocked && state.readErrorCode === "EF-E002";
  let text = "准备读取当前页面";
  if (state.phase === "reading") {
    text = "正在读取当前页面…";
  } else if (state.pageState === "changed") {
    text = "页面已变化，正在核对";
  } else if (needsAccess) {
    text = "新页面需要授权";
  } else if (restricted) {
    text = "此页面受浏览器保护，无法读取";
  } else if (blocked) {
    text = state.readErrorText || "无法读取当前页面，请重试";
  } else if (state.snapshot !== null) {
    text = `已看到 ${state.snapshot.domain} 的页面`;
  }

  return (
    <div className={`ef-page-status${blocked ? " ef-page-status-error" : ""}`}>
      <span className={blocked ? "ef-status-dot ef-status-dot-error" : "ef-status-dot"} aria-hidden="true" />
      <div className="ef-page-status-copy">
        <span className="ef-page-status-text" role="status">{text}</span>
        {needsAccess ? <><button type="button" className="ef-page-access-action" onClick={onOpenSettings}>开启切页自动读取</button><p className="ef-page-status-note">也可点击浏览器工具栏中的EasyFlow图标，只读取这一页。</p></> : null}
        {restricted ? <p className="ef-page-status-note">浏览器内部页、扩展商店等不支持读取，请切换到普通网页。</p> : null}
        {simpleHint !== null ? <p className="ef-page-status-note">{simpleHint}</p> : null}
      </div>
      <button type="button" className="ef-simple-toggle" aria-pressed={simpleMode} onClick={onToggleSimple}>
        {simpleMode ? "原始网页" : "简洁导览"}
      </button>
      <button type="button" className="ef-icon-button" aria-label="重新读取当前页面" title="重新读取当前页面" disabled={state.busy} onClick={onRefresh}><Icon name="refresh" /></button>
    </div>
  );
}
