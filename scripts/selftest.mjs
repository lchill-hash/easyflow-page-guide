import test, { after } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as proxyLib from "./model-proxy-lib.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const tempDir = await mkdtemp(join(tmpdir(), "easyflow-selftest-"));
const outfile = join(tempDir, "bundle.mjs");

await build({
  absWorkingDir: root,
  stdin: {
    contents: [
      'export { matchGoal, ruleMatcher, normalizeGoal } from "./src/sidepanel/match/ruleMatcher.ts";',
      'export { buildSummary, buildExcerpt } from "./src/sidepanel/match/summarize.ts";',
      'export { normalizeText, isMeaningfulText } from "./src/content/normalize.ts";',
      'export { textHash, isValidDomPath, normalizeWhitespace } from "./src/shared/domPath.ts";',
      'export { applyBudget, isSelectedControl } from "./src/content/collect.ts";',
      'export { mergeLineBoxes } from "./src/content/highlight.ts";',
      'export { buildSegments } from "./src/content/semantic.ts";',
      'export { ruleEngine } from "./src/sidepanel/dialogue/rule/RuleEngine.ts";',
      'export { validateResponse } from "./src/sidepanel/dialogue/validate/validator.ts";',
      'export { evaluateCompletion } from "./src/sidepanel/guide/completion.ts";',
      'export { createPlan, replan, advancePlan, isBookingPlan, completeBookingPlan, reconcileBookingPlan, locateTargetInSnapshot, relocate, timePreferenceOf, parseClockMinutes } from "./src/sidepanel/guide/stepPlanner.ts";',
      'export { evaluateBookingSuccess, isBookingSuccessPage, buildBookingDoneResponse, buildBookingUnconfirmedResponse, buildBookingAfterSuccessResponse, buildSuccessCitation, BOOKING_SUCCESS_TITLES, BOOKING_COMPLETE_NOTICE, normalizeSuccessTitle } from "./src/sidepanel/guide/bookingSuccess.ts";',
      'export { classifyIntent, isCompletionUtterance } from "./src/sidepanel/dialogue/intent/classifier.ts";',
      'export { resolveStepCardMode, stepCardActions, shouldShowCompletion, stepCardLabel, stepCardLayout, stepCardStateTag } from "./src/sidepanel/components/chat/stepCardModel.ts";',
      'export { buildStepCardCopy, completionTextOf, extractTimeToken, extractDateToken, extractTimeZoneToken, estimateCopyWidth, resolveCopySource } from "./src/sidepanel/components/chat/stepCardCopy.ts";',
      'export { stripDuplicateStepText, STEP_LEAD_PATTERNS } from "./src/sidepanel/components/chat/messageText.ts";',
      'export { mergeTranscript, checkSpeakText, pickChineseVoice, detectRecognitionSupport, detectSynthesisSupport, mapRecognitionError } from "./src/shared/speech/policy.ts";',
      'export { createVoiceInputState, voiceInputReducer, describeVoiceInput } from "./src/shared/speech/voiceMachine.ts";',
      'export { createSpeakState, speakReducer, speakKeyOf, describeSpeak } from "./src/shared/speech/speakMachine.ts";',
      'export { VoiceController } from "./src/sidepanel/speech/voiceController.ts";',
      'export { SpeechController } from "./src/sidepanel/speech/speechController.ts";',
      'export { VOICE_STATUS_TEXT, VOICE_ISSUE_TEXT, VOICE_BUTTON_TEXT, SPEECH_DISCLOSURE_TEXT, SPEAK_LABELS, SPEAK_NOTE_TEXT, VOICE_DISALLOWED_WORDS, MIC_PERMISSION_DENIED_TEXT, MIC_ENTRY_LABEL, MIC_ENTRY_PURPOSE_TEXT, MIC_PERMISSION_STATE_TEXT, MIC_SETTING_HELP_TEXT, MIC_PAGE_TEXTS, MIC_PAGE_OPEN_FAILED_TEXT, MIC_PAGE_OPENED_TEXT } from "./src/shared/speech/copy.ts";',
      'export { SPEECH_LANG, SPEECH_RATE, SPEECH_REPEAT_WINDOW_MS, SPEECH_NO_RESULT_TIMEOUT_MS, MIC_PERMISSION_PAGE_PATH, MIC_PAGE_DEDUPE_GUARD_MS, MIC_PERMISSION_RECHECK_MIN_MS } from "./src/shared/speech/constants.ts";',
      'export { mapPermissionState, mapMicRequestError, toPermissionState, releaseStream, MIC_PERMISSION_STATES, MIC_REQUEST_OUTCOMES } from "./src/shared/speech/permission.ts";',
      'export { createMicPermissionProbe, readMicPermissions } from "./src/sidepanel/speech/microphone.ts";',
      'export { createMicPermissionPage, readMicRuntime } from "./src/sidepanel/speech/micPage.ts";',
      'export { MSG, isMicPermissionResult, createMicPermissionResult, MIC_RESULT_KINDS } from "./src/shared/messages.ts";',
      'export { deriveMicPageView } from "./src/mic-permission/pageView.ts";',
      'export { readMediaDevices, requestMicrophone } from "./src/mic-permission/request.ts";',
      'export { MAX_TURN_CHARS } from "./src/shared/constants.ts";',
      'export { normalizeUiMode, parseStoredUiMode, serializeUiMode } from "./src/shared/uiMode.ts";',
      'export { mapRawErrorKind, rawKindOfSpeechError, resolveRecognitionFailure } from "./src/shared/speech/policy.ts";',
      'export { LOCAL_AVAILABILITY_STATES, INSTALL_STATES, INSTALL_OUTCOMES, mapLocalAvailability, mapInstallResult, mapInstallOutcome, installStateOf } from "./src/shared/speech/localCapability.ts";',
      'export { describeSpeechDiagnostics, formatRelativeTime, PERMISSION_DIAG_LABEL, RAW_ERROR_LABEL, RAW_ERROR_CODE_LABEL, LOCAL_AVAILABILITY_LABEL, INSTALL_STATE_LABEL, ONSTART_LABEL } from "./src/shared/speech/diagnostics.ts";',
      'export { speechIssueText, SPEECH_NO_SPEECH_TEXT, SPEECH_GENERIC_FAILED_TEXT, SPEECH_NETWORK_GRANTED_TEXT, SPEECH_NETWORK_UNKNOWN_TEXT, SPEECH_NOT_ALLOWED_GRANTED_TEXT, SPEECH_MODE_TEXTS, SPEECH_LOCAL_TEXTS, SPEECH_DIAGNOSTICS_TEXTS, SPEAK_UNAVAILABLE_KIND_TEXT, INSTALL_OUTCOME_TEXTS, INSTALL_ERROR_TEXTS } from "./src/shared/speech/copy.ts";',
      'export { LOCAL_CAPABILITY_TIMEOUT_MS, LOCAL_CAPABILITY_CACHE_MS, LOCAL_AVAILABILITY_LANGS, LOCAL_INSTALL_LANGS, INSTALL_ERROR_BRIEF_MAX_CHARS, INSTALL_ERROR_INPUT_MAX_CHARS, DIAGNOSTICS_SERIALIZED_MAX_CHARS } from "./src/shared/speech/constants.ts";',
      'export { CONTENT_VERSION, HIGHLIGHT_TTL_MS, HIGHLIGHT_PULSE_DURATION_MS, HIGHLIGHT_PULSE_COUNT, HIGHLIGHT_STATIC_MIN_MS, HIGHLIGHT_BOX_POOL_MAX, HIGHLIGHT_HOST_ATTR, HIGHLIGHT_ROUND_ATTR, HIGHLIGHT_STATS_SERIALIZED_MAX_CHARS } from "./src/shared/constants.ts";',
      'export { createRoundState, reduceRound, isPulsing, pulseTotalMs } from "./src/content/highlightRound.ts";',
      'export { mapRawErrorCode } from "./src/shared/speech/policy.ts";',
      'export { INSTALL_ERROR_NAMES, normalizeInstallErrorName, sanitizeInstallErrorBrief, readInstallErrorDetail, describeInstallOutcomeText } from "./src/shared/speech/installReport.ts";',
      'export { DIAGNOSTIC_FORBIDDEN_WORDS, AUDIO_DATA_FORBIDDEN_WORDS, INSTALL_BRIEF_FORBIDDEN_WORDS, ALLOWED_DIAGNOSTIC_AUDIO_VALUE } from "./src/shared/speech/forbidden.ts";',
      'export { readLocalRecognitionApi, createLocalCapabilityProbe, createLocalInstaller } from "./src/sidepanel/speech/localCapability.ts";',
      'export { annotateControls } from "./src/content/controls.ts";',
      'export { detectSensitive } from "./src/shared/privacy/detect.ts";',
      'export { redactText, sanitizeOutbound, redactUrl } from "./src/shared/privacy/redact.ts";',
      'export { ModelDialogueEngine } from "./src/sidepanel/dialogue/model/ModelEngine.ts";',
      'export { conversationReducer, createConversationState } from "./src/sidepanel/state/conversationReducer.ts";',
      'export { extractReusableObject, sanitizeReusableObject } from "./src/sidepanel/dialogue/context/topic.ts";',
      'export { detectNameRisk, redactLabeledNames, sanitizeNameText } from "./src/shared/privacy/name.ts";',
      'export { ModelFallbackError, shouldUseOnlineModel, fallbackNotice, fallbackReasonOf } from "./src/shared/model/fallback.ts";',
      'export { PROXY_CONTRACT } from "./src/shared/privacy/redact.ts";',
      'export { BRAND_NAME, BRAND_TAGLINE, BRAND_PAGE_TITLE, BRAND_MIC_TITLE, BRAND_INSTALL_TITLE } from "./src/shared/brand.ts";',
      'export { INPUT_MIN_ROWS, INPUT_MAX_ROWS, INPUT_MAX_VIEWPORT_RATIO, COMPOSER_MAX_VIEWPORT_RATIO } from "./src/sidepanel/layout/constants.ts";',
      'export { buildTaskProgress } from "./src/sidepanel/guide/taskProgress.ts";',
    ].join("\n").replaceAll('from "./', `from "${root.replaceAll("\\", "/")}/`),
    resolveDir: root,
    sourcefile: "selftest-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile,
  logLevel: "silent",
});

const ef = await import(pathToFileURL(outfile).href);

after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function makeItem(index, text, overrides = {}) {
  return {
    elementId: `ef-p-${index}`,
    type: "paragraph",
    text,
    textLength: text.length,
    truncated: false,
    order: index,
    region: "main",
    domPath: `article:nth-of-type(1) > p:nth-of-type(${index})`,
    textHash: ef.textHash(text),
    tagName: "p",
    ...overrides,
  };
}

function makeSnapshot(items, title = "示例页面") {
  return {
    snapshotId: "snap-selftest",
    runId: "run-selftest",
    schemaVersion: 1,
    url: "https://example.test/page",
    origin: "https://example.test",
    domain: "example.test",
    title,
    titleMissing: false,
    capturedAt: Date.now(),
    itemCount: items.length,
    items,
    truncated: false,
  };
}

const goal = "我想知道示例条款的申请条件和线下办理方式";

test("T-03：至少 3 条相关条目生成 3 张卡片且按分数降序", () => {
  const items = [
    makeItem(1, "示例条款甲：申请条件包括示例资格与示例要求。"),
    makeItem(2, "示例条款乙：线下办理可到示例窗口现场受理。"),
    makeItem(3, "示例条款丙：办理流程按示例步骤执行。"),
  ];
  const result = ef.matchGoal(goal, makeSnapshot(items), performance.now());
  assert.equal(result.status, "success");
  assert.ok(result.cards.length >= 3 && result.cards.length <= 5);
  for (let index = 1; index < result.cards.length; index += 1) {
    assert.ok(result.cards[index - 1].score >= result.cards[index].score);
  }
});

test("T-04：无关目标返回 no-evidence 且卡片为 0", () => {
  const items = [
    makeItem(1, "示例条款甲：申请条件包括示例资格与示例要求。"),
    makeItem(2, "示例条款乙：线下办理可到示例窗口现场受理。"),
  ];
  const result = ef.matchGoal("量子计算芯片散热方案", makeSnapshot(items), performance.now());
  assert.equal(result.status, "no-evidence");
  assert.equal(result.cards.length, 0);
  assert.equal(result.message, "当前页面未找到依据");
});

test("T-05：仅 2 条命中返回 partial 与实际卡片数", () => {
  const items = [
    makeItem(1, "示例条款甲：申请条件包括示例资格。"),
    makeItem(2, "示例条款乙：线下办理可到窗口。"),
  ];
  const result = ef.matchGoal(goal, makeSnapshot(items), performance.now());
  assert.equal(result.status, "partial");
  assert.equal(result.cards.length, 2);
  assert.equal(result.message, "仅找到少量相关片段");
});

test("T-06：空目标、仅停用词、超长目标均返回 invalid-goal", () => {
  const snapshot = makeSnapshot([makeItem(1, "示例条款甲：申请条件包括示例资格。")]);
  const empty = ef.matchGoal("   ", snapshot, performance.now());
  const stopOnly = ef.matchGoal("我想知道怎么如何请问", snapshot, performance.now());
  const tooLong = ef.matchGoal("甲".repeat(201), snapshot, performance.now());
  assert.equal(empty.status, "invalid-goal");
  assert.equal(stopOnly.status, "invalid-goal");
  assert.equal(tooLong.status, "invalid-goal");
  assert.equal(empty.cards.length, 0);
  assert.equal(stopOnly.cards.length, 0);
  assert.equal(tooLong.cards.length, 0);
});

test("T-07：父子重复条目去重后只保留 1 条", () => {
  const text = "示例条款甲：申请条件包括示例资格与示例要求。";
  const items = [
    makeItem(1, text),
    makeItem(1, text, {
      elementId: "ef-p-2",
      order: 2,
      domPath: "article:nth-of-type(1) > p:nth-of-type(1) > span:nth-of-type(1)",
      tagName: "span",
      type: "paragraph",
    }),
  ];
  const result = ef.matchGoal(goal, makeSnapshot(items), performance.now());
  assert.equal(result.cards.length, 1);
  assert.equal(result.status, "partial");
});

test("T-08：空白归一化与超长截断", () => {
  const normalized = ef.normalizeText("\u00a0示例\u3000条款\u0020\n\n甲");
  assert.equal(normalized.text, "示例 条款 甲");
  assert.equal(normalized.truncated, false);

  const longText = ef.normalizeText("甲".repeat(400), 300);
  assert.equal(longText.text.length, 300);
  assert.equal(longText.truncated, true);
  assert.ok(longText.text.endsWith("…"));

  assert.equal(ef.isMeaningfulText("……"), false);
  assert.equal(ef.isMeaningfulText("甲"), false);
  assert.equal(ef.isMeaningfulText("甲", true), true);
});

test("T-09：3001 条条目按预算截断为 3000 条", () => {
  const items = Array.from({ length: 3001 }, (_, index) =>
    makeItem(index + 1, `示例条目${index + 1}`, { elementId: `ef-p-${index + 1}` }),
  );
  const result = ef.applyBudget(items, 3000, 400000);
  assert.equal(result.items.length, 3000);
  assert.equal(result.truncated, true);
  assert.equal(result.droppedByBudget, 1);
});

test("T-10：DOM 路径白名单与文本哈希稳定性", () => {
  assert.equal(ef.isValidDomPath("article:nth-of-type(1) > p:nth-of-type(2)"), true);
  assert.equal(ef.isValidDomPath("article:nth-of-type(1) > p:nth-of-type(2) > script"), true);
  assert.equal(ef.isValidDomPath('div[data-x="1"]'), false);
  assert.equal(ef.isValidDomPath("div > "), false);
  assert.equal(ef.isValidDomPath("div:nth-of-type(1) > :nth-child(2)"), false);
  assert.equal(ef.textHash("示例文本"), ef.textHash("示例文本"));
  assert.notEqual(ef.textHash("示例文本"), ef.textHash("示例文本甲"));
});

test("摘要与片段必须来自原文且长度受限", () => {
  const source = "第一部分说明文字用于占位。示例条款甲：申请条件包括示例资格与示例要求，办理时请携带示例材料。";
  const summary = ef.buildSummary(source, ["申请条件"]);
  assert.ok(summary.length <= 40);
  const core = summary.replace(/^…/, "").replace(/…$/, "");
  assert.ok(source.includes(core));

  const excerpt = ef.buildExcerpt("乙".repeat(500));
  assert.ok(excerpt.text.length <= 240);
  assert.equal(excerpt.truncated, true);
});
test("高亮行框合并：同一行合并，跨行与远距离分栏保留", () => {
  const merged = ef.mergeLineBoxes([
    { left: 10, top: 20, width: 40, height: 18 },
    { left: 52, top: 21, width: 30, height: 18 },
    { left: 10, top: 44, width: 80, height: 18 },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].left, 10);
  assert.equal(merged[0].top, 20);
  assert.equal(merged[0].width, 72);
  assert.equal(merged[1].top, 44);

  const separate = ef.mergeLineBoxes([
    { left: 0, top: 0, width: 10, height: 10 },
    { left: 40, top: 0, width: 10, height: 10 },
  ]);
  assert.equal(separate.length, 2);
});
function makeRef(item) {
  return {
    elementId: item.elementId,
    domPath: item.domPath,
    textHash: item.textHash,
  };
}

function makePageSnapshot(items, extras = {}) {
  const snapshot = makeSnapshot(items, extras.title ?? "示例页面");
  snapshot.segments = extras.segments ?? [];
  snapshot.controls = extras.controls ?? [];
  if (extras.url !== undefined) {
    snapshot.url = extras.url;
  }
  return snapshot;
}

function makeSegment(index, titleItem, bodyItems) {
  const bodyTexts = bodyItems.map((item) => item.text);
  return {
    segmentId: `seg-${index}`,
    text: [titleItem.text, ...bodyTexts].join(" "),
    titleRef: makeRef(titleItem),
    titleText: titleItem.text,
    bodyRefs: bodyItems.map(makeRef),
    bodyTexts,
    truncated: false,
    hasBody: bodyTexts.length > 0,
    region: titleItem.region,
    orderRange: [titleItem.order, bodyItems[bodyItems.length - 1]?.order ?? titleItem.order],
    scopeHints: [],
    scopeConflict: false,
  };
}

function makeControl(index, label, controlType, overrides = {}) {
  return {
    controlId: `ctl-${index}`,
    ref: {
      elementId: `ef-${controlType === "button" ? "b" : controlType === "link" ? "l" : "i"}-${index}`,
      domPath: `main:nth-of-type(1) > ${controlType}:nth-of-type(${index})`,
      textHash: "ctl-hash",
    },
    label,
    controlType,
    visibility: "visible",
    riskFlags: [],
    region: "main",
    ambiguous: false,
    ...overrides,
  };
}

function makeRequest(utterance, snapshot, options = {}) {
  return {
    schemaVersion: 1,
    turnId: "turn-selftest",
    utterance,
    context: {
      recent: [],
      currentGoal: "",
      pageChanged: false,
      ...(options.context ?? {}),
    },
    page: {
      snapshotId: snapshot.snapshotId,
      url: snapshot.url,
      domain: snapshot.domain,
      title: snapshot.title,
      readable: true,
      capturedAt: snapshot.capturedAt,
      iframeCount: 0,
    },
    segments: snapshot.segments ?? [],
    controls: snapshot.controls ?? [],
    plan: options.plan ?? null,
    capabilities: { modelConfigured: false, voiceEnabled: false },
  };
}

test("AT-01 直接回答必须有当前页原文依据且可校验", async () => {
  const title = makeItem(1, "办理条件：", {
    type: "heading",
    elementId: "ef-h-1",
    titleCandidate: true,
    domPath: "article:nth-of-type(1) > h2:nth-of-type(1)",
  });
  const body = makeItem(2, "示例对象为年满60周岁、具有示例区户籍的申请人。", {
    type: "paragraph",
    elementId: "ef-p-1",
    domPath: "article:nth-of-type(1) > p:nth-of-type(1)",
  });
  const segment = makeSegment(1, title, [body]);
  const snapshot = makePageSnapshot([title, body], { segments: [segment] });
  const result = await ef.ruleEngine.respond(makeRequest("谁能申请", snapshot));

  assert.equal(result.responseType, "direct-answer");
  assert.ok(result.citations.length >= 1);
  assert.ok(result.text.length <= 180);
  assert.ok(result.citations.every((citation) => snapshot.items.some((item) => item.elementId === citation.ref.elementId)));
  const validation = ef.validateResponse(result, snapshot, null);
  assert.equal(validation.status, "passed");
});

test("AT-04 语义段按标题与紧随正文聚合、不跨段", () => {
  const items = [
    makeItem(1, "办理条件：", {
      type: "heading",
      elementId: "ef-h-1",
      titleCandidate: true,
      domPath: "article:nth-of-type(1) > h2:nth-of-type(1)",
    }),
    makeItem(2, "示例正文甲。", {
      elementId: "ef-p-1",
      domPath: "article:nth-of-type(1) > p:nth-of-type(1)",
    }),
    makeItem(3, "办理材料：", {
      type: "heading",
      elementId: "ef-h-2",
      titleCandidate: true,
      domPath: "article:nth-of-type(1) > h2:nth-of-type(2)",
    }),
    makeItem(4, "示例正文乙。", {
      elementId: "ef-p-2",
      domPath: "article:nth-of-type(1) > p:nth-of-type(2)",
    }),
  ];
  const segments = ef.buildSegments(items);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].titleRef.elementId, "ef-h-1");
  assert.equal(segments[0].bodyRefs.length, 1);
  assert.equal(segments[1].titleRef.elementId, "ef-h-2");
  assert.ok(segments[0].text.includes("示例正文甲"));
  assert.ok(!segments[0].text.includes("示例正文乙"));
});

test("AT-05 连续追问使用上文对象回答材料问题", async () => {
  const title = makeItem(1, "申请材料：", {
    type: "heading",
    elementId: "ef-h-1",
    titleCandidate: true,
    domPath: "article:nth-of-type(1) > h2:nth-of-type(1)",
  });
  const body = makeItem(2, "示例材料包括示例证件和示例复印件。", {
    elementId: "ef-p-1",
    domPath: "article:nth-of-type(1) > p:nth-of-type(1)",
  });
  const segment = makeSegment(1, title, [body]);
  const snapshot = makePageSnapshot([title, body], { segments: [segment] });
  const result = await ef.ruleEngine.respond(
    makeRequest("那需要带什么", snapshot, {
      context: {
        currentGoal: "高龄津贴",
        lastObject: "高龄津贴",
      },
    }),
  );
  assert.equal(result.responseType, "direct-answer");
  assert.ok(result.text.includes("材料") || result.text.includes("证件"));
  assert.ok(result.citations.length >= 1);
});

test("AT-07 安全性优先于同句事实询问", async () => {
  const title = makeItem(1, "办理条件：", {
    type: "heading",
    elementId: "ef-h-1",
    titleCandidate: true,
  });
  const body = makeItem(2, "示例对象为申请人。");
  const snapshot = makePageSnapshot([title, body], {
    segments: [makeSegment(1, title, [body])],
  });
  const result = await ef.ruleEngine.respond(makeRequest("帮我提交，谁能申请", snapshot));
  assert.equal(result.responseType, "cannot-answer");
  assert.equal(result.limitation.reason, "read-only-boundary");
  assert.equal(result.citations.length, 0);
});

