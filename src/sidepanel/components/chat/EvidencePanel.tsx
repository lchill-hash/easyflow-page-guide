import type { CitationAnchor } from "../../../shared/types";

interface CitationListProps {
  citations: CitationAnchor[];
  onLocate: (citation: CitationAnchor) => void;
}

export function CitationList({ citations, onLocate }: CitationListProps) {
  return (
    <>
      {citations.map((citation) => (
        <div className="ef-citation" key={citation.citationId}>
          <p className="ef-citation-text">{citation.text}</p>
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
      <summary>网页依据（{citations.length} 处）</summary>
      <div className="ef-evidence-list">
        <CitationList citations={citations} onLocate={onLocate} />
      </div>
    </details>
  );
}