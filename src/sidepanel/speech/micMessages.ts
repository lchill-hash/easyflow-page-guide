import { isMicPermissionResult } from "../../shared/messages";
import type { MicRequestOutcome } from "../../shared/speech/permission";

export function subscribeMicPermissionResult(
  listener: (result: MicRequestOutcome, at: number) => void,
): () => void {
  if (typeof chrome === "undefined" || chrome.runtime?.onMessage === undefined) {
    return () => undefined;
  }
  const handler = (message: unknown): boolean => {
    if (!isMicPermissionResult(message)) {
      return false;
    }
    listener(message.result, message.at);
    return false;
  };
  chrome.runtime.onMessage.addListener(handler);
  return () => {
    chrome.runtime.onMessage.removeListener(handler);
  };
}