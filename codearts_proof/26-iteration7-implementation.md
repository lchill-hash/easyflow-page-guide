# 26 — 第七轮实现：语音诊断、network/no-speech 文案与本机识别可选分支

> 依据：`.codeartsdoer/specs/easyflow_page_guide/iteration7-spec.md`、`iteration7-design.md`、`iteration7-tasks.md`。
>
> 自动测试与门禁通过；**真实设备上中文本机识别是否可用尚待人工验收，代码完成不等于语音可用**。未调用真实麦克风、真实 `available/install` 或网络，未创建预约。

## 1. 本轮问题与实现范围

真实 Chrome 复测：授权页已打开，侧栏语音先提示“未识别到语音”，随后提示“网络或语音服务暂不可用”。截图中的旧消息“页面访问许可”属于网页采集 `EF-E003`，本轮保持其独立链路，不混入语音诊断。

实现范围：

1. 语音诊断独立分区，只显示枚举/布尔/相对时间；与页面采集、`EF-E003` 物理分区。
2. `network` 在已授权时明确“麦克风已授权，但浏览器语音服务连接失败……”；`no-speech` 独立单句；权限非 granted 时按真实权限解释。
3. 本机识别能力探测：仅 API 存在时检测；`available` 才出现“使用本机识别”；`downloadable` 只显示安装按钮；`unavailable/接口缺失/抛错` 均不标记可用。
4. 安装仅点击后一次、参数只含 `zh-CN`、成功复检、失败回退、不自动重试。
5. 双模式：默认浏览器服务识别，不持久化；本机模式新建实例并设 `processLocally=true`；两模式都只填输入框、手动发送。
6. 朗读、页面指引、麦克风首次授权流程、`EF-E003` 零改动。

## 2. 修改文件

### 2.1 新增（3）

| 文件 | 内容 |
|---|---|
| `src/shared/speech/localCapability.ts` | `LOCAL_AVAILABILITY_STATES` 五态、`INSTALL_STATES` 六态、`mapLocalAvailability`（`downloading` 并入 `downloadable`）、`mapInstallResult` |
| `src/shared/speech/diagnostics.ts` | `describeSpeechDiagnostics`、`formatRelativeTime`、权限/错误/本机/安装/onstart 中文标签 |
| `src/sidepanel/speech/localCapability.ts` | `readLocalRecognitionApi`、`createLocalCapabilityProbe`（1.5s 超时）、`createLocalInstaller`（唯一静态 `available/install` 访问点） |

### 2.2 修改（15）

| 文件 | 改动 |
|---|---|
| `src/shared/speech/types.ts` | `RawSpeechErrorKind`、`RecognitionMode`、`SpeechStartOptions.processLocally?`、`RecognitionEvent.browser-start`、`error.raw?`、`RecognitionLike.processLocally?`、`VoiceInputIssue.permission-conflict` |
| `src/shared/speech/constants.ts` | 本机能力超时 1500ms、缓存 300000ms、`zh-CN` 可用/安装参数 |
| `src/shared/speech/copy.ts` | `SPEECH_NO_SPEECH_TEXT`、通用失败、network 双模板、permission-conflict、模式/本机/诊断/朗读类别文案、`speechIssueText` |
| `src/shared/speech/policy.ts` | `mapRawErrorKind`、`rawKindOfSpeechError`、`resolveRecognitionFailure`（权限优先） |
| `src/shared/speech/voiceMachine.ts` | 10 个新状态字段、5 类事件、7 个视图字段、诊断视图、`browser-start`、单次失败语义 |
| `src/sidepanel/speech/recognition.ts` | `instance.onstart → browser-start`；错误携带 `raw`；仅本机模式写 `processLocally=true` |
| `src/sidepanel/speech/voiceController.ts` | 单次结算、`ensureLocalCapability`/`recheckLocalCapability`/`requestLocalInstall`/`setRecognitionMode`、`getDiagnostics` |
| `src/sidepanel/hooks/useVoiceInput.ts` | 注入本机能力/安装适配器；暴露 4 个新方法 |
| `src/sidepanel/components/chat/VoiceInputControl.tsx` | 识别方式单选、本机提示、安装按钮 |
| `src/sidepanel/components/chat/ChatComposer.tsx` | 透传 `onSelectMode`/`onInstallLocal` |
| `src/sidepanel/components/chat/DiagnosticsPanel.tsx` | 受控折叠；语音/页面/朗读/运行记录四分区；“朗读不可用类别” |
| `src/sidepanel/App.tsx` | 传诊断视图与两个能力回调；朗读类别中文值 |
| `src/sidepanel/styles/sidepanel.css` | 模式/安装/本机提示/语音诊断/分区标题样式 |
| `scripts/selftest.mjs` | 导出新模块；新增 AT-81—AT-96；AT-55 no-speech 断言按 R-269 显式改写 |
| `dist/` | 重新构建（`sidepanel.js 286138 bytes`） |

### 2.3 未修改

`src/shared/speech/permission.ts`、`microphone.ts`、`micPage.ts`、`micMessages.ts`、`src/mic-permission/**`、`public/mic-permission.html`、`synthesis.ts`、`speechController.ts`、`speakMachine.ts`、`StepCardSpeech.tsx`、`shared/messages.ts`、`background/**`、`shared/errors.ts`、`useConversation.ts`、`conversationReducer.ts`、`manifest.json`、`build.mjs`、`verify-manifest.mjs`、`package.json`、`tsconfig.json`。

