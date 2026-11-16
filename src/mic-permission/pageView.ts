import { MIC_PAGE_TEXTS } from "../shared/speech/copy";

export type MicPagePhase =
  | "idle"
  | "requesting"
  | "granted"
  | "permission-denied"
  | "no-audio-device"
  | "device-unavailable"
  | "unknown"
  | "unsupported";

export interface MicPageView {
  heading: string;
  body: string;
  buttonLabel: string;
  canRequest: boolean;
  statusText: string;
}

export function deriveMicPageView(phase: MicPagePhase): MicPageView {
  const heading = MIC_PAGE_TEXTS.heading;
  const body = MIC_PAGE_TEXTS.purpose;
  switch (phase) {
    case "requesting":
      return {
        heading,
        body,
        buttonLabel: MIC_PAGE_TEXTS.requesting,
        canRequest: false,
        statusText: "",
      };
    case "granted":
      return {
        heading,
        body,
        buttonLabel: "已允许",
        canRequest: false,
        statusText: MIC_PAGE_TEXTS.granted,
      };
    case "permission-denied":
      return {
        heading,
        body,
        buttonLabel: "再试一次",
        canRequest: true,
        statusText: MIC_PAGE_TEXTS.permissionDenied,
      };
    case "no-audio-device":
      return {
        heading,
        body,
        buttonLabel: "再试一次",
        canRequest: true,
        statusText: MIC_PAGE_TEXTS.noDevice,
      };
    case "device-unavailable":
      return {
        heading,
        body,
        buttonLabel: "再试一次",
        canRequest: true,
        statusText: MIC_PAGE_TEXTS.deviceUnavailable,
      };
    case "unknown":
      return {
        heading,
        body,
        buttonLabel: "再试一次",
        canRequest: true,
        statusText: MIC_PAGE_TEXTS.unknown,
      };
    case "unsupported":
      return {
        heading,
        body,
        buttonLabel: MIC_PAGE_TEXTS.button,
        canRequest: false,
        statusText: MIC_PAGE_TEXTS.unsupported,
      };
    default:
      return {
        heading,
        body,
        buttonLabel: MIC_PAGE_TEXTS.button,
        canRequest: true,
        statusText: "",
      };
  }
}