test("AT-10/11 完成判定只认页面信号或用户确认", () => {
  const control = makeControl(1, "查询", "button");
  const step = {
    stepId: "step-1",
    index: 0,
    goal: "点击查询",
    redactedUrl: "https://example.test/a",
    observedState: "页面有查询按钮",
    state: "current",
    evidence: "",
    targetControl: control,
    completion: { kind: "text-appears", expectedText: "查询结果" },
  };
  const unrelated = makePageSnapshot([makeItem(1, "示例无关内容。")]);
  assert.equal(ef.evaluateCompletion(step, unrelated, false).status, "unconfirmed");
  assert.equal(ef.evaluateCompletion(step, unrelated, true).status, "done-user-unverified");
  const appeared = makePageSnapshot([makeItem(1, "查询结果：示例网点。")]);
  assert.equal(ef.evaluateCompletion(step, appeared, false).status, "done-verified");
});

test("AT-16 页面切换保留消息并将引用标记失效", () => {
  const snapshot = makePageSnapshot([makeItem(1, "示例正文。")]);
  const initial = ef.createConversationState();
  const message = {
    messageId: "msg-1",
    turnId: "turn-1",
    role: "assistant",
    kind: "response",
    createdAt: 1,
    snapshotId: snapshot.snapshotId,
    responseType: "direct-answer",
    text: "示例回答。",
    validation: "passed",
    citations: [
      {
        citationId: "cite-1",
        segmentId: "seg-1",
        role: "body",
        text: "示例正文。",
        start: 0,
        end: 5,
        status: "valid",
        ref: makeRef(snapshot.items[0]),
      },
    ],
    diagnostics: {
      mode: "rule-demo",
      engineMs: 1,
      retrievedSegments: 1,
      citationCount: 1,
      intentKind: "page-fact",
      priorityHit: "test",
      outboundBytes: 0,
      sensitiveDetected: false,
    },
  };
  let state = ef.conversationReducer(initial, { type: "assistant-add", message });
  state = ef.conversationReducer(state, { type: "page-changed" });
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].citations[0].status, "stale");
  assert.equal(state.pageState, "changed");
});

test("AT-17/19 敏感值不进入脱敏出站，地址去掉查询串", () => {
  const hits = ef.detectSensitive("联系电话13800138000，证件110101199001011234");
  assert.ok(hits.length >= 2);
  assert.ok(!ef.redactText("联系电话13800138000").includes("13800138000"));
  assert.equal(ef.redactUrl("https://example.test/a?token=secret#x"), "https://example.test/a");

  const source = {
    utterance: "我手机号13800138000",
    domain: "example.test",
    title: "示例页面",
    url: "https://example.test/a?token=secret",
    segments: [],
    controls: [],
    slots: { object: "13800138000" },
  };
  const outbound = ef.sanitizeOutbound(source);
  assert.equal(outbound.status, "pass");
  assert.ok(!outbound.payload.utterance.includes("13800138000"));
  assert.ok(!JSON.stringify(outbound.payload).includes("13800138000"));
  assert.equal(outbound.payload.page.url, "https://example.test/a");

  const blocked = ef.sanitizeOutbound({
    ...source,
    utterance: "普通问题",
    slots: {},
    segments: [
      {
        segmentId: "seg-html",
        text: "<script>示例</script>",
        titleRef: { elementId: "ef-h-1", domPath: "article:nth-of-type(1)", textHash: "x" },
        titleText: "标题",
        bodyRefs: [],
        bodyTexts: [],
        truncated: false,
        hasBody: false,
        region: "main",
        orderRange: [1, 1],
        scopeHints: [],
        scopeConflict: false,
      },
    ],
  });
  assert.equal(blocked.status, "blocked");
});

test("AT-21/22 在线模型代理响应与非法引用被拒绝", async () => {
  const snapshot = makePageSnapshot([makeItem(1, "示例正文。")]);
  const model = new ef.ModelDialogueEngine();
  const originalFetch = globalThis.fetch;
  let outboundBody = "";
  globalThis.fetch = async (_url, options) => {
    outboundBody = String(options.body);
    return { ok: true, json: async () => ({ result: {
      kind: "clarify", answer: "请告诉我想了解什么。", evidence: [], question: "你想了解哪一项？",
    } }) };
  };
  let response;
  try {
    response = await model.respond(makeRequest("示例问题", snapshot));
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(response.responseType, "clarify");
  assert.equal(response.diagnostics.mode, "online-model");
  assert.ok(response.diagnostics.outboundBytes > 0);
  assert.ok(!outboundBody.includes("<html"));

  const invalid = {
    responseType: "direct-answer",
    text: "示例回答。",
    citations: [
      {
        citationId: "cite-bad",
        segmentId: "seg-bad",
        role: "body",
        text: "示例正文。",
        start: 0,
        end: 5,
        status: "valid",
        ref: { elementId: "ef-p-999", domPath: "article:nth-of-type(1)", textHash: "x" },
      },
    ],
    diagnostics: response.diagnostics,
  };
  const validation = ef.validateResponse(invalid, snapshot, null);
  assert.equal(validation.status, "rejected");
  assert.equal(validation.reason, "citation-missing");
});

test("AT-115 云端模型只接受当前页精确引用，步骤由本地引擎处理", async () => {
  const title = makeItem(1, "办理条件", { type: "heading", elementId: "ef-h-1" });
  const body = makeItem(2, "年满80周岁可以申请。", { elementId: "ef-p-2" });
  const safe = makeControl(1, "选择日期", "button", { kind: "date" });
  const disabled = makeControl(2, "已约满", "button", { kind: "time", disabled: true });
  const snapshot = makePageSnapshot([title, body], {
    segments: [makeSegment(1, title, [body])], controls: [safe, disabled],
  });
  const originalFetch = globalThis.fetch;
  let reply = { kind: "answer", answer: "年满80周岁可以申请。", evidence: [{segmentId:"seg-1",quote:"年满80周岁可以申请。"}] };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: reply }) });
  try {
    const model = new ef.ModelDialogueEngine();
    const request = makeRequest("申请条件是什么", snapshot);
    const answer = await model.respond(request);
    assert.equal(answer.responseType, "direct-answer");
    assert.equal(ef.validateResponse(answer, snapshot, null).status, "passed");
    reply = { kind: "step", text: "请先选择日期。", controlId: safe.controlId };
    await assert.rejects(() => model.respond(request), /model-fallback:/);
    reply = { kind: "step", text: "请选择已约满时段。", controlId: disabled.controlId };
    await assert.rejects(() => model.respond(request), /model-fallback:/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("AT-13/14 陪办计划生成与重规划", () => {
  const controls = [
    makeControl(1, "所在城市", "input-label"),
    makeControl(2, "网点类型", "input-label"),
    makeControl(3, "查询", "button"),
  ];
  const snapshot = makePageSnapshot([], { controls });
  const planned = ef.createPlan("第一次办借记卡，先找营业网点", snapshot);
  assert.ok(planned.plan);
  assert.equal(planned.plan.steps.length, 3);
  assert.equal(planned.plan.steps[0].targetControl.label, "所在城市");
  assert.equal(planned.plan.steps[1].targetControl.label, "网点类型");
  assert.equal(planned.plan.steps[2].completion.kind, "text-appears");

  const replanned = ef.replan(planned.plan.goal, snapshot, planned.plan);
  assert.ok(replanned.plan);
  assert.equal(replanned.plan.version, 2);

  const advanced = ef.advancePlan(planned.plan, false);
  assert.equal(advanced.plan.currentIndex, 1);
  assert.equal(advanced.plan.steps[0].state, "done-user-unverified");
});
test("AT-25 申请页字段只读回答与指给我看", async () => {
  const fieldItem = makeItem(1, "手机号", {
    type: "inputLabel",
    elementId: "ef-i-1",
    domPath: "main:nth-of-type(1) > input:nth-of-type(1)",
  });
  const control = makeControl(1, "手机号", "input-label");
  const snapshot = makePageSnapshot([fieldItem], { controls: [control] });

  const asked = await ef.ruleEngine.respond(makeRequest("这个页面要填什么", snapshot));
  assert.equal(asked.responseType, "direct-answer");
  assert.ok(asked.text.includes("手机号"));
  assert.equal(ef.validateResponse(asked, snapshot, null).status, "passed");

  const located = await ef.ruleEngine.respond(makeRequest("指给我看手机号那一栏", snapshot));
  assert.equal(located.responseType, "direct-answer");
  assert.equal(located.citations.length, 1);
  assert.equal(located.citations[0].ref.elementId, "ef-i-1");
});
test("AT-30 真实公开页面捕获快照：两轮话题切换全链路", async () => {
  const captured = JSON.parse(
    await readFile(join(root, "scripts", "fixtures", "bjsjs-captured-items.json"), "utf8"),
  );
  const items = captured.items;
  const segments = ef.buildSegments(items);
  const snapshot = {
    snapshotId: "snap-bjsjs-captured",
    runId: "run-bjsjs-captured",
    schemaVersion: 1,
    url: captured.sourceUrl,
    origin: "https://www.bjsjs.gov.cn",
    domain: captured.domain,
    title: captured.title,
    titleMissing: false,
    capturedAt: Date.now(),
    itemCount: items.length,
    items,
    segments,
    controls: [],
    truncated: false,
  };

  assert.ok(items.some((item) => item.tagName === "div" && item.text.includes("具有本市户籍")));
  assert.ok(segments.some((segment) => segment.titleText.includes("办理条件") && segment.hasBody));
  assert.ok(segments.some((segment) => segment.titleText.includes("办理流程") && segment.hasBody));

  const q1 = await ef.ruleEngine.respond(makeRequest("高龄津贴谁能申请", snapshot));
  assert.equal(q1.responseType, "direct-answer");
  assert.ok(q1.text.includes("本市户籍"));
  assert.ok(q1.text.includes("80周岁"));
  assert.ok(!/日期|来源/.test(q1.text));
  assert.ok(q1.citations.every((citation) => !/^(日期|来源)/.test(citation.text)));
  assert.equal(ef.validateResponse(q1, snapshot, null).status, "passed");

  const savedTopic = ef.extractReusableObject("高龄津贴谁能申请", snapshot.title, undefined);
  assert.equal(savedTopic, "高龄津贴");
  let state = ef.createConversationState();
  state = ef.conversationReducer(state, { type: "last-object", object: savedTopic });
  assert.equal(state.lastObject, "高龄津贴");

  const q2 = await ef.ruleEngine.respond(
    makeRequest("那怎么办理", snapshot, {
      context: { currentGoal: state.lastObject ?? "", lastObject: state.lastObject },
    }),
  );
  assert.equal(q2.responseType, "direct-answer");
  assert.ok(q2.text.includes("网上申请"), q2.text);
  assert.ok(q2.text.includes("现场申请"), q2.text);
  assert.ok(q2.text.includes("身份证") || q2.text.includes("户口簿"));
  assert.ok(!/日期|来源/.test(q2.text));
  assert.ok(q2.citations.every((citation) => !/^(日期|来源)/.test(citation.text)));
  assert.notEqual(q1.text, q2.text);
  assert.notDeepEqual(
    q1.citations.map((citation) => citation.ref.elementId),
    q2.citations.map((citation) => citation.ref.elementId),
  );
  assert.ok(q2.citations.some((citation) => citation.ref.elementId === "ef-p-4"));
  assert.equal(ef.validateResponse(q2, snapshot, null).status, "passed");

  const legacyQ2 = await ef.ruleEngine.respond(
    makeRequest("那怎么办理", snapshot, {
      context: { currentGoal: "高龄津贴谁能申请", lastObject: "高龄津贴谁能申请" },
    }),
  );
  assert.equal(legacyQ2.responseType, "direct-answer");
  assert.ok(legacyQ2.text.includes("网上申请"), legacyQ2.text);
  assert.ok(legacyQ2.text.includes("现场申请"), legacyQ2.text);
  const legacyIds = legacyQ2.citations.map((citation) => citation.ref.elementId);
  assert.ok(legacyIds.includes("ef-p-4"));
  assert.ok(!legacyIds.includes("ef-p-2"));
  assert.ok(!legacyIds.includes("ef-p-3"));
  assert.equal(ef.validateResponse(legacyQ2, snapshot, null).status, "passed");

  const materialTopic = ef.extractReusableObject("那需要带什么", snapshot.title, savedTopic);
  assert.equal(materialTopic, "高龄津贴");
  const q3 = await ef.ruleEngine.respond(
    makeRequest("那需要带什么", snapshot, {
      context: { currentGoal: materialTopic, lastObject: materialTopic },
    }),
  );
  assert.equal(q3.responseType, "direct-answer");
  assert.ok(q3.text.includes("身份证") || q3.text.includes("户口簿"), q3.text);
  assert.ok(!q3.text.includes("100元"), q3.text);
  assert.ok(q3.citations.some((citation) => citation.ref.elementId === "ef-p-7" || citation.ref.elementId === "ef-p-8"));
  assert.equal(ef.validateResponse(q3, snapshot, null).status, "passed");

  const unknown = await ef.ruleEngine.respond(
    makeRequest("体检条件是什么", snapshot, {
      context: { currentGoal: materialTopic, lastObject: materialTopic },
    }),
  );
  assert.equal(unknown.responseType, "cannot-answer");
  assert.ok(unknown.text.includes("没有找到"));
});

test("AT-31 追问话题只保留业务对象，不保存问句", () => {
  assert.equal(ef.sanitizeReusableObject("高龄津贴谁能申请"), "高龄津贴");
  assert.equal(ef.extractReusableObject("高龄津贴谁能申请", "高龄老年人津贴办理指南", undefined), "高龄津贴");
  assert.equal(ef.extractReusableObject("那怎么办理", "高龄老年人津贴办理指南", "高龄津贴"), "高龄津贴");
  assert.equal(ef.extractReusableObject("那需要带什么", "高龄老年人津贴办理指南", "高龄津贴"), "高龄津贴");
  assert.equal(
    ef.extractReusableObject("那怎么办", "高龄老年人津贴办理指南", "高龄津贴谁能申请"),
    "高龄津贴",
  );
  assert.equal(ef.extractReusableObject("怎么办", "", undefined), undefined);
});
function makeBookingContext() {
  return { recent: [], currentGoal: "", pageChanged: false };
}

function makeBookingSignals(controlCount) {
  return { readable: true, segmentCount: 0, controlCount, iframeCount: 0 };
}

test("AT-32 预约意图与日期、时间、个人信息阶段", async () => {
  const goal = "我想预约这个15分钟会议，请一步一步告诉我先点哪里";
  const intentContext = makeBookingContext();
  const signals = makeBookingSignals(5);

  assert.equal(ef.classifyIntent(goal, intentContext, signals).intentKind, "process-goal");
  assert.equal(ef.classifyIntent("这项预约多少钱", intentContext, signals).intentKind, "page-fact");
  assert.equal(ef.classifyIntent("这个会议什么时候", intentContext, signals).intentKind, "page-fact");

  const dateAvailable = makeControl(1, "Monday, November 16, 2026", "button", {
    kind: "date",
    context: "calendar",
  });
  const dateDisabled = makeControl(2, "Tuesday, November 17, 2026", "button", {
    kind: "date",
    context: "calendar",
    disabled: true,
  });
  const dateSnapshot = makePageSnapshot([], { controls: [dateAvailable, dateDisabled] });
  const datePlan = ef.createPlan(goal, dateSnapshot);

  assert.ok(datePlan.plan);
  assert.equal(datePlan.plan.steps[0].targetControl.ref.elementId, "ef-b-1");
  assert.equal(datePlan.plan.steps[0].completion.kind, "time-controls-appear");
  assert.notEqual(datePlan.plan.steps[0].targetControl.ref.elementId, dateDisabled.ref.elementId);

  const dateResponse = await ef.ruleEngine.respond(makeRequest(goal, dateSnapshot));
  assert.equal(dateResponse.responseType, "next-step");
  // 第五轮 R-101：正文不再复述步骤目标；仍断言下一步语义与目标控件。
  assert.ok(dateResponse.text.includes("下一步"));
  assert.equal(dateResponse.targetControl.ref.elementId, "ef-b-1");
  assert.equal(ef.validateResponse(dateResponse, dateSnapshot, null).status, "passed");

  assert.equal(
    ef.evaluateCompletion(datePlan.plan.steps[0], dateSnapshot, false).status,
    "unconfirmed",
  );
  const unrelatedSnapshot = makePageSnapshot([], {
    controls: [dateAvailable, dateDisabled, makeControl(3, "Help", "button")],
  });
  assert.equal(
    ef.evaluateCompletion(datePlan.plan.steps[0], unrelatedSnapshot, false).status,
    "unconfirmed",
  );

  const dateSelected = makeControl(1, "Monday, November 16, 2026", "button", {
    kind: "date",
    context: "calendar",
    selected: true,
  });
  const timeDisabled = makeControl(3, "9:00 AM", "button", {
    kind: "time",
    context: "time-list",
    disabled: true,
  });
  const timeAvailable = makeControl(4, "10:00 AM", "button", {
    kind: "time",
    context: "time-list",
  });
  const timeAlt = makeControl(5, "10:15 AM", "button", {
    kind: "time",
    context: "time-list",
  });
  const timeSnapshot = makePageSnapshot([], {
    controls: [dateSelected, dateDisabled, timeDisabled, timeAvailable, timeAlt],
  });
  assert.equal(
    ef.evaluateCompletion(datePlan.plan.steps[0], timeSnapshot, false).status,
    "done-verified",
  );

  const timePlan = ef.createPlan(goal, timeSnapshot);
  assert.ok(timePlan.plan);
  assert.equal(timePlan.plan.steps[0].targetControl.ref.elementId, "ef-b-4");
  assert.equal(timePlan.plan.steps[0].completion.kind, "control-selected");
  assert.notEqual(
    datePlan.plan.steps[0].targetControl.ref.elementId,
    timePlan.plan.steps[0].targetControl.ref.elementId,
  );

  const timeResponse = await ef.ruleEngine.respond(makeRequest(goal, timeSnapshot));
  assert.equal(timeResponse.responseType, "next-step");
  // 第五轮 R-101：正文不再复述步骤目标；仍断言下一步语义与目标控件。
  assert.ok(timeResponse.text.includes("下一步"));
  assert.equal(timeResponse.targetControl.ref.elementId, "ef-b-4");
  assert.equal(ef.validateResponse(timeResponse, timeSnapshot, null).status, "passed");
  assert.equal(
    ef.evaluateCompletion(timePlan.plan.steps[0], timeSnapshot, false).status,
    "unconfirmed",
  );

  const timeSelected = makeControl(4, "10:00 AM", "button", {
    kind: "time",
    context: "time-list",
    selected: true,
  });
  const formName = makeControl(1, "Name", "input-label", {
    kind: "form",
    context: "form",
    riskFlags: ["personal-info"],
  });
  const formEmail = makeControl(2, "Email", "input-label", {
    kind: "form",
    context: "form",
    riskFlags: ["personal-info"],
  });
  const formSnapshot = makePageSnapshot([], {
    controls: [dateSelected, timeSelected, formName, formEmail, makeControl(9, "Book", "button", { riskFlags: ["submit"] })],
  });
  assert.equal(
    ef.evaluateCompletion(timePlan.plan.steps[0], formSnapshot, false).status,
    "done-verified",
  );
  const formPlan = ef.createPlan(goal, formSnapshot);
  assert.equal(formPlan.plan, null);
  assert.equal(formPlan.failure, "personal-info");
  const formResponse = await ef.ruleEngine.respond(makeRequest(goal, formSnapshot));
  assert.equal(formResponse.responseType, "cannot-answer");
  assert.equal(formResponse.limitation.reason, "read-only-boundary");

  const noTimeSnapshot = makePageSnapshot([], {
    controls: [
      dateSelected,
      timeDisabled,
      makeControl(6, "9:30 AM", "button", {
        kind: "time",
        context: "time-list",
        disabled: true,
      }),
    ],
  });
  const noTimePlan = ef.createPlan(goal, noTimeSnapshot);
  assert.equal(noTimePlan.plan, null);
  assert.equal(noTimePlan.failure, "no-available-times");
  const noTimeResponse = await ef.ruleEngine.respond(makeRequest(goal, noTimeSnapshot));
  assert.equal(noTimeResponse.responseType, "cannot-answer");
  assert.ok(noTimeResponse.text.includes("没有可预约时间"), noTimeResponse.text);

  const allDatesDisabled = makePageSnapshot([], {
    controls: [
      dateDisabled,
      makeControl(7, "Wednesday, November 18, 2026", "button", {
        kind: "date",
        context: "calendar",
        disabled: true,
      }),
    ],
  });
  const noDatePlan = ef.createPlan(goal, allDatesDisabled);
  assert.equal(noDatePlan.plan, null);
  assert.equal(noDatePlan.failure, "no-available-dates");
  const noDateResponse = await ef.ruleEngine.respond(makeRequest(goal, allDatesDisabled));
  assert.equal(noDateResponse.responseType, "cannot-answer");
  assert.ok(noDateResponse.text.includes("日期都不可选"), noDateResponse.text);

  const confirmationSnapshot = makePageSnapshot([], {
    controls: [dateSelected, timeSelected, makeControl(9, "Book", "button", { riskFlags: ["submit"] })],
  });
  const confirmationPlan = ef.createPlan(goal, confirmationSnapshot);
  assert.equal(confirmationPlan.plan, null);
  assert.equal(confirmationPlan.failure, "confirmation");
  const confirmationResponse = await ef.ruleEngine.respond(makeRequest(goal, confirmationSnapshot));
  assert.equal(confirmationResponse.responseType, "cannot-answer");
  assert.equal(confirmationResponse.limitation.reason, "read-only-boundary");
});

test("AT-33 日历控件语义与 DOM fixture", async () => {
  const dateFixture = await readFile(join(root, "scripts", "fixtures", "cal-booking-date.html"), "utf8");
  const timeFixture = await readFile(join(root, "scripts", "fixtures", "cal-booking-time.html"), "utf8");
  const formFixture = await readFile(join(root, "scripts", "fixtures", "cal-booking-form.html"), "utf8");
  const noTimesFixture = await readFile(
    join(root, "scripts", "fixtures", "cal-booking-no-times.html"),
    "utf8",
  );
  assert.ok(dateFixture.includes('data-testid="day"'));
  assert.ok(dateFixture.includes('aria-label="Monday, November 16, 2026"'));
  assert.ok(dateFixture.includes("disabled"));
  assert.ok(timeFixture.includes('data-testid="time-slots"'));
  assert.ok(timeFixture.includes('role="option"'));
  assert.ok(timeFixture.includes('aria-label="02:00"'));
  assert.ok(timeFixture.includes("12h"));
  assert.ok(timeFixture.includes("24h"));
  assert.ok(formFixture.includes("Name"));
  assert.ok(formFixture.includes("Email"));
  assert.ok(noTimesFixture.includes('aria-label="10:00 AM"'));
  assert.ok(noTimesFixture.includes("disabled"));

  const set = ef.annotateControls([
    makeItem(1, "16", {
      type: "button",
      elementId: "ef-b-1",
      accessibleName: "Monday, November 16, 2026",
      controlContext: "calendar",
      role: "button",
    }),
    makeItem(2, "17", {
      type: "button",
      elementId: "ef-b-2",
      accessibleName: "Tuesday, November 17, 2026",
      controlContext: "calendar",
      role: "button",
      disabled: true,
    }),
    makeItem(3, "10:00 AM", {
      type: "button",
      elementId: "ef-b-3",
      accessibleName: "10:00 AM",
      controlContext: "time-list",
      role: "button",
    }),
    makeItem(4, "Name", {
      type: "inputLabel",
      elementId: "ef-i-1",
      accessibleName: "Name",
      controlContext: "form",
    }),
    makeItem(5, "Next", {
      type: "button",
      elementId: "ef-b-5",
      accessibleName: "Next",
      role: "button",
    }),
    makeItem(6, "12h", {
      type: "button",
      elementId: "ef-b-6",
      accessibleName: "12 hours",
      controlContext: "time-list",
      role: "button",
    }),
    makeItem(7, "24h", {
      type: "button",
      elementId: "ef-b-7",
      accessibleName: "24 hours",
      controlContext: "time-list",
      role: "button",
    }),
    makeItem(8, "02:00", {
      type: "button",
      elementId: "ef-b-8",
      accessibleName: "02:00",
      controlContext: "time-list",
      role: "option",
    }),
  ]);

  assert.equal(set.find((control) => control.ref.elementId === "ef-b-1").kind, "date");
  assert.equal(set.find((control) => control.ref.elementId === "ef-b-2").disabled, true);
  assert.equal(set.find((control) => control.ref.elementId === "ef-b-3").kind, "time");
  assert.equal(set.find((control) => control.ref.elementId === "ef-i-1").kind, "form");
  assert.equal(set.find((control) => control.ref.elementId === "ef-b-5").kind, "next");
  assert.equal(set.find((control) => control.ref.elementId === "ef-b-6").kind, "generic");
  assert.equal(set.find((control) => control.ref.elementId === "ef-b-7").kind, "generic");
  assert.equal(set.find((control) => control.ref.elementId === "ef-b-8").kind, "time");

  const goal = "我想预约这个15分钟会议，请一步一步告诉我先点哪里";
  const dateSelected = makeControl(1, "Tuesday, November 17, 2026", "button", {
    kind: "date",
    context: "calendar",
    selected: true,
  });
  const format12 = makeControl(6, "12h", "button", { kind: "generic" });
  const format24 = makeControl(7, "24h", "button", { kind: "generic" });
  const formatOnly = makePageSnapshot([], {
    controls: [dateSelected, format12, format24],
  });
  const missingTime = ef.createPlan(goal, formatOnly);
  assert.equal(missingTime.plan, null);
  assert.equal(missingTime.failure, "time-controls-missing");

  const time0200 = makeControl(8, "02:00", "button", {
    kind: "time",
    context: "time-list",
  });
  const realTimes = makePageSnapshot([], {
    controls: [dateSelected, format12, format24, time0200],
  });
  const timePlan = ef.createPlan(goal, realTimes);
  assert.ok(timePlan.plan);
  assert.equal(timePlan.plan.steps[0].targetControl.ref.elementId, "ef-b-8");
  assert.notEqual(timePlan.plan.steps[0].targetControl.ref.elementId, "ef-b-6");
  assert.notEqual(timePlan.plan.steps[0].targetControl.ref.elementId, "ef-b-7");
});
test("AT-34 今天标记不等于已选，诊断可滚动且时间候选优先", async () => {
  const today = { getAttribute: (name) => (name === "aria-current" ? "date" : null) };
  const selected = { getAttribute: (name) => (name === "aria-selected" ? "true" : null) };
  const pressed = { getAttribute: (name) => (name === "aria-pressed" ? "true" : null) };
  assert.equal(ef.isSelectedControl(today), false);
  assert.equal(ef.isSelectedControl(selected), true);
  assert.equal(ef.isSelectedControl(pressed), true);

  const tsx = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "DiagnosticsPanel.tsx"),
    "utf8",
  );
  assert.ok(tsx.includes('maxHeight: "var(--ef-diag-max-h)"'));
  assert.ok(tsx.includes('overflowY: "auto"'));
  assert.ok(tsx.includes("tabIndex={0}"));
  assert.ok(tsx.indexOf("时间候选（最多 12 个") < tsx.indexOf("日期候选（最多 8 个"));
});
test("AT-35 复合标签分类：日期、02:00 时段、格式开关", async () => {
  const set = ef.annotateControls([
    makeItem(1, "2026年11月17日星期二，可预约", {
      type: "button",
      elementId: "ef-b-1",
      accessibleName: "2026年11月17日星期二，可预约",
      controlContext: "calendar",
      role: "button",
    }),
    makeItem(2, "2026年11月17日星期二 02:00 (Asia/Shanghai)", {
      type: "button",
      elementId: "ef-b-2",
      accessibleName: "2026年11月17日星期二 02:00 (Asia/Shanghai)",
      controlContext: "unknown",
      role: "option",
    }),
    makeItem(3, "12 小时", {
      type: "button",
      elementId: "ef-b-3",
      accessibleName: "12 小时",
      controlContext: "time-list",
      role: "button",
    }),
    makeItem(4, "24 小时", {
      type: "button",
      elementId: "ef-b-4",
      accessibleName: "24 小时",
      controlContext: "time-list",
      role: "button",
    }),
  ]);
  const date = set.find((control) => control.ref.elementId === "ef-b-1");
  const time = set.find((control) => control.ref.elementId === "ef-b-2");
  assert.equal(date.kind, "date");
  assert.equal(time.kind, "time");
  assert.equal(time.disabled, false);
  assert.equal(time.ambiguous, false);
  assert.equal(set.find((control) => control.ref.elementId === "ef-b-3").kind, "generic");
  assert.equal(set.find((control) => control.ref.elementId === "ef-b-4").kind, "generic");

  const snapshot = makePageSnapshot([], { controls: set });
  const goal = "我想预约这个15分钟会议，请一步一步告诉我先点哪里";
  const plan = ef.createPlan(goal, snapshot);
  assert.ok(plan.plan);
  assert.equal(plan.plan.steps[0].targetControl.ref.elementId, "ef-b-2");
  assert.notEqual(plan.plan.steps[0].targetControl.ref.elementId, "ef-b-3");
  assert.notEqual(plan.plan.steps[0].targetControl.ref.elementId, "ef-b-4");
  const response = await ef.ruleEngine.respond(makeRequest(goal, snapshot));
  assert.equal(response.responseType, "next-step");
  assert.equal(response.targetControl.ref.elementId, "ef-b-2");
  assert.equal(ef.validateResponse(response, snapshot, null).status, "passed");
});
test("AT-36 预约成功页由路径形态+精确标题确认（与计划解耦）", () => {
  const goal = "我想预约这个15分钟会议，请一步一步告诉我先点哪里";
  const date = makeControl(1, "Tuesday, November 17, 2026", "button", {
    kind: "date",
    context: "calendar",
    selected: true,
  });
  const time = makeControl(2, "02:00", "button", { kind: "time", context: "time-list" });
  const planResult = ef.createPlan(goal, makePageSnapshot([], { controls: [date, time] }));
  assert.ok(planResult.plan);

  const success = makePageSnapshot([makeItem(1, "该会议已安排", { type: "heading" })], {
    url: "https://example.test/booking/fixture-booking-0001",
  });
  assert.equal(ef.isBookingSuccessPage(success), true);

  const completed = ef.completeBookingPlan(planResult.plan);
  assert.equal(completed.status, "completed");
  assert.equal(ef.isBookingSuccessPage(success), true);

  const normalPath = makePageSnapshot([makeItem(1, "该会议已安排", { type: "heading" })], {
    url: "https://example.test/page",
  });
  assert.equal(ef.isBookingSuccessPage(normalPath), false);

  const vague = makePageSnapshot([makeItem(1, "已安排")], {
    url: "https://example.test/booking/fixture-booking-0001",
  });
  assert.equal(ef.isBookingSuccessPage(vague), false);

  const english = makePageSnapshot([makeItem(1, "This meeting is scheduled", { type: "heading" })], {
    url: "https://example.test/booking/fixture-booking-0001",
  });
  assert.equal(ef.isBookingSuccessPage(english), true);
});
function bookingDateControl(index, label) {
  return makeControl(index, label, "button", {
    kind: "date",
    context: "calendar",
    selected: true,
  });
}

