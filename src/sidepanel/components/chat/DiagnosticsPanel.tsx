import { useState } from "react";
import { SPEECH_DIAGNOSTICS_TEXTS } from "../../../shared/speech/copy";
import type { SpeechDiagnosticsView } from "../../../shared/speech/diagnostics";
import type {
  BookingCheck,
  BookingSuccessReason,
  CollectDiagnostics,
  ConversationDiagnostics,
  HighlightStats,
} from "../../../shared/types";

interface DiagnosticsPanelProps {
  entries: ConversationDiagnostics[];
  collectDiagnostics: CollectDiagnostics | null;
  lastBookingCheck: BookingCheck | null;
  bookingCompleted: boolean;
  speakUnavailableKind: string | null;
  speechDiagnostics: SpeechDiagnosticsView;
  highlightStats: HighlightStats | null;
  highlightRequestCount: number;
  onRecheckLocal: () => void;
  onExpand: () => void;
  onRefresh: () => void;
}

function boolText(value: boolean | undefined): string {
  return value === true ? "是" : "否";
}

function shortDate(label: string | undefined): string {
  if (label === undefined) {
    return "未确认";
  }
  const match = label.match(/(\d{1,2})[,日]/);
  return match?.[1] !== undefined ? `${match[1]} 日` : label;
}

function reasonText(reason: BookingSuccessReason | null): string {
  switch (reason) {
    case "read-failed":
      return "读取失败";
    case "path-mismatch":
      return "路径不符";
    case "title-mismatch":
      return "标题不符";
    case "title-not-visible":
      return "标题不可见";
    default:
      return "未知";
  }
}

function bookingCheckText(check: BookingCheck | null): string {
  if (check === null) {
    return "成功判定 暂无";
  }
  if (check.result === "passed") {
    return "成功判定 通过";
  }
  return `成功判定 未通过（${reasonText(check.reason)}）`;
}

