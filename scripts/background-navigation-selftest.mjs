import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceCache = new Map();
function event() {
  const listeners = [];
  return { addListener: listener => listeners.push(listener), fire: (...args) => listeners.map(listener => listener(...args)) };
}
function deferred() {
  let resolvePromise;
  const promise = new Promise(resolve => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function until(predicate) {
  for (let i = 0; i < 50; i += 1) {
    if (predicate()) return;
    await tick();
  }
  assert.fail("condition was not reached");
}
function setup() {
  const tabs = new Map([[1, { id: 1, windowId: 10, active: true, status: "complete", url: "https://example.test/one" }]]);
  const messages = [], queries = [], injections = [], warnings = [], opened = [];
  const state = { version: "0.3.0", execute: null, send: null };
  const chrome = {
    runtime: { lastError: undefined, onInstalled: event(), onMessage: event(),
      sendMessage: async message => { messages.push(message); } },
    windows: { WINDOW_ID_CURRENT: -2 },
    action: { onClicked: event() },
    sidePanel: { setPanelBehavior: async () => {}, open: async args => { opened.push(args); } },
    storage: { local: { get: async () => ({}), set: async () => {} } },
    scripting: { executeScript: async args => {
      injections.push(args);
      if (state.execute) return state.execute(args);
      state.version = "0.3.0";
      return [];
    } },
    tabs: {
      onActivated: event(), onUpdated: event(), onRemoved: event(),
      get: async id => { if (!tabs.has(id)) throw new Error(`No tab with id: ${id}`); return tabs.get(id); },
      query: async args => {
        queries.push(args);
        return [...tabs.values()].filter(tab => tab.active && (args.windowId === undefined || tab.windowId === args.windowId));
      },
      sendMessage: (id, message, callback) => {
        if (state.send) return state.send(id, message, callback);
        callback(state.version ? { ok: true, data: { ready: true, contentVersion: state.version } } : undefined);
      },
    },
  };
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
    runInNewContext(compiled, { module, exports: module.exports,
      require: dependency => {
        if (!dependency.startsWith(".")) throw new Error(`Unexpected dependency: ${dependency}`);
        return load(join(dirname(file), dependency + ".ts"));
      }, chrome, setTimeout, clearTimeout, Promise, performance, URL,
      console: { warn: (...args) => warnings.push(args), log() {} },
    }, { filename: file });
    return module.exports;
  }
  const injector = load("src/background/injector.ts");
  const router = load("src/background/router.ts");
  const context = load("src/background/tabContext.ts");
  const errors = load("src/shared/errors.ts");
  load("src/background/index.ts");
  return { tabs, chrome, state, messages, queries, injections, warnings, opened, injector, router, context, errors };
}
function route(env, message) {
  return new Promise(resolve => {
    assert.equal(env.router.routeSidePanelMessage({ v: 1, requestId: "test-request", ...message }, resolve), true);
  });
}

test("BG-01: side panel context is scoped to its own browser window", async () => {
  const env = setup();
  env.tabs.set(2, { id: 2, windowId: 20, active: true, status: "complete", url: "https://other.test" });
  const result = await route(env, { type: "EF_GET_CONTEXT", windowId: 20 });
  assert.equal(result.data.tabId, 2);
  assert.equal(result.data.windowId, 20);
  assert.equal(JSON.stringify(env.queries[0]), JSON.stringify({ active: true, windowId: 20 }));
  for (const windowId of [0, -1, "20", 1.5]) {
    assert.equal(env.router.routeSidePanelMessage({ type: "EF_GET_CONTEXT", v: 1, requestId: "bad", windowId }, () => {}), false);
  }
});

test("BG-02: legacy context keeps lastFocusedWindow and missing active tab is explicit", async () => {
  const env = setup();
  assert.equal((await env.context.getActiveTab()).tabId, 1);
  assert.equal(env.queries[0].lastFocusedWindow, true);
  env.tabs.clear();
  assert.equal((await env.context.getActiveTab(10)).error.code, "EF-E001");
});

test("BG-03: matching content PING survives service worker memory reset without reinjection", async () => {
  const env = setup();
  assert.equal((await env.injector.ensureInjected(1)).ok, true);
  assert.equal(env.injections.length, 0);
  assert.equal(env.injector.getInjectionDiagnostics(1).contentVersionSeen, "0.3.0");
});

test("BG-04: missing activeTab permission is not reported as an unsupported webpage", async () => {
  const env = setup();
  env.state.version = null;
  env.state.execute = async () => { throw new Error('Cannot access contents of url "https://example.test/one". Extension manifest must request permission to access this host.'); };
  const result = await env.injector.ensureInjected(1);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "EF-E003");
  assert.equal(env.injector.getLastInjectionError(1).code, "EF-E003");
});

