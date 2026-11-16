import {
  SPEECH_DISCLOSURE_TEXT,
  SPEECH_LOCAL_TEXTS,
  SPEECH_MODE_TEXTS,
} from "../../../shared/speech/copy";
import type { RecognitionMode } from "../../../shared/speech/types";
import type { VoiceInputView } from "../../../shared/speech/voiceMachine";

interface VoiceInputControlProps {
  view: VoiceInputView;
  onStart: () => void;
  onCancel: () => void;
  onRequestMic: () => void;
  onSelectMode: (mode: RecognitionMode) => void;
  onInstallLocal: () => void;
}

export function VoiceInputControl({
  view,
  onStart,
  onCancel,
  onRequestMic,
  onSelectMode,
  onInstallLocal,
}: VoiceInputControlProps) {
  const listening = view.phase === "listening";
  return (
    <div className="ef-speech-row">
      <button
        type="button"
        className="ef-speech-btn"
        disabled={!view.canStart}
        aria-describedby={view.statusText.length > 0 ? "ef-speech-status" : undefined}
        onClick={listening ? onCancel : onStart}
      >
        {view.buttonLabel}
      </button>
      {view.showMicEntry ? (
        <button
          type="button"
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
  );
}