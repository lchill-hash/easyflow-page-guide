import type { CitationAnchor } from "../../../shared/types";
import { Icon } from "./Icon";

interface CitationListProps {
  citations: CitationAnchor[];
  onLocate: (citation: CitationAnchor) => void;
}

export function CitationList({ citations, onLocate }: CitationListProps) {
  return (
    <>
      {citations.map((citation) => (
        <div className="ef-citation" key={citation.citationId}>
          <blockquote className="ef-citation-text">{citation.text}</blockquote>
          {citation.status === "stale" ? (
            <span className="ef-citation-stale">已失效</span>
          ) : (
            <button
              type="button"
              className="ef-inline-link"
              onClick={() => {
                onLocate(citation);
              }}
            >
              <Icon name="target" />
              在网页中查看
            </button>
          )}
        </div>
      ))}
    </>
  );
}

interface EvidencePanelProps {
  citations: CitationAnchor[];
  onLocate: (citation: CitationAnchor) => void;
}

export function EvidencePanel({ citations, onLocate }: EvidencePanelProps) {
  if (citations.length === 0) {
    return null;
  }
  return (
    <details className="ef-evidence">
      <summary><span className="ef-evidence-title"><Icon name="book" />网页依据 <span className="ef-evidence-count">{citations.every((citation) => citation.status === "stale") ? "已失效" : `· ${citations.length} 处`}</span></span><Icon name="chevron" /></summary>
      <div className="ef-evidence-list">
        <CitationList citations={citations} onLocate={onLocate} />
      </div>
    </details>
  );
}
