import { SPEECH_DISCLOSURE_TEXT } from "../../../shared/speech/copy";

export function AboutPanel() {
  return (
    <details className="ef-about">
      <summary>说明</summary>
      <p>本地规则演示，未接入在线模型。</p>
      <p>我不代填、不代提交，最终由你自己操作。</p>
      <p className="ef-about-note">{SPEECH_DISCLOSURE_TEXT}</p>
    </details>
  );
}