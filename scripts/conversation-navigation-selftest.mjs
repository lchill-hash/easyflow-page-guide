import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceCache = new Map();
function deferred() {
  let resolvePromise, rejectPromise;
  const promise = new Promise((yes, no) => { resolvePromise = yes; rejectPromise = no; });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}
function event() {
  const listeners = new Set();
  return { listeners, addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn),
    fire: message => { for (const fn of listeners) fn(message); } };
}

// Execute the production hook, reducer, engines and validators. Only React scheduling,
// Chrome messages, timers and HTTP are replaced by deterministic API boundaries.
function harness(t, options = {}) {
  const slots = [], effects = [], requests = [], fetches = [], actions = [], warnings = [], unmountedWrites = [];
  const timers = new Map();
  let cursor = 0, timerId = 0, dirty = false, disposed = false, view;
  const sameDeps = (previous, next) => previous !== undefined && next !== undefined &&
    previous.length === next.length && next.every((value, index) => value === previous[index]);
  const changed = () => {
    if (disposed) unmountedWrites.push("state write");
    assert.equal(disposed, false, "no state writes after unmount"); dirty = true;
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) {
        const slot = { value: typeof initial === "function" ? initial() : initial };
        slot.set = value => { changed(); slot.value = typeof value === "function" ? value(slot.value) : value; };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].set];
    },
    useReducer(reducer, initial, init) {
      const index = cursor++;
      if (!(index in slots)) {
        const slot = { value: init ? init(initial) : initial };
        slot.dispatch = action => {
          changed(); actions.push(action); slot.value = reducer(slot.value, action);
        };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].dispatch];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) {
        const previous = slots[index];
        const slot = { deps, cleanup: undefined };
        slots[index] = slot;
        effects.push(() => { previous?.cleanup?.(); slot.cleanup = fn(); });
      }
    },
  };
  const onMessage = event();
  const api = {
    tabId: 1, windowId: 10, snapshots: new Map(),
    getWindow: async () => ({ id: api.windowId }),
    getContext: async () => ({ tabId: api.tabId, windowId: api.windowId }),
    collect: async request => collection(api.snapshots.get(request.tabId)),
    highlight: async () => ({ status: "highlighted" }),
    fetch: async () => { throw new Error("No HTTP reply configured"); },
  };
  const envelope = (request, result) => result?.ok === false
    ? { ...result, requestId: request.requestId }
    : { ok: true, requestId: request.requestId, data: result };
  const chrome = {
    windows: { getCurrent: () => api.getWindow() },
    runtime: { onMessage, sendMessage: async request => {
      requests.push(request);
      let result;
      switch (request.type) {
        case "EF_LOAD_GOAL": result = { goal: null }; break;
        case "EF_SAVE_GOAL": result = { saved: true }; break;
        case "EF_GET_CONTEXT": result = await api.getContext(request); break;
        case "EF_COLLECT": result = await api.collect(request); break;
        case "EF_HIGHLIGHT": result = await api.highlight(request); break;
        case "EF_WATCH_START": result = { started: true, stopped: false, changeCount: 0, lastChangeAt: 0, watchedMs: 0 }; break;
        case "EF_WATCH_STOP": result = { stopped: true, changeCount: 0, lastChangeAt: 0, watchedMs: 0 }; break;
        default: assert.fail(`Unexpected Chrome message: ${request.type}`);
      }
      return envelope(request, result);
    } },
  };
  const fakeSetTimeout = fn => { const id = ++timerId; timers.set(id, fn); return id; };
  const fakeClearTimeout = id => timers.delete(id);
  const cache = new Map();
  function load(relative) {
    const file = resolve(root, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    let compiled = sourceCache.get(file);
    if (!compiled) {
      compiled = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      } }).outputText;
      sourceCache.set(file, compiled);
    }
    runInNewContext(compiled, {
      module, exports: module.exports,
      require: dependency => {
        if (dependency === "react") return hooks;
        assert.ok(dependency.startsWith("."), `Unexpected dependency: ${dependency}`);
        return load(join(dirname(file), dependency + ".ts"));
      },
      chrome, window: { setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout },
      setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
      Promise, performance, URL, Error, AbortSignal, TextEncoder, TextDecoder,
      fetch: (url, init) => { fetches.push({ url, init }); return api.fetch(url, init); },
      console: { warn: (...args) => warnings.push(args), log() {} },
    }, { filename: file });
    return module.exports;
  }
  const { useConversation } = load("src/sidepanel/hooks/useConversation.ts");
  const { buildSegments } = load("src/content/semantic.ts");
  const { textHash } = load("src/shared/domPath.ts");
  const { createEfError } = load("src/shared/errors.ts");
  function snapshot(id, { booking = false } = {}) {
    const url = `https://${id.toLowerCase()}.example/${booking ? "booking/success" : "guide"}`;
    const items = [booking ? "会议已安排" : "开放时间", "测试图书馆周一开放。"].map((text, order) => ({
      elementId: `${id}-element-${order}`, type: order === 0 ? "heading" : "paragraph",
      text, textLength: text.length, truncated: false, order, region: "main",
      domPath: `html:nth-of-type(1) > body:nth-of-type(1) > main:nth-of-type(1) > ${order === 0 ? "h1" : "p"}:nth-of-type(1)`,
      textHash: textHash(text), tagName: order === 0 ? "h1" : "p",
    }));
    return { snapshotId: id, runId: `run-${id}`, schemaVersion: 1, url, origin: new URL(url).origin,
      domain: new URL(url).hostname, title: "测试图书馆", titleMissing: false,
      capturedAt: Date.now(), itemCount: items.length, items, segments: buildSegments(items),
      controls: [], truncated: false };
  }
  function collection(value) {
    assert.ok(value, "configured collection must have a snapshot");
    return { snapshot: value, diagnostics: { collectMs: 1, iframeCount: 0,
      droppedHidden: 0, openShadowRoots: 0, itemCount: value.itemCount, truncated: false } };
  }
  const render = () => {
    assert.equal(disposed, false, "cannot render an unmounted hook");
    cursor = 0; dirty = false;
    view = useConversation("normal", options.modelEnabled ?? true, options.modelReady ?? true);
    for (const effect of effects.splice(0)) effect();
    return view;
  };
  const flush = async () => {
    for (let i = 0; i < 60; i++) {
      await Promise.resolve();
      if (dirty && !disposed) render();
    }
    return view;
  };
  const dispose = () => {
    if (disposed) return;
    for (const slot of slots) slot?.cleanup?.();
    disposed = true;
  };
  t.after(dispose);
  const change = (tabId, kind = "activated", windowId = api.windowId) => {
    if (windowId === api.windowId) api.tabId = tabId;
    onMessage.fire({ type: "EF_PAGE_CHANGED", v: 1, tabId, windowId, kind });
  };
  const messagesOf = type => requests.filter(request => request.type === type);
  const fail = (code, detail = "test failure") => ({ ok: false, error: createEfError(code, detail) });
  const modelReply = value => ({ ok: true, json: async () => ({ result: {
    kind: "answer", answer: "测试图书馆周一开放。", evidence: [{
      segmentId: value.segments[0].segmentId, quote: "测试图书馆周一开放。",
    }],
  }, model: "deepseek-chat" }) });
  const a = snapshot("A"), b = snapshot("B");
  api.snapshots.set(1, a); api.snapshots.set(2, b);
  return { api, a, b, requests, fetches, actions, warnings, unmountedWrites, timers, onMessage, render, flush,
    dispose, change, messagesOf, snapshot, collection, fail, modelReply, get view() { return view; } };
}