function bookingTimeControl(index, label, overrides = {}) {
  return makeControl(index, label, "button", {
    kind: "time",
    context: "time-list",
    ...overrides,
  });
}

function makeCardMessage(id, targetControl) {
  return {
    messageId: id,
    turnId: "turn-ui",
    role: "assistant",
    kind: "response",
    createdAt: 1,
    snapshotId: "snap-ui",
    responseType: "next-step",
    text: "现在这一步",
    validation: "passed",
    citations: [],
    targetControl,
    completionCondition: {
      kind: "control-selected",
      controlRef: targetControl.ref,
    },
    diagnostics: {
      mode: "rule-demo",
      engineMs: 0,
      retrievedSegments: 0,
      citationCount: 0,
      intentKind: "process-goal",
      priorityHit: "plan",
      outboundBytes: 0,
      sensitiveDetected: false,
    },
  };
}

test("AT-37 最新快照核对：时段消失后动态改指真实可选时段", async () => {
  const goal = "我想预约这个15分钟会议，请一步一步告诉我先点哪里";
  const date = bookingDateControl(1, "2026年11月17日星期二");
  const t0200 = bookingTimeControl(2, "02:00");
  const t0215 = bookingTimeControl(3, "02:15");
  const t0300 = bookingTimeControl(4, "03:00");

  const snapA = makePageSnapshot([], { controls: [date, t0200, t0215, t0300] });
  const planA = ef.createPlan(goal, snapA).plan;
  assert.ok(planA);
  assert.equal(planA.steps[0].targetControl.label, "02:00");
  const rsA = ef.reconcileBookingPlan(planA, snapA);
  assert.equal(rsA.status, "unchanged");
  assert.ok(rsA.plan);
  assert.equal(rsA.plan.steps[0].targetControl.ref.elementId, "ef-b-2");

  const snapB = makePageSnapshot([], { controls: [date, t0215, t0300] });
  const rsB = ef.reconcileBookingPlan(planA, snapB);
  assert.equal(rsB.status, "replanned");
  assert.ok(rsB.plan);
  assert.equal(rsB.plan.steps[0].targetControl.label, "02:15");
  assert.equal(rsB.plan.steps[0].targetControl.ref.elementId, "ef-b-3");
  assert.equal(rsB.previousTarget.label, "02:00");
  assert.equal(rsB.plan.version, planA.version + 1);
  assert.ok(rsB.plan.planId.includes(snapB.snapshotId));

  const snapC = makePageSnapshot([], { controls: [date, t0300] });
  const rsC = ef.reconcileBookingPlan(rsB.plan, snapC);
  assert.equal(rsC.status, "replanned");
  assert.ok(rsC.plan);
  assert.equal(rsC.plan.steps[0].targetControl.label, "03:00");

  const snapD = makePageSnapshot([], {
    controls: [date, bookingTimeControl(2, "02:00", { disabled: true }), t0215],
  });
  const rsD = ef.reconcileBookingPlan(planA, snapD);
  assert.equal(rsD.status, "replanned");
  assert.ok(rsD.plan);
  assert.equal(rsD.plan.steps[0].targetControl.label, "02:15");

  const snapE = makePageSnapshot([], {
    controls: [date, bookingTimeControl(2, "02:00", { disabled: true })],
  });
  const rsE = ef.reconcileBookingPlan(planA, snapE);
  assert.equal(rsE.status, "unavailable");
  assert.equal(rsE.step, null);
  assert.ok(rsE.plan);
  assert.equal(rsE.plan.status, "superseded");
  assert.equal(rsE.failure, "no-available-times");
  assert.ok(!JSON.stringify(rsE).includes("09:00"));

  const date18 = bookingDateControl(11, "2026年11月18日星期三");
  const t1345 = bookingTimeControl(12, "13:45");
  const snapF = makePageSnapshot([], {
    controls: [date18, t1345],
    url: "https://other.example/schedule",
  });
  const rsF = ef.reconcileBookingPlan(planA, snapF);
  assert.equal(rsF.status, "replanned");
  assert.ok(rsF.plan);
  assert.equal(rsF.plan.steps[0].targetControl.label, "13:45");

  const sameLabelOtherId = bookingTimeControl(90, "02:00");
  const snapSame = makePageSnapshot([], { controls: [date, sameLabelOtherId] });
  const rsSame = ef.reconcileBookingPlan(planA, snapSame);
  assert.equal(rsSame.status, "updated");
  assert.ok(rsSame.plan);
  assert.equal(rsSame.plan.steps[0].targetControl.ref.elementId, "ef-b-90");
  assert.equal(rsSame.plan.steps[0].completion.controlRef.elementId, "ef-b-90");

  const neighborOnly = bookingTimeControl(9, "09:00");
  const snapNeighbor = makePageSnapshot([], { controls: [date, neighborOnly] });
  const located = ef.relocate(planA.steps[0], snapNeighbor);
  assert.equal(located.status, "missing");

  const dupA = bookingTimeControl(21, "02:00");
  const dupB = bookingTimeControl(22, "02:00");
  const dupSnapshot = makePageSnapshot([], { controls: [date, dupA, dupB] });
  const ambiguous = ef.relocate(planA.steps[0], dupSnapshot);
  assert.equal(ambiguous.status, "ambiguous");

  assert.equal(ef.timePreferenceOf("下午可以吗"), "afternoon");
  assert.equal(ef.timePreferenceOf("能安排更晚一点吗"), "later");
  assert.equal(ef.timePreferenceOf("上午呢"), "morning");
  assert.equal(ef.timePreferenceOf("换个时间"), "any");
  assert.equal(ef.parseClockMinutes("2026年11月17日星期二 02:00 (Asia/Shanghai)"), 120);
  assert.equal(ef.parseClockMinutes("2:00 PM"), 840);

  const pm = bookingTimeControl(31, "2:00 PM");
  const am = bookingTimeControl(32, "10:00 AM");
  const pmPlan = ef.createPlan(goal, makePageSnapshot([], { controls: [date, am, pm] }), {
    timePreference: "afternoon",
  }).plan;
  assert.ok(pmPlan);
  assert.equal(pmPlan.steps[0].targetControl.ref.elementId, "ef-b-31");
  const noPm = ef.createPlan(goal, makePageSnapshot([], { controls: [date, am] }), {
    timePreference: "afternoon",
  });
  assert.equal(noPm.plan, null);
  assert.equal(noPm.failure, "no-preferred-times");
  const later = ef.reconcileBookingPlan(planA, makePageSnapshot([], { controls: [date, t0300] }), "later");
  assert.equal(later.status, "replanned");
  assert.ok(later.plan);
  assert.equal(later.plan.steps[0].targetControl.label, "03:00");

  const plannerSource = await readFile(
    join(root, "src", "sidepanel", "guide", "stepPlanner.ts"),
    "utf8",
  );
  const hookSource = await readFile(
    join(root, "src", "sidepanel", "hooks", "useConversation.ts"),
    "utf8",
  );
  assert.ok(!/02:00|02:15|03:00/.test(plannerSource));
  assert.ok(!/02:00|02:15|03:00/.test(hookSource));
});

test("AT-38 只有当前计划的当前步骤卡可操作，旧卡标记已过期", async () => {
  const goal = "我想预约这个15分钟会议，请一步一步告诉我先点哪里";
  const date = bookingDateControl(1, "2026年11月17日星期二");
  const time = bookingTimeControl(2, "02:00");
  const plan = ef.createPlan(goal, makePageSnapshot([], { controls: [date, time] })).plan;
  assert.ok(plan);

  let state = ef.createConversationState();
  state = ef.conversationReducer(state, {
    type: "assistant-add",
    message: makeCardMessage("msg-card-1", time),
  });
  assert.equal(state.currentCardMessageId, "msg-card-1");
  state = ef.conversationReducer(state, { type: "plan-set", plan });
  assert.equal(state.currentCardMessageId, "msg-card-1");
  state = ef.conversationReducer(state, {
    type: "assistant-add",
    message: makeCardMessage("msg-card-2", time),
  });
  assert.equal(state.currentCardMessageId, "msg-card-2");
  const unavailable = ef.reconcileBookingPlan(plan, makePageSnapshot([], { controls: [date] }));
  state = ef.conversationReducer(state, { type: "plan-set", plan: unavailable.plan });
  assert.equal(state.currentCardMessageId, null);
  assert.ok(state.plan);
  assert.equal(state.plan.status, "superseded");

  const listSource = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "MessageList.tsx"),
    "utf8",
  );
  const cardSource = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "StepCard.tsx"),
    "utf8",
  );
  const appSource = await readFile(join(root, "src", "sidepanel", "App.tsx"), "utf8");
  assert.ok(listSource.includes("currentCardMessageId"));
  assert.ok(listSource.includes("planActive"));
  assert.ok(cardSource.includes("已过期"));
  assert.ok(cardSource.includes("expired"));
  assert.ok(appSource.includes("planActive"));
});
function makeSuccessTitleItem(index, text) {
  return makeItem(index, text, { type: "heading", elementId: `ef-h-${index}` });
}

function makeSuccessSnapshot(items, url = "https://example.test/booking/fixture-booking-0001") {
  return makePageSnapshot(items, { url });
}

function makeBookingNotice(snapshotId = "snap-success") {
  return {
    messageId: `msg-booking-${snapshotId}`,
    turnId: "turn-booking",
    role: "system",
    kind: "system",
    createdAt: 1,
    snapshotId,
    noticeKind: "booking-complete",
    text: ef.BOOKING_COMPLETE_NOTICE,
  };
}

test("AT-39 成功判定与计划状态解耦且原因可断言", () => {
  const success = makeSuccessSnapshot([makeSuccessTitleItem(1, "该会议已安排")]);
  const evidence = ef.evaluateBookingSuccess(success);
  assert.equal(evidence.ok, true);
  assert.equal(evidence.reason, null);
  assert.equal(evidence.pathShape, "success");
  assert.equal(evidence.titleItem.elementId, "ef-h-1");
  assert.ok(success.items.some((item) => item.elementId === evidence.titleItem.elementId));
  assert.equal(ef.isBookingSuccessPage(success), true);

  const completedPlan = {
    planId: "plan-completed",
    version: 1,
    goal: "我想预约会议",
    status: "completed",
    steps: [],
    currentIndex: 0,
  };
  assert.equal(completedPlan.status, "completed");
  assert.equal(ef.evaluateBookingSuccess(success).ok, true);

  const normalPath = makeSuccessSnapshot([makeSuccessTitleItem(1, "该会议已安排")], "https://example.test/page");
  assert.equal(ef.evaluateBookingSuccess(normalPath).reason, "path-mismatch");
});

test("AT-40 无计划成功页的完成消息只出现一次", () => {
  let state = ef.createConversationState();
  state = ef.conversationReducer(state, {
    type: "booking-check",
    check: { result: "failed", reason: "title-mismatch", snapshotId: "snap-a", checkedAt: 1 },
  });
  state = ef.conversationReducer(state, {
    type: "booking-check",
    check: { result: "passed", reason: null, snapshotId: "snap-b", checkedAt: 2 },
  });
  assert.equal(state.lastBookingCheck.snapshotId, "snap-b");
  for (let index = 0; index < 3; index += 1) {
    state = ef.conversationReducer(state, {
      type: "booking-success",
      plan: null,
      message: makeBookingNotice(),
    });
  }
  assert.equal(state.pageSuccess, "confirmed");
  assert.equal(state.plan, null);
  assert.equal(state.currentCardMessageId, null);
  const notices = state.messages.filter(
    (message) => message.role === "system" && message.noticeKind === "booking-complete",
  );
  assert.equal(notices.length, 1);
  assert.equal(notices[0].text, "预约已完成。请以网页和确认邮件中的信息为准。");
});

test("AT-41 无计划完成回答：直接回答且引用当前成功标题", () => {
  const titleItem = makeSuccessTitleItem(2, "该会议已安排");
  const snapshot = makeSuccessSnapshot([titleItem]);
  const evidence = ef.evaluateBookingSuccess(snapshot);
  assert.ok(evidence.ok);
  const response = ef.buildBookingDoneResponse(evidence);
  assert.equal(response.responseType, "direct-answer");
  assert.ok(response.text.startsWith("页面显示预约已安排"), response.text);
  assert.ok(response.text.length <= 180, String(response.text.length));
  assert.ok((response.text.match(/[。！？；]/g) ?? []).length <= 3);
  assert.equal(response.citations.length, 1);
  assert.equal(response.citations[0].role, "title");
  assert.equal(response.citations[0].text, ef.normalizeWhitespace(titleItem.text));
  assert.equal(ef.validateResponse(response, snapshot, null).status, "passed");
  assert.ok(!response.text.includes("我还没有正在陪办的步骤"));
  assert.ok(!/我帮你完成了|已替.*提交|已发送确认邮件/.test(response.text));
});

test("AT-42 五类非成功页不误报并返回互斥原因", () => {
  const cases = [
    {
      name: "normal-path",
      snapshot: makeSuccessSnapshot([makeSuccessTitleItem(1, "该会议已安排")], "https://example.test/page"),
      reason: "path-mismatch",
    },
    {
      name: "arranged-only",
      snapshot: makeSuccessSnapshot([makeItem(1, "已安排")]),
      reason: "title-mismatch",
    },
    {
      name: "fake-url",
      snapshot: makeSuccessSnapshot(
        [makeSuccessTitleItem(1, "该会议已安排")],
        "https://example.test/schedule?status=success",
      ),
      reason: "path-mismatch",
    },
    {
      name: "hidden-title",
      snapshot: makeSuccessSnapshot([makeItem(1, "其他内容")]),
      reason: "title-not-visible",
      signals: { droppedHidden: 2 },
    },
    { name: "read-failed", snapshot: null, reason: "read-failed" },
  ];
  let falsePositives = 0;
  for (const entry of cases) {
    const result = ef.evaluateBookingSuccess(entry.snapshot, entry.signals ?? {});
    assert.equal(result.ok, false, `${entry.name} 不应判定成功`);
    assert.equal(result.reason, entry.reason, `${entry.name} 原因不符`);
    if (result.ok) {
      falsePositives += 1;
    }
  }
  assert.equal(falsePositives, 0);
});

test("AT-43 证据不足时不声称完成", () => {
  const response = ef.buildBookingUnconfirmedResponse("title-mismatch");
  assert.equal(response.responseType, "cannot-answer");
  assert.equal(response.limitation.reason, "no-evidence");
  assert.ok(response.text.includes("没看到"));
  assert.ok(!response.text.includes("预约已安排"));
  assert.ok(!response.text.includes("预约已完成"));
  assert.ok(response.limitation.advice.includes("重新读取"));
  assert.equal(
    ef.validateResponse(response, makeSuccessSnapshot([makeItem(1, "任意内容")]), null).status,
    "passed",
  );
});

