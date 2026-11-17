export const SCHEMA_VERSION = 1 as const;

export type ItemType = "heading" | "paragraph" | "link" | "button" | "inputLabel";

export type Region = "main" | "nav" | "header" | "footer" | "aside" | "unknown";

export type LabelSource = "label" | "aria-label" | "aria-labelledby" | "placeholder" | "nearby";

export interface ElementItem {
  elementId: string;
  type: ItemType;
  text: string;
  textLength: number;
  truncated: boolean;
  order: number;
  region: Region;
  domPath: string;
  textHash: string;
  tagName: string;
  labelSource?: LabelSource;
  titleCandidate?: boolean;
  accessibleName?: string;
  disabled?: boolean;
  selected?: boolean;
  isToday?: boolean;
  role?: string;
  controlContext?: ControlContext;
  controlContextReason?: string;
}

export interface PageSnapshot {
  snapshotId: string;
  runId: string;
  schemaVersion: 1;
  url: string;
  origin: string;
  domain: string;
  title: string;
  titleMissing: boolean;
  capturedAt: number;
  itemCount: number;
  items: ElementItem[];
  segments?: SemanticSegment[];
  controls?: PageControl[];
  truncated: boolean;
}

export interface CollectDiagnostics {
  collectMs: number;
  candidateCount: number;
  visibleCount: number;
  droppedHidden: number;
  droppedByBudget: number;
  contentVersion: string;
  segmentsMs?: number;
  segmentCount?: number;
  controlCount?: number;
  iframeCount?: number;
  buttonCandidates?: number;
  buttonCollected?: number;
  dateControlCount?: number;
  timeControlCount?: number;
  filteredEmptyButtons?: number;
  filteredHiddenButtons?: number;
  filteredDisabledButtons?: number;
  openShadowRoots?: number;
  controlsTruncated?: boolean;
  dateCandidates?: ControlDiagnostic[];
  timeCandidates?: ControlDiagnostic[];
  availableDateCount?: number;
  selectedDateLabel?: string;
  selectedTimeLabel?: string;
  capturedAt?: number;
}

export interface ElementRef {
  elementId: string;
  domPath: string;
  textHash: string;
}

export interface GuidanceCard {
  cardId: string;
  elementId: string;
  summary: string;
  excerpt: string;
  excerptTruncated: boolean;
  matchedKeywords: string[];
  score: number;
  rank: number;
}

export type RunStatus =
  | "success"
  | "partial"
  | "no-evidence"
  | "invalid-goal"
  | "inject-failed"
  | "timeout"
  | "stale";

export interface MatchDiagnostics {
  matchMs: number;
  keywordGroups: number;
  scoredCount: number;
  topScore: number;
  threshold: number;
  dedupedCount: number;
}

export interface AnalysisRun {
  runId: string;
  snapshotId: string;
  mode: "rule-demo";
  status: RunStatus;
  goal: string;
  cards: GuidanceCard[];
  startedAt: number;
  finishedAt: number;
  diagnostics: MatchDiagnostics;
}

export type MatchStatus = "success" | "partial" | "no-evidence" | "invalid-goal";

export interface MatchResult {
  status: MatchStatus;
  cards: GuidanceCard[];
  diagnostics: MatchDiagnostics;
  message?: string;
}

export interface MatchStrategy {
  readonly mode: "rule-demo";
  match(goal: string, snapshot: PageSnapshot): MatchResult;
}

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type LocateStatus = "highlighted" | "folded" | "stale" | "partial";

export type CleanupReason =
  | "ttl"
  | "replaced"
  | "collect"
  | "pagehide"
  | "unroute"
  | "noop";

export interface HighlightStats {
  refCalls: number;
  roundStartCount: number;
  pulseStartCount: number;
  pulseCompletedCount: number;
  overlayCreateCount: number;
  overlayLiveCount: number;
  overlayLiveMax: number;
  legacyHostCount: number;
  cleanupScheduledCount: number;
  cleanupFiredCount: number;
  cleanupReplacedCount: number;
  cleanupNoopCount: number;
  cleanupReason: CleanupReason | null;
  positionUpdateCount: number;
  domTickCount: number;
  boxCreateCount: number;
  boxRemoveCount: number;
  boxCount: number;
  uiModeAtRequest: "normal" | "care";
  reducedMotionAtRequest: boolean;
  lastRoundStartAt: number | null;
  lastRoundEndAt: number | null;
  lastCleanupAt: number | null;
  highlightLifetimeMs: number | null;
  contentVersionSeen: string;
  expectedContentVersion: string;
  pageInjectionCount: number;
}