test("CONV-01: initial read targets the side panel's window and accepts its snapshot", async t => {
  const h = harness(t); h.render(); const view = await h.flush();
  assert.equal(h.messagesOf("EF_GET_CONTEXT")[0].windowId, 10);
  assert.equal(view.state.snapshot, h.a); assert.equal(view.state.tabId, 1);
  assert.equal(view.state.phase, "ready"); assert.equal(view.state.busy, false);
});

for (const outcome of ["success", "failure"]) {
  test(`CONV-02-${outcome}: late A collection cannot overwrite accepted B`, async t => {
    const h = harness(t), old = deferred();
    h.api.collect = request => request.tabId === 1 ? old.promise : h.collection(h.b);
    h.render(); await h.flush(); assert.equal(h.messagesOf("EF_COLLECT").length, 1);
    h.change(2); await h.flush();
    assert.equal(h.view.state.snapshot, h.b);
    const count = h.view.state.messages.length;
    old.resolve(outcome === "success" ? h.collection(h.a) : h.fail("EF-E003"));
    const view = await h.flush();
    assert.equal(view.state.snapshot, h.b); assert.equal(view.state.tabId, 2);
    assert.equal(view.state.phase, "ready"); assert.equal(view.state.busy, false);
    assert.equal(view.state.readErrorCode, null); assert.equal(view.state.messages.length, count);
  });
}

