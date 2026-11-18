import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const cache = new Map();
function load(relative) {
  const file = resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  runInNewContext(compiled, { module, exports: module.exports, URL,
    require: dependency => {
      assert.ok(dependency.startsWith("."), `Unexpected dependency: ${dependency}`);
      return load(join(dirname(file), dependency + ".ts"));
    },
  }, { filename: file });
  return module.exports;
}
const progress = load("src/shared/seniorProgress.ts");
const { createProgress, parseProgress, resumePrompt, SENIOR_PROGRESS_MAX_AGE_MS } = progress;
const now = 1_795_000_000_000;
const input = { goal: "预约图书馆", stepLabel: "选择日期", domain: "library.example",
  stepIndex: 1, stepCount: 4 };
const make = extra => createProgress({ ...input, ...extra }, now);

test("PROGRESS-01: schema preserves only a small task reminder and requires a new read", () => {
  const record = make({ snapshot: { text: "page contents" }, bookingSuccess: "confirmed", value: "form value" });
  assert.ok(record); assert.equal(record.requiresFreshRead, true);
  assert.deepEqual(Object.keys(record).sort(), ["schemaVersion", "goal", "stepLabel", "domain",
    "stepIndex", "stepCount", "savedAt", "requiresFreshRead"].sort());
  assert.equal(record.stepIndex, 1); assert.equal(record.savedAt, now);
  assert.equal(JSON.stringify(parseProgress(JSON.parse(JSON.stringify(record)), now + 1)), JSON.stringify(record));
});

test("PROGRESS-02: telephone and email are redacted before storage, including step label", () => {
  const record = make({ goal: "查询联系电话13800138000", stepLabel: "查看邮箱demo@example.com" });
  assert.ok(record);
  assert.equal(record.goal, "查询联系电话手机号"); assert.equal(record.stepLabel, "查看邮箱邮箱");
  assert.doesNotMatch(JSON.stringify(record), /13800138000|demo@example/);
  assert.ok(parseProgress(record, now));
});

test("PROGRESS-03: names, credentials, form identifiers and address disclosures are not stored", () => {
  for (const goal of ["申请人：张三", "联系张先生", "我的名字是李四", "我叫王五", "家庭住址：幸福路一号",
    "我的密码是 abc123", "验证码123456", "身份证110101199001011234", "银行卡6222021234567890123",
    "api_key sk-test-value", "access_token secret-value", "bearer abcdef", "编号1234567"] ) {
    assert.equal(make({ goal }), null, goal);
  }
});

test("PROGRESS-04: truncation happens only after full-text privacy checks", () => {
  const long = "查询开放时间".repeat(30);
  assert.equal(make({ goal: long + " 密码abc123" }), null);
  assert.equal(make({ goal: long + " 张三先生" }), null);
  const record = make({ goal: long, stepLabel: "查看办理流程".repeat(25) });
  assert.equal(record.goal.length, progress.SENIOR_PROGRESS_MAX_GOAL_CHARS);
  assert.equal(record.stepLabel.length, progress.SENIOR_PROGRESS_MAX_STEP_CHARS);
  assert.ok(parseProgress(record, now));
});

test("PROGRESS-05: hostname excludes URL path, query, fragment and port", () => {
  const record = make({ domain: "https://Library.Example:8443/personal/12345?token=secret#form" });
  assert.equal(record.domain, "library.example");
  assert.doesNotMatch(JSON.stringify(record), /personal|12345|token|secret|8443|#form/);
  for (const domain of ["https://user:pass@example.com/", "chrome://settings", "file:///private", "https://13800138000.example", "bad host"])
    assert.equal(make({ domain }), null, domain);
  assert.equal(make({ domain: "" }).domain, "");
});

test("PROGRESS-06: free-text HTML, control characters and URL parameters are rejected", () => {
  for (const goal of ["<input value='secret'>", "查询\u0000资料", "打开https://example.com/private?token=secret", "页面?token=secret"])
    assert.equal(make({ goal }), null, goal);
  assert.equal(make({ goal: "  查询  开放时间\n和地点 " }).goal, "查询 开放时间 和地点");
});

test("PROGRESS-07: step bounds are checked and no old DOM references can be restored", () => {
  for (const extra of [{ stepIndex: -1 }, { stepIndex: 4 }, { stepIndex: 0.5 }, { stepCount: 13 },
    { stepCount: -1 }, { stepCount: 1.5 }, { stepIndex: 1, stepCount: 0 }]) assert.equal(make(extra), null);
  const record = make({ stepIndex: 0, stepCount: 0, stepLabel: "ignored old target" });
  assert.equal(record.stepLabel, ""); assert.ok(parseProgress(record, now));
  assert.equal("plan" in record, false); assert.equal("targetControl" in record, false);
});

test("PROGRESS-08: corrupted, foreign and old records are rejected", () => {
  const record = make({});
  for (const raw of [null, [], "old goal string", {}, { ...record, schemaVersion: 0 },
    { ...record, schemaVersion: 2 }, { ...record, requiresFreshRead: false },
    { ...record, snapshot: {} }, { ...record, pageSuccess: "confirmed" },
    { ...record, goal: 123 }, { ...record, stepLabel: null }, { ...record, domain: [] },
    { ...record, savedAt: "yesterday" }, { ...record, stepCount: "4" }]) {
    assert.equal(parseProgress(raw, now), null, JSON.stringify(raw));
  }
  const incomplete = { ...record }; delete incomplete.domain;
  assert.equal(parseProgress(incomplete, now), null);
});

test("PROGRESS-09: tampered sensitive values are rejected rather than silently accepted", () => {
  const record = make({});
  for (const extra of [{ goal: "联系13800138000" }, { stepLabel: "demo@example.com" },
    { goal: "  预约图书馆" }, { domain: "https://library.example/?token=secret" }, { domain: "Library.Example" }]) {
    assert.equal(parseProgress({ ...record, ...extra }, now), null);
  }
});

test("PROGRESS-10: reminders expire after seven days and future timestamps fail closed", () => {
  const record = make({});
  assert.ok(parseProgress(record, now + SENIOR_PROGRESS_MAX_AGE_MS - 1));
  assert.equal(parseProgress(record, now + SENIOR_PROGRESS_MAX_AGE_MS), null);
  assert.equal(parseProgress(record, now - 1), null);
  for (const time of [0, -1, NaN, Infinity, 1.5]) {
    assert.equal(createProgress(input, time), null);
    assert.equal(parseProgress({ ...record, savedAt: time }, now), null);
  }
});

test("PROGRESS-11: resume text describes history, not verified present progress", () => {
  const prompt = resumePrompt(make({}), now);
  assert.match(prompt, /上次想做：“预约图书馆”/);
  assert.match(prompt, /上次记录到第2步（共4步）：“选择日期”/);
  assert.match(prompt, /先重新读取当前页面/);
  assert.match(prompt, /预约是否完成.*以当前页面重新核对/);
  assert.equal(resumePrompt({ ...make({}), pageSuccess: "confirmed" }, now), null);
  assert.equal(resumePrompt(make({}), now + SENIOR_PROGRESS_MAX_AGE_MS), null);
});

test("PROGRESS-12: pure helpers do not mutate inputs or require browser storage", () => {
  const source = Object.freeze({ ...input }); const record = createProgress(source, now);
  Object.freeze(record);
  assert.ok(parseProgress(record, now)); assert.ok(resumePrompt(record, now));
  assert.equal(source.goal, input.goal); assert.equal(record.requiresFreshRead, true);
});
