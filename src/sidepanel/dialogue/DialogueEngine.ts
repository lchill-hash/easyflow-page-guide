import type { DialogueMode, DialogueRequest, DialogueResponse } from "../../shared/types";

export interface DialogueEngine {
  readonly mode: DialogueMode;
  respond(request: DialogueRequest): Promise<DialogueResponse>;
}

export class InvalidDialogueRequestError extends Error {
  constructor(reason: string) {
    super(`invalid-dialogue-request:${reason}`);
    this.name = "InvalidDialogueRequestError";
  }
}

export function assertDialogueRequest(request: DialogueRequest): void {
  if (request.schemaVersion !== 1) {
    throw new InvalidDialogueRequestError("schema-version");
  }
  if (request.turnId.length === 0) {
    throw new InvalidDialogueRequestError("turn-id");
  }
  if (request.utterance.length === 0) {
    throw new InvalidDialogueRequestError("utterance");
  }
  if (!Array.isArray(request.segments) || !Array.isArray(request.controls)) {
    throw new InvalidDialogueRequestError("page-payload");
  }
}