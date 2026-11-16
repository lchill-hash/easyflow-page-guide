export const CONTENT_VERSION = "0.3.0";

export const MAX_ITEMS = 3000;
export const MAX_TEXT_LENGTH = 300;
export const MAX_EXCERPT = 240;
export const MAX_SUMMARY = 40;
export const MAX_GOAL_LENGTH = 200;
export const CHAR_BUDGET = 400000;

export const COLLECT_TIMEOUT_MS = 3000;
export const LOCATE_TIMEOUT_MS = 1000;
export const PING_TIMEOUT_MS = 300;
export const HIGHLIGHT_TTL_MS = 4000;
export const HIGHLIGHT_PULSE_DURATION_MS = 750;
export const HIGHLIGHT_PULSE_COUNT = 3;

export const MAX_TURN_CHARS = 500;
export const MAX_CONTEXT_TURNS = 6;
export const MAX_MESSAGES = 200;
export const MAX_ANSWER_SENTENCES = 3;
export const MAX_ANSWER_CHARS = 180;
export const MAX_CLARIFY_OPTIONS = 3;

export const MAX_SEGMENT_CHARS = 500;
export const MAX_SEGMENTS = 600;
export const MAX_SEGMENT_BODY_REFS = 8;
export const MAX_CITATION_CHARS = 240;

export const MAX_PLAN_STEPS = 12;
export const MAX_AUTO_RECHECK_PER_STEP = 3;
export const WATCH_DEBOUNCE_MS = 600;
export const RECHECK_MIN_INTERVAL_MS = 1200;
export const MAX_EXPECTED_TEXT_CHARS = 40;
export const MAX_CONTROL_LABEL_CHARS = 80;

export const ENGINE_SLOW_HINT_MS = 500;
export const MAX_HIGHLIGHT_REFS = 3;

export const MAX_OUTBOUND_SEGMENTS = 24;
export const MAX_OUTBOUND_CHARS = 6000;
export const MAX_OUTBOUND_CONTROLS = 40;
export const MODEL_MODE_DEFAULT = "rule-demo";

export const ELEMENT_ID_PATTERN = /^ef-[hplbi]-\d{1,5}$/;
export const GOAL_STORAGE_KEY = "easyflow.goal";export const UI_MODE_STORAGE_KEY = "easyflow.ui.mode";
export const UI_MODE_SCHEMA_VERSION = 1;
export const STEP_CARD_SHORT_MAX_WIDTH = 24;
export const STEP_CARD_SHORT_NAME_MAX_CHARS = 12;