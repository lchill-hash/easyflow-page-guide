import { SPEECH_DISCLOSURE_TEXT } from "../../../shared/speech/copy";

export function AboutPanel({ modelEnabled, modelReady }: { modelEnabled: boolean; modelReady: boolean }) {
  return (
    <details className="ef-about">
      <summary>说明</summary>
      <p>{modelEnabled && modelReady ? "在线智能已连接；页面摘要脱敏后经本机代理发送给 DeepSeek。" : modelEnabled ? "在线智能待连接，当前自动使用本地规则。" : "当前使用本地规则。点击顶部“本地规则”可开启在线智能。"}</p>
      <p>我不代填、不代提交，最终由你自己操作。</p>
      <p className="ef-about-note">{SPEECH_DISCLOSURE_TEXT}</p>
    </details>
  );
}
