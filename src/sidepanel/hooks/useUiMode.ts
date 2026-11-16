import { useCallback, useEffect, useRef, useState } from "react";
import { UI_MODE_STORAGE_KEY } from "../../shared/constants";
import { normalizeUiMode, parseStoredUiMode, serializeUiMode } from "../../shared/uiMode";
import type { UiMode, UiModePrefIssue } from "../../shared/uiMode";

export interface UiModeController {
  uiMode: UiMode;
  modeReady: boolean;
  prefIssue: UiModePrefIssue | null;
  setMode: (mode: UiMode) => void;
  toggleMode: () => void;
}

export function useUiMode(): UiModeController {
  const [uiMode, setUiMode] = useState<UiMode>("normal");
  const [modeReady, setModeReady] = useState(false);
  const [prefIssue, setPrefIssue] = useState<UiModePrefIssue | null>(null);
  const modeRef = useRef<UiMode>("normal");

  const apply = useCallback((mode: UiMode): void => {
    const next = normalizeUiMode(mode);
    modeRef.current = next;
    setUiMode(next);
    document.documentElement.dataset.uiMode = next;
    document.documentElement.dataset.modeReady = "true";
  }, []);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const stored = await chrome.storage.local.get(UI_MODE_STORAGE_KEY);
        if (disposed) {
          return;
        }
        const parsed = parseStoredUiMode(stored[UI_MODE_STORAGE_KEY]);
        setPrefIssue(parsed.issue);
        apply(parsed.mode);
      } catch {
        if (disposed) {
          return;
        }
        setPrefIssue("read-failed");
        apply("normal");
      } finally {
        if (!disposed) {
          setModeReady(true);
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [apply]);

  const setMode = useCallback((mode: UiMode): void => {
    const next = normalizeUiMode(mode);
    modeRef.current = next;
    setUiMode(next);
    document.documentElement.dataset.uiMode = next;
    void (async () => {
      try {
        await chrome.storage.local.set({
          [UI_MODE_STORAGE_KEY]: serializeUiMode(next, Date.now()),
        });
        setPrefIssue(null);
      } catch {
        setPrefIssue("write-failed");
      }
    })();
  }, []);

  const toggleMode = useCallback((): void => {
    setMode(modeRef.current === "care" ? "normal" : "care");
  }, [setMode]);

  return { uiMode, modeReady, prefIssue, setMode, toggleMode };
}