test("AT-44 成功态旧卡结束且既有过期语义不回退", () => {
  assert.equal(ef.resolveStepCardMode({ ended: true, expired: true }), "ended");
  assert.equal(ef.resolveStepCardMode({ ended: false, expired: true }), "expired");
  assert.equal(ef.resolveStepCardMode({ ended: false, expired: false }), "current");
  assert.equal(ef.stepCardActions("ended").length, 0);
  assert.equal(ef.shouldShowCompletion("ended"), false);
  assert.ok(ef.stepCardLabel("ended").includes("已结束"));
  assert.equal(ef.stepCardActions("current").length, 5);
  assert.equal(ef.stepCardActions("expired").length, 0);
  // 第四轮 R-57：过期卡不展示旧完成条件（由 true 收紧为 false）
  assert.equal(ef.shouldShowCompletion("expired"), false);
  assert.equal(ef.shouldShowCompletion("current"), true);
  assert.equal(ef.stepCardLabel("expired"), "这一步已过期");
  assert.equal(ef.stepCardLabel("current"), "现在这一步");
  assert.equal(ef.stepCardLayout("expired").primary, null);
  assert.equal(ef.stepCardLayout("expired").showDetails, false);
  assert.equal(ef.stepCardLayout("ended").primary, null);
  assert.equal(ef.stepCardLayout("ended").secondary.length, 0);
  assert.equal(ef.stepCardLayout("current").primary, "locate");
  assert.equal(ef.stepCardLayout("current").secondary.length, 4);
  assert.equal(ef.stepCardLayout("current").showDetails, true);
});

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(path)));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(path);
    }
  }
  return files;
}

test("AT-45 隐私、源码清洁与 fixture 门禁", async () => {
  const sensitive = [
    makeItem(1, "姓名 fixture"),
    makeItem(2, "fixture@example.test"),
    makeItem(3, "会议链接 https://meeting.example.test/join?token=abc"),
    makeSuccessTitleItem(4, "该会议已安排"),
  ];
  const snapshot = makeSuccessSnapshot(sensitive);
  const evidence = ef.evaluateBookingSuccess(snapshot);
  assert.equal(evidence.ok, true);
  const serialized = JSON.stringify(evidence);
  assert.ok(!serialized.includes("fixture@example.test"));
  assert.ok(!serialized.includes("meeting.example.test"));
  assert.ok(!serialized.includes("token=abc"));

  const sourceFiles = await collectSourceFiles(join(root, "src"));
  assert.ok(sourceFiles.length > 0);
  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8");
    assert.ok(!/02:00|02:15|03:00/.test(source), `${path} 含测试时刻字面量`);
    assert.ok(
      !/cal\.com|calendar\.google\.com|outlook\.com|teams\.microsoft\.com/.test(source),
      `${path} 含真实站点域名`,
    );
    assert.ok(
      !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(source),
      `${path} 含邮箱样式`,
    );
  }

  const diagSource = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "DiagnosticsPanel.tsx"),
    "utf8",
  );
  assert.ok(!diagSource.includes("02:00"));
  assert.ok(diagSource.includes("成功判定"));

  const fixtureNames = [
    "booking-success-with-plan.html",
    "booking-success-no-plan.html",
    "booking-arranged-only.html",
    "booking-fake-url.html",
    "booking-normal-path-precise-title.html",
    "booking-success-hidden-title.html",
    "booking-success-repeat.html",
  ];
  const fixtures = new Map();
  for (const name of fixtureNames) {
    const source = await readFile(join(root, "scripts", "fixtures", name), "utf8");
    fixtures.set(name, source);
    assert.ok(!/cal\.com|TEST-ID/.test(source), `${name} 含真实站点标记`);
    assert.ok(
      !/[A-Za-z0-9._%+-]+@(?!example\.test)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(source),
      `${name} 含非虚构邮箱`,
    );
  }
  const withPlan = fixtures.get("booking-success-with-plan.html");
  const withoutPlan = fixtures.get("booking-success-no-plan.html");
  assert.ok(withPlan.includes('data-testid="booking-success"'));
  assert.ok(withPlan.includes("<h1>该会议已安排</h1>"));
  assert.ok(withPlan.includes("fixture-booking-0001"));
  assert.ok(withoutPlan.includes('data-testid="booking-success"'));
  assert.ok(!fixtures.get("booking-arranged-only.html").includes("<h1>该会议已安排</h1>"));
  assert.ok(fixtures.get("booking-success-hidden-title.html").includes("hidden"));
  assert.ok(fixtures.get("booking-success-hidden-title.html").includes('aria-hidden="true"'));
  assert.ok(fixtures.get("booking-success-repeat.html").includes("该会议已安排，请准时参加"));

const manifest = JSON.parse(await readFile(join(root, "public", "manifest.json"), "utf8"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "sidePanel", "storage"]);
});

class FakeLocalCapability {
  constructor(result = "available") {
    this.result = result;
    this.installResult = true;
    this.availableCalls = 0;
    this.installCalls = 0;
    this.lastAvailableOptions = null;
    this.lastInstallOptions = null;
    this.throwMode = false;
    this.installThrowMode = false;
    this.installThrowName = "NotAllowedError";
    this.installThrowMessage = undefined;
    this.delayMs = 0;
    this.installDelayMs = 0;
    this.availableDelays = null;
  }

  async available(options) {
    this.availableCalls += 1;
    this.lastAvailableOptions = options;
    const delay =
      Array.isArray(this.availableDelays) && this.availableDelays.length > 0
        ? this.availableDelays[Math.min(this.availableCalls - 1, this.availableDelays.length - 1)]
        : this.delayMs;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (this.throwMode) {
      throw new Error("local check failed");
    }
    return this.result;
  }

  async install(options) {
    this.installCalls += 1;
    this.lastInstallOptions = options;
    const delay = this.installDelayMs > 0 ? this.installDelayMs : this.delayMs;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (this.installThrowMode) {
      throw {
        name: this.installThrowName,
        ...(this.installThrowMessage === undefined
          ? {}
          : { message: this.installThrowMessage }),
      };
    }
    if (this.installResult === true && this.result === "downloadable") {
      this.result = "available";
    }
    return this.installResult;
  }
}

function localController(options = {}) {
  const fake = options.fake ?? new FakeLocalCapability(options.localResult ?? "available");
  const adapter = options.adapter ?? new FakeRecognition();
  const page = options.page ?? new FakePermissionPage();
  const controller = new ef.VoiceController({
    adapter,
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
    probe: options.permissionProbe ?? new FakePermissionProbe(options.permission ?? "granted"),
    micPage: page,
    ...(options.noLocal === true
      ? {}
      : {
          localCapability: ef.createLocalCapabilityProbe(fake),
          localInstaller: ef.createLocalInstaller(fake),
        }),
    now: options.now ?? (() => 0),
  });
  return { controller, fake, adapter, page };
}

function failWith(permission, kind, raw) {
  let state = ef.createVoiceInputState();
  state = ef.voiceInputReducer(state, {
    type: "permission-refreshed",
    state: permission,
    at: 1,
  });
  state = ef.voiceInputReducer(state, { type: "start-requested", supported: true });
  state = ef.voiceInputReducer(state, {
    type: "adapter-error",
    kind,
    raw,
    cancelledByUser: false,
    at: 2,
  });
  return state;
}

test("AT-81 语音诊断字段最小化与分区", async () => {
  let state = ef.createVoiceInputState();
  state = ef.voiceInputReducer(state, {
    type: "permission-refreshed",
    state: "granted",
    at: 1000,
  });
  state = ef.voiceInputReducer(state, {
    type: "local-capability-checked",
    apiPresent: true,
    availability: "available",
    at: 2000,
  });
  state = ef.voiceInputReducer(state, { type: "install-state-changed", state: "succeeded" });
  const view = ef.describeVoiceInput(state, 60000);
  const d = view.diagnostics;
  assert.deepEqual(Object.keys(d).sort(), [
    "installOutcomeText",
    "installStateText",
    "lastErrorAgo",
    "lastErrorText",
    "listeningText",
    "localApiText",
    "localAvailabilityText",
    "localCheckedAgo",
    "modeText",
    "onstartText",
    "permissionCheckedAgo",
    "permissionText",
    "rawErrorCodeText",
  ]);
  assert.equal(d.lastErrorText, ef.SPEECH_DIAGNOSTICS_TEXTS.noError);
  assert.equal(d.installOutcomeText, "未开始 · 无 · 无");
  const serialized = JSON.stringify(d);
  assert.ok(!/http|url|message|device|transcript/i.test(serialized));
  assert.ok(
    !new RegExp(ef.AUDIO_DATA_FORBIDDEN_WORDS.join("|"), "i").test(serialized),
    serialized,
  );
  assert.equal(
    new RegExp(ef.AUDIO_DATA_FORBIDDEN_WORDS.join("|"), "i").test(ef.ALLOWED_DIAGNOSTIC_AUDIO_VALUE),
    false,
  );
  assert.ok(serialized.length <= ef.DIAGNOSTICS_SERIALIZED_MAX_CHARS, String(serialized.length));
  const before = serialized;
  state = ef.voiceInputReducer(state, {
    type: "adapter-final",
    merge: { ok: true, text: "x".repeat(100) },
  });
  assert.equal(JSON.stringify(ef.describeVoiceInput(state, 60000).diagnostics), before);
  const source = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "DiagnosticsPanel.tsx"),
    "utf8",
  );
  assert.ok(source.includes("SPEECH_DIAGNOSTICS_TEXTS.title"));
  assert.ok(source.includes("SPEECH_DIAGNOSTICS_TEXTS.pageTitle"));
  assert.equal(ef.SPEECH_DIAGNOSTICS_TEXTS.title, "语音输入诊断");
  assert.equal(ef.SPEECH_DIAGNOSTICS_TEXTS.pageTitle, "页面采集诊断");
  assert.ok(
    source.indexOf("SPEECH_DIAGNOSTICS_TEXTS.title") <
      source.indexOf("SPEECH_DIAGNOSTICS_TEXTS.pageTitle"),
  );
  assert.ok(source.includes("SPEECH_DIAGNOSTICS_TEXTS.speakTitle"));
  assert.ok(!source.includes("EF-E003"));
  assert.ok(!source.includes("页面访问许可"));
  assert.ok(!source.includes("下载中文语音资源"));
});

test("AT-82 权限状态优先于网络错误", () => {
  const granted = failWith("granted", "network", "network");
  const grantedView = ef.describeVoiceInput(granted);
  assert.ok(grantedView.statusText.includes("麦克风已授权"));
  assert.equal(granted.lastRawErrorKind, "network");

  const denied = failWith("denied", "network", "network");
  const deniedView = ef.describeVoiceInput(denied);
  assert.equal(denied.phase, "permission-denied");
  assert.ok(deniedView.statusText.includes("麦克风权限未开启"));
  assert.equal(denied.lastRawErrorKind, "network");

  const prompt = failWith("prompt", "network", "network");
  const promptView = ef.describeVoiceInput(prompt);
  assert.equal(prompt.phase, "idle");
  assert.ok(promptView.statusText.includes("开启麦克风"));
  assert.equal(prompt.lastRawErrorKind, "network");
});

test("AT-83 network 文案禁止重授", async () => {
  const state = failWith("granted", "network", "network");
  const view = ef.describeVoiceInput(state);
  const text = view.statusText;
  for (const part of ["麦克风已授权", "浏览器语音服务连接失败", "可以打字", "本机语音识别"]) {
    assert.ok(text.includes(part), part);
  }
  assert.ok(!/重新授权|权限未开启|开启麦克风|去设置/.test(text));
  assert.equal(view.showMicEntry, false);
  const page = new FakePermissionPage();
  const controller = new ef.VoiceController({
    adapter: new FakeRecognition(),
    detect: () => "supported",
    probe: new FakePermissionProbe("granted"),
    micPage: page,
  });
  await controller.ensureLocalCapability();
  assert.equal(page.openCalls, 0);
  controller.dispose();
});

test("AT-84 no-speech 独立且 unknown 不混用", () => {
  const noSpeech = failWith("granted", "no-speech", "no-speech");
  const noSpeechView = ef.describeVoiceInput(noSpeech);
  assert.equal(noSpeechView.statusText, ef.SPEECH_NO_SPEECH_TEXT);
  assert.ok(!/网络|服务|权限|授权/.test(noSpeechView.statusText));

  const unknown = failWith("granted", "unknown", "other");
  const unknownView = ef.describeVoiceInput(unknown);
  assert.equal(unknown.phase, "failed");
  assert.equal(unknownView.statusText, ef.SPEECH_GENERIC_FAILED_TEXT);
  assert.notEqual(unknownView.statusText, noSpeechView.statusText);

  const second = ef.voiceInputReducer(noSpeech, {
    type: "adapter-error",
    kind: "no-speech",
    cancelledByUser: false,
  });
  assert.equal(second, noSpeech);
});

test("AT-85 六类失败文案两两不同", () => {
  const texts = [
    ef.SPEECH_NETWORK_GRANTED_TEXT,
    ef.SPEECH_NO_SPEECH_TEXT,
    ef.MIC_PERMISSION_DENIED_TEXT,
    ef.VOICE_ISSUE_TEXT["service-limited"],
    ef.VOICE_ISSUE_TEXT["no-audio-device"],
    ef.VOICE_ISSUE_TEXT["device-unavailable"],
  ];
  assert.equal(new Set(texts).size, 6);
  assert.ok(
    !/NotAllowedError|NotFoundError|NotReadableError|no-speech|audio-capture|service-not-allowed|network/.test(
      texts.join("\n"),
    ),
  );
});

test("AT-86 本机 API 缺失时不标记可用", async () => {
  assert.equal(ef.readLocalRecognitionApi({}), null);
  assert.equal(ef.readLocalRecognitionApi({ SpeechRecognition: function () {} }), null);
  const probe = ef.createLocalCapabilityProbe(null);
  assert.equal(await probe.check(), "unsupported-not-called");

  const { controller } = localController({ noLocal: true });
  await controller.ensureLocalCapability();
  assert.equal(controller.getView().showModeSelector, false);
  assert.equal(controller.getView().localOptionVisible, false);
  assert.ok(controller.getView().localNoticeText !== null);
  controller.dispose();
  const source = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "VoiceInputControl.tsx"),
    "utf8",
  );
  assert.ok(!source.includes("使用本机识别"));
});

test("AT-87 本机 available 与 processLocally", async () => {
  const fake = new FakeLocalCapability("available");
  const { controller, adapter } = localController({ fake });
  await controller.ensureLocalCapability();
  assert.equal(controller.getView().showModeSelector, true);
  assert.equal(controller.getView().localOptionVisible, true);
  assert.equal(fake.installCalls, 0);
  assert.deepEqual(fake.lastAvailableOptions, {
    langs: ["zh-CN"],
    processLocally: true,
  });
  controller.setRecognitionMode("local");
  await controller.start();
  assert.equal(adapter.lastOptions.processLocally, true);
  controller.dispose();
});

test("AT-88 本机 downloadable 只显示安装入口", async () => {
  const fake = new FakeLocalCapability("downloadable");
  const { controller } = localController({ fake });
  await controller.ensureLocalCapability();
  assert.equal(controller.getView().localOptionVisible, false);
  assert.equal(controller.getView().installButtonVisible, true);
  assert.equal(fake.installCalls, 0);
  controller.dispose();
});

test("AT-89 安装只在点击后触发且幂等", async () => {
  const fake = new FakeLocalCapability("downloadable");
  fake.delayMs = 20;
  const { controller } = localController({ fake });
  await controller.ensureLocalCapability();
  const calls = [
    controller.requestLocalInstall(),
    controller.requestLocalInstall(),
    controller.requestLocalInstall(),
    controller.requestLocalInstall(),
    controller.requestLocalInstall(),
  ];
  await Promise.all(calls);
  assert.equal(fake.installCalls, 1);
  assert.deepEqual(fake.lastInstallOptions, { langs: ["zh-CN"] });
  const composer = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "ChatComposer.tsx"),
    "utf8",
  );
  assert.ok(composer.includes("disabled={disabled || text.trim().length === 0}"));
  controller.dispose();
});

test("AT-90 安装成功复检与失败回退", async () => {
  const successFake = new FakeLocalCapability("downloadable");
  successFake.installResult = true;
  const success = localController({ fake: successFake });
  await success.controller.ensureLocalCapability();
  const checksBefore = successFake.availableCalls;
  await success.controller.requestLocalInstall();
  assert.equal(success.controller.getView().localOptionVisible, true);
  assert.ok(successFake.availableCalls > checksBefore);
  assert.equal(success.controller.getView().mode, "service");

  const failedFake = new FakeLocalCapability("downloadable");
  failedFake.installResult = false;
  const failed = localController({ fake: failedFake });
  await failed.controller.ensureLocalCapability();
  const failedBefore = failedFake.availableCalls;
  await failed.controller.requestLocalInstall();
  assert.equal(failed.controller.getView().localOptionVisible, false);
  assert.equal(failedFake.availableCalls, failedBefore + 1);
  const failedOutcome = failed.controller.getDiagnostics().installOutcomeText;
  assert.ok(failedOutcome.includes("返回 false（明确失败）"));
  assert.ok(failedOutcome.endsWith(" · 无 · 无"));
  const installCalls = failedFake.installCalls;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(failedFake.installCalls, installCalls);
  assert.ok(failed.controller.getView().localNoticeText !== null);

  const deniedFake = new FakeLocalCapability("downloadable");
  deniedFake.installThrowMode = true;
  const denied = localController({ fake: deniedFake });
  await denied.controller.ensureLocalCapability();
  const deniedBefore = deniedFake.availableCalls;
  await denied.controller.requestLocalInstall();
  assert.equal(deniedFake.availableCalls, deniedBefore + 1);
  const deniedOutcome = denied.controller.getDiagnostics().installOutcomeText;
  assert.ok(deniedOutcome.includes("抛出异常 · NotAllowedError · "));
  assert.notEqual(deniedOutcome, failedOutcome);
  assert.ok(denied.controller.getView().localNoticeText !== null);
  success.controller.dispose();
  failed.controller.dispose();
  denied.controller.dispose();
});

test("AT-91 本机 unavailable 与抛错", async () => {
  const unavailable = localController({ localResult: "unavailable" });
  await unavailable.controller.ensureLocalCapability();
  assert.equal(unavailable.controller.getView().localOptionVisible, false);
  assert.equal(unavailable.controller.getView().installButtonVisible, false);
  assert.ok(unavailable.controller.getView().localNoticeText.includes("暂不支持"));

  const broken = localController({ localResult: "available" });
  broken.fake.throwMode = true;
  await broken.controller.ensureLocalCapability();
  assert.equal(broken.controller.getView().localOptionVisible, false);
  assert.ok(broken.controller.getView().localNoticeText.includes("无法判断"));
  unavailable.controller.dispose();
  broken.controller.dispose();
});

test("AT-92 双模式与 processLocally", async () => {
  const fake = new FakeLocalCapability("available");
  const { controller, adapter } = localController({ fake });
  await controller.ensureLocalCapability();
  await controller.start();
  assert.ok(!("processLocally" in adapter.lastOptions));
  controller.cancel();
  controller.setRecognitionMode("local");
  await controller.start();
  assert.equal(adapter.lastOptions.processLocally, true);
  controller.dispose();
});

test("AT-93 本机失败不自动回退、网络不自动切换", async () => {
  const fake = new FakeLocalCapability("available");
  const { controller, adapter } = localController({ fake });
  await controller.ensureLocalCapability();
  controller.setRecognitionMode("local");
  await controller.start();
  adapter.emit({ type: "error", kind: "network", raw: "network" });
  assert.equal(controller.getView().mode, "local");
  assert.equal(adapter.startCalls, 1);
  assert.ok(controller.getView().statusText.includes("麦克风已授权"));
  controller.dispose();
});

test("AT-94 两种模式都只填输入框", async () => {
  for (const mode of ["service", "local"]) {
    const fake = new FakeLocalCapability("available");
    const { controller, adapter } = localController({ fake });
    await controller.ensureLocalCapability();
    if (mode === "local") {
      controller.setRecognitionMode("local");
    }
    await controller.start();
    adapter.emit({ type: "final", text: "我想了解办理条件" });
    assert.equal(controller.getView().pendingText, "我想了解办理条件");
    assert.equal(controller.getView().revision, 1);
    controller.dispose();
  }
});

test("AT-95 失败仍可打字且不自动重试", async () => {
  const { controller, adapter } = localController({ permission: "granted" });
  await controller.start();
  adapter.emit({ type: "error", kind: "network", raw: "network" });
  const startCalls = adapter.startCalls;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(adapter.startCalls, startCalls);
  const composer = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "ChatComposer.tsx"),
    "utf8",
  );
  assert.ok(composer.includes("disabled={disabled || text.trim().length === 0}"));
  controller.dispose();
});

test("AT-96 朗读与页面诊断不受影响、隐私最小化", async () => {
  const synth = new FakeSynthesis();
  const speech = new ef.SpeechController({ adapter: synth, now: () => 0 });
  speech.speak({ kind: "step-action", text: "现在请选择可用时间" });
  speech.stop();
  assert.equal(synth.speakCalls, 1);
  assert.equal(synth.stopCalls, 1);
  speech.dispose();

  const pageSource = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "DiagnosticsPanel.tsx"),
    "utf8",
  );
  assert.ok(pageSource.includes("页面采集诊断"));
  assert.ok(!pageSource.includes("EF-E003"));

  for (const dir of [
    join(root, "src", "shared", "speech"),
    join(root, "src", "sidepanel", "speech"),
  ]) {
    for (const path of await collectSourceFiles(dir)) {
      const source = await readFile(path, "utf8");
      assert.ok(!source.includes("chrome.storage"), path);

    }
  }
const manifest = JSON.parse(await readFile(join(root, "public", "manifest.json"), "utf8"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "sidePanel", "storage"]);
});

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("AT-97 安装结果三分与四句文案", async () => {
  const cases = [
    {
      name: "false",
      setup: (fake) => {
        fake.installResult = false;
      },
      outcome: "returned-false",
      text: "返回 false（明确失败）",
    },
    {
      name: "unknown",
      setup: (fake) => {
        fake.installResult = undefined;
      },
      outcome: "returned-unknown",
      text: "返回未知值（未确认成功）",
    },
    {
      name: "throw",
      setup: (fake) => {
        fake.installThrowMode = true;
        fake.installThrowMessage = "x".repeat(20);
      },
      outcome: "threw",
      text: "抛出异常",
    },
    {
      name: "unsupported",
      setup: (fake) => {
        fake.install = undefined;
      },
      outcome: "unsupported",
      text: "接口不支持",
    },
  ];
  const notices = [];
  const outcomes = [];
  for (const entry of cases) {
    const fake = new FakeLocalCapability("downloadable");
    entry.setup(fake);
    const { controller } = localController({ fake });
    await controller.ensureLocalCapability();
    await controller.requestLocalInstall();
    const view = controller.getView();
    assert.ok(view.localNoticeText !== null, entry.name);
    notices.push(view.localNoticeText);
    const text = controller.getDiagnostics().installOutcomeText;
    assert.ok(text.includes(entry.text), `${entry.name}: ${text}`);
    outcomes.push(text);
    assert.ok(text.endsWith(" · 无 · 无") || entry.outcome === "threw", entry.name);
    controller.dispose();
  }
  assert.equal(new Set(notices).size, 4);
  assert.equal(new Set(outcomes).size, 4);
  assert.deepEqual(Object.keys(ef.INSTALL_OUTCOME_TEXTS).sort(), [
    "none",
    "requesting",
    "returned-false",
    "returned-unknown",
    "succeeded",
    "threw",
    "unsupported",
  ]);
  assert.ok(!/NotAllowedError|SecurityError|false|message|undefined/i.test(notices.join("\n")));
  assert.ok(!/已完成|已可用|语音可用|语音识别已完成/.test(notices.join("\n")));
});