function msText(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)} ms`;
}

export function DiagnosticsPanel({
  entries,
  collectDiagnostics,
  lastBookingCheck,
  bookingCompleted,
  speakUnavailableKind,
  speechDiagnostics,
  highlightStats,
  highlightRequestCount,
  onRecheckLocal,
  onExpand,
  onRefresh,
}: DiagnosticsPanelProps) {
  const [open, setOpen] = useState(false);
  const timeCandidates = collectDiagnostics?.timeCandidates ?? [];
  const dateCandidates = collectDiagnostics?.dateCandidates ?? [];

  return (
    <details
      className="ef-diagnostics"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        if (next) {
          onExpand();
        }
      }}
    >
      <summary>运行诊断</summary>
      {open ? (
        <>
          <section className="ef-speech-diag" aria-labelledby="ef-speech-diag-title">
            <div id="ef-speech-diag-title" className="ef-diag-section-title">
              {SPEECH_DIAGNOSTICS_TEXTS.title}
            </div>
            <div className="ef-speech-diag-grid">
              <span>
                {SPEECH_DIAGNOSTICS_TEXTS.permissionLabel}：{speechDiagnostics.permissionText}（
                {speechDiagnostics.permissionCheckedAgo}）
              </span>
              <span>
                {SPEECH_DIAGNOSTICS_TEXTS.lastErrorLabel}：{speechDiagnostics.lastErrorText}（
                {speechDiagnostics.lastErrorAgo}）
              </span>
              <span>
                {SPEECH_DIAGNOSTICS_TEXTS.rawErrorCodeLabel}：
                {speechDiagnostics.rawErrorCodeText}
              </span>
              <span>
                {SPEECH_DIAGNOSTICS_TEXTS.listeningLabel}：{speechDiagnostics.listeningText}
              </span>
              <span>
                {SPEECH_DIAGNOSTICS_TEXTS.onstartLabel}：{speechDiagnostics.onstartText}
              </span>
              <span>
                {SPEECH_DIAGNOSTICS_TEXTS.localApiLabel}：{speechDiagnostics.localApiText}
              </span>
              <span>
                {SPEECH_DIAGNOSTICS_TEXTS.localStateLabel}：
                {speechDiagnostics.localAvailabilityText}
              </span>
              <span>
                {SPEECH_DIAGNOSTICS_TEXTS.localCheckedLabel}：
                {speechDiagnostics.localCheckedAgo}
              </span>
              <span>
                {SPEECH_DIAGNOSTICS_TEXTS.installStateLabel}：{speechDiagnostics.installStateText}
              </span>
              <span>
                {SPEECH_DIAGNOSTICS_TEXTS.installOutcomeLabel}：
                {speechDiagnostics.installOutcomeText}
              </span>
              <span>
                {SPEECH_DIAGNOSTICS_TEXTS.modeLabel}：{speechDiagnostics.modeText}
              </span>
            </div>
            <button
              type="button"
              className="ef-inline-link"
              aria-label={SPEECH_DIAGNOSTICS_TEXTS.recheck}
              onClick={onRecheckLocal}
            >
              {SPEECH_DIAGNOSTICS_TEXTS.recheck}
            </button>
          </section>

          <details className="ef-highlight-diag">
            <summary>高亮</summary>
            {highlightStats === null ? (
              <p className="ef-muted">暂无高亮记录</p>
            ) : (
              <div className="ef-speech-diag-grid">
                <span>请求次数：{highlightRequestCount}</span>
                <span>轮次：{highlightStats.roundStartCount}</span>
                <span>
                  脉冲启动/完成：{highlightStats.pulseStartCount}/{highlightStats.pulseCompletedCount}
                </span>
                <span>
                  宿主创建/当前/峰值/未标识：{highlightStats.overlayCreateCount}/
                  {highlightStats.overlayLiveCount}/{highlightStats.overlayLiveMax}/
                  {highlightStats.legacyHostCount}
                </span>
                <span>
                  清理计划/执行/替换/空操作：{highlightStats.cleanupScheduledCount}/
                  {highlightStats.cleanupFiredCount}/{highlightStats.cleanupReplacedCount}/
                  {highlightStats.cleanupNoopCount}
                </span>
                <span>
                  最近清理：{highlightStats.cleanupReason ?? "无"}（
                  {msText(highlightStats.lastCleanupAt)}，存活{" "}
                  {msText(highlightStats.highlightLifetimeMs)}）
                </span>
                <span>
                  位置更新/DOM tick：{highlightStats.positionUpdateCount}/
                  {highlightStats.domTickCount}
                </span>
                <span>
                  框创建/移除/当前：{highlightStats.boxCreateCount}/
                  {highlightStats.boxRemoveCount}/{highlightStats.boxCount}
                </span>
                <span>
                  页面/期望版本：{highlightStats.contentVersionSeen || "未知"} /{" "}
                  {highlightStats.expectedContentVersion || "未知"}
                </span>
                <span>页面注入次数：{highlightStats.pageInjectionCount}</span>
              </div>
            )}
          </details>

          {collectDiagnostics !== null ? (
            <section aria-labelledby="ef-page-diag-title">
              <div
                style={{
                  maxHeight: "var(--ef-diag-max-h)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div id="ef-page-diag-title" className="ef-page-diag-title">
                  {SPEECH_DIAGNOSTICS_TEXTS.pageTitle}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginTop: "4px",
                  }}
                >
                  <button
                    type="button"
                    className="ef-inline-link"
                    onClick={onRefresh}
                    disabled={bookingCompleted}
                  >
                    重新读取页面
                  </button>
                  {bookingCompleted ? <span className="ef-muted">已完成</span> : null}
                  <span>
                    已选日期：{shortDate(collectDiagnostics.selectedDateLabel)} · 时间候选：
                    {timeCandidates.length}
                  </span>
                  <span>
                    快照{" "}
                    {collectDiagnostics.capturedAt === undefined
                      ? "未知"
                      : new Date(collectDiagnostics.capturedAt).toLocaleTimeString("zh-CN")}
                  </span>
                </div>
                <div
                  tabIndex={0}
                  aria-label="页面采集诊断详情，可滚动"
                  style={{
                    overflowY: "auto",
                    minHeight: 0,
                    paddingRight: "4px",
                    marginTop: "4px",
                  }}
                >
                  <div className="ef-page-diag-grid">
                    <span>已选时间 {collectDiagnostics.selectedTimeLabel ?? "无"}</span>
                    <span>可用日期 {collectDiagnostics.availableDateCount ?? "—"}</span>
                    <span>button 候选 {collectDiagnostics.buttonCandidates ?? "—"}</span>
                    <span>button 采集 {collectDiagnostics.buttonCollected ?? "—"}</span>
                    <span>日期控件 {collectDiagnostics.dateControlCount ?? "—"}</span>
                    <span>时间控件 {collectDiagnostics.timeControlCount ?? "—"}</span>
                    <span>空文字按钮 {collectDiagnostics.filteredEmptyButtons ?? "—"}</span>
                    <span>隐藏按钮 {collectDiagnostics.filteredHiddenButtons ?? "—"}</span>
                    <span>禁用按钮 {collectDiagnostics.filteredDisabledButtons ?? "—"}</span>
                    <span>iframe {collectDiagnostics.iframeCount ?? "—"}</span>
                    <span>开放 shadow root {collectDiagnostics.openShadowRoots ?? "—"}</span>
                    <span>预算截断 {boolText(collectDiagnostics.controlsTruncated)}</span>
                  </div>
                  <p className="ef-muted">{bookingCheckText(lastBookingCheck)}</p>
                  {(collectDiagnostics.iframeCount ?? 0) > 0 ||
                  (collectDiagnostics.openShadowRoots ?? 0) > 0 ? (
                    <p className="ef-muted">
                      页面存在 iframe 或开放 shadow root；若日期/时间位于其中，当前只读采集可能无法覆盖。
                    </p>
                  ) : null}

                  <div className="ef-page-diag-title">时间候选（最多 12 个，优先显示）</div>
                  {timeCandidates.length === 0 ? (
                    <p className="ef-muted">
                      未发现时间候选。若左侧已滚到时段区域，请点“重新读取页面”后再截图。
                    </p>
                  ) : (
                    <div className="ef-date-candidates">
                      {timeCandidates.map((candidate, index) => (
                        <div className="ef-date-candidate" key={`time-${candidate.label}-${index}`}>
                          <div className="ef-date-candidate-label">{candidate.label}</div>
                          <div>
                            &lt;{candidate.tagName}&gt; role={candidate.role} · 可见{" "}
                            {boolText(candidate.visible)}
                          </div>
                          <div>
                            上下文 {candidate.context}（{candidate.contextReason}） · 语义{" "}
                            {candidate.semantic}
                          </div>
                          <div>
                            禁用 {boolText(candidate.disabled)} · 选中 {boolText(candidate.selected)} · 今天{" "}
                            {boolText(candidate.isToday)}
                            {candidate.filterReason !== undefined
                              ? ` · 过滤 ${candidate.filterReason}`
                              : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="ef-page-diag-title">日期候选（最多 8 个）</div>
                  {dateCandidates.length === 0 ? (
                    <p className="ef-muted">未发现日期候选。若左侧日历可见，请截图反馈。</p>
                  ) : (
                    <div className="ef-date-candidates">
                      {dateCandidates.map((candidate, index) => (
                        <div className="ef-date-candidate" key={`date-${candidate.label}-${index}`}>
                          <div className="ef-date-candidate-label">{candidate.label}</div>
                          <div>
                            &lt;{candidate.tagName}&gt; role={candidate.role} · 可见{" "}
                            {boolText(candidate.visible)}
                          </div>
                          <div>
                            上下文 {candidate.context}（{candidate.contextReason}） · 语义{" "}
                            {candidate.semantic}
                          </div>
                          <div>
                            禁用 {boolText(candidate.disabled)} · 选中 {boolText(candidate.selected)} · 今天{" "}
                            {boolText(candidate.isToday)}
                            {candidate.filterReason !== undefined
                              ? ` · 过滤 ${candidate.filterReason}`
                              : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <section aria-labelledby="ef-speak-diag-title">
            <div id="ef-speak-diag-title" className="ef-diag-section-title">
              {SPEECH_DIAGNOSTICS_TEXTS.speakTitle}
            </div>
            <p className="ef-muted">
              {SPEECH_DIAGNOSTICS_TEXTS.speakUnavailableLabel}：
              {speakUnavailableKind ?? SPEECH_DIAGNOSTICS_TEXTS.noValue}
            </p>
          </section>

          {entries.length === 0 ? (
            <p className="ef-muted">暂无运行记录</p>
          ) : (
            <div className="ef-diag-list">
              {entries.map((entry) => (
                <div className="ef-diag-item" key={`${entry.turnId}-${entry.engineMs}`}>
                  <div>运行 {entry.turnId}</div>
                  <div>
                    模式 {entry.mode} · 读取 {entry.readMs} ms · 引擎 {entry.engineMs} ms
                  </div>
                  <div>
                    条目 {entry.itemCount} · 语义段 {entry.segmentCount} · 控件{" "}
                    {entry.controlCount} · 引用 {entry.citationCount}
                  </div>
                  <div className={entry.validation === "rejected" ? "ef-diag-error" : ""}>
                    校验 {entry.validation}
                    {entry.rejectReason !== undefined ? ` · ${entry.rejectReason}` : ""}
                  </div>
                  <div>
                    出站 {entry.outboundBytes} 字节 · 敏感检测{" "}
                    {entry.sensitiveDetected ? "有" : "无"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </details>
  );
}