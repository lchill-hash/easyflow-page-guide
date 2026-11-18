import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
const api = {
  ...require(join(root, "src/sidepanel/speech/speechController.ts")),
  ...require(join(root, "src/sidepanel/speech/synthesis.ts")),
  ...require(join(root, "src/sidepanel/speech/recognition.ts")),
  ...require(join(root, "src/sidepanel/speech/voiceController.ts")),
  ...require(join(root, "src/shared/speech/voiceMachine.ts")),
  ...require(join(root, "src/shared/speech/constants.ts")),
  ...require(join(root, "src/shared/speech/copy.ts")),
};

class FakeSynthesisAdapter {
  listener = null;
  calls = [];
  stopCalls = 0;
  speak(options) { this.calls.push(options); }
  stop() { this.stopCalls += 1; }
  subscribe(listener) { this.listener = listener; return () => { this.listener = null; }; }
  dispose() {}
  emit(event) { this.listener?.(event); }
}

test("慢速朗读、停止后主动重播、页面失效后清除旧文本", () => {
  const adapter = new FakeSynthesisAdapter();
  const controller = new api.SpeechController({ adapter, now: () => 0 });
  const request = { kind: "direct-answer", text: "先查看办理条件。" };
  controller.setSpeed("slow");
  controller.speak(request);
  assert.equal(adapter.calls.at(-1).rate, api.SPEECH_SLOW_RATE);
  controller.stop();
  assert.equal(controller.getView().canReplay, true);
  controller.replay();
  assert.equal(adapter.calls.length, 2);
  assert.equal(adapter.calls.at(-1).text, request.text);
  controller.setSpeed("normal");
  assert.equal(adapter.calls.at(-1).rate, api.SPEECH_RATE);
  controller.invalidate();
  assert.equal(controller.getView().canReplay, false);
  controller.replay();
  assert.equal(adapter.calls.length, 3);
  controller.dispose();
});

test("主动重播绕过重复保护，速度改变会以新语速重读当前句", () => {
  const adapter = new FakeSynthesisAdapter();
  const controller = new api.SpeechController({ adapter, now: () => 0 });
  const request = { kind: "step-action", text: "选择一个可用日期。" };
  controller.speak(request);
  controller.setSpeed("slow");
  assert.equal(adapter.calls.length, 2);
  assert.equal(adapter.stopCalls, 1);
  assert.equal(adapter.calls.at(-1).rate, api.SPEECH_SLOW_RATE);
  adapter.emit({ type: "ended" });
  controller.replay();
  assert.equal(adapter.calls.length, 3);
  controller.dispose();
});

test("浏览器打断会显示明确的重播提示", () => {
  const utterances = [];
  const browserSpeech = {
    getVoices: () => [],
    speak: (utterance) => utterances.push(utterance),
    cancel: () => undefined,
  };
  class Utterance {
    constructor(text) { this.text = text; }
  }
  const controller = new api.SpeechController({
    adapter: api.createSynthesisAdapter({ speechSynthesis: browserSpeech, SpeechSynthesisUtterance: Utterance }),
  });
  controller.speak({ kind: "direct-answer", text: "请查看页面提示。" });
  utterances[0].onerror({ error: "interrupted" });
  assert.equal(controller.getView().phase, "failed");
  assert.match(controller.getView().note, /再说一遍/);
  controller.replay();
  assert.equal(utterances.length, 2);
  controller.dispose();
});

test("新朗读或切页后，旧浏览器结束事件不会影响当前状态", () => {
  const utterances = [];
  const browserSpeech = {
    getVoices: () => [],
    speak: (utterance) => utterances.push(utterance),
    cancel: () => undefined,
  };
  class Utterance {
    constructor(text) { this.text = text; }
  }
  const controller = new api.SpeechController({
    adapter: api.createSynthesisAdapter({ speechSynthesis: browserSpeech, SpeechSynthesisUtterance: Utterance }),
  });
  controller.speak({ kind: "direct-answer", text: "上一句。" });
  const oldEnd = utterances[0].onend;
  controller.speak({ kind: "direct-answer", text: "新的一句。" });
  oldEnd();
  assert.equal(controller.getView().speakingKey, "direct-answer:新的一句。");
  const currentEnd = utterances[1].onend;
  controller.invalidate();
  currentEnd();
  assert.equal(controller.getView().phase, "idle");
  assert.equal(controller.getView().canReplay, false);
  controller.dispose();
});

test("语音识别失败展示文字和使用帮助替代入口", async () => {
  let state = api.createVoiceInputState();
  state = api.voiceInputReducer(state, { type: "start-requested", supported: true });
  state = api.voiceInputReducer(state, {
    type: "adapter-error",
    kind: "network",
    cancelledByUser: false,
    raw: "network",
    at: 1,
  });
  const view = api.describeVoiceInput(state, 1);
  assert.equal(view.showFallbackActions, true);
  assert.match(view.statusText, /打字/);
  assert.match(api.VOICE_FALLBACK_TEXT, /打字/);
  assert.match(api.VOICE_FALLBACK_TEXT, /使用帮助/);
  const control = await readFile(join(root, "src/sidepanel/components/chat/VoiceInputControl.tsx"), "utf8");
  const composer = await readFile(join(root, "src/sidepanel/components/chat/ChatComposer.tsx"), "utf8");
  assert.match(control, /onPageQuestions/);
  assert.match(composer, /onPageQuestions=\{onHelp\}/);
});

test("识别取消后忽略旧浏览器回调，下一次结果正常进入状态机", () => {
  const instances = [];
  class Recognition {
    constructor() { instances.push(this); }
    lang = "";
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onresult = null;
    onerror = null;
    onend = null;
    onstart = null;
    start() {}
    abort() {}
  }
  const adapter = api.createRecognitionAdapter({ SpeechRecognition: Recognition });
  const events = [];
  adapter.subscribe((event) => events.push(event));
  const options = { lang: "zh-CN", singleShot: true, interimResults: false };
  adapter.start(options);
  const previous = instances[0];
  const staleResult = previous.onresult;
  adapter.cancel();
  staleResult({ results: [{ isFinal: true, length: 1, 0: { transcript: "旧内容" } }] });
  adapter.start(options);
  const current = instances[1];
  current.onresult({ results: [{ isFinal: true, length: 1, 0: { transcript: "继续查询" } }] });
  assert.deepEqual(events.filter((event) => event.type === "final"), [
    { type: "final", text: "继续查询" },
  ]);
  adapter.dispose();
});

test("切页失效后控制器不可重播上一页语音内容", () => {
  const adapter = new FakeSynthesisAdapter();
  const controller = new api.SpeechController({ adapter });
  controller.speak({ kind: "direct-answer", text: "旧网页的内容。" });
  controller.invalidate();
  assert.equal(controller.getView().replayKey, null);
  assert.equal(controller.getView().canReplay, false);
  controller.dispose();
});

test("新增语音按钮文案使用明确的操作名称", () => {
  assert.equal(api.SPEAK_LABELS.replay, "再说一遍");
  assert.equal(api.SPEAK_LABELS.slower, "慢一点");
  assert.equal(api.SPEAK_LABELS.normalSpeed, "恢复语速");
});
