import type { EfError } from "../../shared/errors";
import type { CollectDiagnostics, PageSnapshot } from "../../shared/types";
import type { RunLogEntry } from "../state/initialState";

interface RunLogProps {
  entries: RunLogEntry[];
  snapshot: PageSnapshot | null;
  diagnostics: CollectDiagnostics | null;
  error: EfError | null;
}

export function RunLog({ entries, snapshot, diagnostics, error }: RunLogProps) {
  return (
    <details className="ef-runlog">
      <summary>运行诊断</summary>
      <div className="ef-runlog-body">
        {error !== null ? (
          <p className="ef-muted ef-diagnostic-detail">
            最近一次错误 {error.code}：{error.detail ?? error.message}
          </p>
        ) : null}
        {entries.length === 0 ? (
          <p className="ef-muted">暂无分析运行记录</p>
        ) : (
          <div className="ef-runlog-list">
            {entries.map((entry) => (
              <div className="ef-runlog-item" key={entry.runId}>
                <div className="ef-runlog-id">
                  <span>运行</span>
                  <code>{entry.runId}</code>
                </div>
                <div className="ef-runlog-grid">
                  <span>采集 {entry.collectMs} ms</span>
                  <span>匹配 {entry.matchMs} ms</span>
                  <span>条目 {entry.items}</span>
                  <span>卡片 {entry.matchedCards}</span>
                  <span>内容版本 {entry.contentVersion || "—"}</span>
                  <span>{entry.truncated ? "已截断" : "未截断"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {snapshot !== null ? (
          <p className="ef-muted">
            快照 {snapshot.snapshotId} · 采集于{" "}
            {new Date(snapshot.capturedAt).toLocaleTimeString("zh-CN")}
          </p>
        ) : null}
        {diagnostics !== null ? (
          <p className="ef-muted">
            候选 {diagnostics.candidateCount} · 可见 {diagnostics.visibleCount} · 隐藏{" "}
            {diagnostics.droppedHidden} · 预算丢弃 {diagnostics.droppedByBudget}
          </p>
        ) : null}
      </div>
    </details>
  );
}