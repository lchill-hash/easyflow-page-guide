import { useEffect, useRef, type ReactNode } from "react";
import type { UiMode } from "../../../shared/uiMode";
import type { PageAccessState } from "../../hooks/usePageAccess";
import { Icon } from "./Icon";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  uiMode: UiMode;
  modeReady: boolean;
  onToggleMode: () => void;
  modelEnabled: boolean;
  modelReady: boolean;
  onToggleModel: () => void;
  pageAccess: PageAccessState;
  children: ReactNode;
}

export function SettingsDialog({ open, onClose, uiMode, modeReady, onToggleMode, modelEnabled, modelReady, onToggleModel, pageAccess, children }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className="ef-settings-dialog" aria-labelledby="ef-settings-title" onClose={onClose}>
      <div className="ef-dialog-header">
        <h2 id="ef-settings-title">使用帮助与设置</h2>
        <button type="button" className="ef-icon-button" aria-label="关闭设置" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="ef-settings-body">
        <div className="ef-setting-row">
          <div className="ef-setting-copy"><strong id="ef-page-access-label">切页后继续协助</strong><p id="ef-page-access-purpose">开启后，侧栏打开时，EasyFlow可在你切换到普通网站时继续读取当前页。只读取可见内容，不会替你操作；可随时关闭。</p></div>
          <button type="button" className="ef-setting-switch" role="switch" aria-checked={pageAccess.enabled} aria-labelledby="ef-page-access-label" aria-describedby="ef-page-access-purpose" disabled={!pageAccess.ready || pageAccess.busy} onClick={pageAccess.toggle}>{pageAccess.busy ? "处理中…" : !pageAccess.ready ? pageAccess.error === null ? "检查中…" : "暂不可用" : pageAccess.enabled ? "已开启" : "已关闭"}</button>
        </div>
        <p className={`ef-settings-status${pageAccess.error !== null ? " ef-settings-status-error" : ""}`} role="status">{pageAccess.error ?? (pageAccess.enabled ? "已允许切页后继续协助。浏览器内部页、扩展商店等仍不能读取。" : "关闭时，点击浏览器工具栏中的EasyFlow图标，只授权并读取你主动打开的这一页。")}</p>
        <div className="ef-setting-row">
          <div className="ef-setting-copy"><strong id="ef-large-label">简明大字模式</strong><p>放大文字和操作按钮；常用帮助入口始终保留在侧栏上方。</p></div>
          <button type="button" className="ef-setting-switch" role="switch" aria-checked={uiMode === "care"} aria-labelledby="ef-large-label" disabled={!modeReady} onClick={onToggleMode}>{uiMode === "care" ? "已开启" : "已关闭"}</button>
        </div>
        <div className="ef-setting-row">
          <div className="ef-setting-copy"><strong id="ef-online-label">在线智能</strong><p>开启后，将脱敏页面摘要发送给模型服务。</p></div>
          <button type="button" className="ef-setting-switch" role="switch" aria-checked={modelEnabled} aria-labelledby="ef-online-label" onClick={onToggleModel}>{modelEnabled ? "已开启" : "已关闭"}</button>
        </div>
        <p className="ef-settings-status" role="status">{modelEnabled ? modelReady ? "在线服务已连接，回答会结合当前页面。" : "在线服务暂未连接，当前回退到本地规则。" : "当前使用本地规则，在线智能未开启。"}</p>
        <section className="ef-settings-help" aria-labelledby="ef-help-title">
          <h3 id="ef-help-title">从当前页面开始</h3>
          <p>点“我没看懂”可以用简单的话重新解释；点“指给我看”会滚动并高亮网页依据。高亮会保留到你关闭或目标变化。</p>
          <p>默认只读取你主动授权的这一页。若想切页后继续协助，请单独开启上方权限。填写、勾选与最终提交仍由你本人操作；求助内容只提供预览和复制，不会自动发送。</p>
        </section>
        {children}
      </div>
    </dialog>
  );
}