test("AT-98 异常名称白名单与安全摘要", () => {
  for (const name of ef.INSTALL_ERROR_NAMES) {
    assert.equal(ef.normalizeInstallErrorName(name), name);
  }
  for (const bad of ["WeirdError", "", 42, "notallowederror", "A".repeat(50), undefined]) {
    assert.equal(ef.normalizeInstallErrorName(bad), "未知错误");
  }
  const dirty =
    "see https://example.test/path C:\\Users\\x\\a.log " +
    "a".repeat(32) +
    " " +
    "b".repeat(30) +
    " 1234567890 audio message device transcript url http";
  const brief = ef.sanitizeInstallErrorBrief(dirty);
  assert.ok(!/example\.test|C:\\|a{32}|b{30}|1234567890|audio|message|device|transcript|url|http/i.test(brief), brief);
  assert.ok(Array.from(brief).length <= 41, brief);
  assert.equal(ef.sanitizeInstallErrorBrief(""), ef.INSTALL_ERROR_TEXTS.emptyBrief);
  assert.equal(ef.sanitizeInstallErrorBrief(undefined), ef.INSTALL_ERROR_TEXTS.emptyBrief);
  const long = ef.sanitizeInstallErrorBrief("中".repeat(200));
  assert.ok(Array.from(long).length <= 41);
  assert.ok(!/\[object Object\]|stack|undefined/.test(brief + long));
  for (const word of ef.DIAGNOSTIC_FORBIDDEN_WORDS) {
    assert.ok(ef.INSTALL_BRIEF_FORBIDDEN_WORDS.includes(word));
  }
  assert.ok(ef.INSTALL_BRIEF_FORBIDDEN_WORDS.includes("audio"));
  assert.ok(!ef.AUDIO_DATA_FORBIDDEN_WORDS.includes(ef.ALLOWED_DIAGNOSTIC_AUDIO_VALUE));
});

test("AT-99 四类安装结果都强制复检一次", async () => {
  const cases = [
    (fake) => {
      fake.installResult = true;
    },
    (fake) => {
      fake.installResult = false;
    },
    (fake) => {
      fake.installResult = undefined;
    },
    (fake) => {
      fake.installThrowMode = true;
    },
  ];
  for (const setup of cases) {
    const fake = new FakeLocalCapability("downloadable");
    setup(fake);
    const { controller } = localController({ fake });
    await controller.ensureLocalCapability();
    const before = fake.availableCalls;
    await controller.requestLocalInstall();
    assert.equal(fake.availableCalls, before + 1);
    assert.deepEqual(fake.lastAvailableOptions, {
      langs: ["zh-CN"],
      processLocally: true,
    });
    assert.equal(controller.getView().mode, "service");
    controller.dispose();
  }

  const unsupportedFake = new FakeLocalCapability("downloadable");
  unsupportedFake.install = undefined;
  const unsupported = localController({ fake: unsupportedFake });
  await unsupported.controller.ensureLocalCapability();
  const before = unsupportedFake.availableCalls;
  await unsupported.controller.requestLocalInstall();
  assert.equal(unsupportedFake.availableCalls, before);
  assert.ok(unsupported.controller.getDiagnostics().installOutcomeText.includes("接口不支持"));
  assert.equal(unsupported.controller.getView().installButtonVisible, false);
  unsupported.controller.dispose();
});

test("AT-100 复检失败保留结论并恢复按钮", async () => {
  const fake = new FakeLocalCapability("downloadable");
  fake.installResult = false;
  const { controller } = localController({ fake });
  await controller.ensureLocalCapability();
  fake.throwMode = true;
  await controller.requestLocalInstall();
  const view = controller.getView();
  assert.equal(controller.getDiagnostics().localAvailabilityText, "无法判断");
  assert.ok(controller.getDiagnostics().installOutcomeText.includes("返回 false（明确失败）"));
  assert.equal(view.installButtonVisible, false);
  fake.throwMode = false;
  await controller.recheckLocalCapability();
  assert.equal(controller.getView().localOptionVisible, false);
  assert.equal(controller.getView().installButtonVisible, true);

  const slow = new FakeLocalCapability("downloadable");
  slow.installResult = false;
  slow.availableDelays = [200];
  const slowCtx = localController({ fake: slow });
  await slowCtx.controller.ensureLocalCapability();
  const pending = slowCtx.controller.requestLocalInstall();
  await waitMs(20);
  assert.equal(slowCtx.controller.getView().installInProgress, true);
  assert.equal(slowCtx.controller.getView().installButtonVisible, true);
  assert.ok(slowCtx.controller.getDiagnostics().installOutcomeText.length > 0);
  await pending;
  controller.dispose();
  slowCtx.controller.dispose();
});

test("AT-101 浏览器实际错误码与文本隔离", () => {
  const codes = [
    "no-speech",
    "network",
    "not-allowed",
    "service-not-allowed",
    "audio-capture",
    "language-not-supported",
    "aborted",
  ];
  for (const code of codes) {
    assert.equal(ef.mapRawErrorCode(code), code);
  }
  assert.equal(ef.mapRawErrorCode("weird-code"), "unmapped");
  assert.equal(ef.mapRawErrorCode(undefined), null);

  let state = ef.createVoiceInputState();
  state = ef.voiceInputReducer(state, {
    type: "permission-refreshed",
    state: "granted",
    at: 1,
  });
  state = ef.voiceInputReducer(state, { type: "start-requested", supported: true });
  state = ef.voiceInputReducer(state, {
    type: "adapter-error",
    kind: "network",
    raw: "network",
    code: "network",
    errorSource: "onerror",
    at: 2,
  });
  const view = ef.describeVoiceInput(state);
  assert.equal(view.diagnostics.rawErrorCodeText, "network");
  assert.notEqual(view.diagnostics.lastErrorText, view.diagnostics.rawErrorCodeText);
  assert.ok(!view.statusText.includes("network"));
  const afterEnd = ef.voiceInputReducer(state, { type: "adapter-ended", at: 3 });
  assert.equal(afterEnd, state);

  let unmapped = ef.createVoiceInputState();
  unmapped = ef.voiceInputReducer(unmapped, {
    type: "permission-refreshed",
    state: "granted",
    at: 1,
  });
  unmapped = ef.voiceInputReducer(unmapped, { type: "start-requested", supported: true });
  unmapped = ef.voiceInputReducer(unmapped, {
    type: "adapter-error",
    kind: "unknown",
    raw: "other",
    code: "unmapped",
    errorSource: "onerror",
    at: 2,
  });
  assert.equal(
    ef.describeVoiceInput(unmapped).diagnostics.rawErrorCodeText,
    "其他（未映射）",
  );

  let missing = ef.createVoiceInputState();
  missing = ef.voiceInputReducer(missing, {
    type: "permission-refreshed",
    state: "granted",
    at: 1,
  });
  missing = ef.voiceInputReducer(missing, { type: "start-requested", supported: true });
  missing = ef.voiceInputReducer(missing, {
    type: "adapter-error",
    kind: "unknown",
    raw: "other",
    errorSource: "onerror",
    at: 2,
  });
  assert.equal(ef.describeVoiceInput(missing).diagnostics.rawErrorCodeText, "未提供");
  assert.equal(
    ef.describeVoiceInput(ef.createVoiceInputState()).diagnostics.rawErrorCodeText,
    ef.SPEECH_DIAGNOSTICS_TEXTS.noError,
  );
});

test("AT-102 onend/超时/取消不伪造实际码", () => {
  const base = () => {
    let state = ef.createVoiceInputState();
    state = ef.voiceInputReducer(state, {
      type: "permission-refreshed",
      state: "granted",
      at: 1,
    });
    return ef.voiceInputReducer(state, { type: "start-requested", supported: true });
  };

  const ended = ef.voiceInputReducer(base(), { type: "adapter-ended", at: 2 });
  assert.equal(ended.lastErrorSource, "onend");
  assert.equal(ended.lastRawErrorCode, null);
  assert.equal(
    ef.describeVoiceInput(ended).diagnostics.rawErrorCodeText,
    "未提供",
  );
  assert.equal(
    ef.describeVoiceInput(ended).diagnostics.lastErrorText,
    "没有听到语音（会话结束）",
  );
  assert.equal(ended.phase, "no-speech");

  const timedOut = ef.voiceInputReducer(base(), { type: "timeout", at: 2 });
  assert.equal(timedOut.lastErrorSource, "timeout");
  assert.equal(timedOut.lastRawErrorCode, null);
  assert.ok(ef.describeVoiceInput(timedOut).diagnostics.lastErrorText.includes("等待超时"));

  const cancelled = ef.voiceInputReducer(base(), { type: "cancel-requested" });
  assert.equal(cancelled.lastErrorSource, "cancel");
  assert.equal(cancelled.lastRawErrorCode, null);
  assert.equal(ef.describeVoiceInput(cancelled).diagnostics.lastErrorText, "已取消识别");

  const userAbort = ef.voiceInputReducer(base(), {
    type: "adapter-error",
    kind: "aborted",
    raw: "other",
    code: "aborted",
    cancelledByUser: true,
    errorSource: "onerror",
    at: 2,
  });
  assert.equal(userAbort.lastErrorSource, "cancel");
  assert.equal(userAbort.lastRawErrorCode, null);

  const browserAbort = ef.voiceInputReducer(base(), {
    type: "adapter-error",
    kind: "aborted",
    raw: "other",
    code: "aborted",
    cancelledByUser: false,
    errorSource: "onerror",
    at: 2,
  });
  assert.equal(browserAbort.lastErrorSource, "onerror");
  assert.equal(browserAbort.lastRawErrorCode, "aborted");
});

test("AT-103 13 键、两行与序列化上限", async () => {
  const input = {
    permission: "granted",
    permissionCheckedAt: 1,
    lastRawErrorKind: "audio-capture",
    lastRawErrorCode: "audio-capture",
    lastErrorSource: "onerror",
    lastRawErrorAt: 2,
    lastRawErrorTimedOut: false,
    browserOnstart: "reached",
    listening: false,
    localApiPresent: true,
    localAvailability: "downloadable",
    localCheckedAt: 3,
    installState: "denied",
    installOutcome: "threw",
    installErrorName: "InvalidStateError",
    installErrorBrief: "…".repeat(41),
    mode: "service",
  };
  const view = ef.describeSpeechDiagnostics(input, 4);
  assert.equal(Object.keys(view).length, 13);
  const serialized = JSON.stringify(view);
  assert.ok(serialized.length <= ef.DIAGNOSTICS_SERIALIZED_MAX_CHARS);
  for (const [key, value] of Object.entries(view)) {
    if (key !== "rawErrorCodeText") {
      assert.ok(!String(value).includes("audio"), key);
    }
  }
  const panel = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "DiagnosticsPanel.tsx"),
    "utf8",
  );
  const rawIndex = panel.indexOf("SPEECH_DIAGNOSTICS_TEXTS.rawErrorCodeLabel");
  const installIndex = panel.indexOf("SPEECH_DIAGNOSTICS_TEXTS.installOutcomeLabel");
  assert.ok(rawIndex > panel.indexOf("SPEECH_DIAGNOSTICS_TEXTS.title"));
  assert.ok(installIndex > rawIndex);
  assert.ok(installIndex < panel.indexOf("SPEECH_DIAGNOSTICS_TEXTS.pageTitle"));
  assert.ok(panel.includes("open={open}"));
  assert.ok(panel.includes("{open ? ("));
});

test("AT-104 失败仍可打字且不自动重试", async () => {
  const { controller, adapter } = localController({ permission: "granted" });
  await controller.start();
  adapter.emitError({ kind: "network", raw: "network", code: "network" });
  const startCalls = adapter.startCalls;
  await waitMs(40);
  assert.equal(adapter.startCalls, startCalls);
  assert.equal(controller.getView().installInProgress, false);
  const composer = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "ChatComposer.tsx"),
    "utf8",
  );
  assert.ok(composer.includes("disabled={disabled || text.trim().length === 0}"));
  const texts = [
    controller.getView().statusText,
    controller.getView().localNoticeText ?? "",
    ...Object.values(ef.SPEECH_LOCAL_TEXTS),
  ].join("\n");
  assert.ok(!/已完成|已可用|语音可用|语音识别已完成/.test(texts));
  controller.dispose();
});

test("AT-105 边界回归、隐私与例外清单", async () => {
  const manifest = JSON.parse(await readFile(join(root, "public", "manifest.json"), "utf8"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "sidePanel", "storage"]);

  for (const dir of [
    join(root, "src", "shared", "speech"),
    join(root, "src", "sidepanel", "speech"),
  ]) {
    for (const path of await collectSourceFiles(dir)) {
      const source = await readFile(path, "utf8");
      assert.ok(!source.includes("chrome.storage"), path);
      assert.ok(!source.includes("fetch("), path);
      assert.ok(!source.includes("MediaRecorder"), path);
    }
  }

  const synth = new FakeSynthesis();
  const speech = new ef.SpeechController({ adapter: synth, now: () => 0 });
  speech.speak({ kind: "step-action", text: "现在请选择可用时间" });
  speech.stop();
  assert.equal(synth.speakCalls, 1);
  assert.equal(synth.stopCalls, 1);
  speech.dispose();

  const panel = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "DiagnosticsPanel.tsx"),
    "utf8",
  );
  assert.ok(panel.includes("SPEECH_DIAGNOSTICS_TEXTS.pageTitle"));
  assert.ok(!panel.includes("EF-E003"));
  const verifySource = await readFile(
    join(root, "scripts", "verify-manifest.mjs"),
    "utf8",
  );
  const exceptions = [
    ...verifySource.matchAll(
      /scope: "(src|dist)",\s*path: "([^"]+)",\s*pattern: "getUserMedia"/g,
    ),
  ];
  assert.equal(exceptions.length, 2);
  const allCopy = Object.values(ef.SPEECH_LOCAL_TEXTS).join("\n");
  assert.ok(!/语音可用|已可用|已完成/.test(allCopy));
});

class FakePermissionProbe {
  constructor(state = "prompt") {
    this.state = state;
    this.queryCalls = 0;
    this.throwMode = false;
  }

  async query() {
    this.queryCalls += 1;
    if (this.throwMode) {
      throw new Error("permission query failed");
    }
    return this.state;
  }
}

class FakePermissionPage {
  constructor(result = "opened") {
    this.result = result;
    this.openCalls = 0;
  }

  async open() {
    this.openCalls += 1;
    return this.result;
  }
}

class FakeTrack {
  constructor() {
    this.stopCalls = 0;
  }

  stop() {
    this.stopCalls += 1;
  }
}

class FakeStream {
  constructor(tracks) {
    this.tracks = tracks;
  }

  getTracks() {
    return this.tracks;
  }
}

class FakeMediaDevices {
  constructor(stream, error) {
    this.stream = stream;
    this.error = error;
    this.calls = 0;
    this.lastConstraints = null;
  }

  async getUserMedia(constraints) {
    this.calls += 1;
    this.lastConstraints = constraints;
    if (this.error !== undefined) {
      throw this.error;
    }
    return this.stream;
  }
}

test("AT-64 权限五态与文案映射", () => {
  assert.deepEqual([...ef.MIC_PERMISSION_STATES], [
    "unknown",
    "granted",
    "prompt",
    "denied",
    "unsupported",
  ]);
  for (const state of ["unknown", "granted", "prompt", "denied"]) {
    assert.equal(ef.mapPermissionState(state), state);
    assert.ok(ef.MIC_PERMISSION_STATE_TEXT[state].length > 0);
  }
  assert.equal(ef.mapPermissionState("unsupported"), "unknown");
  assert.equal(ef.mapPermissionState(undefined), "unknown");
  assert.equal(ef.mapPermissionState("limited"), "unknown");
  assert.ok(ef.MIC_PERMISSION_STATE_TEXT.unsupported.length > 0);
  assert.equal(new Set(Object.values(ef.MIC_PERMISSION_STATE_TEXT)).size, 5);
  assert.ok(!/NotAllowedError|NotFoundError|NotReadableError|audio-capture/.test(
    Object.values(ef.MIC_PERMISSION_STATE_TEXT).join("\n"),
  ));
});

test("AT-65 未授权首次点击只显示开启麦克风", async () => {
  const probe = new FakePermissionProbe("prompt");
  const adapter = new FakeRecognition();
  const controller = new ef.VoiceController({
    adapter,
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
    probe,
    micPage: new FakePermissionPage(),
    now: () => 0,
  });
  await controller.start();
  assert.equal(controller.getView().phase, "idle");
  assert.equal(adapter.startCalls, 0);
  assert.equal(controller.getView().showMicEntry, true);
  assert.ok(controller.getView().statusText.includes("开启麦克风"));
  const sidepanelFiles = await collectSourceFiles(join(root, "src", "sidepanel"));
  for (const path of sidepanelFiles) {
    const source = await readFile(path, "utf8");
    assert.ok(!source.includes("getUserMedia"), path);
  }
  const micPageFiles = await collectSourceFiles(join(root, "src", "mic-permission"));
  const hits = [];
  for (const path of micPageFiles) {
    const source = await readFile(path, "utf8");
    if (source.includes("getUserMedia")) {
      hits.push(path.replaceAll("\\", "/"));
    }
  }
  assert.equal(hits.length, 1);
  assert.ok(hits[0].endsWith("src/mic-permission/request.ts"));
  controller.dispose();
});

test("AT-66 点击开启麦克风只打开固定扩展页", async () => {
  const createdUrls = [];
  const runtime = {
    getURL: (path) => `chrome-extension://test/${path}`,
    countContexts: async () => 0,
    createTab: async (url) => {
      createdUrls.push(url);
      return 1;
    },
  };
  const page = ef.createMicPermissionPage({ runtime });
  const probe = new FakePermissionProbe("prompt");
  const controller = new ef.VoiceController({
    adapter: new FakeRecognition(),
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
    probe,
    micPage: page,
    now: () => 0,
  });
  await controller.requestMicPermission();
  assert.deepEqual(createdUrls, ["chrome-extension://test/mic-permission.html"]);
  assert.equal(controller.getView().pageOpened, true);
  assert.ok(controller.getView().statusText.includes("授权页已打开"));
  const micPageSource = await readFile(
    join(root, "src", "sidepanel", "speech", "micPage.ts"),
    "utf8",
  );
  assert.ok(!/tabs\.query|tabs\.update|tabs\.reload|tabs\.remove/.test(micPageSource));
  assert.ok(!/favIconUrl|pendingUrl/.test(micPageSource));
  controller.dispose();
});

test("AT-67 授权页并发与降级窗口不重复开页", async () => {
  let now = 0;
  const createdUrls = [];
  const runtime = {
    getURL: (path) => `chrome-extension://test/${path}`,
    countContexts: async () => {
      throw new Error("contexts unavailable");
    },
    createTab: async (url) => {
      createdUrls.push(url);
      return 1;
    },
  };
  const page = ef.createMicPermissionPage({ runtime, now: () => now });
  const results = await Promise.all([page.open(), page.open(), page.open(), page.open(), page.open()]);
  assert.equal(results.filter((result) => result === "opened").length, 1);
  assert.equal(createdUrls.length, 1);
  now = 1000;
  assert.equal(await page.open(), "already-open");
  now = 2001;
  assert.equal(await page.open(), "opened");
  assert.equal(createdUrls.length, 2);

  const closedRuntime = {
    getURL: (path) => `chrome-extension://test/${path}`,
    countContexts: async () => 0,
    createTab: async () => 1,
  };
  const closedPage = ef.createMicPermissionPage({ runtime: closedRuntime, now: () => 0 });
  assert.equal(await closedPage.open(), "opened");
  assert.equal(await closedPage.open(), "opened");
});

test("AT-68 已授权直接识别且不重复弹窗", async () => {
  const probe = new FakePermissionProbe("granted");
  const page = new FakePermissionPage();
  const adapter = new FakeRecognition();
  const controller = new ef.VoiceController({
    adapter,
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
    probe,
    micPage: page,
    now: () => 0,
  });
  await controller.start();
  assert.equal(controller.getView().phase, "listening");
  assert.equal(adapter.startCalls, 1);
  assert.equal(page.openCalls, 0);
  assert.equal(controller.getView().showMicEntry, false);
  controller.dispose();
});

test("AT-69 授权成功后立即停止全部音轨", async () => {
  const tracks = [new FakeTrack(), new FakeTrack()];
  const media = new FakeMediaDevices(new FakeStream(tracks));
  const outcome = await ef.requestMicrophone(media);
  assert.equal(outcome, "granted");
  assert.deepEqual(media.lastConstraints, { audio: true });
  assert.equal(tracks[0].stopCalls, 1);
  assert.equal(tracks[1].stopCalls, 1);
  const released = ef.releaseStream(new FakeStream(tracks));
  assert.deepEqual(released, { stopped: 2, failed: 0 });
  const failure = new FakeTrack();
  failure.stop = () => {
    throw new Error("stop failed");
  };
  assert.deepEqual(ef.releaseStream(new FakeStream([failure])), { stopped: 0, failed: 1 });
});

test("AT-70 拒绝权限文案指向扩展来源", async () => {
  assert.equal(ef.mapRecognitionError("not-allowed"), "permission-denied");
  assert.equal(ef.mapMicRequestError("NotAllowedError"), "permission-denied");
  assert.equal(ef.mapMicRequestError({ name: "SecurityError" }), "permission-denied");
  assert.equal(ef.toPermissionState("permission-denied"), "denied");
  const state = ef.voiceInputReducer(ef.createVoiceInputState(), {
    type: "permission-refreshed",
    state: "denied",
    at: 1,
  });
  const view = ef.describeVoiceInput(state);
  assert.ok(view.statusText.includes("麦克风权限未开启"));
  assert.ok(view.statusText.includes("EasyFlow"));
  assert.ok(view.statusText.includes("不是当前网页"));
  assert.ok(!view.statusText.includes("当前网站"));
  assert.ok(view.settingHelpText !== null && view.settingHelpText.includes("EasyFlow"));
  const deniedText = ef.VOICE_STATUS_TEXT["permission-denied"];
  assert.ok(deniedText.includes("麦克风权限未开启"));
  const composer = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "ChatComposer.tsx"),
    "utf8",
  );
  assert.ok(composer.includes("disabled={disabled || text.trim().length === 0}"));
});

test("AT-71 无设备与权限拒绝文案不同", () => {
  assert.equal(ef.mapRecognitionError("audio-capture"), "no-audio-device");
  assert.equal(ef.mapMicRequestError("NotFoundError"), "no-audio-device");
  assert.equal(ef.mapMicRequestError("OverconstrainedError"), "no-audio-device");
  const state = ef.voiceInputReducer(listeningState(), {
    type: "adapter-error",
    kind: "no-audio-device",
    cancelledByUser: false,
  });
  assert.equal(state.phase, "permission-denied");
  assert.equal(state.issue, "no-audio-device");
  const status = ef.describeVoiceInput(state).statusText;
  assert.ok(status.includes("没有检测到可用的麦克风"));
  assert.ok(!status.includes("权限未开启"));
});

