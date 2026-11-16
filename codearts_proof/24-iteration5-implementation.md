# 24 — 第五轮实现：当前步骤只说一遍、按键说话与按需朗读

> 依据：`.codeartsdoer/specs/easyflow_page_guide/iteration5-spec.md`、`iteration5-design.md`、`iteration5-tasks.md`。
>
> 自测与构建门禁通过；**真实 Chrome 的语音识别、朗读、麦克风授权与 400px/200% 视觉检查：人工验收待用户执行**，相关浏览器行为“未在本环境验证”。本轮未调用真实麦克风、未播放音频、未创建真实预约。

## 1. 本轮需求

1. 活动步骤卡保留一句明确动作与“指给我看”；隐藏/合并上方重复引导句；警告、页面依据、完成状态不隐藏；关怀模式约 400px 时动作句和主按钮首屏可见；日期时刻仍来自最新快照。
2. 输入框旁“语音输入”按钮；点击后仅启动一次中文识别；显示“正在听/已识别/未识别/无权限/不支持”；结果只写可编辑输入框，不自动发送/点击/提交；支持取消、切任务/卸载停止；长度受 `MAX_TURN_CHARS`；不可用时保留文字输入。
3. 当前卡“朗读这一步”、直接回答“朗读回答”与“停止朗读”；只读动作句/回答正文；中文优先、语速 1.0；离开步骤/切任务/关侧栏停止；不读依据、原始标签、诊断、个人信息。

## 2. 修改文件

### 2.1 新增（15）

| 文件 | 内容 |
|---|---|
| `src/shared/speech/types.ts` | 识别/合成事件、适配器、7 类错误、状态类型；浏览器对象最小结构化类型 |
| `src/shared/speech/constants.ts` | `SPEECH_LANG`、`SPEECH_RATE=1.0`、超时 8000ms、重复窗口 1200ms |
| `src/shared/speech/copy.ts` | 五类识别状态、按钮、告知、朗读标签/说明、禁用词表（Unicode 转义） |
| `src/shared/speech/policy.ts` | `mergeTranscript`、`checkSpeakText`、`pickChineseVoice`、能力探测、错误映射 |
| `src/shared/speech/voiceMachine.ts` | 8 phase 纯状态机与 `describeVoiceInput` |
| `src/shared/speech/speakMachine.ts` | 朗读纯状态机、同一句窗口、敏感跳过 |
| `src/sidepanel/speech/recognition.ts` | 单会话识别适配器；同步 `started`、幂等取消、迟到丢弃 |
| `src/sidepanel/speech/synthesis.ts` | 合成适配器；中文选音、先停再起、代次过滤 |
| `src/sidepanel/speech/voiceController.ts` | 可注入 `VoiceController` |
| `src/sidepanel/speech/speechController.ts` | 可注入 `SpeechController` |
| `src/sidepanel/hooks/useVoiceInput.ts` | 订阅 controller、卸载停止 |
| `src/sidepanel/hooks/useSpeechSynthesis.ts` | `SpeechUi`、卸载停止 |
| `src/sidepanel/components/chat/VoiceInputControl.tsx` | 语音按钮/状态/首次告知 |
| `src/sidepanel/components/chat/StepCardSpeech.tsx` | “朗读这一步/朗读回答/停止朗读”与不可用说明 |
| `src/sidepanel/components/chat/messageText.ts` | `stripDuplicateStepText`、`STEP_LEAD_PATTERNS` |

### 2.2 修改

| 文件 | 改动 |
|---|---|
| `src/sidepanel/dialogue/rule/RuleEngine.ts` | 删除 `step.goal` 追加；6 个 next-step 调用点改为状态说明；`NEXT_STEP_LEAD`/`NEXT_STEP_CREATED_LEAD` |
| `src/sidepanel/hooks/useConversation.ts` | `nextStepMessage` 删除 goal 追加；`replanNoticeText` 删除“现在这一步”句式；推进文案去掉“下一步：” |
| `src/sidepanel/components/chat/stepCardModel.ts` | `stepCardStateTag`、`showSpeak`；`stepCardLabel` 保留兼容值 |
| `src/sidepanel/components/chat/StepCard.tsx` | “当前步骤”标签、主按钮+朗读同行、详情/更多操作保留 |
| `src/sidepanel/components/chat/MessageList.tsx` | 当前卡去重、`ef-bubble-card-only`、直接回答朗读、当前卡顶部对齐 |
| `src/sidepanel/components/chat/ChatComposer.tsx` | 语音控件、只写输入框的消费 effect、care 提示压缩 |
| `src/sidepanel/components/chat/AboutPanel.tsx` | 删除“语音暂未开放”，引用统一告知常量；补“不代填/不代提交” |
| `src/sidepanel/components/chat/DiagnosticsPanel.tsx` | 增加“语音不可用类别”一行（仅枚举） |
| `src/sidepanel/App.tsx` | 接入两个语音 hook；切 tab/计划结束/成功态/步骤变化/新消息停止矩阵；切任务先停语音 |
| `src/sidepanel/styles/sidepanel.css` | `.ef-speech-*`、`.ef-speak-*`、`.ef-step-actions-line`、`.ef-step-state-tag`、`.ef-bubble-card-only`；复用关怀 token |
| `scripts/selftest.mjs` | 新增导出；AT-32 两处正文口径调整；AT-50 告知断言改写；AT-51—AT-63 |
| `scripts/verify-manifest.mjs` | **必要门禁调整**：从运行时禁用项移除浏览器内置 `SpeechRecognition`；保留 `getUserMedia`/`MediaRecorder`/网络调用等禁令 |
| `dist/` | 重新构建 |

