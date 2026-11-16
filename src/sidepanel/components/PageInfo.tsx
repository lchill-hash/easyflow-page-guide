import type { PageSnapshot } from "../../shared/types";

interface PageInfoProps {
  snapshot: PageSnapshot | null;
  loading: boolean;
}

export function PageInfo({ snapshot, loading }: PageInfoProps) {
  return (
    <section className="ef-panel ef-page-info" aria-live="polite">
      <div className="ef-page-domain">
        {snapshot !== null ? snapshot.domain : loading ? "正在读取当前页面…" : "尚未读取页面"}
      </div>
      <div className="ef-page-title">
        {snapshot !== null ? snapshot.title : loading ? "正在加载页面信息" : "—"}
      </div>
      <div className="ef-page-hints">
        {snapshot !== null && snapshot.titleMissing ? (
          <span className="ef-hint">页面无标题，已使用域名占位</span>
        ) : null}
        {snapshot !== null ? (
          <span className="ef-hint">
            {snapshot.itemCount} 个可见条目{snapshot.truncated ? "（已截断）" : ""}
          </span>
        ) : null}
        {snapshot !== null ? <span className="ef-hint">只读采集</span> : null}
      </div>
    </section>
  );
}