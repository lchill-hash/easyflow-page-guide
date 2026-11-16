import { useEffect, useState } from "react";
import { MAX_TURN_CHARS } from "../../../shared/constants";
import type { UiMode } from "../../../shared/uiMode";
import type { VoiceInputHandle } from "../../hooks/useVoiceInput";
import { VoiceInputControl } from "./VoiceInputControl";

interface ChatComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
  voice: VoiceInputHandle;
  uiMode: UiMode;
}

export function ChatComposer({ onSend, disabled, voice, uiMode }: ChatComposerProps) {
  const [text, setText] = useState("");

  const submit = (): void => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || disabled) {
      return;
    }
    onSend(trimmed);
    setText("");
    voice.onComposerTextChange("");
  };

  useEffect(() => {
    const pending = voice.view.pendingText;
    if (pending === null) {
      return;
    }
    setText(pending);
    voice.onComposerTextChange(pending);
    voice.consumePending();
  }, [voice.view.revision, voice.view.pendingText]);

  return (
    <div className="ef-composer">
      <textarea
        className="ef-composer-input"
        value={text}
        rows={2}
        maxLength={MAX_TURN_CHARS}
        placeholder="你想了解什么，或想完成什么事？直接告诉我。"
        aria-label="输入你想了解或想完成的事"
        aria-describedby="ef-composer-hint"
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          voice.onComposerTextChange(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="ef-composer-row">
        <span className="ef-composer-hint" id="ef-composer-hint">
          {uiMode === "care" ? "Enter 发送" : "Enter 发送 · Shift+Enter 换行"}
        </span>
        <button
          type="button"
          className="ef-send-btn"
          disabled={disabled || text.trim().length === 0}
          onClick={submit}
        >
          {disabled ? "等待中…" : "发送"}
        </button>
      </div>
      <VoiceInputControl
        view={voice.view}
        onStart={voice.start}
        onCancel={voice.cancel}
        onRequestMic={voice.requestMicPermission}
        onSelectMode={voice.setMode}
        onInstallLocal={voice.installLocal}
      />
    </div>
  );
}