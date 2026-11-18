import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const path = new URL("../src/sidepanel/components/chat/seniorAssistModel.ts", import.meta.url);
const source = readFileSync(path, "utf8");
const detectSource = readFileSync(new URL("../src/shared/privacy/detect.ts", import.meta.url), "utf8");
const detected = { exports: {} };
const detectCode = ts.transpileModule(detectSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
} }).outputText;
runInNewContext(detectCode, { module: detected, exports: detected.exports }, { filename: "detect.ts" });
const modelSource = source.replace(
  'from "../../../shared/privacy/detect"',
  'from "privacy/detect"',
);
const dependent = { exports: {} };
const dependentCode = ts.transpileModule(modelSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
} }).outputText;
runInNewContext(dependentCode, {
  module: dependent,
  exports: dependent.exports,
  require: (id) => {
    assert.equal(id, "privacy/detect");
    return detected.exports;
  },
}, { filename: path.pathname });
const { preparationEntries, officialHelpLinks, pageQuestions } = dependent.exports;

function snapshot({ truncated = false, segments = [], items = [] } = {}) {
  return { snapshotId: "snapshot-1", truncated, segments, items };
}

function segment(bodyTexts, { truncated = false } = {}) {
  return {
    segmentId: "segment-1",
    truncated,
    bodyTexts,
    bodyRefs: bodyTexts.map((_, index) => ({
      elementId: `body-${index}`,
      domPath: `main > p:nth-of-type(${index + 1})`,
      textHash: `hash-${index}`,
    })),
  };
}

test("ASSIST-01: preparation checklist entries point to exact current-page text", () => {
  const page = snapshot({
    truncated: true,
    segments: [segment(["办理时需要携带身份证原件和复印件。", "欢迎访问本网站。"] )],
  });
  const entries = preparationEntries(page);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].text, "办理时需要携带身份证原件和复印件。");
  assert.equal(entries[0].citation.ref.elementId, "body-0");
  assert.equal(entries[0].citation.end, entries[0].text.length);
});

test("ASSIST-02: checklist skips form prompts, irrelevant text and truncated evidence", () => {
  const page = snapshot({ segments: [
    segment(["请输入身份证号码后继续办理。", "本页面包含联系电话。", "申请人必须准备申请材料。"]),
    segment(["请带上手机号13800138000办理。"]),
    segment(["办理前需要预约。"], { truncated: true }),
  ] });
  assert.deepEqual(Array.from(preparationEntries(page), (entry) => entry.text), ["申请人必须准备申请材料。"]);
});

test("ASSIST-03: official support links only come from visible page links and buttons", () => {
  const page = snapshot({ items: [
    { type: "paragraph", text: "客服联系电话", elementId: "paragraph", domPath: "main > p", textHash: "p" },
    { type: "link", text: "在线咨询", elementId: "help-link", domPath: "footer > a", textHash: "a" },
    { type: "button", text: "人工服务", elementId: "help-button", domPath: "main > button", textHash: "b" },
    { type: "link", text: "下一步", elementId: "next-link", domPath: "main > a", textHash: "n" },
  ] });
  const contacts = officialHelpLinks(page);
  assert.deepEqual(contacts.map((entry) => entry.text), ["在线咨询", "人工服务"]);
  assert.equal(contacts[0].citation.ref.elementId, "help-link");
});

test("ASSIST-04: absent page evidence yields no checklist or contact claim", () => {
  assert.equal(preparationEntries(null).length, 0);
  assert.equal(officialHelpLinks(null).length, 0);
  assert.equal(preparationEntries(snapshot()).length, 0);
});

test("ASSIST-05: quick questions are derived from current-page section titles", () => {
  const page = snapshot({ segments: [
    { titleText: "办理条件" },
    { titleText: "准备材料" },
    { titleText: "办理流程" },
    { titleText: "收费标准" },
  ] });
  const questions = Array.from(pageQuestions(page));
  assert.deepEqual(questions.map((question) => question.id), ["requirements", "materials", "steps"]);
  assert.equal(pageQuestions(snapshot()).length, 0);
});
