import { useEffect, useRef, useState } from "react";
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
import { WelcomeSticker } from "./WelcomeSticker";
import { Icon } from "./Icon";

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
  const messageKind = cardActive
    ? "逐步指引"
    : message.citations.length > 0
      ? message.citations.some((citation) => citation.status === "valid") ? "依据当前页" : "历史回答"
      : "页面助手";
  return (
    <div className="ef-message ef-message-assistant">
      <div className="ef-message-role"><span className="ef-mini-brand" aria-hidden="true">e</span>EasyFlow <span>· {messageKind}</span></div>
      <div className={bubbleClass}>
        {dedupe.hidden ? null : <div className="ef-assistant-text">{dedupe.text}</div>}
        {message.limitation !== undefined ? (
          <div className="ef-advice">{message.limitation.advice}</div>
        ) : null}
        {message.canRetry === true ? (
          <button type="button" className="ef-inline-link" onClick={onRetry}>
            <Icon name="refresh" />重新读取当前页
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
        {message.citations.length > 0 && !cardActive ? (
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
  const lastAnnouncedId = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState<{ id: string; text: string } | null>(null);
  const latestMessageId = messages.at(-1)?.messageId;

  useEffect(() => {
    if (currentCardMessageId !== null && lastScrolledCardId.current !== currentCardMessageId) {
      lastScrolledCardId.current = currentCardMessageId;
      currentCardRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
    if (currentCardMessageId === null) lastScrolledCardId.current = null;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [currentCardMessageId, latestMessageId]);

  useEffect(() => {
    const latest = messages.at(-1);
    if (latest === undefined || latest.role === "user" || latest.messageId === lastAnnouncedId.current) return;
    lastAnnouncedId.current = latest.messageId;
    const currentCopy = latest.role === "assistant" && latest.messageId === currentCardMessageId && activeStep !== null
      ? buildStepCardCopy({ targetControl: activeStep.targetControl, snapshot, completionCondition: activeStep.completion })
      : null;
    const text = currentCopy === null ? latest.text : `当前一步：${currentCopy.shortText}`;
    setAnnouncement({ id: latest.messageId, text: `${latest.role === "assistant" ? "EasyFlow：" : ""}${text}` });
  }, [latestMessageId, messages, currentCardMessageId, activeStep, snapshot]);

  return (
    <div className="ef-message-list">
      <div className="ef-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement === null ? null : <span key={announcement.id}>{announcement.text}</span>}
      </div>
      {messages.length === 0 ? (
        <div className="ef-welcome">
          <WelcomeSticker />
          <h2 className="ef-welcome-title">这一页，有什么想问的？</h2>
          <p className="ef-welcome-description">我可以解释页面上的内容，也可以一步一步陪你操作。</p>
          <div className="ef-welcome-prompts">
            {["这个页面讲了什么？", "我想在这个页面办事"].map((prompt) => <button type="button" className="ef-quick-option" key={prompt} onClick={() => onSend(prompt)}>{prompt}<Icon name="chevron" /></button>)}
          </div>
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
