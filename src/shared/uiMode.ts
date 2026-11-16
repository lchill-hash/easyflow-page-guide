import { UI_MODE_SCHEMA_VERSION } from "./constants";

export type UiMode = "normal" | "care";

export type UiModePrefIssue = "missing" | "invalid" | "read-failed" | "write-failed";

export interface StoredUiMode {
  v: 1;
  mode: UiMode;
  updatedAt: number;
}

export function normalizeUiMode(value: unknown): UiMode {
  return value === "care" ? "care" : "normal";
}

export function parseStoredUiMode(value: unknown): {
  mode: UiMode;
  issue: UiModePrefIssue | null;
} {
  if (value === undefined || value === null) {
    return { mode: "normal", issue: "missing" };
  }
  if (value === "care" || value === "normal") {
    return { mode: value, issue: null };
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.v !== UI_MODE_SCHEMA_VERSION) {
      return { mode: "normal", issue: "invalid" };
    }
    if (record.mode !== "normal" && record.mode !== "care") {
      return { mode: "normal", issue: "invalid" };
    }
    return { mode: record.mode, issue: null };
  }
  return { mode: "normal", issue: "invalid" };
}

export function serializeUiMode(mode: UiMode, now: number): StoredUiMode {
  return { v: 1, mode, updatedAt: now };
}