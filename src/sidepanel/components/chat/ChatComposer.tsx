import { useEffect, useRef, useState } from "react";
import { MAX_TURN_CHARS } from "../../../shared/constants";
import type { UiMode } from "../../../shared/uiMode";
import type { VoiceInputHandle } from "../../hooks/useVoiceInput";
import { useAutosizeTextarea } from "../../hooks/useAutosizeTextarea";
import { VoiceInputControl } from "./VoiceInputControl";
import { Icon } from "./Icon";

interface ChatComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
  voice: VoiceInputHandle;
  uiMode: UiMode;
  onHelp: () => void;
}

export function ChatComposer({ onSend, disabled, voice, uiMode, onHelp }: ChatComposerProps) {
  const [text, setText] = useState("");
  const composing = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useAutosizeTextarea(inputRef, text);

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
    <footer className="ef-composer">
      <div className="ef-context-actions"><button type="button" onClick={onHelp}><Icon name="help" />使用帮助</button><span>围绕当前页面提问</span></div>
      <div className="ef-composer-box">
      <textarea
        ref={inputRef}
        className="ef-composer-input"
        value={text}
        rows={2}
        maxLength={MAX_TURN_CHARS}
        placeholder="问问这一页，或说说你想办什么…"
        aria-label="输入你想了解或想完成的事"
        aria-describedby="ef-composer-hint"
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          voice.onComposerTextChange(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !composing.current && event.nativeEvent.keyCode !== 229) {
            event.preventDefault();
            submit();
          }
        }}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
      />
      <div className="ef-composer-row">
        <span className="ef-composer-hint" id="ef-composer-hint">
          {uiMode === "care" ? "Enter 发送" : "Enter 发送"}
        </span>
        <VoiceInputControl
          view={voice.view}
          onStart={voice.start}
          onCancel={voice.cancel}
          onRequestMic={voice.requestMicPermission}
          onSelectMode={voice.setMode}
          onInstallLocal={voice.installLocal}
          onPageQuestions={onHelp}
        />
        <button
          type="button"
          className="ef-send-btn"
          aria-label={disabled ? "正在等待回复" : "发送问题"}
          title={disabled ? "正在等待回复" : "发送问题"}
          disabled={disabled || text.trim().length === 0}
          onClick={submit}
        >
          <Icon name="up" />
        </button>
      </div>
      </div>
      <p className="ef-composer-note"><Icon name="lock" />只读指引 · 不代填、不代提交</p>
    </footer>
  );
}
