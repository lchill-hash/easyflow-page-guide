import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const compiled = await build({
  absWorkingDir: root,
  stdin: {
    contents: [
      'export { ModelDialogueEngine, probeModelProxy } from "./src/sidepanel/dialogue/model/ModelEngine.ts";',
      'export { PROXY_CONTRACT, sanitizeOutbound } from "./src/shared/privacy/redact.ts";',
      'export * from "./src/shared/model/config.ts";',
      'export { ModelFallbackError } from "./src/shared/model/fallback.ts";',
      'export { validateResponse } from "./src/sidepanel/dialogue/validate/validator.ts";',
      'export { buildSegments } from "./src/content/semantic.ts";',
    ].join("\n").replaceAll('from "./', `from "${root.replaceAll("\\", "/")}/`),
    resolveDir: root,
    sourcefile: "model-integration-selftest-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  write: false,
  logLevel: "silent",
});
const ef = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const expectedBase = "https://124.221.252.80:8090/easyflow/page-guide-api";

function ref(index) {
  return { elementId: `ef-p-${index}`, domPath: `article:nth-of-type(1) > p:nth-of-type(${index})`, textHash: `hash-${index}` };
}

function segment(segmentId = "seg-1", bodyTexts = ["办理条件是年满80周岁。", "现场办理：请到街道办事窗口。"], titleText = "申请说明") {
  return {
    segmentId, titleText, titleRef: ref(1), bodyTexts,
    bodyRefs: bodyTexts.map((_, index) => ref(index + 2)),
    text: [titleText, ...bodyTexts].join(" "), hasBody: bodyTexts.length > 0,
    truncated: false, region: "main", orderRange: [1, bodyTexts.length + 1],
    scopeHints: [], scopeConflict: false,
  };
}

function request(segments = [segment()], utterance = "在哪里现场办理") {
  return {
    schemaVersion: 1, turnId: "turn-model-selftest", utterance,
    context: { recent: [], currentGoal: utterance, pageChanged: false },
    page: { snapshotId: "snapshot-model-selftest", url: "https://example.test/guide?private=yes#private",
      domain: "example.test", title: "办事指南", readable: true, capturedAt: 1, iframeCount: 0 },
    segments, controls: [], plan: null,
    capabilities: { modelConfigured: true, voiceEnabled: false },
  };
}

function answer(overrides = {}) {
  return { kind: "answer", answer: "请到街道办事窗口办理。",
    evidence: [{ segmentId: "seg-1", quote: "请到街道办事窗口。" }], ...overrides };
}

function jsonResponse(result, overrides = {}) {
  return { ok: true, json: async () => ({ result, model: "deepseek-chat", elapsedMs: 12 }), ...overrides };
}

async function withFetch(fake, action) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fake;
  try { return await action(); } finally { globalThis.fetch = originalFetch; }
}

async function withReply(reply, action) {
  return withFetch(async () => jsonResponse(reply), action);
}

async function expectFallback(reply, reason, input = request()) {
  await withReply(reply, () => assert.rejects(
    () => new ef.ModelDialogueEngine().respond(input),
    (error) => error instanceof ef.ModelFallbackError && error.reason === reason,
  ));
}

test("MODEL-01: endpoint、超时与精确主机权限符合云端契约", async () => {
  assert.equal(ef.MODEL_API_BASE_URL, expectedBase);
  assert.equal(ef.MODEL_HEALTH_TIMEOUT_MS, 5000);
  assert.equal(ef.MODEL_REQUEST_TIMEOUT_MS, 17000);
  assert.equal(ef.PROXY_CONTRACT.endpoint, `POST ${expectedBase}/v1/dialogue`);
  assert.equal(ef.PROXY_CONTRACT.healthEndpoint, `GET ${expectedBase}/health`);
  assert.equal(ef.PROXY_CONTRACT.localOnly, false);
  assert.equal(ef.PROXY_CONTRACT.maxQuoteChars, 180);
  const manifest = JSON.parse(await readFile(join(root, "public", "manifest.json"), "utf8"));
  assert.deepEqual(manifest.host_permissions, ["https://124.221.252.80/*"]);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "sidePanel", "storage"]);
  assert.ok(!JSON.stringify(manifest).includes("<all_urls>"));
  for (const file of ["src/shared/model/config.ts", "src/sidepanel/dialogue/model/ModelEngine.ts"]) {
    const source = await readFile(join(root, file), "utf8");
    assert.ok(!/sk-[A-Za-z0-9]{20,}/.test(source));
    assert.ok(!/127\.0\.0\.1|localhost/.test(source));
  }
});

