import type {
  DialogueRequest,
  DialogueResponse,
  EngineDiagnostics,
} from "../../../shared/types";
import { PROXY_CONTRACT } from "../../../shared/privacy/redact";
import type { DialogueEngine } from "../DialogueEngine";

export type ModelProxyStatus = "not-configured" | "ready";

export const modelProxyStatus: ModelProxyStatus = "not-configured";

export class ModelDialogueEngine implements DialogueEngine {
  readonly mode = "online-model" as const;

  async respond(request: DialogueRequest): Promise<DialogueResponse> {
    const diagnostics: EngineDiagnostics = {
      mode: "online-model",
      engineMs: 0,
      retrievedSegments: 0,
      citationCount: 0,
      intentKind: "fallback-clarify",
      priorityHit: "model-not-configured",
      outboundBytes: 0,
      sensitiveDetected: false,
    };
    return Promise.resolve({
      responseType: "cannot-answer",
      text: "在线模型还没有配置，这一轮继续使用本地规则演示。",
      citations: [],
      limitation: {
        reason: "low-confidence",
        advice: "继续用本地规则问答；模型接入需要单独的代理与授权配置。",
      },
      diagnostics,
    });
  }
}

export { PROXY_CONTRACT };