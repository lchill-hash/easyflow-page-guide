# 27 — 第八轮实现：安装结果两分、异常安全摘要与浏览器实际错误码

> 依据：`.codeartsdoer/specs/easyflow_page_guide/iteration8-spec.md`（v2）、`iteration8-design.md`、`iteration8-tasks.md`。
>
> 自动测试与门禁通过；**真实设备上中文本机识别是否可用尚待人工验收，代码完成不等于语音可用**。本轮未调用真实麦克风、真实 `available/install` 或网络，未创建预约。

## 1. 需求摘要

只诊断语音输入，不改导办流程、麦克风首次授权、朗读与 `EF-E003`：

1. `SpeechRecognition.install()` 返回 `false`、返回未知值、抛异常、接口不支持四类分别记录；抛异常显示白名单名称与脱敏摘要。
2. 安装结束（成功/false/未知/throw）一律重新检测 `zh-CN` 本机识别状态；复检失败保留安装结论。
3. 诊断显示“浏览器错误码”，只来自 `onerror.error`；`onend`/超时/取消显示“未提供”，不伪造 `no-speech`。
4. 诊断固定 13 键，与页面采集/`EF-E003` 分区；不记录音频、识别内容、设备名、URL、完整 message。
5. 失败下打字可用；不显示“已完成/已可用/语音可用”；诊断不明确时只补诊断，不自动改权限/重试/安装。

## 2. 修改文件

### 2.1 新增（2）

| 文件 | 内容 |
|---|---|
| `src/shared/speech/forbidden.ts` | 诊断禁词、音频数据禁词、安装摘要禁词与允许值 `audio-capture` 单一来源 |
| `src/shared/speech/installReport.ts` | 10 个异常名称白名单、`normalizeInstallErrorName`、`sanitizeInstallErrorBrief`（输入 2000、摘要 40 code point、10 步脱敏）、`readInstallErrorDetail`、`describeInstallOutcomeText` |

### 2.2 修改

| 文件 | 改动 |
|---|---|
| `src/shared/speech/types.ts` | `RawErrorCode`、`ErrorSource`；`RecognitionEvent.error` 可选 `code/errorSource`；保留 `kind/raw` |
| `src/shared/speech/constants.ts` | `INSTALL_ERROR_BRIEF_MAX_CHARS=40`、`INSTALL_ERROR_INPUT_MAX_CHARS=2000`、`DIAGNOSTICS_SERIALIZED_MAX_CHARS=480` |
| `src/shared/speech/copy.ts` | 四句安装结果文案；诊断“浏览器错误码/安装结果/未提供/未映射/会话结束/等待超时/已取消/已中断”；`INSTALL_OUTCOME_TEXTS` 七态；`INSTALL_ERROR_TEXTS` |
| `src/shared/speech/localCapability.ts` | `INSTALL_OUTCOMES`/`InstallOutcome`/`InstallOutcomeDetail`；`mapInstallOutcome`（严格 false vs 未知值）；`installStateOf`；`mapInstallResult` 原实现保留 |
| `src/shared/speech/policy.ts` | `mapRawErrorCode`（7 白名单 + `unmapped` + `null`） |
| `src/shared/speech/diagnostics.ts` | 13 键视图；`installOutcomeText` 三段式；`rawErrorCodeText`；来源优先的 `lastErrorText`；`RAW_ERROR_CODE_LABEL` |
| `src/shared/speech/voiceMachine.ts` | 7 个新状态字段；`install-flow-changed`/`install-settled`；`adapter-error` 写来源/原码；`adapter-ended`/`timeout`/`cancel` 不伪造码；`localNoticeOf` 四句顺序；`installButtonVisible` 新公式 |
| `src/sidepanel/speech/recognition.ts` | `onerror` 携带白名单 `code` 与 `errorSource:"onerror"`；`onend` 不再发 `no-speech` 错误；三处本地失败标 `errorSource:"adapter"` |
| `src/sidepanel/speech/localCapability.ts` | `LocalInstaller.install(): Promise<InstallOutcomeDetail>`；成功/false/未知/throw/不支持映射；永不 reject |
| `src/sidepanel/speech/voiceController.ts` | 安装结算接线；所有实际结果各 1 次强制复检；复检串行 + 至多 1 次排队 + 绕过缓存；复检态按钮；错误码/来源透传 |
| `src/sidepanel/components/chat/DiagnosticsPanel.tsx` | 语音区新增“浏览器错误码”“安装结果”两行；折叠不渲染；分区/按钮数量不变 |
| `scripts/selftest.mjs` | 导出新模块；扩展 `FakeLocalCapability`/`FakeRecognition`；AT-81/AT-90 最小改写；新增 AT-97—AT-105 |
| `dist/` | 重新构建（`sidepanel.js 293282 bytes`） |

### 2.3 未修改

`VoiceInputControl.tsx`、`ChatComposer.tsx`、`App.tsx`、`useVoiceInput.ts`、`sidepanel.css`、`permission.ts`、`microphone.ts`、`micPage.ts`、`micMessages.ts`、`synthesis.ts`、`speechController.ts`、`speakMachine.ts`、`StepCard*.tsx`、`src/mic-permission/**`、`public/mic-permission.html`、`background/**`、`shared/messages.ts`、`manifest.json`、`build.mjs`、`verify-manifest.mjs`、`package.json`、`tsconfig.json`。