test("CONV-03: same-tab overlapping manual retries retain the newest result", async t => {
  const h = harness(t); h.render(); await h.flush();
  const first = deferred(), second = deferred(), newer = h.snapshot("A-new");
  let count = 0; h.api.collect = () => (++count === 1 ? first.promise : second.promise);
  const firstRetry = h.view.retry(); await h.flush();
  const secondRetry = h.view.retry(); await h.flush();
  second.resolve(h.collection(newer)); await secondRetry; await h.flush();
  assert.equal(h.view.state.snapshot, newer);
  first.resolve(h.collection(h.a)); await firstRetry; await h.flush();
  assert.equal(h.view.state.snapshot, newer); assert.equal(h.view.state.busy, false);
});

test("CONV-04: loading immediately invalidates old page and waits for completion", async t => {
  const h = harness(t); h.render(); await h.flush();
  const count = h.messagesOf("EF_COLLECT").length;
  h.change(1, "loading"); const loading = h.render();
  assert.equal(loading.state.snapshot, null); assert.equal(loading.state.tabId, null);
  assert.equal(loading.state.busy, true); assert.equal(loading.state.pageState, "changed");
  await h.flush(); assert.equal(h.messagesOf("EF_COLLECT").length, count);
  assert.equal(h.messagesOf("EF_WATCH_STOP").at(-1).tabId, 1);
});

test("CONV-05: immediate loading and completion events are not lost to debounce", async t => {
  const h = harness(t); h.render(); await h.flush();
  h.api.snapshots.set(1, h.b);
  h.change(1, "loading"); h.change(1, "navigated");
  const view = await h.flush();
  assert.equal(view.state.snapshot, h.b); assert.equal(view.state.busy, false);
  assert.equal(h.messagesOf("EF_COLLECT").length, 2);
});

test("CONV-06: events from another window do not reset or collect the current page", async t => {
  const h = harness(t); h.render(); await h.flush();
  const actions = h.actions.length, requests = h.requests.length;
  h.change(99, "loading", 20); h.change(99, "activated", 20); await h.flush();
  assert.equal(h.view.state.snapshot, h.a); assert.equal(h.view.state.tabId, 1);
  assert.equal(h.actions.length, actions); assert.equal(h.requests.length, requests);
});

test("CONV-07: confirmed booking does not block later page navigation or retry", async t => {
  const h = harness(t), booked = h.snapshot("Booked", { booking: true });
  h.api.snapshots.set(1, booked); h.render(); await h.flush();
  assert.equal(h.view.state.pageSuccess, "confirmed");
  h.change(2); await h.flush();
  assert.equal(h.view.state.snapshot, h.b); assert.equal(h.view.state.pageSuccess, "none");
  assert.equal(h.view.state.busy, false);
  const refreshed = h.snapshot("B-refreshed"); h.api.snapshots.set(2, refreshed);
  await h.view.retry(); await h.flush(); assert.equal(h.view.state.snapshot, refreshed);
});

test("CONV-08: failed read clears old snapshot and cannot send it to the model", async t => {
  const h = harness(t); h.render(); await h.flush();
  h.api.collect = () => h.fail("EF-E003"); h.change(2); await h.flush();
  assert.equal(h.view.state.snapshot, null); assert.equal(h.view.state.tabId, null);
  assert.equal(h.view.state.collectDiagnostics, null); assert.equal(h.view.state.phase, "read-blocked");
  assert.equal(h.view.state.readErrorCode, "EF-E003"); assert.equal(h.view.state.busy, false);
  h.view.send("开放时间是什么？"); await h.flush();
  assert.equal(h.fetches.length, 0); assert.match(h.view.state.messages.at(-1).text, /还没读到当前页面/);
});

for (const outcome of ["success", "failure"]) {
  test(`CONV-09-${outcome}: late model result cannot append old answer or clear a new read`, async t => {
    const h = harness(t); h.render(); await h.flush();
    const model = deferred(), nextRead = deferred();
    h.api.fetch = () => model.promise;
    h.view.send("开放时间是什么？"); await h.flush();
    assert.equal(h.fetches.length, 1); assert.equal(h.view.state.busy, true);
    h.api.collect = () => nextRead.promise;
    h.change(2, "loading"); h.change(2, "navigated"); await h.flush();
    const messageCount = h.view.state.messages.length;
    if (outcome === "success") model.resolve(h.modelReply(h.a));
    else model.reject(new Error("late network error"));
    await h.flush();
    assert.equal(h.view.state.snapshot, null); assert.equal(h.view.state.busy, true);
    assert.equal(h.view.state.messages.length, messageCount);
    assert.equal(h.view.state.diagnostics.length, 0); assert.equal(h.warnings.length, 0);
    assert.equal(h.timers.size, 0, "old slow hint timer is cancelled on navigation");
    nextRead.resolve(h.collection(h.b)); await h.flush();
    assert.equal(h.view.state.snapshot, h.b); assert.equal(h.view.state.busy, false);
  });
}

