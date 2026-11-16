import { createMicPermissionResult } from "../shared/messages";
import type { MicRequestOutcome } from "../shared/speech/permission";

export function notifyMicPermissionResult(result: MicRequestOutcome, at: number): void {
  if (typeof chrome === "undefined" || chrome.runtime?.sendMessage === undefined) {
    return;
  }
  void chrome.runtime.sendMessage(createMicPermissionResult(result, at)).catch(() => undefined);
}