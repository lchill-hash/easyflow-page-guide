import { SPEECH_DISCLOSURE_TEXT } from "../../../shared/speech/copy";

export function AboutPanel({ modelEnabled, modelReady }: { modelEnabled: boolean; modelReady: boolean }) {
  return (
    <details className="ef-about">
      <summary>数据与能力说明</summary>
      <p>{modelEnabled && modelReady ? "在线智能已连接；页面摘要脱敏后经模型代理发送给 DeepSeek。" : modelEnabled ? "在线智能待连接，当前自动使用本地规则。" : "当前使用本地规则，可在上方开启在线智能。"}</p>
      <p>定位只滚动并临时高亮网页，不会替你点击、填写、勾选或提交。</p>
      <p>聊天保留在本次会话中。页面变化后，旧依据可能失效，需要重新核对。</p>
      <p className="ef-about-note">{SPEECH_DISCLOSURE_TEXT}</p>
    </details>
  );
}