export interface HighlightResult {
  status: LocateStatus;
  rect?: ViewportRect;
  locatedElementIds?: string[];
  missingElementIds?: string[];
  stats?: HighlightStats;
}

export interface SemanticSegment {
  segmentId: string;
  text: string;
  titleRef: ElementRef;
  titleText: string;
  bodyRefs: ElementRef[];
  bodyTexts: string[];
  truncated: boolean;
  hasBody: boolean;
  region: Region;
  orderRange: [number, number];
  scopeHints: string[];
  scopeConflict: boolean;
}

export interface CitationAnchor {
  citationId: string;
  segmentId: string;
  role: "title" | "body";
  text: string;
  start: number;
  end: number;
  status: "valid" | "stale";
  ref: ElementRef;
}

export type ControlType = "button" | "link" | "input-label" | "option" | "tab";
export type ControlContext = "calendar" | "time-list" | "form" | "unknown";
export type ControlSemantic = "date" | "time" | "next" | "form" | "generic";

export type RiskFlag = "submit" | "payment" | "delete" | "captcha" | "password" | "personal-info";

export interface PageControl {
  controlId: string;
  ref: ElementRef;
  label: string;
  labelTruncated?: boolean;
  controlType: ControlType;
  visibility: "visible" | "folded" | "hidden";
  riskFlags: RiskFlag[];
  region: Region;
  ambiguous: boolean;
  kind?: ControlSemantic;
  disabled?: boolean;
  selected?: boolean;
  isToday?: boolean;
  context?: ControlContext;
  contextReason?: string;
}

export interface ControlDiagnostic {
  label: string;
  role: string;
  tagName: string;
  visible: boolean;
  disabled: boolean;
  selected: boolean;
  isToday: boolean;
  context: ControlContext;
  contextReason: string;
  semantic: string;
  filterReason?: string;
}

export type TargetControl = PageControl;

export type SessionPhase =
  | "greeting"
  | "reading"
  | "ready"
  | "composing"
  | "reviewing"
  | "read-blocked"
  | "ended";

export type PageState = "readable" | "rechecking" | "changed" | "unsupported" | "restricted";

export type DialogueMode = "rule-demo" | "online-model";

export type VoiceState = "disabled" | "available" | "unsupported" | "denied";

export type ResponseType = "direct-answer" | "clarify" | "next-step" | "cannot-answer";

export type NoticeKind =
  | "page-changed"
  | "rechecking"
  | "recheck-done"
  | "booking-complete"
  | "citation-stale"
  | "read-failed"
  | "goal-restored"
  | "voice-disabled";

export type BookingSuccessReason =
  | "read-failed"
  | "path-mismatch"
  | "title-mismatch"
  | "title-not-visible";

export interface BookingSuccessSignals {
  droppedHidden?: number;
  iframeCount?: number;
  openShadowRoots?: number;
  snapshotTruncated?: boolean;
}

export interface BookingCheck {
  result: "passed" | "failed";
  reason: BookingSuccessReason | null;
  snapshotId: string;
  checkedAt: number;
}

export type StepState =
  | "pending"
  | "current"
  | "needs-review"
  | "done-verified"
  | "done-user-unverified"
  | "blocked"
  | "superseded"
  | "abandoned";

export type PlanStatus = "active" | "superseded" | "abandoned" | "completed";

export type CompletionKind =
  | "text-appears"
  | "element-appears"
  | "element-disappears"
  | "url-changed"
  | "control-state-changed"
  | "time-controls-appear"
  | "control-selected"
  | "form-controls-appear"
  | "user-confirmed";

export type LimitationReason =
  | "no-evidence"
  | "read-only-boundary"
  | "cross-origin"
  | "iframe-or-map"
  | "login-or-captcha"
  | "read-failed"
  | "low-confidence";

export type IntentKind =
  | "safety-boundary"
  | "task-switch"
  | "process-goal"
  | "context-feedback"
  | "page-fact"
  | "ellipsis-reference"
  | "fallback-clarify";

export type GoalSlot =
  | "object"
  | "condition"
  | "material"
  | "location"
  | "time"
  | "contact"
  | "amount"
  | "action";