test("AT-72 系统禁用/被占用文案独立", () => {
  assert.equal(ef.mapMicRequestError("NotReadableError"), "device-unavailable");
  assert.equal(ef.mapMicRequestError("TrackStartError"), "device-unavailable");
  const state = ef.voiceInputReducer(listeningState(), {
    type: "adapter-error",
    kind: "device-unavailable",
    cancelledByUser: false,
  });
  assert.equal(state.phase, "failed");
  assert.equal(state.issue, "device-unavailable");
  assert.ok(ef.describeVoiceInput(state).statusText.includes("被系统关闭或被其他应用占用"));
  const texts = [
    ef.MIC_PERMISSION_DENIED_TEXT,
    ef.VOICE_ISSUE_TEXT["service-limited"],
    ef.VOICE_ISSUE_TEXT["no-audio-device"],
    ef.VOICE_ISSUE_TEXT["device-unavailable"],
    ef.VOICE_ISSUE_TEXT.network,
  ];
  assert.equal(new Set(texts).size, 5);
});

test("AT-73 服务受限不再叫没权限", () => {
  assert.equal(ef.mapRecognitionError("service-not-allowed"), "service-limited");
  const state = ef.voiceInputReducer(listeningState(), {
    type: "adapter-error",
    kind: "service-limited",
    cancelledByUser: false,
  });
  assert.equal(state.phase, "failed");
  assert.equal(state.issue, "service-limited");
  const status = ef.describeVoiceInput(state).statusText;
  assert.ok(status.includes("语音服务不可用或被浏览器限制"));
  assert.ok(!status.includes("权限未开启"));
  const granted = ef.voiceInputReducer(ef.createVoiceInputState(), {
    type: "permission-refreshed",
    state: "granted",
    at: 1,
  });
  assert.equal(ef.describeVoiceInput(granted).showMicEntry, false);
});

test("AT-74 网络失败文案独立且不泄漏原始错误", () => {
  const state = ef.voiceInputReducer(listeningState(), {
    type: "adapter-error",
    kind: "network",
    cancelledByUser: false,
  });
  assert.equal(state.phase, "failed");
  assert.equal(state.issue, "network");
  assert.ok(ef.describeVoiceInput(state).statusText.includes("网络或语音服务暂不可用"));
  const values = [
    ...Object.values(ef.VOICE_STATUS_TEXT),
    ...Object.values(ef.VOICE_ISSUE_TEXT),
  ].join("\n");
  assert.ok(
    !/NotAllowedError|NotFoundError|NotReadableError|no-speech|audio-capture|service-not-allowed|network/.test(
      values,
    ),
  );
});

test("AT-75 重试复核、迟到消息与并发去重", async () => {
  const adapter = new FakeRecognition();
  const staleController = new ef.VoiceController({
    adapter,
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
    probe: new FakePermissionProbe("prompt"),
    micPage: new FakePermissionPage(),
    now: () => 100,
  });
  await staleController.refreshPermission();
  staleController.applyMicResult("permission-denied", 50);
  assert.equal(staleController.getPermission(), "prompt");
  staleController.applyMicResult("permission-denied", 150);
  assert.equal(staleController.getPermission(), "denied");
  staleController.dispose();

  const grantedProbe = new FakePermissionProbe("granted");
  const grantedPage = new FakePermissionPage();
  const grantedController = new ef.VoiceController({
    adapter: new FakeRecognition(),
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
    probe: grantedProbe,
    micPage: grantedPage,
    now: () => 0,
  });
  await grantedController.start();
  await grantedController.requestMicPermission();
  assert.equal(grantedPage.openCalls, 0);
  grantedController.dispose();

  const promptPage = new FakePermissionPage();
  const promptController = new ef.VoiceController({
    adapter: new FakeRecognition(),
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
    probe: new FakePermissionProbe("prompt"),
    micPage: promptPage,
    now: () => 0,
  });
  await Promise.all([
    promptController.requestMicPermission(),
    promptController.requestMicPermission(),
    promptController.requestMicPermission(),
    promptController.requestMicPermission(),
    promptController.requestMicPermission(),
  ]);
  assert.equal(promptPage.openCalls, 1);
  promptController.dispose();
});

test("AT-76 识别结果只进输入框不自动发送", async () => {
  const adapter = new FakeRecognition();
  const controller = new ef.VoiceController({
    adapter,
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
    probe: new FakePermissionProbe("granted"),
    now: () => 0,
  });
  await controller.start();
  adapter.emit({ type: "final", text: "我想了解办理条件" });
  assert.equal(controller.getView().pendingText, "我想了解办理条件");
  assert.equal(controller.getView().revision, 1);
  const composer = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "ChatComposer.tsx"),
    "utf8",
  );
  const effectStart = composer.indexOf("useEffect(() => {");
  const effectEnd = composer.indexOf("}, [voice.view.revision");
  const effect = composer.slice(effectStart, effectEnd);
  assert.ok(!effect.includes("submit"));
  assert.ok(!effect.includes("focus"));
  const controllerSource = await readFile(
    join(root, "src", "sidepanel", "speech", "voiceController.ts"),
    "utf8",
  );
  assert.ok(!controllerSource.includes("onSend"));
  controller.dispose();
});

test("AT-77 麦克风失败不影响朗读", async () => {
  const synth = new FakeSynthesis();
  const controller = new ef.SpeechController({ adapter: synth, now: () => 0 });
  controller.speak({ kind: "step-action", text: "现在请选择可用时间" });
  assert.equal(synth.speakCalls, 1);
  controller.stop();
  assert.equal(synth.stopCalls, 1);
  controller.dispose();
  const synthesisSource = await readFile(
    join(root, "src", "sidepanel", "speech", "synthesis.ts"),
    "utf8",
  );
  assert.ok(!/permission|MIC_|micPermission/.test(synthesisSource));
  const speakMachine = await readFile(
    join(root, "src", "shared", "speech", "speakMachine.ts"),
    "utf8",
  );
  assert.ok(!/permission|MIC_|micPermission/.test(speakMachine));
});

test("AT-78 授权页构建、HTML 引用与路径常量", async () => {
  const buildSource = await readFile(join(root, "scripts", "build.mjs"), "utf8");
  assert.ok(buildSource.includes("src/mic-permission/main.tsx"));
  assert.ok(buildSource.includes("mic-permission.html"));
  const micBlock = buildSource.slice(
    buildSource.indexOf("async function buildMicPermission"),
    buildSource.indexOf("async function copyStatic"),
  );
  assert.ok(micBlock.includes("minify: false"));
  const html = await readFile(join(root, "public", "mic-permission.html"), "utf8");
  assert.ok(html.includes('src="mic-permission.js"'));
  assert.ok(html.includes('href="mic-permission.css"'));
  assert.ok(!/https?:\/\//i.test(html));
  const constants = await readFile(
    join(root, "src", "shared", "speech", "constants.ts"),
    "utf8",
  );
  assert.ok(constants.includes('"mic-permission.html"'));
});

test("AT-79 门禁例外精确且侧栏不含 getUserMedia", async () => {
  const verifySource = await readFile(
    join(root, "scripts", "verify-manifest.mjs"),
    "utf8",
  );
  const exceptions = [
    ...verifySource.matchAll(
      /scope: "(src|dist)",\s*path: "([^"]+)",\s*pattern: "getUserMedia"/g,
    ),
  ];
  assert.equal(exceptions.length, 2);
  for (const match of exceptions) {
    assert.ok(!/[*?]/.test(match[2]), match[2]);
    assert.ok(!match[2].endsWith("/"), match[2]);
  }
  const forbiddenBlock = verifySource.slice(
    verifySource.indexOf("const runtimeForbidden"),
    verifySource.indexOf("const sourceForbidden"),
  );
  assert.ok(forbiddenBlock.includes('"MediaRecorder"'));
  assert.ok(forbiddenBlock.includes('"fetch("'));
  assert.ok(!forbiddenBlock.includes('"getUserMedia"'));
  const sidepanel = await readFile(join(root, "dist", "sidepanel.js"), "utf8");
  assert.ok(!sidepanel.includes("getUserMedia"));
});

test("AT-80 消息最小化、文案单源与入口尺寸", async () => {
  const notification = ef.createMicPermissionResult("granted", 1);
  assert.deepEqual(Object.keys(notification).sort(), ["at", "result", "type", "v"]);
  assert.ok(JSON.stringify(notification).length < 120);
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(notification)));
  assert.equal(ef.isMicPermissionResult(notification), true);
  for (const invalid of [
    { ...notification, v: 2 },
    { ...notification, result: "ok" },
    { ...notification, at: 0 },
    { ...notification, at: Number.NaN },
    { type: "EF_GET_CONTEXT", v: 1, requestId: "x" },
  ]) {
    assert.equal(ef.isMicPermissionResult(invalid), false);
  }
  assert.equal(new Set(Object.values(ef.MIC_PERMISSION_STATE_TEXT)).size, 5);
  assert.ok(ef.MIC_SETTING_HELP_TEXT.includes("EasyFlow"));
  assert.ok(ef.MIC_PERMISSION_DENIED_TEXT.includes("不是当前网页"));
  assert.ok(!ef.MIC_PERMISSION_DENIED_TEXT.includes("当前网站"));
  const css = await readFile(
    join(root, "src", "sidepanel", "styles", "sidepanel.css"),
    "utf8",
  );
  assert.ok(/\.ef-speech-open-btn\s*\{[^}]*min-height:\s*var\(--ef-tap-min\)/s.test(css));
  for (const dir of [
    join(root, "src", "shared", "speech"),
    join(root, "src", "sidepanel", "speech"),
    join(root, "src", "mic-permission"),
  ]) {
    for (const path of await collectSourceFiles(dir)) {
      const source = await readFile(path, "utf8");
      assert.ok(!source.includes("chrome.storage"), path);
    }
  }
});
test("AT-46 阅读模式偏好：默认、保存、非法与最小序列化", () => {
  assert.equal(ef.normalizeUiMode(undefined), "normal");
  assert.equal(ef.normalizeUiMode("care"), "care");
  assert.equal(ef.normalizeUiMode("huge"), "normal");
  assert.deepEqual(ef.parseStoredUiMode("care"), { mode: "care", issue: null });
  assert.deepEqual(ef.parseStoredUiMode({ v: 2, mode: "care" }), {
    mode: "normal",
    issue: "invalid",
  });
  assert.deepEqual(ef.parseStoredUiMode({}), { mode: "normal", issue: "invalid" });
  assert.deepEqual(ef.parseStoredUiMode(undefined), { mode: "normal", issue: "missing" });
  assert.deepEqual(ef.parseStoredUiMode("huge"), { mode: "normal", issue: "invalid" });
  const stored = ef.serializeUiMode("care", 1);
  assert.deepEqual(Object.keys(stored).sort(), ["mode", "updatedAt", "v"]);
  const serialized = JSON.stringify(stored);
  for (const key of ["url", "title", "text", "snapshot"]) {
    assert.ok(!serialized.includes(key), key);
  }
});

test("AT-47 短句与原文分层且 ref 不变", () => {
  const date = makeControl(1, "2026年11月17日星期二，可预约", "button", {
    kind: "date",
    context: "calendar",
    selected: true,
  });
  const target = makeControl(2, "2026年11月17日星期二 02:15 (Asia/Shanghai)", "button", {
    kind: "time",
    context: "time-list",
  });
  const snapshot = makePageSnapshot([], { controls: [date, target] });
  const copy = ef.buildStepCardCopy({
    targetControl: target,
    snapshot,
    completionCondition: { kind: "control-selected", controlRef: target.ref },
  });
  assert.ok(copy.shortText.includes("02:15"), copy.shortText);
  assert.equal(copy.includesTime, true);
  assert.ok(!copy.shortText.includes("2026年11月17日星期二"));
  assert.equal(copy.rawLabel, target.label);
  assert.deepEqual(copy.targetRef, target.ref);
  assert.equal(copy.sourceSnapshotId, snapshot.snapshotId);
  assert.ok(ef.estimateCopyWidth(copy.shortText) <= 24, String(ef.estimateCopyWidth(copy.shortText)));
});

test("AT-48 短句回退、多日期/多时区歧义与最长限定", () => {
  const select = makeControl(1, "Select", "button", { kind: "generic" });
  const selectCopy = ef.buildStepCardCopy({
    targetControl: select,
    snapshot: makePageSnapshot([], { controls: [select] }),
    completionCondition: { kind: "user-confirmed" },
  });
  assert.equal(selectCopy.shortText, "现在请在网页上选择对应项");
  assert.equal(selectCopy.fallbackReason, "unparseable");

  const truncated = makeControl(2, "2026年11月17日星期二 02:", "button", {
    kind: "time",
    context: "time-list",
    labelTruncated: true,
  });
  const truncatedCopy = ef.buildStepCardCopy({
    targetControl: truncated,
    snapshot: makePageSnapshot([], { controls: [truncated] }),
    completionCondition: { kind: "control-selected", controlRef: truncated.ref },
  });
  assert.ok(truncatedCopy.fallbackReason);
  assert.ok(!truncatedCopy.shortText.includes("2026"));
  assert.ok(!truncatedCopy.shortText.includes("02:"));
  assert.equal(truncatedCopy.labelTruncated, true);

  const d1 = makeControl(3, "2026年11月16日星期一", "button", {
    kind: "date",
    context: "calendar",
    selected: true,
  });
  const d2 = makeControl(4, "2026年11月17日星期二", "button", {
    kind: "date",
    context: "calendar",
  });
  const t1 = makeControl(5, "2026年11月16日星期一 02:15 (Asia/Shanghai)", "button", {
    kind: "time",
    context: "time-list",
  });
  const multiCopy = ef.buildStepCardCopy({
    targetControl: t1,
    snapshot: makePageSnapshot([], { controls: [d1, d2, t1] }),
    completionCondition: { kind: "control-selected", controlRef: t1.ref },
  });
  assert.ok(multiCopy.shortText.includes("11月16日"), multiCopy.shortText);
  assert.ok(multiCopy.shortText.includes("02:15"));
  assert.ok(ef.estimateCopyWidth(multiCopy.shortText) <= 24);

  const d3 = makeControl(6, "2026年11月18日星期三", "button", {
    kind: "date",
    context: "calendar",
  });
  const t2 = makeControl(7, "2026年11月18日星期三 02:15 (Asia/Shanghai)", "button", {
    kind: "time",
    context: "time-list",
  });
  const ambiguous = ef.buildStepCardCopy({
    targetControl: t2,
    snapshot: makePageSnapshot([], { controls: [d2, d3, t2] }),
    completionCondition: { kind: "control-selected", controlRef: t2.ref },
  });
  assert.equal(ambiguous.shortText, "现在请在网页上选择对应项");
  assert.equal(ambiguous.fallbackReason, "ambiguous-date");

  const tz8 = makeControl(8, "2026年11月16日 02:15 (GMT+8)", "button", {
    kind: "time",
    context: "time-list",
  });
  const tz9 = makeControl(9, "2026年11月16日 02:15 (GMT+9)", "button", {
    kind: "time",
    context: "time-list",
  });
  const tzCopy = ef.buildStepCardCopy({
    targetControl: tz8,
    snapshot: makePageSnapshot([], { controls: [d1, tz8, tz9] }),
    completionCondition: { kind: "control-selected", controlRef: tz8.ref },
  });
  assert.ok(tzCopy.shortText.includes("GMT+8"), tzCopy.shortText);
  assert.ok(ef.estimateCopyWidth(tzCopy.shortText) <= 24);

  const tzMissing = makeControl(10, "2026年11月16日 03:15", "button", {
    kind: "time",
    context: "time-list",
  });
  const tzMissingCopy = ef.buildStepCardCopy({
    targetControl: tzMissing,
    snapshot: makePageSnapshot([], { controls: [d1, tz8, tz9, tzMissing] }),
    completionCondition: { kind: "control-selected", controlRef: tzMissing.ref },
  });
  assert.equal(tzMissingCopy.fallbackReason, "ambiguous-timezone");
});

test("AT-49 旧卡/成功态不渲染可执行结构", () => {
  assert.equal(ef.shouldShowCompletion("expired"), false);
  assert.equal(ef.stepCardLayout("expired").primary, null);
  assert.equal(ef.stepCardLayout("expired").secondary.length, 0);
  assert.equal(ef.stepCardLayout("expired").showDetails, false);
  assert.equal(ef.stepCardLayout("ended").primary, null);
  assert.equal(ef.stepCardLayout("ended").showDetails, false);
  assert.equal(ef.stepCardLayout("current").primary, "locate");
  assert.equal(ef.stepCardLayout("current").secondary.length, 4);
  assert.equal(ef.stepCardActions("current").length, 5);
});

test("AT-50 样式 token、偏好契约与源码清洁", async () => {
  const css = await readFile(
    join(root, "src", "sidepanel", "styles", "sidepanel.css"),
    "utf8",
  );
  for (const needle of [
    'html[data-ui-mode="care"]',
    "--ef-font-body: 18px",
    "--ef-font-current: 22px",
    "--ef-primary-min-h: 48px",
    "--ef-tap-min: 44px",
    "prefers-reduced-motion: reduce",
    "max-height: var(--ef-composer-max-h)",
    "100dvh",
    ":focus-visible",
  ]) {
    assert.ok(css.includes(needle), needle);
  }
  assert.ok(!/ef-voice-btn|ef-mode-notice/.test(css));

  const composer = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "ChatComposer.tsx"),
    "utf8",
  );
  assert.ok(!composer.includes("语音未开放"));
  const about = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "AboutPanel.tsx"),
    "utf8",
  );
  assert.ok(about.includes("在线智能已连接"));
  assert.ok(about.includes("SPEECH_DISCLOSURE_TEXT"));
  assert.ok(!about.includes("语音暂未开放"));
  const speechCopy = await readFile(
    join(root, "src", "shared", "speech", "copy.ts"),
    "utf8",
  );
  assert.ok(speechCopy.includes("可能使用"));
  assert.ok(speechCopy.includes("不保存音频"));

  const messages = await readFile(join(root, "src", "shared", "messages.ts"), "utf8");
  assert.ok(messages.includes('mode?: "normal" | "care"'));
  const highlight = await readFile(join(root, "src", "content", "highlight.ts"), "utf8");
  assert.ok(highlight.includes("HIGHLIGHT_CARE_BORDER_WIDTH"));

  const sourceFiles = await collectSourceFiles(join(root, "src"));
  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8");
    assert.ok(!/02:00|02:15|03:00/.test(source), `${path} 含测试时刻字面量`);
  }
});
class FakeRecognition {
  constructor() {
    this.startCalls = 0;
    this.cancelCalls = 0;
    this.lastOptions = null;
    this.listener = null;
    this.disposed = false;
  }

  start(options) {
    this.startCalls += 1;
    this.lastOptions = options;
  }

  cancel() {
    this.cancelCalls += 1;
  }

  subscribe(listener) {
    this.listener = listener;
    return () => {
      if (this.listener === listener) {
        this.listener = null;
      }
    };
  }

  dispose() {
    this.disposed = true;
    this.listener = null;
  }

  emit(event) {
    if (!this.disposed) {
      this.listener?.(event);
    }
  }

  emitError({ kind, raw, code }) {
    this.emit({
      type: "error",
      kind,
      raw,
      ...(code === undefined ? {} : { code }),
      errorSource: "onerror",
    });
  }

  emitEnd() {
    this.emit({ type: "ended" });
  }

  emitAborted(code) {
    this.emit({
      type: "error",
      kind: "aborted",
      raw: "other",
      ...(code === undefined ? {} : { code }),
      errorSource: "onerror",
    });
  }
}

class FakeSynthesis {
  constructor() {
    this.speakCalls = 0;
    this.stopCalls = 0;
    this.lastOptions = null;
    this.listener = null;
    this.disposed = false;
  }

  speak(options) {
    this.speakCalls += 1;
    this.lastOptions = options;
  }

  stop() {
    this.stopCalls += 1;
  }

  subscribe(listener) {
    this.listener = listener;
    return () => {
      if (this.listener === listener) {
        this.listener = null;
      }
    };
  }

  dispose() {
    this.disposed = true;
    this.listener = null;
  }

  emit(event) {
    if (!this.disposed) {
      this.listener?.(event);
    }
  }
}

function listeningState() {
  return ef.voiceInputReducer(ef.createVoiceInputState(), {
    type: "start-requested",
    supported: true,
  });
}

test("AT-51 语音输入：开始→识别→填入但未发送", async () => {
  const fake = new FakeRecognition();
  const controller = new ef.VoiceController({
    adapter: fake,
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
  });
  controller.start();
  assert.equal(controller.getView().phase, "listening");
  assert.equal(fake.startCalls, 1);
  assert.ok(controller.getView().statusText.includes("正在听"));
  assert.equal(controller.getView().showDisclosure, true);
  controller.start();
  assert.equal(fake.startCalls, 1);
  fake.emit({ type: "final", text: "帮我看看" });
  assert.equal(controller.getView().pendingText, "帮我看看");
  assert.equal(controller.getView().revision, 1);
  assert.ok(controller.getView().statusText.includes("已识别"));

  const composer = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "ChatComposer.tsx"),
    "utf8",
  );
  assert.ok(composer.includes("voice.view.revision"));
  assert.ok(composer.includes("consumePending"));
  const effectStart = composer.indexOf("useEffect(() => {");
  const effectEnd = composer.indexOf("}, [voice.view.revision");
  assert.ok(effectStart >= 0 && effectEnd > effectStart);
  const effect = composer.slice(effectStart, effectEnd);
  assert.ok(!effect.includes("submit"));
  assert.ok(!effect.includes("focus"));
  const about = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "AboutPanel.tsx"),
    "utf8",
  );
  assert.ok(about.includes("SPEECH_DISCLOSURE_TEXT"));
  controller.dispose();
});

test("AT-52 取消识别后迟到结果不写入", () => {
  const fake = new FakeRecognition();
  const controller = new ef.VoiceController({
    adapter: fake,
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
  });
  controller.start();
  controller.cancel();
  assert.equal(controller.getView().phase, "cancelled");
  assert.ok(controller.getView().statusText.includes("已取消"));
  assert.equal(fake.cancelCalls, 1);
  const cancelledView = controller.getView();
  fake.emit({ type: "final", text: "迟到的识别" });
  assert.equal(controller.getView(), cancelledView);
  assert.equal(controller.getView().pendingText, null);
  controller.cancel();
  assert.equal(fake.cancelCalls, 1);
  controller.dispose();
});

test("AT-53 权限拒绝保留文字输入并可重试", async () => {
  const fake = new FakeRecognition();
  const controller = new ef.VoiceController({
    adapter: fake,
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
  });
  controller.start();
  fake.emit({ type: "error", kind: "permission-denied" });
  assert.equal(controller.getView().phase, "permission-denied");
  assert.ok(controller.getView().statusText.includes("麦克风"));
  assert.equal(controller.getView().canStart, true);
  const merged = ef.mergeTranscript("原文", "新内容", ef.MAX_TURN_CHARS);
  assert.equal(merged.ok, true);
  assert.ok(merged.text.startsWith("原文"));
  const composer = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "ChatComposer.tsx"),
    "utf8",
  );
  assert.ok(composer.includes("disabled={disabled || text.trim().length === 0}"));
  controller.dispose();
});

test("AT-54 不支持语音识别时降级为文字输入", async () => {
  assert.equal(ef.detectRecognitionSupport({}), "unsupported");
  assert.equal(ef.detectRecognitionSupport({ SpeechRecognition: () => undefined }), "supported");
  assert.equal(ef.detectRecognitionSupport({ webkitSpeechRecognition: () => undefined }), "supported");
  const state = ef.voiceInputReducer(ef.createVoiceInputState(), {
    type: "start-requested",
    supported: false,
  });
  const view = ef.describeVoiceInput(state);
  assert.equal(view.phase, "unsupported");
  assert.equal(view.canStart, false);
  assert.ok(view.statusText.includes("不支持"));

  const componentFiles = await collectSourceFiles(
    join(root, "src", "sidepanel", "components"),
  );
  for (const path of componentFiles) {
    const source = await readFile(path, "utf8");
    assert.ok(
      !/SpeechRecognition|webkitSpeechRecognition|speechSynthesis|SpeechSynthesisUtterance/.test(
        source,
      ),
      `${path} 不应直接接触语音全局对象`,
    );
  }
  const control = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "VoiceInputControl.tsx"),
    "utf8",
  );
  assert.ok(control.includes("disabled={!view.canStart}"));
});