test("MODEL-02: health 使用 GET、5 秒超时且仅双就绪字段为真时启用", async () => {
  const originalTimeout = AbortSignal.timeout;
  const timeouts = [];
  AbortSignal.timeout = (ms) => { timeouts.push(ms); return new AbortController().signal; };
  try {
    await withFetch(async (url, options) => {
      assert.equal(url, `${expectedBase}/health`);
      assert.equal(options.method, "GET");
      assert.equal(options.credentials, "omit");
      assert.equal(options.redirect, "error");
      assert.equal(options.cache, "no-store");
      return { ok: true, json: async () => ({ ok: true, modelConfigured: true, model: "deepseek-chat" }) };
    }, async () => assert.equal(await ef.probeModelProxy(), true));
    assert.deepEqual(timeouts, [5000]);
  } finally { AbortSignal.timeout = originalTimeout; }
  for (const payload of [null, [], {}, { ready: true }, { ok: true }, { modelConfigured: true },
    { ok: true, modelConfigured: false }, { ok: "true", modelConfigured: true }]) {
    await withFetch(async () => ({ ok: true, json: async () => payload }), async () => {
      assert.equal(await ef.probeModelProxy(), false);
    });
  }
});

test("MODEL-03: health 的 HTTP、JSON 和网络失败都保持未就绪", async () => {
  for (const fake of [
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError("invalid-json"); } }),
    async () => { throw new TypeError("network-unavailable"); },
  ]) {
    await withFetch(fake, async () => assert.equal(await ef.probeModelProxy(), false));
  }
});

test("MODEL-04: POST 仅发送脱敏载荷，省略凭据并使用 17 秒超时", async () => {
  const originalTimeout = AbortSignal.timeout;
  const timeouts = [];
  AbortSignal.timeout = (ms) => { timeouts.push(ms); return new AbortController().signal; };
  try {
    const input = request(undefined, "手机号13800138000，在哪里现场办理");
    await withFetch(async (url, options) => {
      assert.equal(url, `${expectedBase}/v1/dialogue`);
      assert.equal(options.method, "POST");
      assert.equal(options.credentials, "omit");
      assert.equal(options.redirect, "error");
      assert.deepEqual(options.headers, { "Content-Type": "application/json" });
      const payload = JSON.parse(options.body);
      assert.deepEqual(Object.keys(payload).sort(), ["controls", "page", "segments", "truncated", "utterance"]);
      assert.equal(payload.page.url, "https://example.test/guide");
      assert.ok(!options.body.includes("13800138000"));
      assert.ok(!options.body.includes("private"));
      assert.deepEqual(payload, ef.sanitizeOutbound({ utterance: input.utterance,
        domain: input.page.domain, title: input.page.title, url: input.page.url,
        segments: input.segments, controls: input.controls }).payload);
      return jsonResponse(answer());
    }, async () => assert.equal((await new ef.ModelDialogueEngine().respond(input)).responseType, "direct-answer"));
    assert.deepEqual(timeouts, [17000]);
  } finally { AbortSignal.timeout = originalTimeout; }
});

