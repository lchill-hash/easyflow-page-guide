import { useCallback, useEffect, useRef, useState } from "react";

export const PAGE_ACCESS_ORIGINS = ["http://*/*", "https://*/*"];

export interface PageAccessState {
  enabled: boolean;
  ready: boolean;
  busy: boolean;
  error: string | null;
  toggle: () => void;
}

export function usePageAccess(): PageAccessState {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabledRef = useRef(false);
  const readyRef = useRef(false);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const checkVersion = useRef(0);

  const refresh = useCallback(async (): Promise<void> => {
    const version = ++checkVersion.current;
    try {
      const allowed = await chrome.permissions.contains({ origins: [...PAGE_ACCESS_ORIGINS] });
      if (!mounted.current || version !== checkVersion.current) return;
      enabledRef.current = allowed;
      readyRef.current = true;
      setEnabled(allowed);
      setReady(true);
    } catch {
      if (!mounted.current || version !== checkVersion.current) return;
      readyRef.current = false;
      setReady(false);
      setError("暂时无法检查网站读取权限，请关闭并重新打开侧栏后重试。");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // This project pins older Chrome typings that omit standard event cleanup.
    const added = chrome.permissions.onAdded as chrome.events.Event<(permissions: chrome.permissions.Permissions) => void>;
    const removed = chrome.permissions.onRemoved as chrome.events.Event<(permissions: chrome.permissions.Permissions) => void>;
    const changed = (): void => {
      if (!busyRef.current) setError(null);
      void refresh();
    };
    added.addListener(changed);
    removed.addListener(changed);
    void refresh();
    return () => {
      mounted.current = false;
      ++checkVersion.current;
      added.removeListener(changed);
      removed.removeListener(changed);
    };
  }, [refresh]);

  const toggle = useCallback((): void => {
    if (!readyRef.current || busyRef.current) return;
    const removing = enabledRef.current;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const settle = async (changed: boolean, failed = false): Promise<void> => {
      if (!mounted.current) return;
      if (!changed || failed) {
        setError(removing
          ? "未能关闭切页自动读取，请重试或在浏览器扩展设置中管理网站权限。"
          : failed
            ? "未能申请网站读取权限。请重试，或点击工具栏中的EasyFlow图标读取这一页。"
            : "未开启切页自动读取。你仍可点击工具栏中的EasyFlow图标，只读取这一页。");
      }
      // The browser permission is the source of truth, including denial/removal.
      await refresh();
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    };
    try {
      // Keep request in the click's synchronous user-gesture call stack.
      const operation = removing
        ? chrome.permissions.remove({ origins: [...PAGE_ACCESS_ORIGINS] })
        : chrome.permissions.request({ origins: [...PAGE_ACCESS_ORIGINS] });
      void operation.then((changed) => settle(changed), () => settle(false, true));
    } catch {
      void settle(false, true);
    }
  }, [refresh]);

  return { enabled, ready, busy, error, toggle };
}
