import type { EfError } from "../../shared/errors";

interface StatusBannerProps {
  error: EfError | null;
  notice: string | null;
  onDismiss: () => void;
}

export function StatusBanner({ error, notice, onDismiss }: StatusBannerProps) {
  if (error === null && notice === null) {
    return null;
  }

  const isError = error !== null;
  return (
    <section
      className={`ef-banner ${isError ? "ef-banner-error" : "ef-banner-info"}`}
      role={isError ? "alert" : "status"}
    >
      <div className="ef-banner-body">
        <div className="ef-banner-main">{error !== null ? error.message : notice}</div>
        {error !== null ? (
          <div className="ef-banner-action">
            {error.action}
            <code>{error.code}</code>
          </div>
        ) : null}
        {error !== null && error.detail !== undefined && error.detail.length > 0 ? (
          <div className="ef-banner-detail">诊断：{error.detail}</div>
        ) : null}
      </div>
      <button
        type="button"
        className="ef-banner-close"
        aria-label="关闭提示"
        onClick={onDismiss}
      >
        ×
      </button>
    </section>
  );
}