test("MODEL-05: 引用第二段具体原文与原 ref，不替换为第一句", async () => {
  const input = request();
  await withReply(answer(), async () => {
    const result = await new ef.ModelDialogueEngine().respond(input);
    const citation = result.citations[0];
    assert.equal(citation.text, "请到街道办事窗口。");
    assert.deepEqual(citation.ref, input.segments[0].bodyRefs[1]);
    assert.equal(citation.start, "现场办理：".length);
    assert.equal(citation.end, "现场办理：请到街道办事窗口。".length);
    assert.equal(citation.role, "body");
    assert.equal(result.diagnostics.citationCount, 1);
    assert.equal(result.diagnostics.priorityHit, "deepseek-server");
    const items = [
      { ...input.segments[0].titleRef, text: input.segments[0].titleText, type: "heading", tagName: "h2" },
      ...input.segments[0].bodyTexts.map((text, i) => ({ ...input.segments[0].bodyRefs[i], text, type: "paragraph", tagName: "p" })),
    ];
    assert.equal(ef.validateResponse(result, { items }, null).status, "passed");
  });
});

test("MODEL-06: 标题引用可以精确匹配标题 ref", async () => {
  await withReply(answer({ answer: "本节是申请说明。", evidence: [{ segmentId: "seg-1", quote: "申请说明" }] }), async () => {
    const input = request();
    const result = await new ef.ModelDialogueEngine().respond(input);
    assert.equal(result.citations[0].role, "title");
    assert.deepEqual(result.citations[0].ref, input.segments[0].titleRef);
  });
});

test("MODEL-07: 同一语义段中多条引用分别定位且按段统计", async () => {
  await withReply(answer({ answer: "年满80周岁可以申请，请到街道办事窗口办理。", evidence: [
    { segmentId: "seg-1", quote: "年满80周岁" },
    { segmentId: "seg-1", quote: "请到街道办事窗口。" },
  ] }), async () => {
    const input = request();
    const result = await new ef.ModelDialogueEngine().respond(input);
    assert.deepEqual(result.citations.map((item) => item.ref), input.segments[0].bodyRefs);
    assert.equal(result.diagnostics.citationCount, 2);
    assert.equal(result.diagnostics.retrievedSegments, 1);
  });
});

test("MODEL-08: 无依据、未知段落和虚构引用整体回退", async () => {
  for (const evidence of [[], [{ segmentId: "missing", quote: "请到街道办事窗口。" }],
    [{ segmentId: "seg-1", quote: "可以自动批准申请。" }],
    [{ segmentId: "seg-1", quote: "请到街道办事窗口。" }, { segmentId: "missing", quote: "未知" }]]) {
    await expectFallback(answer({ evidence }), "ungrounded");
  }
});

test("MODEL-09: 跨两个 DOM 元素的连续引用拆为两个精确 ref", async () => {
  const input = request();
  const quote = input.segments[0].bodyTexts.join(" ");
  assert.ok(input.segments[0].text.includes(quote));
  await withReply(answer({ evidence: [{ segmentId: "seg-1", quote }] }), async () => {
    const result = await new ef.ModelDialogueEngine().respond(input);
    assert.deepEqual(result.citations.map((item) => item.text), input.segments[0].bodyTexts);
    assert.deepEqual(result.citations.map((item) => item.ref), input.segments[0].bodyRefs);
    assert.deepEqual(result.citations.map((item) => item.start), [0, 0]);
    assert.equal(result.citations.map((item) => item.text).join(" "), quote);
    assert.equal(result.diagnostics.citationCount, 2);
  });
});

test("MODEL-10: 原文匹配但缺少对应 body ref 时回退", async () => {
  const input = request();
  input.segments[0].bodyRefs.pop();
  await expectFallback(answer(), "ungrounded", input);
});

test("MODEL-11: 不接受未发送的段落或截断后的原文", async () => {
  const segments = Array.from({ length: 25 }, (_, i) => segment(`seg-${i + 1}`, [`第${i + 1}条公开说明。`]));
  await expectFallback(answer({ evidence: [{ segmentId: "seg-25", quote: "第25条公开说明。" }] }), "ungrounded", request(segments));
  const longSegment = segment("seg-1", ["甲".repeat(6000) + "尾部办理说明。"]);
  await expectFallback(answer({ evidence: [{ segmentId: "seg-1", quote: "尾部办理说明。" }] }), "ungrounded", request([longSegment]));
});