test("BG-05: browser internal pages and loading documents are not injected", async () => {
  const env = setup();
  env.tabs.get(1).url = "chrome://settings/";
  assert.equal((await env.injector.ensureInjected(1)).error.code, "EF-E002");
  env.tabs.get(1).url = "https://example.test";
  env.tabs.get(1).status = "loading";
  assert.equal((await env.injector.ensureInjected(1)).error.code, "EF-E007");
  assert.equal(env.injections.length, 0);
});

test("BG-06: concurrent requests share injection for one document", async () => {
  const env = setup(), gate = deferred();
  env.state.version = null;
  env.state.execute = async () => { await gate.promise; env.state.version = "0.3.0"; };
  const first = env.injector.ensureInjected(1), second = env.injector.ensureInjected(1);
  assert.equal(first, second);
  await until(() => env.injections.length === 1);
  gate.resolve();
  assert.equal((await first).ok, true);
  assert.equal((await second).ok, true);
  assert.equal(env.injections.length, 1);
});

test("BG-07: navigation invalidates pending injection and a fresh document gets a fresh task", async () => {
  const env = setup(), gate = deferred();
  env.state.version = null;
  env.state.execute = async () => { await gate.promise; };
  const old = env.injector.ensureInjected(1);
  await until(() => env.injections.length === 1);
  env.injector.resetInjected(1);
  env.state.version = "0.3.0";
  const fresh = env.injector.ensureInjected(1);
  assert.notEqual(old, fresh);
  assert.equal((await fresh).ok, true);
  gate.resolve();
  assert.equal((await old).error.code, "EF-E007");
  assert.equal(env.injector.getLastInjectionError(1), undefined);
  assert.equal(env.injector.getInjectionDiagnostics(1).pageInjectionCount, 0);
});

test("BG-08: late PING from an old document cannot overwrite current diagnostics", async () => {
  const env = setup();
  let oldPing;
  env.state.send = (_id, _message, callback) => { oldPing = callback; };
  const old = env.injector.ensureInjected(1);
  await until(() => oldPing !== undefined);
  env.injector.resetInjected(1);
  env.state.send = null;
  assert.equal((await env.injector.ensureInjected(1)).ok, true);
  oldPing({ ok: true, data: { ready: true, contentVersion: "old-version" } });
  assert.equal((await old).error.code, "EF-E007");
  assert.equal(env.injector.getInjectionDiagnostics(1).contentVersionSeen, "0.3.0");
});

test("BG-09: unrelated inactive tab loading and completion do not refresh the sidebar", () => {
  const env = setup(), tab = { id: 2, windowId: 10, active: false, status: "loading" };
  env.chrome.tabs.onUpdated.fire(2, { status: "loading" }, tab);
  env.chrome.tabs.onUpdated.fire(2, { status: "complete" }, { ...tab, status: "complete" });
  assert.equal(env.messages.length, 0);
});

test("BG-10: fast active navigation emits both loading and complete with exact window", () => {
  const env = setup(), tab = env.tabs.get(1);
  env.chrome.tabs.onUpdated.fire(1, { status: "loading" }, tab);
  env.chrome.tabs.onUpdated.fire(1, { status: "complete" }, tab);
  assert.equal(env.messages.length, 2);
  assert.deepEqual(env.messages.map(message => message.kind), ["loading", "navigated"]);
  assert.ok(env.messages.every(message => message.tabId === 1 && message.windowId === 10));
});

