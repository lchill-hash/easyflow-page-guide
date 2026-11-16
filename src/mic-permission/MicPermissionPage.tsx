import { useEffect, useRef, useState } from "react";
import { MIC_PAGE_TEXTS, SPEECH_DISCLOSURE_TEXT } from "../shared/speech/copy";
import type { MicRequestOutcome } from "../shared/speech/permission";
import { notifyMicPermissionResult } from "./notify";
import { deriveMicPageView } from "./pageView";
import type { MicPagePhase } from "./pageView";
import { readMediaDevices, requestMicrophone } from "./request";

function initialPhase(): MicPagePhase {
  return readMediaDevices(window) === null ? "unsupported" : "idle";
}

export function MicPermissionPage() {
  const [phase, setPhase] = useState<MicPagePhase>(initialPhase);
  const requestingRef = useRef(false);
  const mountedRef = useRef(true);
  const view = deriveMicPageView(phase);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onRequest = async (): Promise<void> => {
    if (requestingRef.current) {
      return;
    }
    requestingRef.current = true;
    setPhase("requesting");
    const outcome: MicRequestOutcome = await requestMicrophone(readMediaDevices(window));
    if (!mountedRef.current) {
      requestingRef.current = false;
      return;
    }
    setPhase(outcome);
    notifyMicPermissionResult(outcome, Date.now());
    requestingRef.current = false;
  };

  return (
    <main className="ef-mic-page">
      <section className="ef-mic-card">
        <h1>{view.heading}</h1>
        <p>{view.body}</p>
        <p>{SPEECH_DISCLOSURE_TEXT}</p>
        <p>{MIC_PAGE_TEXTS.privacyExtra}</p>
        <button
          type="button"
          className="ef-mic-action"
          disabled={!view.canRequest}
          onClick={() => {
            void onRequest();
          }}
        >
          {view.buttonLabel}
        </button>
        <p className="ef-mic-status" role="status" aria-live="polite">
          {view.statusText}
        </p>
        <p className="ef-mic-note">{MIC_PAGE_TEXTS.keepOpenNote}</p>
      </section>
    </main>
  );
}