test("MODEL-12: 脱敏占位词不能还原隐私或冒充原文引用", async () => {
  const input = request([segment("seg-1", ["咨询联系人13800138000。"])]);
  await expectFallback(answer({ evidence: [{ segmentId: "seg-1", quote: "手机号" }] }), "ungrounded", input);
  await expectFallback(answer({ evidence: [{ segmentId: "seg-1", quote: "13800138000" }] }), "ungrounded", input);
});

test("MODEL-13: 非法结构、超长输出和旧代理无 quote 格式被拒绝", async () => {
  const invalid = [null, [], {}, { kind: "answer", text: "旧格式", segmentIds: ["seg-1"] },
    answer({ answer: "" }), answer({ answer: "甲".repeat(181) }),
    answer({ evidence: undefined }), answer({ evidence: {} }), answer({ evidence: [null] }),
    answer({ evidence: [{ segmentId: "seg-1", quote: "" }] }),
    answer({ evidence: [{ segmentId: "seg-1", quote: "甲".repeat(181) }] }),
    answer({ evidence: Array.from({ length: 5 }, () => ({ segmentId: "seg-1", quote: "申请说明" })) }),
    answer({ question: 1 }), answer({ question: "甲".repeat(181) }),
    answer({ kind: "unknown" })];
  for (const reply of invalid) await expectFallback(reply, "model-invalid");
});

test("MODEL-14: 不支持的模型 step 与自动操作请求回退", async () => {
  await expectFallback({ kind: "step", answer: "请选择日期。", evidence: [] }, "model-invalid");
  await expectFallback({ kind: "step", text: "请提交申请。", controlId: "control-1" }, "unsafe-instruction");
  await expectFallback(answer({ answer: "我会帮你提交申请。" }), "unsafe-instruction");
});

test("MODEL-15: 澄清与无法回答使用真实云端格式并通过客户端校验", async () => {
  await withReply({ kind: "clarify", answer: "请说明你希望了解哪一项。", question: "你想了解办理地点还是条件？", evidence: [] }, async () => {
    const result = await new ef.ModelDialogueEngine().respond(request());
    assert.equal(result.responseType, "clarify");
    assert.equal(result.clarify.question, "你想了解办理地点还是条件？");
    assert.equal(ef.validateResponse(result, { items: [] }, null).status, "passed");
  });
  await withReply({ kind: "cannot-answer", answer: "当前页面没有这项信息。", evidence: [] }, async () => {
    const result = await new ef.ModelDialogueEngine().respond(request());
    assert.equal(result.responseType, "cannot-answer");
    assert.equal(result.limitation.reason, "no-evidence");
    assert.equal(ef.validateResponse(result, { items: [] }, null).status, "passed");
  });
  await expectFallback({ kind: "clarify", answer: "你想了解哪项？", evidence: [{ segmentId: "missing", quote: "未知" }] }, "ungrounded");
});

test("MODEL-16: 答案中的无依据数字和过多句子回退", async () => {
  await expectFallback(answer({ answer: "办理费是999元。" }), "ungrounded");
  await expectFallback(answer({ answer: "一。二。三。四。" }), "ungrounded");
});

test("MODEL-17: 隐私阻断在发送请求前生效", async () => {
  let calls = 0;
  await withFetch(async () => { calls += 1; return jsonResponse(answer()); }, async () => {
    await assert.rejects(() => new ef.ModelDialogueEngine().respond(request(undefined, "请联系张三先生")),
      (error) => error.reason === "outbound-blocked");
  });
  assert.equal(calls, 0);
});