test("BG-11: activation carries its own browser window rather than global focus", () => {
  const env = setup();
  env.chrome.tabs.onActivated.fire({ tabId: 7, windowId: 20 });
  assert.equal(env.messages[0].kind, "activated");
  assert.equal(env.messages[0].tabId, 7);
  assert.equal(env.messages[0].windowId, 20);
});

test("BG-12: toolbar click retries an already open sidebar after permission/injection", async () => {
  const env = setup();
  env.chrome.action.onClicked.fire(env.tabs.get(1));
  await until(() => env.messages.some(message => message.kind === "authorized"));
  assert.equal(env.opened.length, 1);
  assert.equal(env.opened[0].tabId, 1);
  assert.equal(env.messages[0].windowId, 10);
});

test("BG-13: delayed toolbar injection does not switch sidebar back to an inactive tab", async () => {
  const env = setup(), gate = deferred();
  env.state.version = null;
  env.state.execute = async () => { await gate.promise; env.state.version = "0.3.0"; };
  env.chrome.action.onClicked.fire(env.tabs.get(1));
  await until(() => env.injections.length === 1);
  env.tabs.get(1).active = false;
  gate.resolve();
  await tick(); await tick();
  assert.equal(env.messages.length, 0);
});

test("BG-14: closing a tab clears diagnostics and invalidates its outstanding task", async () => {
  const env = setup(), gate = deferred();
  env.state.version = null;
  env.state.execute = async () => { await gate.promise; };
  const task = env.injector.ensureInjected(1);
  await until(() => env.injections.length === 1);
  env.tabs.delete(1);
  env.chrome.tabs.onRemoved.fire(1, { windowId: 10, isWindowClosing: false });
  gate.resolve();
  assert.equal((await task).error.code, "EF-E007");
  assert.equal(env.injector.getInjectionDiagnostics(1).pageInjectionCount, 0);
  assert.equal(env.injector.getInjectionDiagnostics(1).contentVersionSeen, "");
  assert.equal(env.injector.getLastInjectionError(1), undefined);
});

test("BG-15: a new document never shares old collection or loses its lock to an old finally", async () => {
  const env = setup(), callbacks = [];
  env.state.send = (_id, message, callback) => {
    if (message.type === "EF_CONTENT_PING") callback({ ok: true, data: { ready: true, contentVersion: "0.3.0" } });
    else if (message.type === "EF_CONTENT_COLLECT") callbacks.push(callback);
  };
  const old = route(env, { type: "EF_COLLECT", tabId: 1, reason: "initial" });
  await until(() => callbacks.length === 1);
  env.chrome.tabs.onUpdated.fire(1, { status: "loading" }, env.tabs.get(1));
  const fresh = route(env, { type: "EF_COLLECT", tabId: 1, reason: "recheck" });
  await until(() => callbacks.length === 2);
  callbacks[0]({ ok: true, data: { snapshot: { snapshotId: "old" }, diagnostics: {} } });
  await old;
  const shared = route(env, { type: "EF_COLLECT", tabId: 1, reason: "recheck" });
  await tick();
  assert.equal(callbacks.length, 2);
  callbacks[1]({ ok: true, data: { snapshot: { snapshotId: "fresh" }, diagnostics: {} } });
  assert.equal((await fresh).data.snapshot.snapshotId, "fresh");
  assert.equal((await shared).data.snapshot.snapshotId, "fresh");
});

test("BG-16: error classification distinguishes missing grant, browser restrictions, and closed tabs", () => {
  const env = setup();
  const cases = [
    ['Cannot access contents of the page. Extension manifest must request permission.', "EF-E003"],
    ['Missing host permission for the tab', "EF-E003"],
    ['Cannot access contents of url "https://example.test/"', "EF-E003"],
    ['Cannot access a chrome:// URL', "EF-E002"],
    ['Cannot access edge://settings/', "EF-E002"],
    ['The extensions gallery cannot be scripted.', "EF-E002"],
    ['No tab with id: 20', "EF-E004"],
  ];
  for (const [message, code] of cases) assert.equal(env.errors.toEfError(message).code, code, message);
});