### 2.3 未修改

`src/content/**`（采集/高亮/观察）、`stepPlanner.ts`、`completion.ts`、`bookingSuccess.ts`、`conversationReducer.ts`、`types.ts`、`constants.ts`、`messages.ts`、`validator.ts`、`manifest.json`、`build.mjs`。

## 3. 关键行为

- 生成层不再追加 `step.goal`；渲染层仅对当前 next-step 卡剥离动作复述句；变化说明、警告、依据、完成状态保留。
- 识别只在点击后启动；结果只写输入框，不发送、不聚焦、不点击网页；超长不截断不写入。
- 首次点击显示告知：“由浏览器提供，可能使用在线服务；不保存音频/识别原文”；不称“离线”。
- 朗读只接受 `copy.shortText` 或 `message.text`；`detectSensitive` 命中整句跳过；同一句 1.2 秒内不重复；离开步骤/切任务/新消息/卸载停止。
- 新增按钮消费既有 `--ef-tap-min`（关怀 44px）与 `--ef-primary-min-h`（48px）。

## 4. 门禁结果

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run typecheck` | 0 | 0 error |
| `npm run selftest` | 0 | **54 项通过**（原 41 + AT-51—AT-63） |
| `npm run build` | 0 | `dist/` 产物齐全（sidepanel.js 262780 bytes） |
| `npm run verify` | 0 | 权限仍 `activeTab/scripting/sidePanel/storage` |

日志：

- `codearts_proof/iteration5-typecheck.log`
- `codearts_proof/iteration5-selftest.log`
- `codearts_proof/iteration5-build.log`
- `codearts_proof/iteration5-verify.log`

### 4.1 测试口径调整（显式记录）

- **AT-32**：两处 `dateResponse/timeResponse.text.includes("选择可用日期/时间")` 改为 `includes("下一步")`。原因：第五轮 R-101 禁止正文复述 `step.goal`；仍保留 `responseType==="next-step"`、目标控件与 `validateResponse` 断言。
- **AT-50**：`AboutPanel` 的“语音暂未开放”断言替换为 `SPEECH_DISCLOSURE_TEXT` 引用 + 禁止旧口径 + “可能使用/不保存音频”；其余断言逐条保留。
- **AT-44/AT-37/AT-38/AT-49**：未改断言，全部通过。
- 既有 AT-31/33/36/39—45/46—49：全部通过。

## 5. 清洁检索

| 检索 | 结果 |
|---|---|
| `src/**/*.{ts,tsx}` 含 `02:00/02:15/03:00` | 0 hits（`iteration5-clean-clock.log`） |
| `src/**` 含 `getUserMedia/MediaRecorder` | 0 hits（`iteration5-clean-speech-global.log`） |
| `src/shared/speech`、`src/sidepanel/speech` 含 `fetch(/XMLHttpRequest/chrome.storage/localStorage` | 0 hits（`iteration5-clean-speech-dir.log`） |
| `src/**` 含“离线” | 0 hits（`iteration5-clean-offline-word.log`） |
| `src/**` 真实站点域名 | 0 hits（`iteration5-clean-domain.log`） |
| `manifest.json` 权限 | 四项不变（`iteration5-clean-manifest.log`） |

说明：`policy.ts` 的能力探测与 `recognition.ts`/`synthesis.ts` 的浏览器对象访问是唯一允许出现语音全局对象的位置；`src/sidepanel/components/**` 不含这些全局对象（AT-54 断言）。

## 6. 真实 Chrome 人工验收（待用户执行）

以下项目**未在本环境验证**，不得写成“已通过”：

1. 重新加载扩展（`chrome://extensions` → 重新加载 → 刷新页面 → 重开侧栏）。
2. 打开有步骤的页面，确认首屏只出现一次当前动作句与“指给我看”；关怀模式约 400px 宽时动作句与主按钮在首屏。
3. 点击“语音输入”，说一句中文：应看到“正在听”，随后文字出现在输入框；**确认未自动发送**；手动点“发送”后消息才发出。
4. 识别中点击“取消识别”：状态变为“已取消”，不再写入迟到结果。
5. 拒绝麦克风：状态显示“无权限”，输入框仍可打字并发送。
6. 点击“朗读这一步”或“朗读回答”：应听到中文朗读；再次点击变为“停止朗读”并停止；切换任务或关闭侧栏应停止。
7. 在浏览器站点设置中重新允许麦克风后再次点击，应可重试（不永久锁定）。
8. 200% 缩放：语音按钮、朗读按钮、输入框、发送按钮可达，无横向裁切。

浏览器语音可能使用浏览器厂商的在线识别服务；本扩展不保存音频、不保存识别中间结果、不新增权限、不调用外部语音 API。上述行为需在真实 Chrome 中确认。

## 7. 风险

| 风险 | 说明 |
|---|---|
| 浏览器不支持/未授权 | 已提供“不支持/无权限”状态与文字输入降级；未在真实设备验证 |
| 识别服务在线 | 首次点击告知；不宣称离线 |
| 朗读音色/语速 | 中文优先、语速 1.0；实际音色因系统而异 |
| 页面步骤文案去重过度 | 八变体 + 信号词保护；真实页面表现待人工确认 |
| 门禁脚本调整 | 仅移除对浏览器内置 `SpeechRecognition` 的禁用；`getUserMedia`/录音/网络仍禁止 |