test("MODEL-18: 网络、HTTP 和超时失败保留可区分的回退原因", async () => {
  const cases = [
    [async () => ({ ok: false, status: 502 }), "network"],
    [async () => { throw new TypeError("fetch failed"); }, "network"],
    [async () => { throw Object.assign(new Error("deadline"), { name: "TimeoutError" }); }, "timeout"],
    [async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); }, "timeout"],
  ];
  for (const [fake, reason] of cases) {
    await withFetch(fake, () => assert.rejects(() => new ef.ModelDialogueEngine().respond(request()),
      (error) => error.reason === reason));
  }
});

test("MODEL-19: 响应体非法 JSON 或读取超时也可安全回退", async () => {
  for (const [error, reason] of [
    [new SyntaxError("bad JSON"), "model-invalid"],
    [Object.assign(new Error("deadline"), { name: "TimeoutError" }), "timeout"],
  ]) {
    await withFetch(async () => ({ ok: true, json: async () => { throw error; } }),
      () => assert.rejects(() => new ef.ModelDialogueEngine().respond(request()), (caught) => caught.reason === reason));
  }
  await withFetch(async () => ({ ok: true, json: async () => null }),
    () => assert.rejects(() => new ef.ModelDialogueEngine().respond(request()), (error) => error.reason === "model-invalid"));
});

test("MODEL-20: 真实 semantic 标题加正文引用完整拆分并通过页面校验", async () => {
  const items = [
    { ...ref(1), text: "开放时间", type: "heading", tagName: "h2", region: "main", order: 1, textLength: 4, truncated: false },
    { ...ref(2), text: "测试图书馆周一至周五开放，开放时间为上午9点至下午5点。", type: "paragraph", tagName: "p", region: "main", order: 2, textLength: 32, truncated: false },
  ];
  const segments = ef.buildSegments(items);
  const quote = segments[0].text;
  assert.equal(quote, items.map((item) => item.text).join(" "));
  await withReply(answer({ answer: "图书馆周一至周五上午9点至下午5点开放。", evidence: [{ segmentId: segments[0].segmentId, quote }] }), async () => {
    const result = await new ef.ModelDialogueEngine().respond(request(segments, "图书馆什么时候开放"));
    assert.deepEqual(result.citations.map((item) => item.text), items.map((item) => item.text));
    assert.deepEqual(result.citations.map((item) => item.ref), [ref(1), ref(2)]);
    assert.deepEqual(result.citations.map((item) => item.role), ["title", "body"]);
    assert.equal(ef.validateResponse(result, { items }, null).status, "passed");
  });
});

test("MODEL-21: 跨段引用的首尾片段保留各自真实偏移，不扩充整段", async () => {
  const input = request([segment("seg-1", ["前置说明：开放日为周一。", "开放时间为九点。后置说明。"])]);
  const quote = "开放日为周一。 开放时间为九点。";
  await withReply(answer({ answer: "开放日为周一，开放时间为九点。", evidence: [{ segmentId: "seg-1", quote }] }), async () => {
    const result = await new ef.ModelDialogueEngine().respond(input);
    assert.deepEqual(result.citations.map((item) => item.text), ["开放日为周一。", "开放时间为九点。"]);
    assert.deepEqual(result.citations.map((item) => item.start), ["前置说明：".length, 0]);
    assert.deepEqual(result.citations.map((item) => item.end), [input.segments[0].bodyTexts[0].length, "开放时间为九点。".length]);
    for (const [index, citation] of result.citations.entries()) {
      assert.equal(input.segments[0].bodyTexts[index].slice(citation.start, citation.end), citation.text);
    }
    assert.equal(result.citations.map((item) => item.text).join("").replace(/\s/g, ""), quote.replace(/\s/g, ""));
  });
});

