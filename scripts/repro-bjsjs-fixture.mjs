import { build } from "esbuild";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const tempDir = join(root, ".tmp-repro-fixture");
const engineFile = join(tempDir, "engine.mjs");

await build({
  absWorkingDir: root,
  stdin: {
    contents: [
      'export { ruleEngine } from "./src/sidepanel/dialogue/rule/RuleEngine.ts";',
      'export { buildSegments } from "./src/content/semantic.ts";',
      'export { buildQuery, retrieveSegments } from "./src/sidepanel/dialogue/retrieval/segmentRetriever.ts";',
      'export { validateResponse } from "./src/sidepanel/dialogue/validate/validator.ts";',
      'export { extractReusableObject, sanitizeReusableObject } from "./src/sidepanel/dialogue/context/topic.ts";',
      'export { conversationReducer, createConversationState } from "./src/sidepanel/state/conversationReducer.ts";',
    ].join("\n"),
    resolveDir: root,
    sourcefile: "repro-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile: engineFile,
  logLevel: "silent",
});

const ef = await import(pathToFileURL(engineFile).href);
const captured = JSON.parse(
  await readFile(join(root, "scripts", "fixtures", "bjsjs-captured-items.json"), "utf8"),
);
const segments = ef.buildSegments(captured.items);
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
  itemCount: captured.items.length,
  items: captured.items,
  segments,
  controls: [],
  truncated: false,
};

function makeRequest(utterance, context) {
  return {
    schemaVersion: 1,
    turnId: "turn-repro-fixture",
    utterance,
    context: {
      recent: [],
      currentGoal: context.currentGoal ?? "",
      pageChanged: false,
      ...(context.lastObject === undefined ? {} : { lastObject: context.lastObject }),
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
    segments,
    controls: [],
    plan: null,
    capabilities: { modelConfigured: false, voiceEnabled: false },
  };
}

function summarizeHits(hits) {
  return hits.map((hit) => ({
    segmentId: hit.segment.segmentId,
    titleText: hit.segment.titleText,
    score: hit.score,
    matchedKeywords: hit.matchedKeywords,
    bodyTexts: hit.segment.bodyTexts,
  }));
}

function summarizeAnswer(result) {
  return {
    responseType: result.responseType,
    text: result.text,
    citations: result.citations.map((citation) => ({
      role: citation.role,
      text: citation.text,
      elementId: citation.ref.elementId,
    })),
    validation: ef.validateResponse(result, snapshot, null),
  };
}

const savedTopic = ef.extractReusableObject("高龄津贴谁能申请", snapshot.title, undefined);
if (savedTopic === undefined) {
  throw new Error("无法提取第一轮业务话题");
}
let conversationState = ef.createConversationState();
conversationState = ef.conversationReducer(conversationState, {
  type: "last-object",
  object: savedTopic,
});

const q1Slots = { condition: "谁", object: savedTopic };
const q2Slots = { action: "办理", object: savedTopic };
const q3Slots = { material: "材料", object: savedTopic };
const q1Query = ef.buildQuery("高龄津贴谁能申请", q1Slots, "");
const q2Query = ef.buildQuery("那怎么办理", q2Slots, savedTopic);
const q3Query = ef.buildQuery("那需要带什么", q3Slots, savedTopic);
const numberOfHits = 5;
const q1Hits = ef.retrieveSegments(q1Query, segments, numberOfHits, q1Slots);
const q2Hits = ef.retrieveSegments(q2Query, segments, numberOfHits, q2Slots);
const q3Hits = ef.retrieveSegments(q3Query, segments, numberOfHits, q3Slots);
const q1 = await ef.ruleEngine.respond(makeRequest("高龄津贴谁能申请", {}));
const q2 = await ef.ruleEngine.respond(
  makeRequest("那怎么办理", {
    currentGoal: conversationState.lastObject ?? "",
    lastObject: conversationState.lastObject,
  }),
);
const legacyQ2 = await ef.ruleEngine.respond(
  makeRequest("那怎么办理", {
    currentGoal: "高龄津贴谁能申请",
    lastObject: "高龄津贴谁能申请",
  }),
);
const materialTopic = ef.extractReusableObject("那需要带什么", snapshot.title, savedTopic);
const q3 = await ef.ruleEngine.respond(
  makeRequest("那需要带什么", {
    currentGoal: materialTopic ?? "",
    lastObject: materialTopic,
  }),
);
const unknown = await ef.ruleEngine.respond(
  makeRequest("体检条件是什么", {
    currentGoal: materialTopic ?? "",
    lastObject: materialTopic,
  }),
);

const relevantPattern = /(办理条件|办理流程|发放标准|日期|来源|本市户籍|网上申请|现场申请|街道|身份证|户口簿)/;
const report = {
  label: "after-fixture",
  verificationMode: "local-fixture-reproduction",
  isRealSiteAcceptance: false,
  note: "本地原始条目夹具全链路；不是访问真实网站，也不是真实网站验收。",
  fixtureSource: "scripts/fixtures/bjsjs-captured-items.json",
  capturedAt: new Date().toISOString(),
  sourceUrl: captured.sourceUrl,
  savedTopic,
  simulatedStateLastObject: conversationState.lastObject,
  materialTopic,
  itemCount: snapshot.itemCount,
  segmentCount: segments.length,
  relevantItems: captured.items
    .filter((item) => relevantPattern.test(item.text))
    .map((item) => ({
      elementId: item.elementId,
      type: item.type,
      tagName: item.tagName,
      text: item.text,
      domPath: item.domPath,
      titleCandidate: item.titleCandidate ?? false,
      order: item.order,
    })),
  relevantSegments: segments
    .filter((segment) => relevantPattern.test(segment.titleText) || relevantPattern.test(segment.text))
    .map((segment) => ({
      segmentId: segment.segmentId,
      titleText: segment.titleText,
      hasBody: segment.hasBody,
      bodyTexts: segment.bodyTexts,
      textLength: segment.text.length,
      orderRange: segment.orderRange,
    })),
  q1: {
    query: q1Query,
    hits: summarizeHits(q1Hits),
    answer: summarizeAnswer(q1),
  },
  q2: {
    query: q2Query,
    hits: summarizeHits(q2Hits),
    answer: summarizeAnswer(q2),
  },
  legacyQ2: {
    query: q2Query,
    hits: summarizeHits(q2Hits),
    answer: summarizeAnswer(legacyQ2),
  },
  q3: {
    query: q3Query,
    hits: summarizeHits(q3Hits),
    answer: summarizeAnswer(q3),
  },
  unknown: {
    query: "体检条件是什么",
    answer: summarizeAnswer(unknown),
  },
};

const outputPath = join(root, "codearts_proof", "repro-bjsjs-after-fixture.json");
await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
console.log(`report: ${outputPath}`);
console.log(
  JSON.stringify(
    {
      savedTopic,
      simulatedStateLastObject: conversationState.lastObject,
      q1: report.q1.answer,
      q2: report.q2.answer,
      legacyQ2: report.legacyQ2.answer,
      q3: report.q3.answer,
      unknown: report.unknown.answer,
    },
    null,
    2,
  ),
);
await rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });