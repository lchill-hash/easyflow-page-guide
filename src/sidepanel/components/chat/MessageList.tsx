import { useEffect, useRef } from "react";
import type {
  AssistantMessage,
  CitationAnchor,
  DialogueMessage,
  ElementRef,
  GuideStep,
  PageSnapshot,
} from "../../../shared/types";
import type { SpeechUi } from "../../hooks/useSpeechSynthesis";
import { EvidencePanel } from "./EvidencePanel";
import { StepCard } from "./StepCard";
import { AnswerSpeechButton } from "./StepCardSpeech";
import { stripDuplicateStepText } from "./messageText";
import { buildStepCardCopy } from "./stepCardCopy";

interface MessageListProps {
  messages: DialogueMessage[];
  currentCardMessageId: string | null;
  planActive: boolean;
  bookingCompleted: boolean;
  activeStep: GuideStep | null;
  snapshot: PageSnapshot | null;
  speech: SpeechUi;
  answerKeyOf: (messageId: string) => string;
  onCitation: (citation: CitationAnchor) => void;
  onLocateControl: (ref: ElementRef) => void;
  onSend: (text: string) => void;
  onRetry: () => void;
  onNotFound: () => void;
  onMisclicked: () => void;
  onDone: () => void;
  onSwitchTask: () => void;
}

function AssistantBubble({
  message,
  currentCardMessageId,
  planActive,
  bookingCompleted,
  activeStep,
  snapshot,
  speech,
  answerKeyOf,
  onCitation,
  onLocateControl,
  onSend,
  onRetry,
  onNotFound,
  onMisclicked,
  onDone,
  onSwitchTask,
}: {
  message: AssistantMessage;
  currentCardMessageId: string | null;
  planActive: boolean;
  bookingCompleted: boolean;
  activeStep: GuideStep | null;
  snapshot: PageSnapshot | null;
  speech: SpeechUi;
  answerKeyOf: (messageId: string) => string;
  onCitation: (citation: CitationAnchor) => void;
  onLocateControl: (ref: ElementRef) => void;
  onSend: (text: string) => void;
  onRetry: () => void;
  onNotFound: () => void;
  onMisclicked: () => void;
  onDone: () => void;
  onSwitchTask: () => void;
}) {
  const cardActive = planActive && message.messageId === currentCardMessageId;
  const copy =
    cardActive && activeStep !== null
      ? buildStepCardCopy({
          targetControl: activeStep.targetControl,
          snapshot,
          completionCondition: activeStep.completion,
        })
      : null;
  const dedupe = stripDuplicateStepText({
    text: message.text,
    stepGoal: activeStep?.goal ?? "",
    shortText: copy?.shortText ?? "",
    responseType: message.responseType,
    cardActive,
  });
  const bubbleClass = dedupe.hidden
    ? "ef-bubble ef-bubble-assistant ef-bubble-card-only"
    : "ef-bubble ef-bubble-assistant";
  return (
    <div className="ef-message ef-message-assistant">
      <div className="ef-message-role">EasyFlow</div>
      <div className={bubbleClass}>
        {dedupe.hidden ? null : <div className="ef-assistant-text">{dedupe.text}</div>}
        {message.limitation !== undefined ? (
          <div className="ef-advice">{message.limitation.advice}</div>
        ) : null}
        {message.canRetry === true ? (
          <button type="button" className="ef-inline-link" onClick={onRetry}>
            重试
          </button>
        ) : null}
        {message.clarify?.options !== undefined && message.clarify.options.length > 0 ? (
          <div className="ef-quick-options">
            {message.clarify.options.map((option) => (
              <button
                type="button"
                className="ef-quick-option"
                key={option}
                onClick={() => {
                  onSend(option);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
        {message.responseType === "direct-answer" &&
        speech.supported &&
        message.text.trim().length > 0 ? (
          <AnswerSpeechButton
            speech={speech}
            answerKey={answerKeyOf(message.messageId)}
            text={message.text}
          />
        ) : null}
        {message.citations.length > 0 ? (
          <EvidencePanel citations={message.citations} onLocate={onCitation} />
        ) : null}
        {message.targetControl !== undefined && message.completionCondition !== undefined ? (
          <StepCard
            targetControl={activeStep?.targetControl ?? message.targetControl}
            completionCondition={activeStep?.completion ?? message.completionCondition}
            copy={copy}
            citations={message.citations}
            expired={!cardActive}
            ended={bookingCompleted}
            speech={speech}
            {...(copy === null
              ? {}
              : { stepKey: `step:${message.messageId}:${copy.shortText}` })}
            onLocate={onLocateControl}
            onCitation={onCitation}
            onNotFound={onNotFound}
            onMisclicked={onMisclicked}
            onDone={onDone}
            onSwitchTask={onSwitchTask}
          />
        ) : null}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  currentCardMessageId,
  planActive,
  bookingCompleted,
  activeStep,
  snapshot,
  speech,
  answerKeyOf,
  onCitation,
  onLocateControl,
  onSend,
  onRetry,
  onNotFound,
  onMisclicked,
  onDone,
  onSwitchTask,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const currentCardRef = useRef<HTMLDivElement>(null);
  const lastScrolledCardId = useRef<string | null>(null);

  useEffect(() => {
    if (currentCardMessageId !== null) {
      if (lastScrolledCardId.current === currentCardMessageId) {
        return;
      }
      lastScrolledCardId.current = currentCardMessageId;
      currentCardRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [currentCardMessageId, messages.length]);

  return (
    <div className="ef-message-list" aria-live="polite">
      {messages.length === 0 ? (
        <div className="ef-welcome">
          你好，我可以回答这个页面上的问题，也可以一步一步陪你办。
        </div>
      ) : null}
      {messages.map((message) => {
        if (message.role === "system") {
          return (
            <div className="ef-system-notice" key={message.messageId}>
              {message.text}
            </div>
          );
        }
        if (message.role === "user") {
          return (
            <div className="ef-message ef-message-user" key={message.messageId}>
              <div className="ef-bubble ef-bubble-user">{message.text}</div>
            </div>
          );
        }
        const isCurrent = message.messageId === currentCardMessageId;
        return (
          <div key={message.messageId} ref={isCurrent ? currentCardRef : undefined}>
            <AssistantBubble
              message={message}
              currentCardMessageId={currentCardMessageId}
              planActive={planActive}
              bookingCompleted={bookingCompleted}
              activeStep={activeStep}
              snapshot={snapshot}
              speech={speech}
              answerKeyOf={answerKeyOf}
              onCitation={onCitation}
              onLocateControl={onLocateControl}
              onSend={onSend}
              onRetry={onRetry}
              onNotFound={onNotFound}
              onMisclicked={onMisclicked}
              onDone={onDone}
              onSwitchTask={onSwitchTask}
            />
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}