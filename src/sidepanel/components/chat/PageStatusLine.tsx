import type { ConversationState } from "../../state/conversationReducer";

interface PageStatusLineProps {
  state: ConversationState;
}

export function PageStatusLine({ state }: PageStatusLineProps) {
  let text = "准备读取当前页面";
  if (state.phase === "reading") {
    text = "正在读取当前页面…";
  } else if (state.pageState === "changed") {
    text = "页面已变化，正在核对";
  } else if (state.phase === "read-blocked") {
    text = "无法读取当前页面";
  } else if (state.snapshot !== null) {
    text = `已看到 ${state.snapshot.domain} 的页面`;
  }

  return (
    <div className="ef-page-status" aria-live="polite">
      <span className={state.phase === "read-blocked" ? "ef-status-dot ef-status-dot-error" : "ef-status-dot"} />
      <span>{text}</span>
    </div>
  );
}