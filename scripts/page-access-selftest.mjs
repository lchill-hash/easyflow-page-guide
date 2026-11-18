import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/sidepanel/hooks/usePageAccess.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const origins = ["http://*/*", "https://*/*"];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

// Exercise permission logic with deterministic hook slots and a Chrome API boundary.
// Browser rendering and the actual permission prompt are separate browser checks.
function harness(allowed = false) {
  let cursor = 0;
  const slots = [];
  const pendingEffects = [];
  const cleanups = [];
  let disposed = false;
  const event = () => {
    const listeners = new Set();
    return { listeners, addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn),
      fire: () => { for (const fn of listeners) fn({ origins }); } };
  };
  const added = event(), removed = event();
  const api = { allowed, requestCalls: [], removeCalls: [], containsCalls: [],
    request: () => { api.allowed = true; return Promise.resolve(true); },
    remove: () => { api.allowed = false; return Promise.resolve(true); },
    contains: () => Promise.resolve(api.allowed) };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => {
        assert.equal(disposed, false, "no state update after unmount");
        slots[index] = typeof value === "function" ? value(slots[index]) : value;
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) {
        slots[index] = { deps };
        pendingEffects.push(fn);
      }
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => { assert.equal(name, "react"); return hooks; },
    chrome: { permissions: {
      onAdded: added, onRemoved: removed,
      contains: p => { api.containsCalls.push(JSON.parse(JSON.stringify(p))); return api.contains(); },
      request: p => { api.requestCalls.push(JSON.parse(JSON.stringify(p))); return api.request(); },
      remove: p => { api.removeCalls.push(JSON.parse(JSON.stringify(p))); return api.remove(); },
    } },
  });
  const render = () => {
    cursor = 0;
    const view = exports.usePageAccess();
    for (const effect of pendingEffects.splice(0)) cleanups.push(effect());
    return view;
  };
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); return render(); };
  const dispose = () => { for (const cleanup of cleanups) cleanup?.(); disposed = true; };
  return { api, added, removed, render, flush, dispose };
}

test("ACCESS-01: 首次打开只检查权限，不弹出授权", async () => {
  const h = harness();
  assert.equal(h.render().ready, false);
  const view = await h.flush();
  assert.equal(view.enabled, false);
  assert.equal(view.ready, true);
  assert.equal(h.api.requestCalls.length, 0);
  assert.deepEqual(h.api.containsCalls, [{ origins }]);
  h.dispose();
});

test("ACCESS-02: 已有权限读取真实开启状态", async () => {
  const h = harness(true); h.render();
  assert.equal((await h.flush()).enabled, true);
  assert.equal(h.api.requestCalls.length, 0);
  h.dispose();
});

test("ACCESS-03: 用户点击同步发起权限申请，结果核验前不显示开启", async () => {
  const h = harness(); h.render();
  const view = await h.flush();
  const wait = deferred(); h.api.request = () => wait.promise;
  view.toggle();
  assert.deepEqual(h.api.requestCalls, [{ origins }]);
  assert.equal(h.render().busy, true);
  assert.equal(h.render().enabled, false);
  h.api.allowed = true; wait.resolve(true);
  const done = await h.flush();
  assert.equal(done.enabled, true); assert.equal(done.busy, false); assert.equal(done.error, null);
  h.dispose();
});

test("ACCESS-04: 拒绝授权保持关闭，并提供单页读取提示", async () => {
  const h = harness(); h.render(); h.api.request = () => Promise.resolve(false);
  (await h.flush()).toggle();
  const view = await h.flush();
  assert.equal(view.enabled, false); assert.equal(view.busy, false);
  assert.match(view.error, /未开启.*工具栏.*只读取这一页/);
  h.dispose();
});

test("ACCESS-05: 同步抛错与异步拒绝均恢复可操作状态", async () => {
  for (const request of [() => { throw new Error("denied"); }, () => Promise.reject(new Error("denied"))]) {
    const h = harness(); h.render(); h.api.request = request;
    (await h.flush()).toggle();
    const view = await h.flush();
    assert.equal(view.enabled, false); assert.equal(view.busy, false); assert.match(view.error, /未能申请/);
    h.dispose();
  }
});

test("ACCESS-06: 连续点击只发起一次申请", async () => {
  const h = harness(); h.render(); const view = await h.flush();
  const wait = deferred(); h.api.request = () => wait.promise;
  view.toggle(); view.toggle();
  assert.equal(h.api.requestCalls.length, 1);
  wait.resolve(false); await h.flush(); h.dispose();
});

test("ACCESS-07: 关闭只撤销可选普通网站权限并核对结果", async () => {
  const h = harness(true); h.render();
  (await h.flush()).toggle();
  assert.deepEqual(h.api.removeCalls, [{ origins }]);
  assert.equal(h.api.requestCalls.length, 0);
  assert.equal((await h.flush()).enabled, false);
  h.dispose();
});

test("ACCESS-08: 移除失败不得虚报关闭", async () => {
  const h = harness(true); h.render(); h.api.remove = () => Promise.resolve(false);
  (await h.flush()).toggle();
  const view = await h.flush();
  assert.equal(view.enabled, true); assert.equal(view.busy, false); assert.match(view.error, /未能关闭/);
  h.dispose();
});

test("ACCESS-09: 浏览器外部授权变更同步，卸载移除监听", async () => {
  const h = harness(); h.render(); await h.flush();
  h.api.allowed = true; h.added.fire(); assert.equal((await h.flush()).enabled, true);
  h.api.allowed = false; h.removed.fire(); assert.equal((await h.flush()).enabled, false);
  h.dispose();
  assert.equal(h.added.listeners.size, 0); assert.equal(h.removed.listeners.size, 0);
});

test("ACCESS-10: 旧权限检查迟到不得覆盖最新状态", async () => {
  const h = harness(); const old = deferred(); h.api.contains = () => old.promise;
  h.render();
  h.api.contains = () => Promise.resolve(true); h.added.fire();
  assert.equal((await h.flush()).enabled, true);
  old.resolve(false); assert.equal((await h.flush()).enabled, true);
  h.dispose();
});

test("ACCESS-11: 检查失败不假报权限状态，重开或变更后可恢复", async () => {
  const h = harness(); h.api.contains = () => Promise.reject(new Error("unavailable")); h.render();
  const failed = await h.flush(); assert.equal(failed.ready, false); assert.match(failed.error, /无法检查/);
  failed.toggle(); assert.equal(h.api.requestCalls.length, 0);
  h.api.contains = () => Promise.resolve(false); h.removed.fire();
  assert.equal((await h.flush()).ready, true); h.dispose();
});

test("ACCESS-12: 卸载后未完成申请不得写入状态", async () => {
  const h = harness(); h.render(); const view = await h.flush();
  const wait = deferred(); h.api.request = () => wait.promise;
  view.toggle(); h.dispose(); wait.resolve(true);
  for (let i = 0; i < 12; i++) await Promise.resolve();
});