test("AT-55 未识别与网络失败文案不含原始错误串", () => {
  assert.equal(ef.mapRecognitionError("no-speech"), "no-speech");
  assert.equal(ef.mapRecognitionError("network"), "network");
  const noSpeech = ef.voiceInputReducer(listeningState(), {
    type: "adapter-error",
    kind: "no-speech",
    cancelledByUser: false,
  });
  assert.equal(noSpeech.phase, "no-speech");
  // 第七轮 R-269：no-speech 改为独立单句，不再与“未识别”通用句混用。
  assert.ok(ef.describeVoiceInput(noSpeech).statusText.includes("没有听到"));
  assert.equal(ef.describeVoiceInput(noSpeech).statusText, ef.SPEECH_NO_SPEECH_TEXT);
  const network = ef.voiceInputReducer(listeningState(), {
    type: "adapter-error",
    kind: "network",
    cancelledByUser: false,
  });
  assert.equal(network.phase, "failed");
  assert.equal(network.issue, "network");
  assert.ok(ef.describeVoiceInput(network).statusText.includes("网络或语音服务暂不可用"));
  const values = [
    ...Object.values(ef.VOICE_STATUS_TEXT),
    ...Object.values(ef.VOICE_ISSUE_TEXT),
  ].join("\n");
  assert.ok(!/NotAllowedError|no-speech|audio-capture|network/.test(values));
  const timeout = ef.voiceInputReducer(listeningState(), { type: "timeout" });
  assert.equal(timeout.phase, "no-speech");
  assert.equal(timeout.issue, "timeout");
  assert.ok(ef.describeVoiceInput(timeout).statusText.includes("没有听到"));
});

test("AT-56 重复点击只保留一个识别会话", () => {
  const fake = new FakeRecognition();
  const controller = new ef.VoiceController({
    adapter: fake,
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
  });
  controller.start();
  controller.start();
  controller.start();
  assert.equal(fake.startCalls, 1);
  const listening = listeningState();
  assert.equal(
    ef.voiceInputReducer(listening, { type: "start-requested", supported: true }),
    listening,
  );
  fake.emit({ type: "final", text: "只写一次" });
  assert.equal(controller.getView().revision, 1);
  const view = controller.getView();
  assert.equal(controller.getView(), view);
  assert.equal(controller.getView(), view);
  controller.dispose();
});

test("AT-57 切换任务/卸载停止且迟到事件被丢弃", async () => {
  const fake = new FakeRecognition();
  const controller = new ef.VoiceController({
    adapter: fake,
    detect: () => "supported",
    limit: ef.MAX_TURN_CHARS,
  });
  controller.start();
  controller.cancel();
  assert.equal(controller.getView().phase, "cancelled");
  controller.invalidate();
  assert.equal(controller.getView().phase, "idle");
  assert.equal(controller.getView().pendingText, null);
  controller.cancel();
  controller.invalidate();
  assert.ok(fake.cancelCalls <= 2);
  fake.emit({ type: "final", text: "迟到" });
  assert.equal(controller.getView().phase, "idle");
  controller.dispose();

  const voiceHook = await readFile(
    join(root, "src", "sidepanel", "hooks", "useVoiceInput.ts"),
    "utf8",
  );
  assert.ok(voiceHook.includes("dispose("));
  assert.ok(voiceHook.includes("cancel("));
  const speechHook = await readFile(
    join(root, "src", "sidepanel", "hooks", "useSpeechSynthesis.ts"),
    "utf8",
  );
  assert.ok(speechHook.includes("stop("));
  assert.ok(speechHook.includes("dispose("));

  const synth = new FakeSynthesis();
  const speech = new ef.SpeechController({ adapter: synth, now: () => 0 });
  speech.speak({ kind: "step-action", text: "读我" });
  speech.invalidate();
  assert.equal(synth.stopCalls, 1);
  speech.dispose();
});

test("AT-58 超长识别不覆盖原文", async () => {
  assert.equal(ef.MAX_TURN_CHARS, 500);
  assert.equal(
    ef.mergeTranscript("a".repeat(480), "b".repeat(40), ef.MAX_TURN_CHARS).ok,
    false,
  );
  assert.equal(ef.mergeTranscript("", "b".repeat(501), ef.MAX_TURN_CHARS).ok, false);
  const tooLong = ef.voiceInputReducer(listeningState(), {
    type: "adapter-final",
    merge: { ok: false, reason: "too-long" },
  });
  assert.equal(tooLong.phase, "failed");
  assert.equal(tooLong.issue, "too-long");
  assert.equal(tooLong.pendingText, null);
  assert.ok(ef.describeVoiceInput(tooLong).statusText.includes("精简"));
  const composer = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "ChatComposer.tsx"),
    "utf8",
  );
  assert.ok(composer.includes("maxLength={MAX_TURN_CHARS}"));
});

test("AT-59 朗读/停止只调用一次且参数正确", () => {
  const fake = new FakeSynthesis();
  const controller = new ef.SpeechController({ adapter: fake, now: () => 0 });
  controller.speak({ kind: "step-action", text: "现在请点一个时段" });
  assert.equal(fake.speakCalls, 1);
  assert.equal(fake.lastOptions.lang, "zh-CN");
  assert.equal(fake.lastOptions.rate, ef.SPEECH_RATE);
  assert.equal(fake.lastOptions.text, "现在请点一个时段");
  assert.ok(controller.getView().speakingKey !== null);
  controller.stop();
  assert.equal(fake.stopCalls, 1);
  controller.stop();
  assert.equal(fake.stopCalls, 1);
  assert.equal(ef.SPEAK_LABELS.step, "朗读这一步");
  assert.equal(ef.SPEAK_LABELS.stop, "停止朗读");
  controller.dispose();
});

test("AT-60 同一句在重复窗口内不重复朗读", () => {
  let now = 0;
  const fake = new FakeSynthesis();
  const controller = new ef.SpeechController({ adapter: fake, now: () => now });
  const request = { kind: "step-action", text: "同一句" };
  controller.speak(request);
  controller.speak(request);
  controller.speak(request);
  assert.equal(fake.speakCalls, 1);
  fake.emit({ type: "ended" });
  controller.speak(request);
  assert.equal(fake.speakCalls, 1);
  now = ef.SPEECH_REPEAT_WINDOW_MS;
  controller.speak(request);
  assert.equal(fake.speakCalls, 2);
  controller.dispose();
});

test("AT-61 朗读白名单与个人信息跳过", async () => {
  const sensitiveText = `联系 ${"a"}${"@"}${"example.test"}`;
  const check = ef.checkSpeakText({ kind: "step-action", text: sensitiveText });
  assert.equal(check.allowed, false);
  assert.equal(check.reason, "sensitive");
  const fake = new FakeSynthesis();
  const controller = new ef.SpeechController({ adapter: fake, now: () => 0 });
  controller.speak({ kind: "step-action", text: sensitiveText });
  assert.equal(fake.speakCalls, 0);
  assert.ok(controller.getView().note.includes("个人信息"));
  controller.dispose();

  const stepCardSpeech = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "StepCardSpeech.tsx"),
    "utf8",
  );
  assert.ok(stepCardSpeech.includes("speech.speak({ kind, text })"));
  const stepCard = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "StepCard.tsx"),
    "utf8",
  );
  assert.ok(stepCard.includes("text={copy.shortText}"));
  const messageList = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "MessageList.tsx"),
    "utf8",
  );
  assert.ok(messageList.includes("text={message.text}"));
  const sources = `${stepCardSpeech}\n${stepCard}\n${messageList}`;
  assert.ok(!/speak\([^)]*(rawLabel|completionText|citation)/.test(sources));
  assert.ok(!/speak\(\{[^}]*limitation/.test(sources));
});

test("AT-62 文案去重八变体与源码断言", async () => {
  const shortText = "现在请点 09:30";
  const dedupe = (text, extra = {}) =>
    ef.stripDuplicateStepText({
      text,
      stepGoal: shortText,
      shortText,
      responseType: "next-step",
      cardActive: true,
      ...extra,
    });

  const v1 = dedupe("先做这一步：现在请点 09:30。");
  assert.equal(v1.hidden, true);
  assert.ok(v1.removed >= 1);
  const v2 = dedupe("原来要点的“09:00”现在已经不在页面上了。现在这一步是“09:30”。");
  assert.equal(v2.text, "原来要点的“09:00”现在已经不在页面上了。");
  const v3 = dedupe("这一步完成了。下一步：现在请点 09:30。");
  assert.equal(v3.text, "这一步完成了。");
  const v4 = dedupe("我按当前页面重新看了一遍。现在请点 09:30。");
  assert.equal(v4.text, "我按当前页面重新看了一遍。");
  const v5 = dedupe("先做这一步：我想预约这个会议。", {
    stepGoal: "我想预约这个会议",
    shortText,
  });
  assert.equal(v5.hidden, true);
  const v6 = dedupe("先做这一步：现在请点 09:30。", { cardActive: false });
  assert.equal(v6.hidden, false);
  assert.equal(v6.removed, 0);
  assert.equal(v6.text, "先做这一步：现在请点 09:30。");
  const v7 = dedupe("当前页面没有找到这项信息。", { responseType: "direct-answer" });
  assert.equal(v7.text, "当前页面没有找到这项信息。");
  assert.equal(v7.hidden, false);
  const v8 = dedupe("现在请点 09:30", { shortText: "" });
  assert.equal(v8.hidden, false);
  assert.equal(v8.removed, 0);
  assert.equal(ef.STEP_LEAD_PATTERNS.length, 8);

  const ruleEngine = await readFile(
    join(root, "src", "sidepanel", "dialogue", "rule", "RuleEngine.ts"),
    "utf8",
  );
  assert.ok(!ruleEngine.includes("text.includes(step.goal)"));
  assert.ok(!ruleEngine.includes("先做这一步："));
  assert.ok(!ruleEngine.includes("现在这一步是"));
  const conversation = await readFile(
    join(root, "src", "sidepanel", "hooks", "useConversation.ts"),
    "utf8",
  );
  assert.ok(!conversation.includes("text.includes(step.goal)"));
  assert.ok(!conversation.includes("现在这一步是"));
  assert.equal(ef.stepCardStateTag("current"), "当前步骤");
  assert.equal(ef.stepCardLabel("current"), "现在这一步");
  const stepCard = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "StepCard.tsx"),
    "utf8",
  );
  assert.ok(stepCard.includes("已过期"));
  assert.ok(stepCard.includes("expired"));
  const app = await readFile(join(root, "src", "sidepanel", "App.tsx"), "utf8");
  assert.ok(app.includes("planActive"));
});

test("AT-63 关怀尺寸、告知与回归红线", async () => {
  const css = await readFile(
    join(root, "src", "sidepanel", "styles", "sidepanel.css"),
    "utf8",
  );
  assert.ok(css.includes("--ef-tap-min"));
  assert.ok(css.includes("--ef-primary-min-h"));
  assert.ok(/\.ef-speech-btn\s*\{[^}]*min-height:\s*var\(--ef-tap-min\)/s.test(css));
  assert.ok(/\.ef-speak-btn\s*\{[^}]*min-height:\s*var\(--ef-tap-min\)/s.test(css));
  assert.ok(
    /\.ef-step-actions-line\s*>\s*\.ef-step-primary\s*\{[^}]*min-height:\s*var\(--ef-primary-min-h\)/s.test(
      css,
    ),
  );
  assert.ok(css.includes(".ef-step-actions-line"));
  assert.ok(!css.includes("ef-voice-btn"));
  assert.ok(!css.includes("ef-mode-notice"));

  const about = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "AboutPanel.tsx"),
    "utf8",
  );
  assert.ok(about.includes("SPEECH_DISCLOSURE_TEXT"));
  assert.ok(!about.includes("语音暂未开放"));
  assert.ok(ef.SPEECH_DISCLOSURE_TEXT.includes("可能使用"));
  assert.ok(ef.SPEECH_DISCLOSURE_TEXT.includes("不保存音频"));
  const copyValues = [
    ...Object.values(ef.VOICE_STATUS_TEXT),
    ...Object.values(ef.VOICE_ISSUE_TEXT),
    ...Object.values(ef.SPEAK_LABELS),
    ...Object.values(ef.SPEAK_NOTE_TEXT),
    ef.SPEECH_DISCLOSURE_TEXT,
  ].join("\n");
  assert.ok(!copyValues.includes("离线"));

  const manifest = JSON.parse(await readFile(join(root, "public", "manifest.json"), "utf8"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "sidePanel", "storage"]);
});
const normalRoundConfig = {
  pulseDurationMs: 600,
  pulseCount: 3,
  ttlMs: 4000,
  care: false,
  reducedMotion: false,
  supportsAnimate: true,
};

test("AT-106 高亮单轮状态机与计数不变式", () => {
  let state = ef.createRoundState();
  assert.equal(state.phase, "idle");
  assert.equal(state.roundId, 0);
  assert.equal(state.timing.ttlAt, null);

  state = ef.reduceRound(state, { type: "round-start", now: 1000, config: normalRoundConfig });
  assert.equal(state.phase, "pulsing");
  assert.equal(state.counters.roundStartCount, 1);
  assert.equal(state.counters.pulseStartCount, 1);
  assert.equal(state.counters.cleanupScheduledCount, 1);
  assert.equal(state.counters.overlayCreateCount, 1);
  assert.equal(state.counters.overlayLiveCount, 1);
  assert.equal(state.timing.ttlAt, 5000);
  assert.equal(state.timing.pulseEndsAt, 2800);

  for (let index = 0; index < 3; index += 1) {
    state = ef.reduceRound(state, { type: "position-updated", now: 1100 + index });
    state = ef.reduceRound(state, { type: "dom-tick", now: 1100 + index });
  }
  assert.equal(state.counters.positionUpdateCount, 3);
  assert.equal(state.counters.domTickCount, 3);
  assert.equal(state.timing.ttlAt, 5000);

  const early = ef.reduceRound(state, { type: "pulse-complete", now: 2000 });
  assert.equal(early, state);
  state = ef.reduceRound(state, { type: "pulse-complete", now: 2800 });
  assert.equal(state.phase, "static");
  assert.equal(state.counters.pulseCompletedCount, 1);

  state = ef.reduceRound(state, { type: "cleanup", now: 5000, reason: "ttl" });
  assert.equal(state.phase, "cleared");
  assert.equal(state.counters.cleanupFiredCount, 1);
  assert.equal(state.counters.overlayLiveCount, 0);
  assert.equal(state.timing.ttlAt, null);
  assert.equal(state.timing.highlightLifetimeMs, 4000);

  const noop = ef.reduceRound(state, { type: "cleanup", now: 6000, reason: "noop" });
  assert.equal(noop.counters.cleanupNoopCount, 1);
  assert.equal(noop.timing.lastCleanupAt, 5000);

  let rounds = ef.createRoundState();
  rounds = ef.reduceRound(rounds, { type: "round-start", now: 0, config: normalRoundConfig });
  rounds = ef.reduceRound(rounds, { type: "cleanup", now: 100, reason: "replaced" });
  rounds = ef.reduceRound(rounds, { type: "round-start", now: 200, config: normalRoundConfig });
  rounds = ef.reduceRound(rounds, { type: "cleanup", now: 300, reason: "replaced" });
  rounds = ef.reduceRound(rounds, { type: "round-start", now: 400, config: normalRoundConfig });
  assert.equal(rounds.counters.roundStartCount, 3);
  assert.equal(rounds.counters.cleanupReplacedCount, 2);
  assert.equal(rounds.counters.overlayLiveMax, 1);
});

test("AT-107 高亮常量关系与静态实现约束", async () => {
  assert.equal(ef.CONTENT_VERSION, "0.3.0");
  assert.equal(ef.HIGHLIGHT_PULSE_DURATION_MS, 600);
  assert.equal(ef.HIGHLIGHT_PULSE_COUNT, 3);
  assert.equal(ef.HIGHLIGHT_PULSE_DURATION_MS * ef.HIGHLIGHT_PULSE_COUNT, 1800);
  assert.ok(ef.HIGHLIGHT_PULSE_DURATION_MS * ef.HIGHLIGHT_PULSE_COUNT <= 2000);
  assert.ok(ef.HIGHLIGHT_TTL_MS >= 1800 + ef.HIGHLIGHT_STATIC_MIN_MS);
  assert.equal(ef.HIGHLIGHT_HOST_ATTR, "data-ef-highlight");
  assert.equal(ef.HIGHLIGHT_ROUND_ATTR, "data-ef-round");
  assert.equal(ef.HIGHLIGHT_BOX_POOL_MAX, 60);
  assert.equal(ef.HIGHLIGHT_STATS_SERIALIZED_MAX_CHARS, 1024);

  const source = await readFile(join(root, "src", "content", "highlight.ts"), "utf8");
  assert.ok(!source.includes("750"));
  assert.ok(!source.includes("4000"));
  assert.ok(!source.includes("iterations: 3"));
  assert.ok(!source.includes("setInterval"));
  assert.ok(!source.includes("querySelectorAll"));
  const measureStart = source.indexOf("function measure(");
  const measureEnd = source.indexOf("export function highlightRef");
  const measureBody = source.slice(measureStart, measureEnd);
  assert.ok(measureBody.indexOf("scrollIntoView") < measureBody.indexOf("buildTextHighlight"));
  const updateStart = source.indexOf("function updateOverlayPositions");
  const updateEnd = source.indexOf("function scheduleOverlayUpdate");
  const updateBody = source.slice(updateStart, updateEnd);
  assert.ok(updateBody.includes("positionBoxes(boxes)"));
  assert.ok(!updateBody.includes("startPulse"));
  const finishStart = source.indexOf("function finish(");
  const finishEnd = source.indexOf("export function cleanupHighlight");
  const finishBody = source.slice(finishStart, finishEnd);
  assert.ok(finishBody.indexOf("clearSessionResources") < finishBody.indexOf("target.host.remove"));
  assert.ok(
    finishBody.indexOf("target.host.remove") <
      finishBody.lastIndexOf('type: "cleanup"'),
  );
  assert.ok(finishBody.includes("syncHosts"));
});

test("AT-108 关怀与减少动态始终静态", () => {
  for (const config of [
    { ...normalRoundConfig, care: true },
    { ...normalRoundConfig, reducedMotion: true },
    { ...normalRoundConfig, supportsAnimate: false },
  ]) {
    assert.equal(ef.isPulsing(config), false);
    const state = ef.reduceRound(ef.createRoundState(), {
      type: "round-start",
      now: 10,
      config,
    });
    assert.equal(state.phase, "static");
    assert.equal(state.counters.pulseStartCount, 0);
    assert.equal(state.counters.roundStartCount, 1);
    assert.equal(state.timing.pulseEndsAt, null);
  }
});

test("AT-109 清理原因可辨且替换不叠加", () => {
  let state = ef.reduceRound(ef.createRoundState(), {
    type: "round-start",
    now: 0,
    config: normalRoundConfig,
  });
  state = ef.reduceRound(state, { type: "cleanup", now: 500, reason: "replaced" });
  assert.equal(state.counters.cleanupReplacedCount, 1);
  assert.equal(state.counters.cleanupFiredCount, 0);
  assert.equal(state.timing.lastCleanupReason, "replaced");

  for (const reason of ["ttl", "collect", "pagehide", "unroute"]) {
    let next = ef.reduceRound(ef.createRoundState(), {
      type: "round-start",
      now: 0,
      config: normalRoundConfig,
    });
    next = ef.reduceRound(next, { type: "cleanup", now: 100, reason });
    assert.equal(next.counters.cleanupFiredCount, 1, reason);
    assert.equal(next.timing.lastCleanupReason, reason);
    assert.equal(next.counters.overlayLiveCount, 0);
  }

  const idleNoop = ef.reduceRound(ef.createRoundState(), {
    type: "cleanup",
    now: 100,
    reason: "noop",
  });
  assert.equal(idleNoop.counters.cleanupNoopCount, 1);
  assert.equal(idleNoop.timing.lastCleanupAt, null);
});

test("AT-110 宿主复核与框池计数", () => {
  let state = ef.reduceRound(ef.createRoundState(), {
    type: "round-start",
    now: 0,
    config: normalRoundConfig,
  });
  state = ef.reduceRound(state, { type: "hosts-measured", now: 1, live: 0, legacy: 1 });
  assert.equal(state.counters.overlayLiveCount, 0);
  assert.equal(state.counters.overlayLiveMax, 1);
  assert.equal(state.counters.legacyHostCount, 1);

  state = ef.reduceRound(state, {
    type: "boxes-synced",
    now: 2,
    created: 3,
    removed: 0,
    visible: 3,
  });
  state = ef.reduceRound(state, {
    type: "boxes-synced",
    now: 3,
    created: 0,
    removed: 0,
    visible: 2,
  });
  assert.equal(state.counters.boxCreateCount, 3);
  assert.equal(state.counters.boxRemoveCount, 0);
  assert.equal(state.counters.boxCount, 2);
});

test("AT-111 高亮统计只含计数与时间", async () => {
  const stats = {
    refCalls: 1,
    roundStartCount: 1,
    pulseStartCount: 1,
    pulseCompletedCount: 1,
    overlayCreateCount: 1,
    overlayLiveCount: 0,
    overlayLiveMax: 1,
    legacyHostCount: 0,
    cleanupScheduledCount: 1,
    cleanupFiredCount: 1,
    cleanupReplacedCount: 0,
    cleanupNoopCount: 0,
    cleanupReason: "ttl",
    positionUpdateCount: 2,
    domTickCount: 1,
    boxCreateCount: 1,
    boxRemoveCount: 0,
    boxCount: 0,
    uiModeAtRequest: "normal",
    reducedMotionAtRequest: false,
    lastRoundStartAt: 100,
    lastRoundEndAt: 1900,
    lastCleanupAt: 4100,
    highlightLifetimeMs: 4000,
    contentVersionSeen: "0.3.0",
    expectedContentVersion: "0.3.0",
    pageInjectionCount: 1,
  };
  assert.equal(Object.keys(stats).length, 27);
  const serialized = JSON.stringify(stats);
  assert.ok(serialized.length <= ef.HIGHLIGHT_STATS_SERIALIZED_MAX_CHARS);
  assert.ok(!/https?:|用户输入|网页标题|查询串/.test(serialized));

  const source = await readFile(join(root, "src", "content", "highlight.ts"), "utf8");
  assert.ok(source.includes("contentVersionSeen: \"\""));
  assert.ok(!source.includes("document.title"));
  assert.ok(!source.includes("location.href"));
  assert.ok(!source.includes("querySelectorAll"));
  assert.ok(source.includes("legacyHostCount"));
  assert.ok(source.includes("cleanupReplacedCount"));
  assert.ok(source.includes("cleanupNoopCount"));
});

