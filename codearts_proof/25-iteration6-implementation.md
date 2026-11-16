# 25 — 第六轮实现：扩展来源麦克风授权、错误分类与最小门禁例外

> 依据：`.codeartsdoer/specs/easyflow_page_guide/iteration6-spec.md`、`iteration6-design.md`、`iteration6-tasks.md`。
>
> 自动测试与构建门禁通过；**真实 Chrome 的麦克风授权、侧栏识别与扩展页行为：人工验收待用户执行 / 浏览器麦克风行为未在本环境验证**。本轮未调用真实麦克风、未保存音频、未创建预约。

## 1. 需求摘要

侧栏语音识别运行在 `chrome-extension://` 来源；此前把 `not-allowed` 与 `service-not-allowed` 合并为“没有麦克风权限”，并误指当前网站站点设置。本轮改为：扩展来源五态权限查询；未授权时侧栏只显示“开启麦克风”，用户再点才打开 EasyFlow 自己的 `mic-permission.html`；授权页仅点击后请求一次 `getUserMedia({audio:true})`，成功立即停止全部音轨并丢弃流；回侧栏重新查询后直达识别。`service-not-allowed`、`audio-capture`、`NotReadableError/TrackStartError`、`network` 分别映射为不同文案；不新增 `tabs`/网站通配权限。

## 2. 修改文件

### 2.1 新增

| 文件 | 内容 |
|---|---|
| `src/shared/speech/permission.ts` | 五态/结果枚举、`mapPermissionState`、`mapMicRequestError`、`toPermissionState`、`releaseStream` |
| `src/sidepanel/speech/microphone.ts` | 唯一 `navigator.permissions` 查询点；`createMicPermissionProbe` 永不 reject |
| `src/sidepanel/speech/micPage.ts` | 固定授权页打开适配器；in-flight + `getContexts` 数量 + 2 秒降级窗口 |
| `src/sidepanel/speech/micMessages.ts` | 授权页→侧栏固定通知订阅；不读 `sender` |
| `public/mic-permission.html` | 授权页静态页（引用本地 JS/CSS） |
| `src/mic-permission/main.tsx` | 授权页入口 |
| `src/mic-permission/MicPermissionPage.tsx` | 页面 UI、点击锁、卸载保护 |
| `src/mic-permission/request.ts` | **唯一** `getUserMedia({audio:true})` 调用点；成功后 `releaseStream` |
| `src/mic-permission/pageView.ts` | 授权页 8 状态文案映射 |
| `src/mic-permission/notify.ts` | 发送 `{type,v,result,at}` 通知 |
| `src/mic-permission/mic-permission.css` | 授权页布局；复用既有 token，按钮 ≥44px |

### 2.2 修改

| 文件 | 改动 |
|---|---|
| `src/shared/speech/types.ts` | `SpeechErrorKind`/`VoiceInputIssue` 增加 `service-limited`、`device-unavailable` |
| `src/shared/speech/policy.ts` | `service-not-allowed → service-limited`；`not-allowed` 保持 `permission-denied` |
| `src/shared/speech/constants.ts` | 授权页路径、消息版本、重查间隔、去重窗口、300ms 可见常量 |
| `src/shared/speech/copy.ts` | 拒绝文案改为 EasyFlow 扩展来源；新增入口/设置说明/授权页文案；`network` 去前缀；五类失败文案互异 |
| `src/shared/speech/voiceMachine.ts` | 权限五态、`micGate`、`pageOpened`、`micPageFailed`、设置说明与状态优先级 |
| `src/sidepanel/speech/voiceController.ts` | `start(): Promise<void>` 同步兼容；`refreshPermission`、`requestMicPermission`、`applyMicResult`、`getPermission` |
| `src/sidepanel/hooks/useVoiceInput.ts` | 注入 probe/page；挂载查询；focus/visibility 重查；订阅跨页通知；卸载清理 |
| `src/sidepanel/components/chat/VoiceInputControl.tsx` | “开启麦克风”、目的说明、扩展来源设置说明 |
| `src/sidepanel/components/chat/ChatComposer.tsx` | 透传 `onRequestMic` |
| `src/shared/messages.ts` | `MSG.MIC_PERMISSION_RESULT`、最小通知类型、校验与构造 |
| `src/background/index.ts` | 授权页通知前置拦截，不进入路由 |
| `src/sidepanel/styles/sidepanel.css` | `.ef-speech-open-btn`、目的/设置说明样式；320px 100% 宽度 |
| `scripts/build.mjs` | 授权页第四入口（`minify:false`）与 HTML 复制 |
| `scripts/verify-manifest.mjs` | 3 个授权页产物；HTML/脚本/路径断言；`getUserMedia` 仅两条例外（逐条打印、未使用即失败） |
| `scripts/selftest.mjs` | 新增导出与 AT-64—AT-80 |
| `dist/` | 重新构建 |

### 2.3 未修改

`recognition.ts`、`synthesis.ts`、`speechController.ts`、`speakMachine.ts`、`StepCardSpeech.tsx`、`StepCard.tsx`、`MessageList.tsx`、`AboutPanel.tsx`、`conversationReducer.ts`、`shared/types.ts`、`background/router.ts`、`public/manifest.json`、`public/sidepanel.html`、前五轮文档。

## 3. 自动测试结果

