import { SPEAK_LABELS, SPEAK_UNAVAILABLE_TEXT } from "../../../shared/speech/copy";
import type { SpeakTextKind } from "../../../shared/speech/types";
import type { SpeechUi } from "../../hooks/useSpeechSynthesis";

interface SpeechButtonProps {
  speech: SpeechUi;
  targetKey: string;
  kind: SpeakTextKind;
  text: string;
}

function SpeechButton({ speech, targetKey, kind, text }: SpeechButtonProps) {
  if (!speech.supported) {
    return (
      <span className="ef-speak-unavailable" role="status">
        {SPEAK_UNAVAILABLE_TEXT}
      </span>
    );
  }
  const speaking = speech.isSpeaking(targetKey);
  const label = speaking
    ? SPEAK_LABELS.stop
    : kind === "step-action"
      ? SPEAK_LABELS.step
      : SPEAK_LABELS.answer;
  return (
    <>
      <button
        type="button"
        className="ef-speak-btn"
        onClick={() => {
          if (speaking) {
            speech.stop();
            return;
          }
          speech.speak({ kind, text });
        }}
      >
        {label}
      </button>
      {speech.note !== null ? (
        <span className="ef-speak-note" role="status">
          {speech.note}
        </span>
      ) : null}
    </>
  );
}

interface StepCardSpeechProps {
  speech: SpeechUi;
  stepKey: string;
  text: string;
}

export function StepCardSpeech({ speech, stepKey, text }: StepCardSpeechProps) {
  return <SpeechButton speech={speech} targetKey={stepKey} kind="step-action" text={text} />;
}

interface AnswerSpeechButtonProps {
  speech: SpeechUi;
  answerKey: string;
  text: string;
}

export function AnswerSpeechButton({ speech, answerKey, text }: AnswerSpeechButtonProps) {
  return <SpeechButton speech={speech} targetKey={answerKey} kind="direct-answer" text={text} />;
}