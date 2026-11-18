import type { ReactNode } from "react";

type IconName = "settings" | "refresh" | "close" | "message" | "help" | "lock" | "up" | "target" | "book" | "chevron" | "volume" | "mic" | "stop";

const paths: Record<IconName, ReactNode> = {
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="8" cy="7" r="3" /><circle cx="16" cy="17" r="3" /></>,
  refresh: <path d="M20 7a9 9 0 1 0 1 8M20 2v6h-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  message: <><path d="M21 11a9 9 0 0 1-9 9H3l1-5a9 9 0 1 1 17-4Z" /><path d="M8 10h8m-8 4h5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  up: <path d="M12 19V5m-6 6 6-6 6 6" />,
  target: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>,
  book: <path d="M12 6v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  volume: <path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
};

export function Icon({ name }: { name: IconName }) {
  return <svg className="ef-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