export type RejectReason =
  | "citation-missing"
  | "citation-mismatch"
  | "citation-too-broad"
  | "citation-role-invalid"
  | "fact-unsupported"
  | "scope-dropped"
  | "conflict-adjudicated"
  | "answer-too-long"
  | "citation-count-invalid"
  | "control-invalid"
  | "completion-invalid"
  | "mode-mismatch"
  | "low-confidence";

export type Slots = Partial<Record<GoalSlot, string>>;

export interface ClarifyPrompt {
  question: string;
  options?: string[];
}

export interface Limitation {
  reason: LimitationReason;
  advice: string;
}

interface DialogueMessageBase {
  messageId: string;
  turnId: string;
  createdAt: number;
  snapshotId: string;
}

export interface UserMessage extends DialogueMessageBase {
  role: "user";
  kind: "utterance";
  text: string;
  redacted: boolean;
}

export interface AssistantMessage extends DialogueMessageBase {
  role: "assistant";
  kind: "response";
  responseType: ResponseType;
  text: string;
  validation: "passed" | "rejected";
  rejectReason?: RejectReason;
  citations: CitationAnchor[];
  targetControl?: TargetControl;
  completionCondition?: CompletionCondition;
  clarify?: ClarifyPrompt;
  limitation?: Limitation;
  diagnostics: EngineDiagnostics;
  canRetry?: boolean;
}

export interface SystemNotice extends DialogueMessageBase {
  role: "system";
  kind: "system";
  noticeKind: NoticeKind;
  text: string;
}

export type DialogueMessage = UserMessage | AssistantMessage | SystemNotice;

export interface CompletionCondition {
  kind: CompletionKind;
  expectedText?: string;
  controlRef?: ElementRef;
}

export interface GuideStep {
  stepId: string;
  index: number;
  goal: string;
  redactedUrl: string;
  observedState: string;
  state: StepState;
  evidence: string;
  targetControl: TargetControl;
  completion: CompletionCondition;
}

export interface GuidePlan {
  planId: string;
  version: number;
  goal: string;
  status: PlanStatus;
  steps: GuideStep[];
  currentIndex: number;
}

export interface PlanPatch {
  kind: "create" | "advance" | "supersede" | "abandon" | "complete";
  plan: GuidePlan;
}

export interface ConversationContextTurn {
  role: "user" | "assistant";
  responseType?: ResponseType;
  slots?: Slots;
  summary: string;
}

export interface ConversationContext {
  recent: ConversationContextTurn[];
  currentGoal: string;
  currentStepGoal?: string;
  currentStepState?: StepState;
  pageChanged: boolean;
  lastObject?: string;
  lastMaterial?: string;
}

export interface PageContext {
  snapshotId: string;
  url: string;
  domain: string;
  title: string;
  readable: boolean;
  capturedAt: number;
  iframeCount: number;
}

export interface DialogueCapabilities {
  modelConfigured: boolean;
  voiceEnabled: boolean;
}

export interface DialogueRequest {
  schemaVersion: 1;
  turnId: string;
  utterance: string;
  context: ConversationContext;
  page: PageContext;
  segments: SemanticSegment[];
  controls: PageControl[];
  plan: GuidePlan | null;
  capabilities: DialogueCapabilities;
}

export interface DialogueResponse {
  responseType: ResponseType;
  text: string;
  citations: CitationAnchor[];
  targetControl?: TargetControl;
  completionCondition?: CompletionCondition;
  clarify?: ClarifyPrompt;
  limitation?: Limitation;
  planPatch?: PlanPatch;
  diagnostics: EngineDiagnostics;
}

export interface EngineDiagnostics {
  mode: DialogueMode;
  engineMs: number;
  retrievedSegments: number;
  citationCount: number;
  intentKind: IntentKind;
  priorityHit: string;
  rejectReason?: RejectReason;
  outboundBytes: number;
  sensitiveDetected: boolean;
}

export interface ValidationResult {
  status: "passed" | "rejected";
  reason?: RejectReason;
}

export interface ConversationDiagnostics {
  turnId: string;
  mode: DialogueMode;
  readMs: number;
  engineMs: number;
  itemCount: number;
  segmentCount: number;
  controlCount: number;
  citationCount: number;
  validation: "passed" | "rejected";
  rejectReason?: RejectReason;
  outboundBytes: number;
  sensitiveDetected: boolean;
}