import { useId } from "react";
import type {
  CitationAnchor,
  CompletionCondition,
  ElementRef,
  TargetControl,
} from "../../../shared/types";
import type { SpeechUi } from "../../hooks/useSpeechSynthesis";
import { StepCardSpeech } from "./StepCardSpeech";
import { StepDetails } from "./StepDetails";
import {
  resolveStepCardMode,
  stepCardActions,
  stepCardLabel,
  stepCardLayout,
  stepCardStateTag,
} from "./stepCardModel";
import type { StepCardCopy } from "./stepCardCopy";

interface StepCardProps {
  targetControl: TargetControl;
  completionCondition: CompletionCondition;
  copy: StepCardCopy | null;
  citations: CitationAnchor[];
  expired?: boolean;
  ended?: boolean;
  speech?: SpeechUi;
  stepKey?: string;
  onLocate: (ref: ElementRef) => void;
  onCitation: (citation: CitationAnchor) => void;
  onNotFound: () => void;
  onMisclicked: () => void;
  onDone: () => void;
  onSwitchTask: () => void;
}

export function StepCard({
  targetControl,
  completionCondition,
  copy,
  citations,
  expired = false,
  ended = false,
  speech,
  stepKey,
  onLocate,
  onCitation,
  onNotFound,
  onMisclicked,
  onDone,
  onSwitchTask,
}: StepCardProps) {
  const shortId = useId();
  const mode = resolveStepCardMode({ ended, expired });
  const layout = stepCardLayout(mode);
  const actions = stepCardActions(mode);

  if (mode !== "current") {
    const hint =
      mode === "ended"
        ? "这一步已结束，以网页显示为准。"
        : "页面已经变化，这一步已过期，请按上方最新指引操作。";
    return (
      <div className={`ef-step-card ef-step-card-${mode}`} data-step-mode={mode}>
        <div className="ef-step-label">{stepCardLabel(mode)}</div>
        <p className="ef-step-history-hint">{hint}</p>
      </div>
    );
  }

  if (copy === null) {
    return null;
  }

  const secondary: Record<
    Exclude<(typeof actions)[number], "locate" | "switch-task">,
    { label: string; onClick: () => void }
  > = {
    "not-found": { label: "我找不到", onClick: onNotFound },
    misclicked: { label: "我点错了", onClick: onMisclicked },
    done: { label: "我已完成", onClick: onDone },
  };

  return (
    <section
      className="ef-step-card ef-step-card-current"
      data-step-mode="current"
      aria-labelledby={shortId}
    >
      <div className="ef-step-label">
        <span className="ef-step-state ef-step-state-tag">
          {stepCardStateTag("current")}
        </span>
      </div>
      <p id={shortId} className="ef-step-goal">
        {copy.shortText}
      </p>
      {/* 当前卡内唯一详情入口：ef-step-details（由 StepDetails 渲染） */}
      <div className="ef-step-actions-line">
        <button
          type="button"
          className="ef-step-primary"
          onClick={() => {
            onLocate(copy.targetRef);
          }}
        >
          指给我看
        </button>
        {speech !== undefined ? (
          <StepCardSpeech
            speech={speech}
            stepKey={stepKey ?? `step:${copy.shortText}`}
            text={copy.shortText}
          />
        ) : null}
      </div>
      {layout.showDetails ? (
        <StepDetails
          copy={copy}
          completionCondition={completionCondition}
          citations={citations}
          onCitation={onCitation}
        />
      ) : null}
      <details className="ef-step-more">
        <summary>遇到问题 / 更多操作</summary>
        <div className="ef-step-more-actions">
          {layout.secondary.map((action) => {
            if (action === "switch-task") {
              return (
                <button
                  type="button"
                  className="ef-step-action"
                  key={action}
                  onClick={onSwitchTask}
                >
                  换一个任务
                </button>
              );
            }
            if (action === "locate") {
              return null;
            }
            const item = secondary[action];
            return (
              <button
                type="button"
                className="ef-step-action"
                key={action}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </details>
    </section>
  );
}