## 3. 关键行为

- **诊断**：只保留“最近一次”；字段为权限五态、原始错误六类、侧栏 listening、浏览器 onstart、本机 API、`zh-CN` 五态、最近检测时间、安装状态、识别方式；不写聊天/运行日志/storage。
- **分区**：诊断展开后顺序“语音输入诊断 → 页面采集诊断 → 朗读状态 → 运行记录”；折叠时 DOM 不渲染诊断值。
- **文案**：`granted+network` 固定含“麦克风已授权”“浏览器语音服务连接失败”“可以打字”“本机语音识别”；`no-speech` 单句；`unknown` 走通用失败；`service-limited`/`audio-capture`/`device-unavailable` 保持独立。
- **单次结算**：一次识别只结算一次；`error` 后 `ended`/超时不再追加提示。
- **本机能力**：仅 API 存在才探测；`available` 出现本机项；`downloadable` 出现安装按钮；安装仅在点击后一次，成功复检，失败回退；不自动重试/不自动切模式。
- **双模式**：默认服务；本机新建实例 `processLocally=true`；服务不写该字段；`listening` 中切换先取消；两模式只填 `pendingText`。
- **零改动**：朗读、页面诊断、`EF-E003`、麦克风首次授权。

## 4. 自动测试

- `npm run selftest`：**87 项通过**（`1..87 / pass 87 / fail 0`）。
- 新增 AT-81—AT-96（16 项），覆盖诊断字段/分区、granted+network、no-speech、六类文案、本机缺失/available/downloadable/unavailable/抛错、安装仅点击、`processLocally=true`、只填框、失败可打字、不自动重试、朗读回归。
- 既有 71 项保留；仅 AT-55 的 no-speech 断言按 R-269 显式改写为 `SPEECH_NO_SPEECH_TEXT`，未放宽其他断言。
- 全部使用假识别/假权限/假本机能力/假安装，未调用真实麦克风、真实 `available/install` 或网络。

## 5. 门禁

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run typecheck` | 0 | 0 error |
| `npm run build` | 0 | 产物齐全；`verify` 例外仍 2 条 |
| `npm run selftest` | 0 | 87 项通过 |
| `npm run verify` | 0 | 权限四项、授权页产物、audio-only、停轨、例外清单 |

日志：`codearts_proof/iteration7-{typecheck,build,selftest,verify}.log`。

## 6. 清洁检索

| 检索 | 结果 |
|---|---|
| 本机静态 `available/install` 访问 | 仅 `src/sidepanel/speech/localCapability.ts`（`iteration7-clean-localapi.log`） |
| `processLocally =` 赋值 | 仅 `src/sidepanel/speech/recognition.ts`（`iteration7-clean-processlocally.log`） |
| 语音目录 `chrome.storage`/`fetch(`/`MediaRecorder` | 0 hits（`iteration7-clean-speech.log`） |
| `manifest` 权限 | 四项不变（`iteration7-clean-manifest.log`） |

说明：`SpeechRecognition` 构造器检测仍存在于既有 `policy.ts`/`recognition.ts`；本机 `available/install` 静态方法的读取只在 `localCapability.ts`，且用括号访问，未新增任何外部接口或存储键。

## 7. 真实设备验收

### 7.1 已执行

（空）

### 7.2 用户只做一次检查（人工验收待用户执行 / 真实设备中文本机识别未验证）

1. 重新加载扩展 → 重新打开侧栏。
2. 展开“运行诊断”，记录：麦克风权限（granted/prompt/denied/unknown）、最近错误类别（中文）、侧栏正在听、浏览器 onstart、本机识别接口、`zh-CN` 本机状态。
3. 若 `zh-CN` 状态为 **available**：选择“使用本机识别”，说一句“我想了解办理条件”，确认文字只进输入框、未自动发送；再手动发送。
4. 若为 **downloadable**：点击“下载中文语音资源”，等待并点“重新检测本机识别”；只有变为 available 再选本机模式；失败则直接打字。
5. 若为 **unavailable / 未调用 / 无法判断**：停止继续修改麦克风权限，保留服务识别与打字；不要反复重授。
6. 再点“朗读这一步”确认朗读仍可用、可停止。

失败记录口径：只记录原始错误类别 + 扩展来源权限状态 + Chrome 版本与平台；不记录音频、识别原文、设备名、网页 URL、完整查询串。

## 8. 已知限制

1. 真实设备是否返回 `available` 取决于 Chrome/OS 与中文语言资源；本环境无法确认。
2. 部分实现可能不触发 `onstart`，诊断会显示“否（未开始）”，不代表权限失败。
3. `downloadable` 的安装可能依赖浏览器自身下载与网络；失败只回退文字输入。
4. 能力缓存 5 分钟，仅内存；重开侧栏重新探测；识别方式不持久化。
5. `network` 失败后不自动重试、不自动切本机；需用户手动操作。
6. 本机识别失败不自动回退服务模式，避免“看似成功”的静默替换。