test("MODEL-22: 无标题 semantic fallback 不重复引用首段", async () => {
  const items = ["图书馆周一开放。", "读者可在大厅咨询。"].map((text, index) => ({
    ...ref(index + 1), text, type: "paragraph", tagName: "p", region: "main", order: index + 1,
    textLength: text.length, truncated: false,
  }));
  const segments = ef.buildSegments(items);
  assert.equal(segments[0].titleText, segments[0].bodyTexts[0]);
  assert.equal(segments[0].text, segments[0].bodyTexts.join(" "));
  await withReply(answer({ answer: "图书馆周一开放，可以在大厅咨询。", evidence: [{ segmentId: "seg-1", quote: segments[0].text }] }), async () => {
    const result = await new ef.ModelDialogueEngine().respond(request(segments));
    assert.deepEqual(result.citations.map((item) => item.ref), [ref(1), ref(2)]);
    assert.deepEqual(result.citations.map((item) => item.role), ["body", "body"]);
    assert.equal(result.citations.length, 2);
    assert.equal(ef.validateResponse(result, { items }, null).status, "passed");
  });
});

test("MODEL-23: 跨段引用不能遗漏、重排或插入任何非空白原文字元", async () => {
  const input = request([segment("seg-1", ["第一段说明。", "中间限制条件。", "最后办理地点。"])]);
  for (const quote of ["第一段说明。 最后办理地点。", "最后办理地点。 第一段说明。",
    "第一段说明。 伪造允许办理。 中间限制条件。", "第一段说明。中间限制条件。"] ) {
    await expectFallback(answer({ evidence: [{ segmentId: "seg-1", quote }] }), "ungrounded", input);
  }
  const altered = structuredClone(input);
  altered.segments[0].text = "申请说明 第一段说明。 未映射文字。 中间限制条件。 最后办理地点。";
  await expectFallback(answer({ evidence: [{ segmentId: "seg-1", quote: "第一段说明。 未映射文字。 中间限制条件。" }] }), "ungrounded", altered);
});

test("MODEL-24: 跨段引用任何一部分缺少 ref 都整体回退", async () => {
  const input = request();
  const quote = input.segments[0].bodyTexts.join(" ");
  input.segments[0].bodyRefs[0] = undefined;
  await expectFallback(answer({ evidence: [{ segmentId: "seg-1", quote }] }), "ungrounded", input);
});

test("MODEL-25: 拆分后总引用恰为四条可用，超过四条整体回退", async () => {
  const input = request([segment("seg-1", ["甲段。", "乙段。", "丙段。"])]);
  await withReply(answer({ answer: "页面有三段说明。", evidence: [{ segmentId: "seg-1", quote: input.segments[0].text }] }), async () => {
    const result = await new ef.ModelDialogueEngine().respond(input);
    assert.equal(result.citations.length, 4);
    assert.deepEqual(result.citations.map((item) => item.citationId), ["model-cite-1", "model-cite-2", "model-cite-3", "model-cite-4"]);
  });
  const five = request([segment("seg-1", ["甲段。", "乙段。", "丙段。", "丁段。"])]);
  await expectFallback(answer({ evidence: [{ segmentId: "seg-1", quote: five.segments[0].text }] }), "ungrounded", five);
  await expectFallback(answer({ evidence: [
    { segmentId: "seg-1", quote: input.segments[0].text }, { segmentId: "seg-1", quote: "甲段。" },
  ] }), "ungrounded", input);
});

test("MODEL-26: 跨段引用仍拒绝脱敏替换和未发送的原文尾部", async () => {
  const input = request([segment("seg-1", ["咨询联系人13800138000。"])]);
  await expectFallback(answer({ evidence: [{ segmentId: "seg-1", quote: "申请说明 咨询联系人手机号。" }] }), "ungrounded", input);
  await expectFallback(answer({ evidence: [{ segmentId: "seg-1", quote: input.segments[0].text }] }), "ungrounded", input);
  const body = ["甲".repeat(5990), "尾段说明不能遗漏。"];
  const truncated = request([segment("seg-1", body)]);
  await expectFallback(answer({ evidence: [{ segmentId: "seg-1", quote: "甲".repeat(10) + " 尾段说明不能遗漏。" }] }), "ungrounded", truncated);
});
