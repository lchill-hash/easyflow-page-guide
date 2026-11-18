import { useEffect, useRef, useState } from "react";
import { SPEAK_UNAVAILABLE_KIND_TEXT } from "../shared/speech/copy";
import { AboutPanel } from "./components/chat/AboutPanel";
import { ChatComposer } from "./components/chat/ChatComposer";
import { ChatHeader } from "./components/chat/ChatHeader";
import { DiagnosticsPanel } from "./components/chat/DiagnosticsPanel";
import { MessageList } from "./components/chat/MessageList";
import { PageStatusLine } from "./components/chat/PageStatusLine";
import { SettingsDialog } from "./components/chat/SettingsDialog";
import { SeniorAssistPanel } from "./components/chat/SeniorAssistPanel";
import { currentStep } from "./guide/stepPlanner";
import { useConversation } from "./hooks/useConversation";
import { useModelMode } from "./hooks/useModelMode";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import { useUiMode } from "./hooks/useUiMode";
import { useVoiceInput } from "./hooks/useVoiceInput";
import { usePageAccess } from "./hooks/usePageAccess";

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { uiMode, modeReady, toggleMode } = useUiMode();
  const modelMode = useModelMode();
  const pageAccess = usePageAccess();
  const previousPageAccess = useRef<boolean | null>(null);
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
    highlightStats,
    highlightRequestCount,
  } = useConversation(uiMode, modelMode.enabled, modelMode.ready);
  useEffect(() => {
    if (!pageAccess.ready) return;
    const previous = previousPageAccess.current;
    previousPageAccess.current = pageAccess.enabled;
    if (previous !== null && previous !== pageAccess.enabled) void retry();
  }, [pageAccess.ready, pageAccess.enabled, retry]);
  const voice = useVoiceInput();
  const speech = useSpeechSynthesis();
  const activeStep = currentStep(state.plan);
  const openSettings = (): void => {
    speech.stop();
    setSettingsOpen(true);
  };
  const changeTask = (): void => {
    voice.cancel();
    speech.stop();
    switchTask();
  };

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
        onOpenSettings={openSettings}
      />
      <PageStatusLine state={state} onRefresh={() => { void retry(); }} onOpenSettings={openSettings} />
      {modelMode.enabled && !modelMode.ready ? (
        <div className="ef-connection-banner" role="status"><span>在线服务暂未连接，当前使用本地规则。</span><button type="button" className="ef-text-button" onClick={openSettings}>查看</button></div>
      ) : null}
      <div className="ef-conversation-top">
        <button type="button" className="ef-model-indicator" data-status={modelMode.enabled ? modelMode.ready ? "ready" : "pending" : "local"} aria-label="查看回答模式与设置" onClick={openSettings}>
          {modelMode.enabled ? modelMode.ready ? "在线智能已开启" : "在线智能待连接" : "本地规则"}
        </button>
        <button type="button" className="ef-text-button" disabled={state.busy} onClick={changeTask}>换一个任务</button>
      </div>
      <div className="ef-senior-quick-actions" role="group" aria-label="常用帮助">
        <button type="button" onClick={() => send("请用简单的话解释当前这一步，只依据当前网页能看到的内容；没有依据时请直接告诉我。")} disabled={state.snapshot === null || state.busy}>我没看懂</button>
        <button type="button" onClick={() => activeStep && locateControl(activeStep.targetControl.ref)} disabled={activeStep === null || state.busy}>指给我看</button>
        <button type="button" aria-expanded={helpOpen} onClick={() => setHelpOpen((value) => !value)}>找人帮忙</button>
      </div>
      {state.slowHint ? <div className="ef-slow-hint" role="status">我正在看这个页面…</div> : null}
      <main className="ef-chat-main" aria-label="与 EasyFlow 的对话">
        <SeniorAssistPanel
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          state={state}
          activeStep={activeStep}
          onSend={send}
          onLocateCitation={locateCitation}
          onRefresh={() => { void retry(); }}
        />
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
          onSwitchTask={changeTask}
        />
      </main>
      <ChatComposer onSend={send} disabled={state.busy} voice={voice} uiMode={uiMode} onHelp={openSettings} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} uiMode={uiMode} modeReady={modeReady} onToggleMode={toggleMode} modelEnabled={modelMode.enabled} modelReady={modelMode.ready} onToggleModel={modelMode.toggle} pageAccess={pageAccess}>
        <AboutPanel modelEnabled={modelMode.enabled} modelReady={modelMode.ready} />
        <DiagnosticsPanel
          entries={state.diagnostics}
          collectDiagnostics={state.collectDiagnostics}
          lastBookingCheck={state.lastBookingCheck}
          bookingCompleted={state.pageSuccess === "confirmed"}
          speakUnavailableKind={speakUnavailableKind}
          speechDiagnostics={voice.view.diagnostics}
          highlightStats={highlightStats}
          highlightRequestCount={highlightRequestCount}
          onRecheckLocal={voice.recheckLocalCapability}
          onExpand={voice.ensureLocalCapability}
          onRefresh={() => {
            void retry();
          }}
        />
      </SettingsDialog>
    </div>
  );
}