test("AT-112 侧栏 CSS 单 token 源与视觉约束", async () => {
  const css = await readFile(
    join(root, "src", "sidepanel", "styles", "sidepanel.css"),
    "utf8",
  );
  assert.equal((css.match(/:root\s*\{/g) ?? []).length, 1);
  assert.ok(css.includes('html[data-ui-mode="care"]'));
  assert.ok(css.includes("--ef-font-body: 18px"));
  assert.ok(css.includes("--ef-font-current: 22px"));
  assert.ok(css.includes("--ef-primary-min-h: 48px"));
  assert.ok(css.includes("--ef-tap-min: 44px"));
  assert.ok(css.includes("linear-gradient(135deg, #fff 30%, #f5eeff 100%)"));
  assert.ok(css.includes("--ef-primary: #5b42ed"));
  assert.ok(css.includes("@media (max-width: 420px)"));
  assert.ok(css.includes("@media (max-width: 320px)"));
  assert.ok(css.includes("prefers-reduced-motion: reduce"));
  assert.ok(css.includes(":focus-visible"));
  assert.ok(/\.ef-step-actions-line\s*>\s*\.ef-step-primary\s*\{[^}]*min-height:\s*var\(--ef-primary-min-h\)/s.test(css));
  assert.ok(/\.ef-speech-open-btn\s*\{[^}]*min-height:\s*var\(--ef-tap-min\)/s.test(css));
  assert.ok(/\.ef-speak-btn\s*\{[^}]*min-height:\s*var\(--ef-tap-min\)/s.test(css));
});

test("AT-113 高亮诊断接线且不记录网页文本", async () => {
  const hook = await readFile(
    join(root, "src", "sidepanel", "hooks", "useConversation.ts"),
    "utf8",
  );
  assert.ok(hook.includes("highlightRequestCount"));
  assert.ok(hook.includes("setHighlightStats"));
  const app = await readFile(join(root, "src", "sidepanel", "App.tsx"), "utf8");
  assert.ok(app.includes("highlightStats"));
  assert.ok(app.includes("highlightRequestCount"));
  const panel = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "DiagnosticsPanel.tsx"),
    "utf8",
  );
  assert.ok(panel.includes("高亮"));
  assert.ok(panel.includes("pageInjectionCount"));
  assert.ok(!panel.includes("document.title"));
  assert.ok(!panel.includes("location.href"));
  assert.ok(!panel.includes("innerText"));
});

test("AT-114 高亮改动回归与边界", async () => {
  const manifest = JSON.parse(await readFile(join(root, "public", "manifest.json"), "utf8"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "sidePanel", "storage"]);
  assert.equal(ef.stepCardActions("current").length, 5);
  assert.equal(Object.keys(ef.RAW_ERROR_CODE_LABEL).length, 8);
  assert.equal(ef.SPEAK_LABELS.step, "朗读这一步");

  const verifySource = await readFile(
    join(root, "scripts", "verify-manifest.mjs"),
    "utf8",
  );
  const exceptions = [
    ...verifySource.matchAll(
      /scope: "(src|dist)",\s*path: "([^"]+)",\s*pattern: "getUserMedia"/g,
    ),
  ];
  assert.equal(exceptions.length, 2);

  for (const dir of [
    join(root, "src", "shared", "speech"),
    join(root, "src", "sidepanel", "speech"),
    join(root, "src", "mic-permission"),
  ]) {
    for (const path of await collectSourceFiles(dir)) {
      const source = await readFile(path, "utf8");
      assert.ok(!source.includes("chrome.storage"), path);
      assert.ok(!source.includes("MediaRecorder"), path);
    }
  }
});
test("AT-116 在线模式未就绪不启用且回退提示可区分", () => {
  assert.equal(ef.shouldUseOnlineModel(false, true), false);
  assert.equal(ef.shouldUseOnlineModel(true, false), false);
  assert.equal(ef.shouldUseOnlineModel(false, false), false);
  assert.equal(ef.shouldUseOnlineModel(true, true), true);
  for (const reason of [
    "timeout",
    "network",
    "outbound-blocked",
    "ungrounded",
    "unsafe-control",
    "unsafe-instruction",
    "validation",
  ]) {
    assert.ok(ef.fallbackNotice(reason).length > 0, reason);
  }
  assert.notEqual(ef.fallbackNotice("timeout"), ef.fallbackNotice("unsafe-control"));
  assert.equal(ef.shouldUseOnlineModel(true, true), true);
});

test("AT-117 Key 不进入源码产物与示例文件", async () => {
  const keyPattern = /sk-[A-Za-z0-9]{20,}/;
  for (const file of [
    "src/sidepanel/dialogue/model/ModelEngine.ts",
    "scripts/model-proxy.mjs",
    "scripts/model-proxy-lib.mjs",
    ".env.example",
    "package.json",
    "public/manifest.json",
  ]) {
    const source = await readFile(join(root, file), "utf8");
    assert.ok(!keyPattern.test(source), file);
  }
  const example = await readFile(join(root, ".env.example"), "utf8");
  assert.ok(example.includes("your_deepseek_api_key_here"));
  assert.ok(!example.includes("sk-"));
  const gitignore = await readFile(join(root, ".gitignore"), "utf8");
  assert.ok(/^\.env\.\*/m.test(gitignore) || gitignore.includes(".env.local"));
  let envLocalExists = true;
  try {
    await readFile(join(root, ".env.local"), "utf8");
  } catch {
    envLocalExists = false;
  }
  assert.equal(envLocalExists, false);
});

test("AT-118 姓名标签替换与无标签严格阻断", () => {
  const labeled = ef.sanitizeNameText("申请人：张三，请办理");
  assert.equal(labeled.blocked, false);
  assert.ok(!labeled.text.includes("张三"));
  assert.ok(labeled.text.includes("姓名"));
  assert.equal(labeled.risk.labeled, 1);

  const honorific = ef.sanitizeNameText("请联系张三先生");
  assert.equal(honorific.blocked, true);
  assert.ok(ef.detectNameRisk("张三先生").unlabeled >= 1);

  const source = {
    utterance: "姓名：张三",
    domain: "example.test",
    title: "示例",
    url: "https://example.test/a?token=secret",
    segments: [],
    controls: [],
  };
  const pass = ef.sanitizeOutbound(source);
  assert.equal(pass.status, "pass");
  assert.ok(!JSON.stringify(pass.payload).includes("张三"));
  const blocked = ef.sanitizeOutbound({ ...source, utterance: "请联系张三先生" });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.reason, "name-risk");
});

test("AT-119 出站键白名单与查询串移除", () => {
  const outbound = ef.sanitizeOutbound({
    utterance: "办理条件是什么",
    domain: "example.test",
    title: "示例",
    url: "https://example.test/a?token=secret#x",
    segments: [],
    controls: [],
    slots: { object: "13800138000" },
  });
  assert.equal(outbound.status, "pass");
  assert.deepEqual(Object.keys(outbound.payload).sort(), [
    "controls",
    "page",
    "segments",
    "truncated",
    "utterance",
  ]);
  assert.equal("slots" in outbound.payload, false);
  assert.equal("bytes" in outbound.payload, false);
  assert.ok(!JSON.stringify(outbound.payload).includes("token=secret"));
  assert.ok(!JSON.stringify(outbound.payload).includes("13800138000"));
  assert.ok(!("slots" in outbound.payload));
});

test("AT-120 模型无依据与不安全文本整体回退", async () => {
  const title = makeItem(1, "办理条件", { type: "heading", elementId: "ef-h-1" });
  const body = makeItem(2, "年满80周岁可以申请。", { elementId: "ef-p-2" });
  const safe = makeControl(1, "选择日期", "button", { kind: "date" });
  const snapshot = makePageSnapshot([title, body], {
    segments: [makeSegment(1, title, [body])],
    controls: [safe],
  });
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: { kind: "answer", answer: "年满80周岁可以申请。", evidence: [] } }) });
    const model = new ef.ModelDialogueEngine();
    await assert.rejects(
      () => model.respond(makeRequest("申请条件是什么", snapshot)),
      /model-fallback:ungrounded/,
    );
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: { kind: "step", text: "请提交申请。", controlId: safe.controlId } }) });
    await assert.rejects(
      () => model.respond(makeRequest("下一步点哪里", snapshot)),
      /model-fallback:/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AT-121 代理仅本机且拒绝越权载荷", () => {
  assert.equal(proxyLib.isLocalHostHeader("127.0.0.1:8765"), true);
  assert.equal(proxyLib.isLocalHostHeader("localhost:8765"), true);
  assert.equal(proxyLib.isLocalHostHeader("evil.example:8765"), false);
  assert.equal(proxyLib.isAllowedOrigin("chrome-extension://abc", "abc"), true);
  assert.equal(proxyLib.isAllowedOrigin("https://evil.test", "abc"), false);
  assert.equal(proxyLib.isAllowedOrigin("", "abc"), false);
  assert.equal(proxyLib.validateProxyPayload({ slots: {} }).ok, false);
  assert.equal(proxyLib.validateProxyPayload({ bytes: 1 }).ok, false);
  assert.equal(proxyLib.validateProxyPayload({ utterance: "问题", page: {}, segments: [], controls: [] }).ok, true);
  const headers = proxyLib.corsHeaders("chrome-extension://abc", true);
  assert.equal(headers["Access-Control-Allow-Origin"], "chrome-extension://abc");
  assert.equal(headers["Access-Control-Allow-Private-Network"], "true");
  assert.equal(proxyLib.classifyProxyError(new Error("request-too-large")), "request-too-large");
  assert.equal(proxyLib.classifyProxyError(new Error("provider-http-500")), "upstream-error");
  assert.equal(proxyLib.PROXY_HOST, "127.0.0.1");
  assert.equal(proxyLib.PROXY_TIMEOUT_MS, 10000);
});

test("AT-122 回退原因与就绪门控已接线", async () => {
  assert.equal(ef.fallbackReasonOf(new ef.ModelFallbackError("timeout")), "timeout");
  assert.equal(ef.fallbackReasonOf(new ef.ModelFallbackError("outbound-blocked")), "outbound-blocked");
  assert.ok(ef.fallbackNotice("timeout").includes("本地规则"));
  const hook = await readFile(
    join(root, "src", "sidepanel", "hooks", "useConversation.ts"),
    "utf8",
  );
  assert.ok(hook.includes("shouldUseOnlineModel"));
  assert.ok(hook.includes("fallbackNotice"));
  assert.ok(hook.includes("modelFallbackNotified"));
  assert.ok(hook.includes("modelReadyRef"));
  const app = await readFile(join(root, "src", "sidepanel", "App.tsx"), "utf8");
  assert.ok(app.includes("modelMode.ready"));
});

test("AT-123 紫色系 token 与既有视觉约束", async () => {
  const css = await readFile(
    join(root, "src", "sidepanel", "styles", "sidepanel.css"),
    "utf8",
  );
  assert.equal((css.match(/:root\s*\{/g) ?? []).length, 1);
  assert.ok(css.includes("--ef-primary: #5b42ed"));
  assert.ok(css.includes("linear-gradient(135deg, #fff 30%, #f5eeff 100%)"));
  assert.ok(css.includes("--ef-bg: #faf8ff"));
  assert.ok(css.includes("--ef-text: #1f1a38"));
  assert.ok(css.includes("--ef-muted: #5b5378"));
  assert.ok(css.includes('--ef-border-strong: #8f7fd6'));
  assert.ok(css.includes("--ef-font-body: 18px"));
  assert.ok(css.includes("--ef-font-current: 22px"));
  assert.ok(css.includes("--ef-primary-min-h: 48px"));
  assert.ok(css.includes("--ef-tap-min: 44px"));
  assert.ok(/html\[data-ui-mode="care"\] \.ef-senior-quick-actions button\s*\{[^}]*min-height:\s*44px/s.test(css));
  assert.ok(/\.ef-senior-questions button\s*\{[^}]*min-height:\s*max\(38px, var\(--ef-tap-min\)\)/s.test(css));
  assert.ok(css.includes(":focus-visible"));
  assert.ok(css.includes("prefers-reduced-motion: reduce"));
  const app = await readFile(join(root, "src", "sidepanel", "App.tsx"), "utf8");
  assert.ok(app.includes('className="ef-senior-quick-actions" role="group" aria-label="常用帮助"'));
});
test("AT-124 对外品牌统一为 EasyFlow 且内部标识保留", async () => {
  assert.equal(ef.BRAND_NAME, "EasyFlow");
  assert.equal(ef.BRAND_PAGE_TITLE, "EasyFlow 页面指引");
  assert.equal(ef.BRAND_MIC_TITLE, "EasyFlow 麦克风授权");
  const sourceFiles = await collectSourceFiles(join(root, "src"));
  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8");
    assert.ok(!source.includes("\u6570\u754c\u901a"), path);
  }
  const constants = await readFile(join(root, "src", "shared", "constants.ts"), "utf8");
  assert.ok(constants.includes("easyflow.goal"));
  const header = await readFile(join(root, "src", "sidepanel", "components", "chat", "ChatHeader.tsx"), "utf8");
  assert.ok(header.includes("BRAND_NAME"));
  assert.ok(header.includes("BRAND_TAGLINE"));
  const micCopy = await readFile(join(root, "src", "shared", "speech", "copy.ts"), "utf8");
  assert.ok(micCopy.includes("EasyFlow"));
  assert.ok(!micCopy.includes("\u6570\u754c\u901a"));
  assert.ok(!micCopy.includes("EASYFLOW_MODEL"));
});

test("AT-125 静态品牌、标题与 0.4.0 版本", async () => {
  const manifest = JSON.parse(await readFile(join(root, "public", "manifest.json"), "utf8"));
  assert.equal(manifest.name, "EasyFlow 页面指引");
  assert.equal(manifest.version, "0.4.0");
  assert.equal(manifest.action.default_title, "打开EasyFlow侧边栏");
  assert.equal(manifest.manifest_version, 3);
  const sidepanel = await readFile(join(root, "public", "sidepanel.html"), "utf8");
  assert.ok(sidepanel.includes("<title>EasyFlow 页面指引</title>"));
  const mic = await readFile(join(root, "public", "mic-permission.html"), "utf8");
  assert.ok(mic.includes("<title>EasyFlow 麦克风授权</title>"));
  const install = await readFile(join(root, "public", "index.html"), "utf8");
  assert.ok(install.includes("<title>EasyFlow 页面指引</title>"));
  assert.ok(install.includes("版本 0.4.0"));
  assert.ok(install.includes("EasyFlow · 0.4.0"));
  assert.ok(!install.includes("\u6570\u754c\u901a"));
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(pkg.version, "0.4.0");
  const readme = await readFile(join(root, "README.md"), "utf8");
  assert.ok(readme.startsWith("# EasyFlow"));
  assert.ok(!readme.includes("\u6570\u754c\u901a"));
});

test("AT-126 工具栏图标 PNG 头合法", async () => {
  for (const size of [16, 32, 48, 128]) {
    const buffer = await readFile(join(root, "dist", "icons", `icon${size}.png`));
    assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(buffer.readUInt32BE(16), size);
    assert.equal(buffer.readUInt32BE(20), size);
    assert.equal(buffer[24], 8);
    assert.equal(buffer[25], 6);
    assert.ok(buffer.length > 100);
  }
});

function decodeIconPng(buffer) {
  const size = buffer.readUInt32BE(16);
  let offset = 8;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
    if (type === "IEND") break;
  }
  const raw = inflateSync(Buffer.concat(idat));
  return { size, raw };
}

function pixelAt(raw, size, x, y) {
  const rowStart = y * (size * 4 + 1);
  const index = rowStart + 1 + x * 4;
  return { r: raw[index], g: raw[index + 1], b: raw[index + 2], a: raw[index + 3] };
}

test("AT-127 图标透明角与紫色主体", async () => {
  for (const size of [16, 32, 48, 128]) {
    const { raw } = decodeIconPng(await readFile(join(root, "dist", "icons", `icon${size}.png`)));
    for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
      assert.equal(pixelAt(raw, size, x, y).a, 0, `${size} corner ${x},${y}`);
    }
    const centre = pixelAt(raw, size, Math.floor(size / 2), Math.round(size * 0.52));
    assert.ok(centre.a > 0, `${size} centre alpha`);
    assert.ok(centre.r > 220 && centre.g > 220 && centre.b > 220, `${size} white e crossbar`);
  }
});

test("AT-128 输入区单一滚动与自适应高度", async () => {
  const css = await readFile(join(root, "src", "sidepanel", "styles", "sidepanel.css"), "utf8");
  const composerBlock = css.slice(css.indexOf(".ef-composer {"), css.indexOf(".ef-composer-box {"));
  assert.ok(composerBlock.includes("max-height: var(--ef-composer-max-h)"));
  assert.ok(!composerBlock.includes("overflow-y: auto"));
  assert.ok(!css.includes("max-height: 36vh"));
  assert.ok(css.includes("--ef-input-min-h"));
  assert.ok(css.includes("--ef-input-max-h"));
  const composer = await readFile(join(root, "src", "sidepanel", "components", "chat", "ChatComposer.tsx"), "utf8");
  assert.ok(composer.includes("rows={2}"));
  assert.ok(composer.includes("useAutosizeTextarea"));
  assert.ok(composer.includes("ref={inputRef}"));
  assert.equal(ef.INPUT_MIN_ROWS, 2);
  assert.equal(ef.INPUT_MAX_ROWS, 6);
  assert.equal(ef.INPUT_MAX_VIEWPORT_RATIO, 0.2);
  assert.equal(ef.COMPOSER_MAX_VIEWPORT_RATIO, 0.32);
});

test("AT-129 麦克风说明按需展开与焦点管理", async () => {
  const source = await readFile(join(root, "src", "sidepanel", "components", "chat", "VoiceInputControl.tsx"), "utf8");
  assert.ok(source.includes("micGuideOpen"));
  assert.ok(source.includes("setMicGuideOpen(true)"));
  assert.ok(source.includes("aria-expanded={view.showMicEntry ? micGuideOpen : undefined}"));
  assert.ok(source.includes('aria-controls={view.showMicEntry ? "ef-mic-guide" : undefined}'));
  assert.ok(source.includes('id="ef-mic-guide"'));
  assert.ok(source.includes('role="region"'));
  assert.ok(source.includes("hidden={!micGuideOpen}"));
  assert.ok(source.includes("startRef"));
  assert.ok(source.includes("startRef.current?.focus()"));
  assert.ok(source.includes("!view.showMicEntry"));
});

test("AT-130 视觉 token、单 root 与 450px 断点", async () => {
  const css = await readFile(join(root, "src", "sidepanel", "styles", "sidepanel.css"), "utf8");
  assert.equal((css.match(/:root\s*\{/g) ?? []).length, 1);
  assert.ok(css.includes("--ef-tint-lilac"));
  assert.ok(css.includes("--ef-tint-pink"));
  assert.ok(css.includes("--ef-tint-warm"));
  assert.ok(css.includes("--ef-note-ink"));
  assert.ok(css.includes("@media (max-width: 450px)"));
  assert.ok(css.includes("@media (max-width: 360px)"));
  assert.ok(css.includes("@media (max-width: 320px)"));
  assert.ok(css.includes(":focus-visible"));
  assert.ok(css.includes("prefers-reduced-motion: reduce"));
  assert.ok(css.includes("--ef-primary: #5b42ed"));
});

test("AT-131 长者关怀尺寸与大字不回退", async () => {
  const css = await readFile(join(root, "src", "sidepanel", "styles", "sidepanel.css"), "utf8");
  const care = css.slice(css.indexOf('html[data-ui-mode="care"]'), css.indexOf("/* Layer 3"));
  assert.ok(care.includes("--ef-font-body: 18px"));
  assert.ok(care.includes("--ef-font-current: 22px"));
  assert.ok(care.includes("--ef-tap-min: 44px"));
  assert.ok(care.includes("--ef-primary-min-h: 48px"));
  assert.ok(care.includes("--ef-focus-width: 3px"));
});
test("AT-132 任务进度按实际步骤重算且不由指给我看完成", () => {
  const dateStep = { targetControl: { kind: "date" } };
  const timeStep = { targetControl: { kind: "time" } };
  const nextStep = { targetControl: { kind: "next" } };
  const plan = {
    planId: "p",
    version: 1,
    goal: "我想预约会议",
    status: "active",
    currentIndex: 0,
    steps: [{}],
  };
  const dateProgress = ef.buildTaskProgress(plan, dateStep, false);
  assert.deepEqual(dateProgress.map((stage) => stage.label), ["选择日期", "选择时间", "填写信息", "确认预约"]);
  assert.deepEqual(dateProgress.map((stage) => stage.status), ["current", "next", "next", "next"]);
  const timeProgress = ef.buildTaskProgress(plan, timeStep, false);
  assert.deepEqual(timeProgress.map((stage) => stage.status), ["done", "current", "next", "next"]);
  const nextProgress = ef.buildTaskProgress(plan, nextStep, false);
  assert.deepEqual(nextProgress.map((stage) => stage.status), ["done", "done", "current", "next"]);
  const success = ef.buildTaskProgress(plan, nextStep, true);
  assert.deepEqual(success.map((stage) => stage.status), ["done", "done", "done", "done"]);
  const generic = ef.buildTaskProgress(
    { ...plan, goal: "办理业务", steps: [{ goal: "选网点" }, { goal: "填资料" }], currentIndex: 1 },
    { targetControl: { kind: "generic" } },
    false,
  );
  assert.deepEqual(generic.map((stage) => stage.status), ["done", "current"]);
  assert.equal(ef.buildTaskProgress(null, null, false), null);
  const rescheduleForm = {
    url: "https://cal.com/example/15min?rescheduleUid=test",
    items: [{ type: "inputLabel", text: "您的姓名" }, { type: "inputLabel", text: "邮箱地址" }],
    controls: [],
  };
  const formProgress = ef.buildTaskProgress(null, null, false, rescheduleForm);
  assert.deepEqual(formProgress.map((stage) => stage.status), ["done", "done", "current", "next"]);
  assert.equal(formProgress.at(-1).label, "确认重新安排");
  assert.equal(ef.buildTaskProgress(null, null, false, { ...rescheduleForm, url: "https://example.com/form", title: "普通表单" }), null);
  const unconfirmed = ef.buildTaskProgress({ ...plan, status: "completed" }, nextStep, false, rescheduleForm);
  assert.notEqual(unconfirmed.at(-1).status, "done", "a finished local plan is not proof of submission");
});

test("AT-133 简洁导览可退出且不删除/不阻挡网页", async () => {
  const focus = await readFile(join(root, "src", "sidepanel", "pageFocus.ts"), "utf8");
  assert.ok(focus.includes("ef-page-focus-host"));
  assert.ok(focus.includes("pointerEvents = \"none\""));
  assert.ok(focus.includes("remove()"));
  assert.ok(focus.includes("no-target"));
  assert.ok(!focus.includes("innerHTML"));
  assert.ok(!focus.includes(".removeChild(document.body"));
  const app = await readFile(join(root, "src", "sidepanel", "App.tsx"), "utf8");
  assert.ok(app.includes("applyPageFocus"));
  assert.ok(app.includes("clearPageFocus"));
  assert.ok(app.includes("simpleMode"));
  const status = await readFile(
    join(root, "src", "sidepanel", "components", "chat", "PageStatusLine.tsx"),
    "utf8",
  );
  assert.ok(status.includes("简洁导览"));
  assert.ok(status.includes("原始网页"));
  assert.ok(status.includes("aria-pressed={simpleMode}"));
});
