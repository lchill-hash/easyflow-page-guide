import type { CitationAnchor, CompletionCondition } from "../../../shared/types";
import { CitationList } from "./EvidencePanel";
import { completionTextOf } from "./stepCardCopy";
import type { StepCardCopy } from "./stepCardCopy";

interface StepDetailsProps {
  copy: StepCardCopy;
  completionCondition: CompletionCondition;
  citations: CitationAnchor[];
  onCitation: (citation: CitationAnchor) => void;
}

export function StepDetails({
  copy,
  completionCondition,
  citations,
  onCitation,
}: StepDetailsProps) {
  const completionText =
    copy.completionText.length > 0 ? copy.completionText : completionTextOf(completionCondition);
  return (
    <details className="ef-step-details">
      <summary>展开说明与依据</summary>
      <div className="ef-step-raw">{copy.rawLabel}</div>
      {copy.labelTruncated ? (
        <div className="ef-step-raw-truncated">原文已截断</div>
      ) : null}
      <div className="ef-step-condition">完成条件：{completionText}</div>
      {citations.length > 0 ? (
        <div className="ef-step-citations">
          <CitationList citations={citations} onLocate={onCitation} />
        </div>
      ) : null}
    </details>
  );
}
