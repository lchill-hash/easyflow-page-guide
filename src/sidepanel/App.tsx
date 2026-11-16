import { useEffect } from "react";
import { SPEAK_UNAVAILABLE_KIND_TEXT } from "../shared/speech/copy";
import { AboutPanel } from "./components/chat/AboutPanel";
import { ChatComposer } from "./components/chat/ChatComposer";
import { ChatHeader } from "./components/chat/ChatHeader";
import { DiagnosticsPanel } from "./components/chat/DiagnosticsPanel";
import { MessageList } from "./components/chat/MessageList";
import { PageStatusLine } from "./components/chat/PageStatusLine";
import { currentStep } from "./guide/stepPlanner";
import { useConversation } from "./hooks/useConversation";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import { useUiMode } from "./hooks/useUiMode";
import { useVoiceInput } from "./hooks/useVoiceInput";

export function App() {
  const { uiMode, modeReady, toggleMode } = useUiMode();
  const {
    state,
    send,
    retry,
    markDone,
    notFound,
    misclicked,
    switchTask,
    locateCitation,
    locateControl,
  } = useConversation(uiMode);
  const voice = useVoiceInput();
  const speech = useSpeechSynthesis();
  const activeStep = currentStep(state.plan);

  useEffect(() => {
    voice.invalidate();
    speech.invalidate();
  }, [state.tabId]);

  useEffect(() => {
    if (state.plan?.status === "completed" || state.plan?.status === "superseded") {
      voice.invalidate();
      speech.invalidate();
    }
  }, [state.plan?.status]);

  useEffect(() => {
    if (state.pageSuccess === "confirmed") {
      voice.invalidate();
      speech.invalidate();
    }
  }, [state.pageSuccess]);

  useEffect(() => {
    speech.invalidate();
  }, [activeStep?.stepId]);

  useEffect(() => {
    speech.stop();
  }, [state.messages.length]);

  const answerKeyOf = (messageId: string): string => `answer:${messageId}`;
  const speakUnavailableKind =
    speech.phase === "unsupported" || speech.phase === "sensitive-skipped"
      ? SPEAK_UNAVAILABLE_KIND_TEXT[speech.phase]
      : null;

  return (
    <div className="ef-app ef-chat-app" data-ui-mode={uiMode}>
      <ChatHeader
        uiMode={uiMode}
        modeReady={modeReady}
        onToggleMode={toggleMode}
      />
      <PageStatusLine state={state} />
      {state.slowHint ? <div className="ef-slow-hint">我正在看这个页面…</div> : null}
      <main className="ef-chat-main">
        <MessageList
          messages={state.messages}
          currentCardMessageId={state.currentCardMessageId}
          planActive={state.plan?.status === "active"}
          bookingCompleted={state.pageSuccess === "confirmed"}
          activeStep={activeStep}
          snapshot={state.snapshot}
          speech={speech}
          answerKeyOf={answerKeyOf}
          onCitation={locateCitation}
          onLocateControl={locateControl}
          onSend={send}
          onRetry={() => {
            void retry();
          }}
          onNotFound={notFound}
          onMisclicked={misclicked}
          onDone={() => {
            void markDone();
          }}
          onSwitchTask={() => {
            voice.cancel();
            speech.stop();
            switchTask();
          }}
        />
        <AboutPanel />
      </main>
      <ChatComposer onSend={send} disabled={state.busy} voice={voice} uiMode={uiMode} />
      <DiagnosticsPanel
        entries={state.diagnostics}
        collectDiagnostics={state.collectDiagnostics}
        lastBookingCheck={state.lastBookingCheck}
        bookingCompleted={state.pageSuccess === "confirmed"}
        speakUnavailableKind={speakUnavailableKind}
        speechDiagnostics={voice.view.diagnostics}
        onRecheckLocal={voice.recheckLocalCapability}
        onExpand={voice.ensureLocalCapability}
        onRefresh={() => {
          void retry();
        }}
      />
    </div>
  );
}