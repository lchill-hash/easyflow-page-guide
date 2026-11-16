import { build } from "esbuild";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const label = process.argv[2] ?? "run";
const outputPath = process.argv[3] ?? join(root, "codearts_proof", `repro-bjsjs-${label}.json`);
const saveSnapshot = process.argv.includes("--snapshot");
const printCommandOnly = process.argv.includes("--print-command");
const verificationMode = "local-fixture-reproduction";
const fixtureSource = "scripts/fixtures/bjsjs-highlights.html";
const chromeCommands = [];
const sourceUrl =
  "https://www.bjsjs.gov.cn/gongkai/zwgkpd/ztzl/2024/wqfw/lnrzq/cjcs/202402/t20240229_79299.shtml";

async function cleanStaleReproDirs() {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith(".tmp-repro-")) {
      await rm(join(root, entry.name), {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    }
  }
}

await cleanStaleReproDirs();

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function buildChromeArgs(harnessPath, tempDir, headlessFlag) {
  return [
    headlessFlag,
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${join(tempDir, "profile")}`,
    "--allow-file-access-from-files",
    "--virtual-time-budget=3000",
    "--dump-dom",
    pathToFileURL(harnessPath).href,
  ];
}

function toPowerShellCommand(args) {
  const quoted = args.map((arg) => (arg.includes(" ") ? `"${arg}"` : arg));
  return `& "${chrome}" ${quoted.join(" ")}`;
}

function runChrome(harnessPath, tempDir, headlessFlag) {
  return new Promise((resolve, reject) => {
    const args = buildChromeArgs(harnessPath, tempDir, headlessFlag);
    const command = toPowerShellCommand(args);
    chromeCommands.push(command);
    console.log(`[repro] Chrome 启动命令：${command}`);
    const child = spawn(chrome, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("chrome timeout"));
    }, 30000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function collectSnapshot(tempDir) {
  const fixture = await readFile(join(root, "scripts", "fixtures", "bjsjs-highlights.html"), "utf8");
  const contentScript = await readFile(join(root, "dist", "content.js"), "utf8");
  const harnessPath = join(tempDir, "harness.html");
  const harnessAccessPath = pathToFileURL(harnessPath).href;
  const harness = fixture.replace(
    "</body>",
    `<script>
      window.chrome = { runtime: { onMessage: { addListener(fn) { window.__efListener = fn; }, removeListener() {} } } };
    </script>
    <script>${contentScript}</script>
    <script>
      (function () {
        const request = {
          v: 1,
          requestId: "repro-request",
          type: "EF_CONTENT_COLLECT",
          snapshotId: "snap-repro",
          runId: "run-repro",
          maxItems: 3000,
          maxTextLength: 300
        };
        if (!window.__efListener) {
          document.body.setAttribute("data-ef-result", JSON.stringify({ error: "no-listener" }));
          return;
        }
        window.__efListener(request, {}, function (response) {
          document.body.setAttribute("data-ef-result", JSON.stringify(response));
        });
      })();
    </script>
  </body>`,
  );
  await writeFile(harnessPath, harness, "utf8");

  let result = await runChrome(harnessPath, tempDir, "--headless=new");
  let match = /data-ef-result="([^"]*)"/.exec(result.stdout);
  if (match === null) {
    result = await runChrome(harnessPath, tempDir, "--headless");
    match = /data-ef-result="([^"]*)"/.exec(result.stdout);
  }
  if (match === null) {
    throw new Error(`未捕获采集结果。chrome exit=${result.code}\n${result.stderr.slice(-500)}`);
  }
  const response = JSON.parse(decodeHtml(match[1]));
  if (!response.ok) {
    throw new Error(`采集失败：${JSON.stringify(response.error)}`);
  }
  return {
    ...response.data,
    harnessPath,
    harnessAccessPath,
  };
}

async function loadEngine(tempDir) {
  const engineFile = join(tempDir, "engine.mjs");
  await build({
    absWorkingDir: root,
    stdin: {
      contents: [
        'export { ruleEngine } from "./src/sidepanel/dialogue/rule/RuleEngine.ts";',
        'export { buildSegments } from "./src/content/semantic.ts";',
        'export { buildQuery, retrieveSegments } from "./src/sidepanel/dialogue/retrieval/segmentRetriever.ts";',
        'export { validateResponse } from "./src/sidepanel/dialogue/validate/validator.ts";',
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
  return import(pathToFileURL(engineFile).href);
}

function makeRequest(utterance, snapshot, context) {
  return {
    schemaVersion: 1,
    turnId: "turn-repro",
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
    segments: snapshot.segments ?? [],
    controls: snapshot.controls ?? [],
    plan: null,
    capabilities: { modelConfigured: false, voiceEnabled: false },
  };
}

function summarizeSegment(segment) {
  return {
    segmentId: segment.segmentId,
    titleText: segment.titleText,
    hasBody: segment.hasBody,
    bodyTexts: segment.bodyTexts,
    textLength: segment.text.length,
    orderRange: segment.orderRange,
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

function summarizeAnswer(result, snapshot, validateResponse) {
  return {
    responseType: result.responseType,
    text: result.text,
    citations: result.citations.map((citation) => ({
      role: citation.role,
      text: citation.text,
      elementId: citation.ref.elementId,
    })),
    validation: validateResponse(result, snapshot, null),
  };
}

console.log("[repro] 本地网页夹具复现（非真实网站验收）");
const tempDir = await mkdtemp(join(root, ".tmp-repro-"));
process.once("exit", () => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup only
  }
});
try {
  if (printCommandOnly) {
    const harnessPath = join(tempDir, "harness.html");
    const harnessAccessPath = pathToFileURL(harnessPath).href;
    console.log(`[repro] Chrome: ${chrome}`);
    console.log(`[repro] 本地夹具: ${join(root, fixtureSource)}`);
    console.log(`[repro] 临时页面: ${harnessPath}`);
    console.log(`[repro] 访问路径: ${harnessAccessPath}`);
    console.log(
      `[repro] 启动命令: ${toPowerShellCommand(buildChromeArgs(harnessPath, tempDir, "--headless=new"))}`,
    );
    console.log("[repro] 仅预览命令，未启动 Chrome；该路径是本地文件，不是真实网站。");
  } else {
  const collected = await collectSnapshot(tempDir);
  const snapshot = collected.snapshot;
  const ef = await loadEngine(tempDir);

  const relevantPattern = /(日期|来源|办理条件|办理流程|具有本市户籍|网上申请|现场申请|发放标准|高龄津贴)/;
  const items = snapshot.items.map((item) => ({
    elementId: item.elementId,
    type: item.type,
    text: item.text,
    domPath: item.domPath,
    titleCandidate: item.titleCandidate ?? false,
    order: item.order,
    region: item.region,
  }));
  const relevantItems = items.filter((item) => relevantPattern.test(item.text));

  const rebuiltSegments = ef.buildSegments(snapshot.items);
  const relevantSegments = (snapshot.segments ?? []).filter(
    (segment) => relevantPattern.test(segment.text) || relevantPattern.test(segment.titleText),
  );

  const q1 = ef.buildQuery("高龄津贴谁能申请", { condition: "谁", object: "高龄津贴" }, "");
  const q2 = ef.buildQuery("那怎么办理", { action: "办理", object: "高龄津贴" }, "高龄津贴");
  const hits1 = ef.retrieveSegments(q1, snapshot.segments ?? [], 5, {
    condition: "谁",
    object: "高龄津贴",
  });
  const hits2 = ef.retrieveSegments(q2, snapshot.segments ?? [], 5, {
    action: "办理",
    object: "高龄津贴",
  });

  const a1 = await ef.ruleEngine.respond(makeRequest("高龄津贴谁能申请", snapshot, {}));
  const a2 = await ef.ruleEngine.respond(
    makeRequest("那怎么办理", snapshot, {
      currentGoal: "高龄津贴",
      lastObject: "高龄津贴",
    }),
  );

  const report = {
    label,
    verificationMode,
    isRealSiteAcceptance: false,
    fixtureSource,
    note: "本地网页夹具注入 content.js 复现；不是访问真实网站，不能作为真实网站验收。",
    harnessPath: collected.harnessPath,
    harnessAccessPath: collected.harnessAccessPath,
    chromeCommands,
    capturedAt: new Date().toISOString(),
    sourceUrl,
    url: snapshot.url,
    title: snapshot.title,
    itemCount: snapshot.itemCount,
    segmentsFromSnapshot: (snapshot.segments ?? []).length,
    segmentsRebuilt: rebuiltSegments.length,
    diagnostics: collected.diagnostics,
    relevantItems,
    relevantSegments: relevantSegments.map(summarizeSegment),
    rebuiltRelevantSegments: rebuiltSegments
      .filter((segment) => relevantPattern.test(segment.text) || relevantPattern.test(segment.titleText))
      .map(summarizeSegment),
    q1: {
      query: q1,
      hits: summarizeHits(hits1),
      answer: summarizeAnswer(a1, snapshot, ef.validateResponse),
    },
    q2: {
      query: q2,
      hits: summarizeHits(hits2),
      answer: summarizeAnswer(a2, snapshot, ef.validateResponse),
    },
  };

  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  if (saveSnapshot) {
    const fixturePath = join(root, "scripts", "fixtures", "bjsjs-captured-snapshot.json");
    const fixtureSnapshot = {
      ...snapshot,
      url: sourceUrl,
      origin: "https://www.bjsjs.gov.cn",
      domain: "www.bjsjs.gov.cn",
      title: snapshot.title === "unknown" ? "高龄老年人津贴办理指南" : snapshot.title,
    };
    await writeFile(
      fixturePath,
      JSON.stringify(
        {
          url: fixtureSnapshot.url,
          domain: fixtureSnapshot.domain,
          title: fixtureSnapshot.title,
          capturedAt: fixtureSnapshot.capturedAt,
          items: fixtureSnapshot.items,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`snapshot fixture: ${fixturePath}`);
  }
  console.log(`report: ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        itemCount: report.itemCount,
        segments: report.segmentsFromSnapshot,
        a1: report.q1.answer.text,
        a1Citations: report.q1.answer.citations,
        a1Validation: report.q1.answer.validation,
        a2: report.q2.answer.text,
        a2Citations: report.q2.answer.citations,
        a2Validation: report.q2.answer.validation,
      },
      null,
      2,
    ),
  );
  console.log("[repro] 结论仅代表本地网页夹具复现，不代表真实网站验收。");
  }
} finally {
  await rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}