test("BG-17: revoked host access cannot reuse a surviving PING when the tab URL is hidden", async () => {
  const env = setup(), contentRequests = [];
  assert.equal((await env.injector.ensureInjected(1)).ok, true);
  assert.equal(env.injections.length, 0);
  // Without the tabs permission, Chrome hides URL after both host access and
  // any temporary activeTab grant have gone away. A script can still respond.
  delete env.tabs.get(1).url;
  env.state.send = (_id, message, callback) => {
    contentRequests.push(message.type);
    if (message.type === "EF_CONTENT_PING") {
      callback({ ok: true, data: { ready: true, contentVersion: "0.3.0" } });
    } else if (message.type === "EF_CONTENT_COLLECT") {
      callback({ ok: true, data: { snapshot: { snapshotId: "unauthorized" }, diagnostics: {} } });
    }
  };
  env.state.execute = async () => {
    throw new Error('Cannot access contents of url "https://example.test/one". Extension manifest must request permission to access this host.');
  };
  const result = await route(env, { type: "EF_COLLECT", tabId: 1, reason: "recheck" });
  assert.equal(result.ok, false, "surviving PING is not evidence of current host authorization");
  assert.equal(result.error.code, "EF-E003");
  assert.equal(contentRequests.includes("EF_CONTENT_COLLECT"), false);
  assert.equal(env.injections.length, 1, "Chrome must recheck injection permission");
});

test("BG-18: a renewed single-page grant restores reuse after host access was revoked", async () => {
  const env = setup();
  delete env.tabs.get(1).url;
  env.state.execute = async () => { throw new Error("Missing host permission for the tab"); };
  const denied = await env.injector.ensureInjected(1);
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "EF-E003");
  env.tabs.get(1).url = "https://example.test/one";
  const allowed = await env.injector.ensureInjected(1);
  assert.equal(allowed.ok, true);
  assert.equal(env.injections.length, 1, "renewed activeTab access can reuse the existing script");
  assert.equal(env.injector.getLastInjectionError(1), undefined);
});

test("BG-19: sticky highlight is forwarded and manual clear does not inject", async () => {
  const env = setup(), requests = [];
  env.state.send = (_id, message, callback) => {
    requests.push(message);
    if (message.type === "EF_CONTENT_PING") {
      callback({ ok: true, data: { ready: true, contentVersion: "0.3.0" } });
    } else if (message.type === "EF_CONTENT_HIGHLIGHT") {
      callback({ ok: true, data: { status: "highlighted", sticky: message.sticky } });
    } else if (message.type === "EF_CONTENT_HIGHLIGHT_CLEAR") {
      callback({ ok: true, data: { cleared: true } });
    }
  };
  const ref = { elementId: "ef-p-1", domPath: "p:nth-of-type(1)", textHash: "a1b2c3d4" };
  const highlighted = await route(env, { type: "EF_HIGHLIGHT", tabId: 1, ref, sticky: true });
  assert.equal(highlighted.ok, true);
  assert.equal(highlighted.data.sticky, true);
  assert.equal(requests.find(message => message.type === "EF_CONTENT_HIGHLIGHT").sticky, true);
  const cleared = await route(env, { type: "EF_HIGHLIGHT_CLEAR", tabId: 1 });
  assert.deepEqual(cleared.data, { cleared: true });
  assert.equal(requests.at(-1).type, "EF_CONTENT_HIGHLIGHT_CLEAR");
  assert.equal(env.injections.length, 0);
  assert.equal(env.router.routeSidePanelMessage({ type: "EF_HIGHLIGHT_CLEAR", v: 1, requestId: "bad", tabId: 0 }, () => {}), false);
});