test("CONV-10: late A model answer is discarded after B is already ready", async t => {
  const h = harness(t); h.render(); await h.flush();
  const model = deferred(); h.api.fetch = () => model.promise;
  h.view.send("开放时间是什么？"); await h.flush();
  h.change(2); await h.flush(); const count = h.view.state.messages.length;
  model.resolve(h.modelReply(h.a)); await h.flush();
  assert.equal(h.view.state.snapshot, h.b); assert.equal(h.view.state.messages.length, count);
  assert.equal(h.view.state.busy, false); assert.equal(h.view.state.diagnostics.length, 0);
});

test("CONV-11: valid model answer passes real evidence validation; navigation stales citations", async t => {
  const h = harness(t); h.render(); await h.flush();
  h.api.fetch = () => h.modelReply(h.a); h.view.send("开放时间是什么？"); await h.flush();
  const answer = h.view.state.messages.find(message => message.role === "assistant");
  assert.equal(answer.responseType, "direct-answer"); assert.equal(answer.validation, "passed");
  assert.equal(answer.diagnostics.mode, "online-model"); assert.ok(answer.citations.length > 0);
  assert.equal(answer.citations[0].status, "valid");
  h.change(2); await h.flush();
  const stale = h.view.state.messages.find(message => message.messageId === answer.messageId);
  assert.equal(stale.citations[0].status, "stale");
  h.view.locateCitation(stale.citations[0]); await h.flush();
  assert.equal(h.messagesOf("EF_HIGHLIGHT").length, 0);
});

test("CONV-12: delayed highlight reply does not add stale notice or stats on the new page", async t => {
  const h = harness(t); h.render(); await h.flush();
  const highlight = deferred(); h.api.highlight = () => highlight.promise;
  const item = h.a.items[1];
  h.view.locateCitation({ status: "valid", ref: {
    elementId: item.elementId, domPath: item.domPath, textHash: item.textHash,
  } });
  await h.flush(); assert.equal(h.messagesOf("EF_HIGHLIGHT").length, 1);
  h.change(2); await h.flush(); const count = h.view.state.messages.length;
  highlight.resolve({ status: "folded", stats: { marker: "old-page" } }); await h.flush();
  assert.equal(h.view.highlightStats, null); assert.equal(h.view.state.messages.length, count);
  assert.equal(h.view.state.snapshot, h.b);
});

test("CONV-13: unmount invalidates pending collection and removes message listener", async t => {
  const h = harness(t), pending = deferred(); h.api.collect = () => pending.promise;
  h.render(); await h.flush(); const count = h.actions.length;
  h.dispose(); pending.resolve(h.collection(h.a)); await h.flush();
  assert.equal(h.actions.length, count); assert.equal(h.onMessage.listeners.size, 0);
});

test("CONV-14: failed window lookup can recover on manual retry", async t => {
  const h = harness(t); h.api.getWindow = async () => { throw new Error("temporary window lookup failure"); };
  h.render(); await h.flush(); assert.equal(h.view.state.phase, "read-blocked");
  h.api.getWindow = async () => ({ id: 10 });
  await h.view.retry(); await h.flush();
  assert.equal(h.view.state.snapshot, h.a); assert.equal(h.view.state.phase, "ready");
});

test("CONV-15: authorization event immediately retries a previously blocked page", async t => {
  const h = harness(t); h.api.collect = () => h.fail("EF-E003");
  h.render(); await h.flush(); assert.equal(h.view.state.readErrorCode, "EF-E003");
  h.api.collect = () => h.collection(h.a); h.change(1, "authorized"); await h.flush();
  assert.equal(h.view.state.snapshot, h.a); assert.equal(h.view.state.readErrorCode, null);
  assert.equal(h.view.state.phase, "ready");
});

test("CONV-16: a navigation waiting on window lookup is ignored after unmount", async t => {
  const h = harness(t), lookup = deferred(); h.api.getWindow = () => lookup.promise;
  h.render(); await h.flush();
  h.change(2); h.dispose();
  lookup.resolve({ id: 10 }); await h.flush();
  assert.equal(h.unmountedWrites.length, 0);
  assert.equal(h.messagesOf("EF_COLLECT").length, 0);
});