- `npm run selftest`：**71 项通过**（`1..71 / pass 71 / fail 0`），新增 AT-64—AT-80 共 17 项。
- 原有 54 项全部保留；`AT-32`/`AT-50` 口径未改。
- 假适配器/假 probe/假 page/假 runtime/假 media，未调用真实麦克风、真实识别、真实发声。
- 口径澄清（实现记录，不是放宽）：
  - `mapPermissionState` 只映射浏览器可能返回的 `granted/prompt/denied`；`unsupported` 由探测层直接产生，因此 AT-64 不要求 `unsupported` 经过该映射。
  - “侧栏源码不含 `getUserMedia`”按 `src/sidepanel/**` 与 `src/mic-permission/**` 分别断言；类型契约只保留在授权页请求文件，门禁例外恰为 2 条。
  - 设计中的 `MediaDevicesLike` 从 `shared/speech/permission.ts` 移到授权页 `request.ts`（唯一消费者），避免门禁把类型声明误判为调用；语义不变。

## 4. 门禁结果

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run typecheck` | 0 | 0 error |
| `npm run build` | 0 | 新增 `mic-permission.html/.js/.css`；`sidepanel.js 271084 bytes` |
| `npm run selftest` | 0 | 71 项通过 |
| `npm run verify` | 0 | 权限四项；2 条例外；audio-only；`getTracks()+stop()` |

日志：

- `codearts_proof/iteration6-typecheck.log`
- `codearts_proof/iteration6-build.log`
- `codearts_proof/iteration6-selftest.log`
- `codearts_proof/iteration6-verify.log`

`verify` 例外清单（每次运行打印）：

```
src/mic-permission/request.ts ← getUserMedia
dist/mic-permission.js ← getUserMedia
```

## 5. 清洁检索

| 检索 | 结果 |
|---|---|
| `src` 中 `getUserMedia` | 仅 `src/mic-permission/request.ts`（`iteration6-clean-getusermedia.log`） |
| `MediaRecorder`/`XMLHttpRequest`/`sendBeacon`/`WebSocket`（`src`+`dist`） | 0 hits（`iteration6-clean-network.log`） |
| `chrome.storage`（speech/授权页目录） | 0 hits（`iteration6-clean-privacy.log`） |
| `tabs.query/update/reload/remove` 等 | 命中既有 `src/background/tabContext.ts` 的 `chrome.tabs.query({active:true,lastFocusedWindow:true})`；本轮未新增、未改变该文件（`iteration6-clean-tabs.log`） |
| `public/manifest.json` 权限 | `["activeTab","scripting","sidePanel","storage"]`（`iteration6-clean-manifest.log`） |

说明：既有 `tabs.query` 用于获取当前活动标签上下文，既有 `activeTab` 权限；本轮新增的授权页打开只调用 `chrome.tabs.create({url: getURL("mic-permission.html")})`，不查询其他标签页，不读 `url/title/favIconUrl/pendingUrl`。

## 6. 真实 Chrome 验收

### 6.1 已执行

（空）

### 6.2 待用户执行（人工验收待用户执行 / 浏览器麦克风行为未在本环境验证）

1. 扩展管理页重新加载 EasyFlow → 关闭并重新打开侧栏。
2. 打开第三方网页侧栏 → 点“语音输入” → 只出现“开启麦克风”和“仅用于 EasyFlow 语音输入”；**不出现授权弹窗**；当前网页无变化。
3. 点“开启麦克风” → 仅打开 `chrome-extension://<扩展 ID>/mic-permission.html`；页面有目的、隐私说明与“允许麦克风”；**仍未弹窗**。
4. 点“允许麦克风” → 浏览器弹窗 → 允许 → 页面显示“已允许，请回 EasyFlow 再点语音输入”；**页面不自动关闭**。
5. 回侧栏 → 再点“语音输入” → 进入“正在听”；**没有出现第二个授权页**。
6. 说“我想了解办理条件” → 文字只进入可编辑输入框；等待 5 秒**没有自动发送**；手动点“发送”后才出现用户消息与回答/步骤。
7. 将 EasyFlow 扩展来源的麦克风权限改为拒绝 → 回侧栏重试 → 显示拒绝文案与“EasyFlow 扩展的麦克风权限”设置方法；**不提示当前网站站点设置**；仍可打字并发送。
8. 若自然出现服务受限/网络失败 → 文案与拒绝不同；**不显示“没权限”**。
9. 点“朗读这一步” → 正常朗读 → “停止朗读”立即停止；麦克风权限失败状态下朗读仍可用。
10. 在浏览器设置重新允许 → 回侧栏重试 → 无需重载扩展即可重新进入识别。

失败记录口径（必须遵守）：只记录**浏览器原始错误类别**（如 `NotAllowedError` / `service-not-allowed` / `NotReadableError`）+ **扩展来源权限状态**（granted/prompt/denied/unknown）+ Chrome 版本与平台；**不得记录**音频、识别原文、设备名称、网页 URL、完整查询串。

## 7. 已知限制

1. 授权页允许后不自动关闭、不自动跳回侧栏；依赖用户按文字指引返回。
2. `unknown` 时仍显示“开启麦克风”，可能多开一次授权页（`getContexts` 不可用且 2 秒窗口过期时）。
3. 授权页的“无设备/系统禁用”只即时显示在授权页；回侧栏重试识别才会出现同类侧栏文案。
4. 授权页产物 `mic-permission.js` 约 1.06 MB（`minify:false` + React），仅本地加载；换取门禁对 `{audio:true}` 与停轨逻辑的可读断言。
5. 真实 Chrome 的扩展来源设置入口位置可能随版本变化；文案已注明，不宣称唯一路径。
6. 浏览器语音识别是否可用、是否使用在线服务、麦克风弹窗行为均未在本环境验证。