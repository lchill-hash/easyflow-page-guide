import test, { after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const { chromium } = await import(
  pathToFileURL("C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1116-1220-0_26.1116.1220.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright/index.mjs").href
);
const root = fileURLToPath(new URL("..", import.meta.url));
const tempDir = await mkdtemp(join(tmpdir(), "easyflow-sticky-highlight-"));
const bundlePath = join(tempDir, "highlight.js");
const browserPath = "C:/Users/huawei/AppData/Local/ms-playwright/chromium-1148/chrome-win/chrome.exe";
let browser;
let activePage;

const modulePaths = [
  "src/shared/constants.ts",
  "src/shared/domPath.ts",
  "src/content/highlightRound.ts",
  "src/content/registry.ts",
  "src/content/highlight.ts",
];
const modules = Object.fromEntries(await Promise.all(modulePaths.map(async modulePath => {
  const source = await readFile(join(root,modulePath),"utf8");
  const output = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  return [modulePath,output];
})));
const bundle = `(() => {
  const sources=${JSON.stringify(modules)}; const cache={};
  function resolve(from, request) {
    const parts=from.split("/"); parts.pop();
    for (const part of request.split("/")) { if (part==="..") parts.pop(); else if (part!==".") parts.push(part); }
    let id=parts.join("/"); if (!id.endsWith(".ts")) id += ".ts"; return id;
  }
  function load(id) {
    if (cache[id]) return cache[id].exports;
    const module={exports:{}}; cache[id]=module;
    const localRequire=request=>load(resolve(id,request));
    new Function("module","exports","require",sources[id])(module,module.exports,localRequire);
    return module.exports;
  }
  window.EasyFlowDomPath=load("src/shared/domPath.ts");
  window.EasyFlowHighlight=load("src/content/highlight.ts");
})();`;
await writeFile(bundlePath,bundle);

after(async () => {
  if (browser) await browser.close();
  await rm(tempDir, {recursive: true, force: true});
});
afterEach(async () => { await activePage?.close(); activePage = undefined; });

async function harness() {
  if (!browser) browser = await chromium.launch({executablePath: browserPath, headless: true});
  const page = await browser.newPage();
  activePage = page;
  await page.setContent('<!doctype html><html><body><p id="target">申请人须年满80周岁。</p></body></html>');
  await page.addScriptTag({path: bundlePath});
  await page.evaluate(() => {
    const realSetTimeout = window.setTimeout.bind(window);
    const timers = [];
    window.setTimeout = (callback, delay = 0, ...args) => {
      const timer = {callback, delay, args, cleared: false};
      timers.push(timer);
      return timers.length;
    };
    window.clearTimeout = id => { if (timers[id - 1]) timers[id - 1].cleared = true; };
    window.__fakeTimers = timers;
    window.__advanceFakeTime = elapsed => {
      for (const timer of timers) {
        if (!timer.cleared && timer.delay <= elapsed) {
          timer.cleared = true;
          timer.callback(...timer.args);
        }
      }
    };
    window.__realSetTimeout = realSetTimeout;
  });
  return page;
}

async function prepareRef(page) {
  await page.evaluate(() => {
    const target = document.querySelector("#target");
    const text = target.innerText.replace(/\u00a0/g," ").replace(/[\u200b-\u200d\ufeff]/g,"").replace(/\s+/g," ").trim();
    window.__ref = {elementId:"ef-p-1",domPath:"html:nth-of-type(1) > body:nth-of-type(1) > p:nth-of-type(1)",textHash:EasyFlowDomPath.textHash(EasyFlowDomPath.normalizeWhitespace(target.innerText))};
  });
}

test("sticky 高亮 fake timer 超过 4 秒仍保留，手动 clear 后移除", async () => {
  const page = await harness();
  await prepareRef(page);
  const result = await page.evaluate(() => EasyFlowHighlight.highlightRef(window.__ref, "care", true));
  assert.equal(result.status, "highlighted");
  assert.equal(result.sticky, true);
  assert.equal(await page.locator("html > [data-ef-highlight]").count(), 1);
  assert.equal(await page.evaluate(() => window.__fakeTimers.length), 0);
  await page.evaluate(() => window.__advanceFakeTime(10000));
  assert.equal(await page.locator("html > [data-ef-highlight]").count(), 1);
  const cleared = await page.evaluate(() => EasyFlowHighlight.cleanupHighlight("manual"));
  assert.equal(cleared, true);
  assert.equal(await page.locator("html > [data-ef-highlight]").count(), 0);
});

test("非 sticky 高亮保留 4 秒 TTL 并会自动清理", async () => {
  const page = await harness();
  await prepareRef(page);
  const result = await page.evaluate(() => EasyFlowHighlight.highlightRef(window.__ref, "care", false));
  assert.equal(result.status, "highlighted");
  assert.equal(result.sticky, false);
  assert.deepEqual(await page.evaluate(() => window.__fakeTimers.map(timer => timer.delay)), [4000]);
  await page.evaluate(() => window.__advanceFakeTime(4000));
  assert.equal(await page.locator("html > [data-ef-highlight]").count(), 0);
});

test("sticky 目标文字变化后 observer 清除高亮并停止监听", async () => {
  const page = await harness();
  await prepareRef(page);
  await page.evaluate(() => EasyFlowHighlight.highlightRef(window.__ref, "care", true));
  await page.locator("#target").evaluate(element => { element.textContent = "此办理条件已经更新。"; });
  await page.waitForFunction(() => document.querySelector("html > [data-ef-highlight]") === null);
  const state = await page.evaluate(() => ({
    hostCount: document.querySelectorAll("html > [data-ef-highlight]").length,
    observerStopped: EasyFlowHighlight.cleanupHighlight("manual") === false,
    timers: window.__fakeTimers.length,
  }));
  assert.deepEqual(state, {hostCount:0,observerStopped:true,timers:0});
});

test("SPA pushState 导航清除 sticky 高亮", async () => {
  const page = await harness();
  await prepareRef(page);
  await page.evaluate(() => EasyFlowHighlight.highlightRef(window.__ref, "care", true));
  await page.evaluate(() => history.pushState({}, "", "#next"));
  await page.waitForFunction(() => document.querySelector("html > [data-ef-highlight]") === null);
  assert.equal(await page.locator("html > [data-ef-highlight]").count(), 0);
});