## 3. 关键行为

- **安装四类**：严格 `false` → “返回 false（明确失败）”；`undefined/null/{ok:false}/未知对象` → “返回未知值（未确认成功）”；抛异常 → “抛出异常 · 名称 · 摘要”；无 install → “接口不支持”。语音区四句两两不同；诊断四段文本两两不同。
- **摘要**：白名单名称精确大小写；摘要折叠空白、去协议 URL/盘符路径/扩展 ID/长 ASCII/长数字/禁词，≤40 code point（总 ≤41），空则固定短句；不落盘、不进日志/聊天/storage。
- **复检**：成功/false/未知/throw 各 1 次；接口不支持/未点击 0 次；单探测 Promise + 至多一次排队；强制绕过 5 分钟缓存；复检失败刷新最近检测、保留安装结论、隐藏按钮；复检中按钮可见禁用；`available` 不自动选中。
- **错误码**：`onerror` 白名单 7 码原样显示，未映射显示“其他（未映射）”，缺失显示“未提供”；`onend`/超时/取消一律“未提供”；用户取消不新增码；原码只在诊断区。
- **13 键**：语音诊断固定 13 个文本键；折叠不渲染；`audio-capture` 是唯一允许含 `audio` 的展示值。
- **边界**：失败下打字可用；不自动重试/安装/识别/发送；不显示“已完成/已可用/语音可用”。

## 4. 测试结果

- `npm run selftest`：**96 项通过**（`# tests 96 / # pass 96 / # fail 0`）。
- 新增 AT-97—AT-105（9 项）：安装三分与四句、异常白名单/摘要、四类复检、复检失败与按钮、实际错误码、onend/超时/取消、13 键与两行、失败可打字、边界回归。
- 仅 **AT-81** 改写 13 键/禁词/480 长度，**AT-90** 增加失败路径复检计数与安装结果区分；其余 85 项零改动。
- 全部使用假接口；未访问真实麦克风、真实 `install/available` 或网络。

## 5. 门禁

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run typecheck` | 0 | 0 error |
| `npm run build` | 0 | 产物齐全；verify 例外 2 条 |
| `npm run selftest` | 0 | 96 项通过 |
| `npm run verify` | 0 | 权限四项、授权页产物、audio-only、停轨、例外 2 条 |

日志：`codearts_proof/iteration8-{typecheck,build,selftest,verify}.log`。

## 6. 清洁检索

| 检索 | 结果 |
|---|---|
| 本机静态 `["available"]`/`["install"]` | 仅 `src/sidepanel/speech/localCapability.ts`（`iteration8-clean-localapi.log`） |
| `processLocally =` | 仅 `src/sidepanel/speech/recognition.ts`（`iteration8-clean-processlocally.log`） |
| 语音目录 `chrome.storage`/`fetch(`/`MediaRecorder`/其他网络 API | 0 hits（`iteration8-clean-speech.log`） |
| `manifest` 权限 | 四项不变（`iteration8-clean-manifest.log`） |

## 7. 异常名称与摘要实际参数

- 名称白名单 10 项：`NotAllowedError`、`SecurityError`、`NotSupportedError`、`NetworkError`、`AbortError`、`InvalidStateError`、`UnknownError`、`TypeError`、`RangeError`、`Error`。
- 摘要输入预截断 2000 code point；输出上限 40 code point，省略号另计（总 ≤41）。

## 8. 真实 Chrome

### 8.1 已执行

（空）

### 8.2 待用户执行（人工验收待用户执行 / 真实设备中文本机识别未验证）

1. 重新加载扩展 → 重开侧栏 → 展开“运行诊断”记录基线：权限、最近错误、浏览器错误码、本机接口、`zh-CN` 状态、安装状态/安装结果。
2. 若 `downloadable`：点击一次“下载中文语音资源”，记录安装结果类别；若抛异常，只记录异常名称、摘要长度区间（0 / 1—40 / 41）、是否为空/截断，**不抄摘要原文**。
3. 检查复检后的 `zh-CN` 状态与“最近检测”是否刷新；复检失败时安装结论是否保留、按钮是否隐藏。
4. 服务识别失败：记录“浏览器错误码”与“最近错误”两行；`onend` 时确认是“未提供 + 会话结束”，不是伪造 `no-speech`。
5. 取消一次识别：确认类别“已取消识别”、码“未提供”；失败后打字并手动发送。
6. 确认语音区/诊断区无“已完成/已可用/语音可用”；朗读与页面采集诊断不变。
7. 只记录实际发生的一类；未发生的类别由自动测试覆盖，不得伪造。

## 9. 修复分支

本轮只补诊断，未进入修复分支。后续按证据表处理：
- 安装 `false` 且复检仍 `downloadable` → 浏览器未准备资源，保留安装按钮，不自动重试。
- 安装 `throw` 且复检 `error` → 先修复检/安装错误展示，不改权限。
- 服务识别 `network` 且权限 `granted` → 不重授麦克风，按本机 `zh-CN` 状态决定是否提示本机分支。
- 诊断证据不足 → 只补诊断，不改权限/换服务/扩接口。

## 10. 固定声明

自动测试通过不等于语音可用；真实设备中文本机识别是否可用尚待人工验收。本轮未执行真实 Chrome 语音检查，也未把语音输入标为已完成/已可用。