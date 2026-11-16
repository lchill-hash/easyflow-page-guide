import type {
  ElementRef,
  GuidanceCard,
  PageSnapshot,
} from "../../shared/types";
import type { SessionStatus } from "../state/initialState";
import { Card } from "./Card";

interface CardListProps {
  cards: GuidanceCard[];
  snapshot: PageSnapshot | null;
  status: SessionStatus;
  locatingId: string | null;
  onHighlight: (ref: ElementRef) => void;
}

function emptyCopy(status: SessionStatus): string {
  if (status === "no-evidence") {
    return "当前页面未找到依据";
  }
  if (status === "partial") {
    return "仅找到少量相关片段";
  }
  return "输入目标后点击“分析当前页”，卡片内容将实时取自当前页面。";
}

export function CardList({
  cards,
  snapshot,
  status,
  locatingId,
  onHighlight,
}: CardListProps) {
  if (status === "idle" || status === "resolving" || status === "collecting") {
    return (
      <section className="ef-cards" aria-busy="true">
        <div className="ef-cards-head">
          <h2>相关原文依据</h2>
          <span className="ef-mode-inline">规则演示模式</span>
        </div>
        <div className="ef-skeleton" />
        <div className="ef-skeleton" />
      </section>
    );
  }

  if (cards.length === 0) {
    return (
      <section className="ef-cards ef-empty">
        <div className="ef-cards-head">
          <h2>相关原文依据</h2>
          <span className="ef-mode-inline">规则演示模式</span>
        </div>
        <p className="ef-empty-title">{emptyCopy(status)}</p>
        <p className="ef-empty-hint">可以更换关键词，或点击“重新读取页面”获取最新内容。</p>
      </section>
    );
  }

  return (
    <section className="ef-cards">
      <div className="ef-cards-head">
        <h2>相关原文依据</h2>
        <span className="ef-mode-inline">规则演示模式</span>
      </div>
      {cards.map((card) => {
        const item = snapshot?.items.find((entry) => entry.elementId === card.elementId);
        const ref: ElementRef = {
          elementId: card.elementId,
          domPath: item?.domPath ?? "",
          textHash: item?.textHash ?? "",
        };
        return (
          <Card
            key={card.cardId}
            card={card}
            locating={locatingId === card.elementId}
            onView={() => {
              onHighlight(ref);
            }}
          />
        );
      })}
    </section>
  );
}