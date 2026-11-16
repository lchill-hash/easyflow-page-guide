import {
  MIC_PAGE_DEDUPE_GUARD_MS,
  MIC_PERMISSION_PAGE_PATH,
} from "../../shared/speech/constants";
import type {
  MicPageOpenResult,
  MicPermissionPage,
} from "../../shared/speech/permission";

export interface MicRuntimeLike {
  getURL(path: string): string;
  countContexts?(filter: {
    documentUrls: readonly string[];
    contextTypes: readonly string[];
  }): Promise<number>;
  createTab?(url: string): Promise<number | null>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function readMicRuntime(scope: unknown): MicRuntimeLike | null {
  const root = asRecord(scope);
  if (root === null) {
    return null;
  }
  const chromeLike = asRecord(root["chrome"]);
  if (chromeLike === null) {
    return null;
  }
  const runtime = asRecord(chromeLike["runtime"]);
  if (runtime === null) {
    return null;
  }
  const tabs = asRecord(chromeLike["tabs"]);
  const getURL = runtime["getURL"];
  if (typeof getURL !== "function") {
    return null;
  }
  const getContexts = runtime["getContexts"];
  const create = tabs?.["create"];
  const result: MicRuntimeLike = {
    getURL(path: string): string {
      return (getURL as (this: unknown, nextPath: string) => string).call(runtime, path);
    },
  };
  if (typeof getContexts === "function") {
    result.countContexts = async (filter) => {
      const contexts = await (
        getContexts as (
          this: unknown,
          nextFilter: { documentUrls: readonly string[]; contextTypes: readonly string[] },
        ) => Promise<unknown[]>
      ).call(runtime, {
        documentUrls: [...filter.documentUrls],
        contextTypes: [...filter.contextTypes],
      });
      return Array.isArray(contexts) ? contexts.length : 0;
    };
  }
  if (typeof create === "function" && tabs !== null) {
    result.createTab = async (url: string): Promise<number | null> => {
      const tab = await (
        create as (this: unknown, options: { url: string }) => Promise<{ id?: unknown } | null>
      ).call(tabs, { url });
      return typeof tab?.id === "number" ? tab.id : null;
    };
  }
  return result;
}

export function createMicPermissionPage(deps: {
  runtime: MicRuntimeLike;
  now?: () => number;
}): MicPermissionPage {
  const now = deps.now ?? (() => Date.now());
  let inFlight = false;
  let sessionOpened = false;
  let lastOpenAt = 0;
  return {
    async open(): Promise<MicPageOpenResult> {
      if (inFlight) {
        return "already-open";
      }
      inFlight = true;
      try {
        let pageUrl: string;
        try {
          pageUrl = deps.runtime.getURL(MIC_PERMISSION_PAGE_PATH);
        } catch {
          return "failed";
        }
        if (typeof pageUrl !== "string" || pageUrl.length === 0) {
          return "failed";
        }
        if (deps.runtime.countContexts !== undefined) {
          try {
            const count = await deps.runtime.countContexts({
              documentUrls: [pageUrl],
              contextTypes: ["TAB"],
            });
            if (count > 0) {
              return "already-open";
            }
          } catch {
            if (sessionOpened && now() - lastOpenAt < MIC_PAGE_DEDUPE_GUARD_MS) {
              return "already-open";
            }
          }
        } else if (sessionOpened && now() - lastOpenAt < MIC_PAGE_DEDUPE_GUARD_MS) {
          return "already-open";
        }
        if (deps.runtime.createTab === undefined) {
          return "failed";
        }
        try {
          const tabId = await deps.runtime.createTab(pageUrl);
          if (typeof tabId !== "number") {
            return "failed";
          }
        } catch {
          return "failed";
        }
        sessionOpened = true;
        lastOpenAt = now();
        return "opened";
      } finally {
        inFlight = false;
      }
    },
  };
}