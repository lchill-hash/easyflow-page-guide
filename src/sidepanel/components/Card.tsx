import type { GuidanceCard } from "../../shared/types";

interface CardProps {
  card: GuidanceCard;
  locating: boolean;
  onView: () => void;
}

export function Card({ card, locating, onView }: CardProps) {
  return (
    <article className="ef-card">
      <header className="ef-card-head">
        <span className="ef-rank">依据 {card.rank}</span>
        <span className="ef-score">相关度 {card.score.toFixed(2)}</span>
      </header>
      <p className="ef-summary">{card.summary}</p>
      <blockquote className="ef-excerpt">{card.excerpt}</blockquote>
      <div className="ef-card-meta">
        <code className="ef-element-id">{card.elementId}</code>
        <span className="ef-keywords">{card.matchedKeywords.join(" · ")}</span>
      </div>
      <button
        type="button"
        className="ef-btn ef-btn-link"
        onClick={onView}
        disabled={locating}
      >
        {locating ? "定位中…" : "查看原文"}
      </button>
    </article>
  );
}