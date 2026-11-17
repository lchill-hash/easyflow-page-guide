import { useEffect, useState } from "react";
import { probeModelProxy } from "../dialogue/model/ModelEngine";

const STORAGE_KEY = "easyflow.model.enabled";

export function useModelMode() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void chrome.storage.local.get(STORAGE_KEY).then((stored) => {
      if (active) setEnabled(stored[STORAGE_KEY] === true);
    });
    const check = (): void => {
      void probeModelProxy().then((result) => { if (active) setReady(result); });
    };
    check();
    const timer = window.setInterval(check, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const toggle = (): void => {
    const next = !enabled;
    setEnabled(next);
    void chrome.storage.local.set({ [STORAGE_KEY]: next });
  };

  return { enabled, ready, toggle };
}
