import { useEffect, useRef, useState } from "react";
import {
  SPEECH_DISCLOSURE_TEXT,
  SPEECH_LOCAL_TEXTS,
  SPEECH_MODE_TEXTS,
  VOICE_FALLBACK_TEXT,
} from "../../../shared/speech/copy";
import type { RecognitionMode } from "../../../shared/speech/types";
import type { VoiceInputView } from "../../../shared/speech/voiceMachine";
import { Icon } from "./Icon";

interface VoiceInputControlProps {
  view: VoiceInputView;
  onStart: () => void;
  onCancel: () => void;
  onRequestMic: () => void;
  onSelectMode: (mode: RecognitionMode) => void;
  onInstallLocal: () => void;
  onPageQuestions: () => void;
}

export function VoiceInputControl({
  view,
  onStart,
  onCancel,
  onRequestMic,
  onSelectMode,
  onInstallLocal,
  onPageQuestions,
}: VoiceInputControlProps) {
  const listening = view.phase === "listening";
  const [micGuideOpen, setMicGuideOpen] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!view.showMicEntry) {
      setMicGuideOpen(false);
    }
  }, [view.showMicEntry]);

  useEffect(() => {
    if (micGuideOpen) {
      startRef.current?.focus();
    }
  }, [micGuideOpen]);

  const handleVoice = (): void => {
    if (listening) {
      onCancel();
      return;
    }
    if (view.showMicEntry) {
      setMicGuideOpen(true);
    }
    onStart();
  };

  return (
    <div className="ef-speech-row">
      <button
        type="button"
        className="ef-speech-btn"
        disabled={!view.canStart}
        aria-expanded={view.showMicEntry ? micGuideOpen : undefined}
        aria-controls={view.showMicEntry ? "ef-mic-guide" : undefined}
        aria-describedby={view.statusText.length > 0 ? "ef-speech-status" : undefined}
        onClick={handleVoice}
      >
        <Icon name={listening ? "stop" : "mic"} />
        {view.buttonLabel}
      </button>
      {view.showFallbackActions ? (
        <button type="button" className="ef-speech-open-btn" onClick={onPageQuestions}>
          打开使用帮助
        </button>
      ) : null}
      {view.statusText.length > 0 ? (
        <div
          className="ef-speech-status"
          id="ef-speech-status"
          role="status"
          aria-live="polite"
        >
          {view.statusText}
        </div>
      ) : null}
      {view.showFallbackActions ? <p className="ef-speech-fallback">{VOICE_FALLBACK_TEXT}</p> : null}
      <div
        className="ef-mic-guide"
        id="ef-mic-guide"
        role="region"
        aria-label="麦克风与识别说明"
        hidden={!micGuideOpen}
      >
        {view.showMicEntry ? (
          <button
            type="button"
            ref={startRef}
            className="ef-speech-open-btn"
            onClick={onRequestMic}
          >
            {view.micEntryLabel}
          </button>
        ) : null}
        {view.showModeSelector ? (
          <div
            className="ef-speech-mode"
            role="radiogroup"
            aria-label={SPEECH_MODE_TEXTS.groupLabel}
          >
            <label>
              <input
                type="radio"
                name="ef-speech-mode"
                checked={view.mode === "service"}
                onChange={() => {
                  onSelectMode("service");
                }}
              />
              {SPEECH_MODE_TEXTS.service}
            </label>
            {view.localOptionVisible ? (
              <label>
                <input
                  type="radio"
                  name="ef-speech-mode"
                  checked={view.mode === "local"}
                  onChange={() => {
                    onSelectMode("local");
                  }}
                />
                {SPEECH_MODE_TEXTS.local}
              </label>
            ) : null}
          </div>
        ) : null}
        {view.localNoticeText !== null ? (
          <p className="ef-speech-local-note">{view.localNoticeText}</p>
        ) : null}
        {view.installButtonVisible ? (
          <button
            type="button"
            className="ef-speech-install-btn"
            disabled={view.installInProgress}
            onClick={onInstallLocal}
          >
            {view.installInProgress ? SPEECH_LOCAL_TEXTS.installing : SPEECH_LOCAL_TEXTS.install}
          </button>
        ) : null}
        {view.showMicEntry ? (
          <p className="ef-speech-mic-purpose">{view.micEntryPurpose}</p>
        ) : null}
        {view.settingHelpText !== null ? (
          <p className="ef-speech-setting-help">{view.settingHelpText}</p>
        ) : null}
        {view.showDisclosure ? (
          <p className="ef-speech-disclosure">{SPEECH_DISCLOSURE_TEXT}</p>
        ) : null}
      </div>
    </div>
  );
}