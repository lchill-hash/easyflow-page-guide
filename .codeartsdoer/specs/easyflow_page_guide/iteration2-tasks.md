# EasyFlow 对话式陪办迭代（第二轮）— 编码任务清单

**输入依据**

- `.codeartsdoer/specs/easyflow_page_guide/iteration2-spec.md`（1148 行，需求规格）
- `.codeartsdoer/specs/easyflow_page_guide/iteration2-design.md`（1716 行，增量实现方案）
- `.codeartsdoer/specs/easyflow_page_guide/spec.md`、`design.md`、`tasks.md`（第一轮基线）
- `codearts_proof/08-iteration2-spec-phase.md`、`codearts_proof/09-iteration2-design-phase.md`
- 现有实现：`src/background/**`、`src/content/**`、`src/sidepanel/**`、`src/shared/**`、`scripts/build.mjs`、`scripts/selftest.mjs`、`scripts/verify-manifest.mjs`、`public/manifest.json`、`README.md`、`package.json`

**交付形态**：在现有 Manifest V3 + TypeScript + React 工程上增量改造，`dist/` 仍可直接"加载已解压的扩展程序"。

---

## 0. 使用说明与全局约束

### 基线事实（本阶段只读核查结果，2026-11-13）

| 核查项 | 实测结果 | 对任务的要求 |
|---|---|---|
| 源文件规模 | `src/` 29 个 `.ts/.tsx` 共 3032 行；`scripts/` 4 个 `.mjs` 共 470 行 | 增量改造，不重建工程；`iteration2-design.md` 中"约 1890 行"为旧口径，以本次实测为准 |
| 构建链 | `npm run build` = `tsc --noEmit` → `node scripts/build.mjs`（三入口）→ `node scripts/verify-manifest.mjs` | 保持三入口与命令名不变，任务 1.6 只扩展校验内容 |
| 清单权限 | `["activeTab","scripting","sidePanel","storage"]`，无 `host_permissions`、无静态 `content_scripts` | 全程不得新增权限（见"全局硬约束"第 1 条） |
| 远程请求 | `src/**` 检索 `fetch(`、`XMLHttpRequest`、`WebSocket`、`sendBeacon`、`getUserMedia`、`MediaRecorder`、`SpeechRecognition`、`apiKey`、`API_KEY`、`Authorization`：0 命中 | 本轮模型适配层不得引入任何请求实现 |
| `.value` 读取 | `src/content` 仅 `collect.ts:147` 的 `input[type=button/submit/reset]` 文本兜底 | 保留该例外并逐处说明；不得新增任何 value 读取 |
| 页面写操作 | `src` 中 `click(`/`submit(`/`requestSubmit`/`dispatchEvent` 0 命中；`focus(` 仅 `GoalForm.tsx` 的侧边栏输入框 | 页面侧仍只允许 overlay 宿主一个写操作 |
| 浏览器存储 | `localStorage`/`sessionStorage`/`document.cookie`/`navigator.clipboard`/`FileReader` 0 命中 | 只允许 `chrome.storage.local` 的 `easyflow.goal` |
| 产物字符串 | `dangerouslySetInnerHTML`/`innerHTML` 0 命中；无"大模型/智能体/已接入模型"表述 | 保持纯文本渲染与"规则演示"文案 |
| 现有能力 | 五类只读采集、`WeakMap` 稳定 `elementId`、`domPath + textHash` 降级定位、Range 行框高亮（`HIGHLIGHT_TTL_MS=4000`，脉冲 3 次）、幂等注入 + PING、单飞锁、`EF-E001`—`EF-E013`、折叠诊断 | 任务中一律"复用"，不得重写 |

### 复用 / 扩展 / 替换 / 不修改（禁止重建）

| 判定 | 对象 | 任务落点 |
|---|---|---|
| **复用（不改契约）** | `src/content/collect.ts` 五类选择器与可见性过滤、`registry.ts` 稳定 ID、`highlight.ts` 四级定位与 Range 行框、`injector.ts` 幂等注入 + PING、`router.ts` 单飞锁与超时、`errors.ts` 错误码与文案、`build.mjs` 三入口、`manifest.json` 四项权限 | 2.1、2.6、7.3、1.6、12.3 |
| **扩展（只增可选字段/成员）** | `PageSnapshot.segments/controls`、`ElementItem.titleCandidate`、`CollectDiagnostics.segmentsMs/controlCount/iframeCount`、`EF_COLLECT.reason:"recheck"`、`EF_HIGHLIGHT.refs`、`EF_CONTENT_WATCH/UNWATCH`、`EF_WATCH_TICK`、诊断字段 | 1.1、1.3、2.1、2.5、7.1、8.6 |
| **替换（交互模型与响应逻辑）** | 卡片墙 → 聊天界面；片段列表 → 1—3 句回答；`SessionStatus` → 会话/页面/步骤三态；`page-dirty` 清空 → 保留会话 + 引用失效 + 待复核 | 3.1、8.1—8.6、9.1—9.5 |
| **部分复用** | `ruleMatcher` 打分/同义词/去重逻辑下沉为段级检索器；`GuidanceCard` 类型保留但不再上屏 | 4.4 |
| **不修改** | 构建入口与命令、注入链、采集链、定位高亮链、权限矩阵、错误码语义与文案 | 全部任务 |

### 全局硬约束（每个任务都必须遵守，验收时逐条复核）

1. **权限**：任何阶段不得新增 `host_permissions`、`<all_urls>`、静态 `content_scripts`、`tabs`、麦克风/`getUserMedia`、模型端点主机权限；清单恒为四项。
2. **只读**：不得读取或传输 `input.value`、`textarea.value`、下拉选中值、可编辑区域内容；不得读取姓名、证件号、手机号、银行卡号、验证码、密码。
3. **不代操作**：不得 `click`/`focus`/`select`/`dispatchEvent`/`form.submit`/`requestSubmit`，不得代填、代选、代勾选、代提交、代支付、代删除、不处理验证码。
4. **只写一个节点**：页面唯一写入是临时高亮宿主，`HIGHLIGHT_TTL_MS=4000` 后移除，结束后节点数/属性/文本恢复。
5. **不跨域**：不自动导航、不新开标签页、不自动打开/下载附件、不自动点击页面链接；跨域只给站点名与文字指引（K2-10）。
6. **不持久化页面内容**：页面正文、语义段、引用、聊天、步骤只存侧边栏内存；`storage.local` 只有 `easyflow.goal`（≤200 字）。
7. **规则演示口径**：本轮不接在线模型、不发任何模型请求、不硬编码密钥；界面固定"本地规则演示，未接入在线模型"。
8. **语音口径**：本轮不实现真实识别、不申请麦克风、不渲染可用麦克风；`voiceState` 恒为 `disabled`。
9. **站点无关**：源码、词典、测试样例中不得出现验收站点的政策正文、网点名称、地址、电话或专属 DOM 选择器。
10. **常量命名**：颜色、时长、上限、节流参数一律用命名常量（任务 1.2），禁止散落魔法数。
11. **如实汇报**：未执行的构建、自测、人工验收必须单列"未执行事项"，不得写"理论上通过"。

### 执行顺序总览

| 顺序 | 任务组 | 依赖 | 对应设计迁移步 | 关键产物 |
|---|---|---|---|---|
| 1 | 契约扩展与隐私纯函数 | 无 | M1 | `src/shared/**`、`scripts/verify-manifest.mjs` |
| 2 | 页面读取扩展（语义段/控件/变更计数/批量高亮） | 1 | M2 | `src/content/{semantic,controls,observe}.ts` + 三个扩展点 |
| 3 | 对话数据模型与会话状态 | 1 | M5 前置 | `src/sidepanel/state/conversationReducer.ts` |
| 4 | 对话引擎、规则引擎与校验 | 1、3（类型） | M3 | `src/sidepanel/dialogue/**` |
| 5 | 直接回答/上下文追问/限制说明闭环 | 4 | M3 收口 | 引擎行为验收 |
| 6 | 多步陪办 | 2（控件）、4 | M4 | `src/sidepanel/guide/**` |
| 7 | DOM 观测、复审与并发作废 | 2、6 | M4 收口 | watch → recheck 链路 |
| 8 | 聊天界面 | 3、4、6 | M6 | `src/sidepanel/components/chat/**` |
| 9 | 会话编排 | 3、4、6、8 | M5 | `src/sidepanel/hooks/useConversation.ts` |
| 10 | 自动化测试与门禁 | 1—9 | M7 | `scripts/selftest.mjs`、AT-01—AT-26 |
| 11 | 三站点人工验收矩阵 | 10 | — | E2E/BJ/CCB 记录 |
| 12 | 文档、留痕与收口 | 10、11 | M7 收口 | `README.md`、`codearts_proof/11-*` |

**依赖图**

```text
1 ──> 2 ──> 6 ──> 7
│     │     │
│     └─────┼──> 4 ──> 5
│           │     │
├──> 3 ─────┴─────┼──> 8 ──> 9
│                 │
└─────────────────┴──> 10 ──> 11 ──> 12
```

**硬性顺序**：4 必须先于 6、8 的接线（UI 不得依赖未校验的引擎输出）；2 必须先于 4.4 的段级检索联调；6 必须先于 9.3 的内联动作接线；10 必须先于 11（先有可构建产物与自测结果，再谈人工验收）。

### 阶段门禁（每批任务结束必须真实执行，输出写入留痕）

| 门禁 | 命令 | 通过标准 |
|---|---|---|
| 类型 | `npm run typecheck` | 退出码 0，0 error，无 `any` 绕过 |
| 自测 | `npm run selftest` | 退出码 0，AT 用例名与通过数可见 |
| 构建 | `npm run build` | 退出码 0，`dist/` 7 类产物 + 4 图标齐全 |
| 清单 | `npm run verify` | 退出码 0，权限仍四项，无禁用字段 |
| 检索 | "全局硬约束"第 1—3、6—9 条对应 Grep | 0 命中或逐处说明 |

> 本文件只是任务计划。上表命令在本阶段**均未执行**，执行结果由后续实现阶段补记。

---

## 1. 契约扩展与隐私纯函数（M1）

**依赖**：无。**建议顺序**：最先执行；为任务组 2—9 提供唯一类型、消息与常量来源。

### 1.1 `src/shared/types.ts` 追加第二轮类型

- [ ] 新增语义段与引用类型：`SemanticSegment`（`segmentId`/`text`/`titleRef`/`bodyRefs[]`/`truncated`/`hasBody`/`region`/`orderRange`/`scopeHints`/`scopeConflict`）、`CitationAnchor`（`citationId`/`segmentId`/`role:"title"|"body"`/`text`/`start`/`end`/`status:"valid"|"stale"`）
- [ ] 新增控件类型：`PageControl`（`controlId`/`ref: ElementRef`/`label`/`controlType`/`visibility`/`riskFlags[]`/`region`/`ambiguous`）、`ControlType`、`RiskFlag`
- [ ] 新增对话类型：`ConversationSession`、`SessionPhase`、`PageState`、`DialogueMode`、`VoiceState`、`DialogueMessage` 联合（`UserMessage`/`AssistantMessage`/`SystemNotice`）、`ResponseType`、`NoticeKind`
- [ ] 新增陪办类型：`TargetControl`、`CompletionCondition`、`CompletionKind`、`GuidePlan`、`PlanStatus`、`GuideStep`、`StepState`、`PlanPatch`
- [ ] 新增引擎类型：`DialogueRequest`、`DialogueResponse`、`EngineDiagnostics`、`LimitationReason`、`IntentKind`、`ValidationResult` 及拒绝原因码
- [ ] 扩展既有类型且不改语义：`ElementItem.titleCandidate?: boolean`；`PageSnapshot.segments?`/`controls?`；`CollectDiagnostics.segmentsMs?`/`controlCount?`/`iframeCount?`；`LocateStatus` 增加 `"partial"`
- [ ] 保持 `PageSnapshot.schemaVersion: 1`、`ElementRef` 三元组与 `ELEMENT_ID_PATTERN` 不变；全部新增字段可选、可结构化克隆（无 `Map`/`WeakMap`/函数/DOM）
- [ ] 不使用 `any`/`as any`/`@ts-ignore`

**验证**：`npm run typecheck` 退出码 0；`Grep ": any|as any|@ts-ignore" src/shared/types.ts` 0 命中；人工核对 `ElementRef` 未新增字段。

### 1.2 `src/shared/constants.ts` 新增命名常量

- [ ] 对话上限：`MAX_TURN_CHARS=500`、`MAX_CONTEXT_TURNS=6`、`MAX_MESSAGES=200`、`MAX_ANSWER_SENTENCES=3`、`MAX_ANSWER_CHARS=180`、`MAX_CLARIFY_OPTIONS=3`
- [ ] 语义段上限：`MAX_SEGMENT_CHARS=500`、`MAX_SEGMENTS=600`、`MAX_SEGMENT_BODY_REFS=8`、`MAX_CITATION_CHARS=240`
- [ ] 陪办上限：`MAX_PLAN_STEPS=12`、`MAX_AUTO_RECHECK_PER_STEP=3`、`WATCH_DEBOUNCE_MS=600`、`RECHECK_MIN_INTERVAL_MS=1200`、`MAX_EXPECTED_TEXT_CHARS=40`、`MAX_CONTROL_LABEL_CHARS=80`
- [ ] 界面与高亮：`ENGINE_SLOW_HINT_MS=500`、`MAX_HIGHLIGHT_REFS=3`；沿用 `HIGHLIGHT_TTL_MS=4000`（不新增第二个高亮时长）
- [ ] 出站与模式：`MAX_OUTBOUND_SEGMENTS=24`、`MAX_OUTBOUND_CHARS=6000`、`MAX_OUTBOUND_CONTROLS=40`、`MODEL_MODE_DEFAULT="rule-demo"`
- [ ] 不改既有常量数值与名称；不在常量文件写入站点相关字符串

**验证**：`Grep "MAX_ANSWER_CHARS|MAX_AUTO_RECHECK_PER_STEP|RECHECK_MIN_INTERVAL_MS"` 可查到；`npm run typecheck` 0 error。

### 1.3 `src/shared/messages.ts` 协议扩展

- [ ] `CollectRequest.reason` 联合类型增加 `"recheck"`；`router.ts` 对未知 reason 回退 `"refresh"` 行为
- [ ] `HighlightRequest`/`ContentHighlightRequest` 增加可选 `refs?: ElementRef[]`（1—3），`ref` 字段保留且语义不变
- [ ] 新增 `MSG.CONTENT_WATCH="EF_CONTENT_WATCH"`、`MSG.CONTENT_UNWATCH="EF_CONTENT_UNWATCH"`、`MSG.WATCH_TICK="EF_WATCH_TICK"`
- [ ] 新增请求/响应类型：`ContentWatchRequest`、`ContentUnwatchRequest`（响应 `{ stopped: true; changeCount; lastChangeAt; watchedMs }`）、`WatchTickNotification`（仅 `tabId`/`changeCount`/`lastChangeAt`）
- [ ] 全部沿用 `v:1` + `requestId` + `EfResponse<T>` 包装；侧边栏对未知消息类型静默忽略
- [ ] 不新增 `text`/`html`/`value` 等页面内容字段

**验证**：`npm run typecheck` 0 error；`Grep "changeCount" src/shared/messages.ts` 结果中不含正文/文本字段；人工核对 `MSG` 常量未改名。

### 1.4 `src/shared/privacy/detect.ts`

- [ ] 实现 `detectSensitive(text): SensitiveHit[]`，`SensitiveHit` 只含 `{ kind, index, length }`，**不保留原文**
- [ ] 覆盖身份证 18 位（含 X）、手机号 `1[3-9]\d{9}`、银行卡 16—19 位、验证码 4—6 位数字、邮箱、密码提示词
- [ ] `SENSITIVE_PATTERNS` 独立导出，只用于检测与提醒，不参与回答生成
- [ ] 纯函数、无副作用、不访问 DOM/存储/网络

**验证**：任务 10.5 的 AT-19/AT-20 用例覆盖；`Grep "localStorage|chrome\." src/shared/privacy/detect.ts` 0 命中。

### 1.5 `src/shared/privacy/redact.ts`

- [ ] `redactUrl(href)` → `${protocol}//${hostname}${pathname}`，去除 `search`/`hash`；非法 URL 返回空串
- [ ] `redactText(text)` 把手机号/证件号/银行卡号/邮箱替换为类型占位（"手机号"/"证件号"等），不保留原文
- [ ] `sanitizeOutbound(request)` 按 allowlist 生成出站载荷：`utterance`、`contextDigest`、`page`（脱敏）、`segments`（≤24 段、≤6000 字符）、`controls`（≤40 个标签/类型）；超限截断并标记
- [ ] `assertNoSensitive(payload)` 返回 `pass | blocked`：命中 HTML 标签串、`value`、敏感样式或查询串即 `blocked`
- [ ] `PROXY_CONTRACT` 常量写明端点形态（`POST {PROXY_BASE_URL}/v1/dialogue`，仅本机地址）、代理侧环境变量名、8s 超时、≤20 次/分、≤1200 tokens、审计不含正文；**不含密钥与任何真实地址**
- [ ] 出站层失败必须"不出站"，由调用方降级规则模式并记录"隐私过滤拦截"

**验证**：任务 10.5 用例；`Grep "sk-|Authorization|apiKey" src/shared/privacy` 0 命中；`npm run typecheck` 0 error。

### 1.6 `scripts/verify-manifest.mjs` 门禁扩展

- [ ] 保留现有四项权限、`host_permissions`/`content_scripts`/`web_accessible_resources`/`externally_connectable` 禁用校验与产物存在性校验
- [ ] 新增对 `dist/*.js` 的禁用 API 检索：`fetch(`、`XMLHttpRequest`、`sendBeacon`、`WebSocket`、`getUserMedia`、`MediaRecorder`、`SpeechRecognition`、`apiKey`、`API_KEY`、`Authorization`，命中即失败
- [ ] 新增对 `public/manifest.json` 与 `src/**/*.{ts,tsx}` 的检索：`host_permissions`、`<all_urls>`、静态 `content_scripts`、`dangerouslySetInnerHTML`、`innerHTML`
- [ ] 新增对 `src/**` 的验收站点内容检索占位（域名/网点名/专属选择器清单由实现阶段填写，测试样例保持合成文本）
- [ ] 失败时打印具体文件与命中行，非零退出；通过时打印 `OK` 行

**验证**（实现阶段执行）：`npm run build` 后 `npm run verify` 退出码 0；在临时副本中插入 `fetch(` 或 `host_permissions` 必须失败，恢复后通过（不留临时改动）。

---

## 2. 页面读取扩展：语义段、控件标注、变更计数、批量高亮（M2）

**依赖**：1.1、1.2、1.3。**建议顺序**：2.1→2.2→2.3→2.4→2.5→2.6（2.2/2.3 可并行）。

### 2.1 `src/content/collect.ts` 输出扩展（不重写采集）

- [ ] 保留现有 `TYPE_SELECTORS` 五类选择器、`isElementVisible` 三重过滤、`labelTextOf` 标签链路、`applyBudget`、`compareDocumentOrder` 全部逻辑
- [ ] 为每条 `ElementItem` 写入 `titleCandidate`：`heading` 恒为 `true`；`paragraph` 归一化长度 ≤30 且以 `：`/`:` 结尾为 `true`；其余省略
- [ ] 采集结束后调用 `buildSemanticSegments(items)` 与 `annotateControls()`，写入 `snapshot.segments`/`snapshot.controls`（可选字段）
- [ ] `CollectDiagnostics` 追加 `segmentsMs`、`controlCount`、`iframeCount`（`iframeCount` 用 `document.querySelectorAll("iframe").length`，**不进入 iframe**）
- [ ] 段数超过 `MAX_SEGMENTS` 时按 `order` 保留前 600 段并置 `snapshot.truncated=true`
- [ ] 仍然不读 `value`（仅保留 `button/submit/reset` 文本兜底）、不写页面、不新增 DOM 查询（语义段与控件标注基于已采集条目）

**验证**：`npm run selftest` 中 AT-03/AT-04 通过；`Grep "\.value\b" src/content` 仍仅 `collect.ts:147` 一处；`npm run build` 后 `dist/content.js` 无 `import`/`export`。

### 2.2 `src/content/semantic.ts`（`buildSemanticSegments` / `buildSegments`）

- [ ] 输入为 `ElementItem[]`（已按 `order` 升序、已过滤隐藏、单条 ≤300 字），输出 `SemanticSegment[]`；**不访问 DOM、不二次遍历**
- [ ] 线性扫描 + 每段最多 `MAX_SEGMENT_BODY_REFS=8` 个正文项；段数 ≤600；复杂度目标 ≤50ms（3000 条）
- [ ] 边界规则：遇下一个标题候选 / `region` 切换 / 容器前缀不共享 / 累计超 500 字 / 列表结束 即停；**不跨段补齐**
- [ ] 共享容器判定只用 `domPath` 公共前缀：`common >= 1` 且 `common >= 标题路径段数 - 1` 视为同一容器，否则视为跨区块
- [ ] 同父列表连续 `li` 合并为同段；`link`/`button`/`inputLabel` 跳过，不作为正文
- [ ] 每条段生成标题锚点（`role:"title"`）与正文锚点（`role:"body"`），`text` 为元素归一化文本，`start`/`end` 相对段文本
- [ ] 标题无正文 → `hasBody=false` 并统计 `orphanTitles`；单条已截断或累计超限 → `truncated=true`
- [ ] 不修改入参 `items`、不生成连接词（段文本仅"标题 + 空格 + 正文"）

**验证**：任务 10.2 的 AT-03/AT-04 用例；同输入两次调用 `segmentId` 与顺序一致。

### 2.3 `src/content/controls.ts`（`annotateControls` / `classifyControlRisk`）

- [ ] 从已采集候选（`button`/`link`/`inputLabel`/`option`/`tab` 角色）生成 `PageControl`，`ref` 直接由 `elementId + domPath + textHash` 投影，**不新增定位体系**
- [ ] `controlType` ∈ `button|link|input-label|option|tab`；`visibility` ∈ `visible|folded|hidden`；`region` 复用现有区域判定
- [ ] `classifyControlRisk(label, type)` 标记 `submit|payment|delete|captcha|password|personal-info`；标签含身份证号/手机号/银行卡号/验证码/密码 → `personal-info`
- [ ] 同名同类型控件 >1 → `ambiguous=true`
- [ ] 标签只取按钮文本/链接文本/`label`/`aria-label`/`placeholder`，长度 ≤80；不读 `value`、不把整页容器当控件
- [ ] 目标控件筛选函数：`riskFlags` 命中任一项即排除

**验证**：任务 10.4 的 AT-13 用例；`Grep "value" src/content/controls.ts` 0 命中。

### 2.4 `src/content/observe.ts`（`watchDomChanges` / `stopWatching`）

- [ ] `MutationObserver` 观察 `document.documentElement` 的 `childList`/`subtree`/`attributes`，只累加 `changeCount` 与 `lastChangeAt`
- [ ] 变化后 `WATCH_DEBOUNCE_MS=600` 防抖发送一次 `{ changeCount, lastChangeAt, watchedMs }`；**不含任何页面文本**
- [ ] `stopWatching()` 断开 observer 并返回最终计数；重复 `start` 幂等，不叠加 observer
- [ ] 禁止 `setInterval` 轮询、禁止监听 `input/change/keydown`、禁止在回调中读节点文本或写 DOM
- [ ] 观测本身不触发采集、不触发重排

**验证**：`Grep "setInterval|innerText|textContent|addEventListener\(\"input\"|addEventListener\('input'" src/content/observe.ts` 0 命中。

### 2.5 `src/content/entry.ts` 消息分支扩展

- [ ] `isContentRequest` 增加 `CONTENT_WATCH`/`CONTENT_UNWATCH` 校验（仅 `v/requestId/type`），沿用现有包装
- [ ] `handle` 增加两个分支：启动/停止观测并返回结果；`UNWATCH` 未启动时返回 `stopped:true` 且计数 0
- [ ] 保留 `CONTENT_COLLECT` 先 `cleanupHighlight()` 再采集的既有行为
- [ ] 不拆分 IIFE 入口；新增模块全部打进同一个 `content.js`
- [ ] `EF_WATCH_TICK` 由 content 发出（`chrome.runtime.sendMessage`），不携带文本

**验证**：`npm run build` 后 `dist/content.js` 存在且无 ESM 语句；人工在扩展加载后确认无消息通道错误（任务 11.1）。

### 2.6 `src/content/highlight.ts` 批量高亮（保持单 ref 兼容）

- [ ] 新增 `highlightRefs(refs: ElementRef[])`：逐条 `locate`；全部 `stale` → `{status:"stale"}`；部分 `stale` → `{status:"partial", located:[...], missing:[...]}`；全部命中 → `highlighted`
- [ ] overlay 从"单目标"改为多目标数组（每目标独立 `Range` 与 box 组），共用同一 `HIGHLIGHT_TTL_MS=4000`、同一 scroll/resize 跟随与同一 `cleanupHighlight()`
- [ ] `highlightRef(ref)` 单 ref 路径**行为与第一轮完全一致**（定位四级降级、`folded`/`stale` 语义、脉冲 3 次、`prefers-reduced-motion` 静态高亮）
- [ ] `input/textarea/select` 仍经 `resolveTextElement` 落到 `label`/`aria-labelledby`，只高亮标签文本；不 `focus`、不读 `value`
- [ ] 批量上限 `MAX_HIGHLIGHT_REFS=3`；超过时忽略多余项并在诊断记录
- [ ] 清理保证：移除宿主与监听器后页面节点数、属性、文本与高亮前一致

**验证**：`npm run selftest` 的 `mergeLineBoxes` 用例仍通过；任务 11.2 的 BJ-06 人工回归单 ref 与双 ref 两条路径。

---

## 3. 对话数据模型与会话状态

**依赖**：1.1、1.2、1.3。**建议顺序**：3.1→3.2，须在任务组 4 接线前完成。

### 3.1 `src/sidepanel/state/conversationReducer.ts`

- [ ] `createConversationState()`：`sessionId`、`startedAt`、`phase`、`pageState`、`tabId`、`snapshotId`、`currentGoal`（≤500）、`voiceState:"disabled"`、`mode:"rule-demo"`、`messages[]`、`plan`、`turn`
- [ ] 阶段迁移严格按 `greeting → reading → ready → composing → reviewing → read-blocked → ended`；`Composing → Composing`（空/超长/纯符号不产生用户消息）
- [ ] 动作覆盖：`session-start`、`send-start`、`send-result`、`system-notice`、`page-changed`、`recheck-start`、`recheck-result`、`highlight-result`、`plan-created`、`plan-superseded`、`goal-set`、`read-failed`、`retry-start`、`ended`
- [ ] `page-changed` **不清空** `messages`：只把引用 `status` 置 `stale`、当前步骤置 `needs-review`、追加一条 `SystemNotice`（`page-changed`）
- [ ] `messages` ≤200：超出丢弃最早 `SystemNotice`，保留用户消息与最后 20 条响应；已落地消息不原地改写
- [ ] 错误码 → 五种对话原因类别映射（无活动页/受限页面/未获授权/读取超时/页面脚本不可用），错误码本身只进诊断
- [ ] 保留 `snapshot`、`tabId`、`error` 字段语义（不沿用 `status` 单一枚举）

**验证**：任务 10.4 的 AT-16 用例（reducer 驱动"步骤中切换页面"）；`npm run typecheck` 0 error。

### 3.2 响应封闭性、系统提示与渲染白名单

- [ ] `AssistantMessage.responseType` 仅允许 `direct-answer|clarify|next-step|cannot-answer`；系统提示用 `SystemNotice(kind, text)`，不参与响应类型统计（K2-01）
- [ ] `validation` ∈ `passed|rejected`；`rejected` 只渲染无法回答文案，不渲染任何事实或步骤
- [ ] 用户可见字段白名单：`text`、引用原文片段、控件可读标签、完成条件的人话描述；禁止 `elementId`/`domPath`/`score`/`hash`/`EF-E0xx`
- [ ] 所有消息字段为可结构化克隆的 JSON 原生类型

**验证**：任务 10.2 的 AT-08；`Grep "elementId" src/sidepanel/components` 0 命中（诊断组件除外）。

---

## 4. 对话引擎、规则引擎与校验（M3）

**依赖**：1.1、1.2、1.3、3.1（类型）。**建议顺序**：4.1→4.2→4.3→4.4→4.5→4.6→4.7→4.8→4.9。4.4 的联调需等任务组 2 完成。

### 4.1 `src/sidepanel/dialogue/DialogueEngine.ts`（本轮核心契约）

- [ ] 定义 `interface DialogueEngine { readonly mode: DialogueMode; respond(request: DialogueRequest): Promise<DialogueResponse> }`
- [ ] `DialogueRequest` 含 `schemaVersion:1`、`turnId`、`utterance`、`context`、`page`、`segments`、`controls`、`capabilities:{modelConfigured,voiceEnabled}`
- [ ] `DialogueResponse` 含 `responseType`、`text`、`citations`、可选 `targetControl`/`completionCondition`/`clarify`/`limitation`/`planPatch`、必填 `diagnostics`
- [ ] 契约注释写明：纯计算、无 Chrome API/DOM/网络/存储；禁止 `Math.random()`/`Date.now()`/`randomUUID()` 参与判定分支
- [ ] 提供 `assertDialogueRequest` 结构校验（字段缺失抛出结构化错误，由调用方映射 `EF-E005` 并降级）
- [ ] 只有 `mode` 与 `capabilities.modelConfigured` 一致时才允许该响应类型

**验证**：`Grep "chrome\.|document\.|window\." src/sidepanel/dialogue/DialogueEngine.ts` 0 命中；`npm run typecheck` 0 error。

### 4.2 `src/sidepanel/match/lexicon.ts` 词表扩展（语言层）

- [ ] 新增 `SAFETY_VERBS`（帮我填/帮我选/帮我勾/帮我提交/帮我支付/帮我删/代填/代选/代提交/输入验证码/告诉验证码/帮我登录）
- [ ] 新增 `TASK_SWITCH`（换一个任务/换个任务/重新开始/不办这个了/另外问/换个事）
- [ ] 新增 `PROCESS_VERBS`（我要办/我想办/第一次办/准备办/怎么申请/如何办理/帮我找/带我去/下一步/继续/先做什么）
- [ ] 新增 `FEEDBACK`（我找不到/没看到/在哪里点/我点错了/点错/不是这个/我已完成/好了/完成了），并区分三种子类
- [ ] 新增 `FACT_WH`（谁/什么/哪些/哪里/在哪/多少/多久/几点/需要带/要不要/是否/能不能/条件/材料/时间/地点/电话）与 `ELLIPSIS`（那/这个呢/然后呢/还要什么/上面说的）
- [ ] 新增 `GoalSlot` 定义（object/condition/material/location/time/contact/amount/action）
- [ ] 复用现有 `SYNONYM_GROUPS`/`STOP_PHRASES`/`REGION_WEIGHTS`/`TITLE_BONUS`，不污染停用词表
- [ ] 词表不含站点政策正文、网点名、地址、电话、DOM 选择器

**验证**：`Grep` 验收站点关键词 0 命中；任务 10.3 的 AT-07。

### 4.3 `src/sidepanel/dialogue/intent/classifier.ts`

- [ ] `classifyIntent(utterance, context, pageSignals)` 按硬顺序：`safety-boundary` > `task-switch` > `process-goal` > `context-feedback` > `page-fact` > `ellipsis-reference` > `fallback-clarify`
- [ ] 同轮多信号取最高优先级，不并列输出；`safety-boundary` 先于一切（含同句事实询问）
- [ ] `task-switch` 先于 `process-goal`；`context-feedback` 先于 `page-fact`
- [ ] `ellipsis-reference` 不直接产出响应，交 `ContextResolver` 解析后回判一次；解析失败 → 澄清
- [ ] 返回 `{ intentKind, priorityHit, matchedSignals, slots }`，`matchedSignals` 只用于诊断
- [ ] 无信号 → `fallback-clarify`，不猜测

**验证**：任务 10.3 的 AT-05/AT-06/AT-07。

### 4.4 `src/sidepanel/dialogue/retrieval/segmentRetriever.ts`

- [ ] 将 `ruleMatcher` 的 n-gram 生成、同义词、区域权重、长度阻尼、去重下沉为纯函数，输入改为 `SemanticSegment[]`
- [ ] 段级打分：标题命中不足以单独成段答案（`orphanTitle`/`hasBody=false` 的段不得作为事实依据）
- [ ] 阈值沿用 `MIN_SCORE=1.0` 与相对阈值 `0.35`；同分按 `order` 升序，保证同输入同顺序
- [ ] 输出候选段 + 命中词 + 分数 + `selectedReason`（只进诊断）
- [ ] 保持 `ruleMatcher.matchGoal` 导出签名不变（第一轮 T-03—T-07 自测继续可用）

**验证**：同一输入调用两次结果完全一致；任务 10.2 的 AT-01/AT-02。

### 4.5 `src/sidepanel/dialogue/answer/composer.ts`

- [ ] `composeAnswer(segments, hits, slots)` 只在选中段正文中取完整句（`。！？；` 与换行切分），**不跨段编句**
- [ ] 优先含命中词句子，其次含槽位名词句子；最多一个连接词（"另外"/"同时"），连接词不承载事实
- [ ] 保留限定词：年份、地区（区/县/街道）、户籍/年龄/对象、时间窗口；原文无则不补
- [ ] 1—3 句且 ≤180 字双约束；超限先删解释性分句，仍超限 → 1 句 + "页面信息较多，我先说最关键的一条"
- [ ] 输出 `text` + 硬事实清单（年龄/数量、时间、地区、机构、材料、电话）+ 引用锚点（标题 + 正文分别保留）
- [ ] 只有标题无正文 → "页面只写了'X'，后面没有具体说明" + 标题定位入口，不构成事实回答
- [ ] 段内冲突条款 → "页面同时出现两种说法" + 两处引用，不裁决

**验证**：任务 10.2 的 AT-01/AT-03；句数用 `MAX_ANSWER_SENTENCES`、字数用 `MAX_ANSWER_CHARS` 断言。

### 4.6 `src/sidepanel/dialogue/validate/validator.ts`（`ResponseValidator`）

- [ ] `validateResponse(response, snapshot, plan)` 校验：响应类型、文本形态、引用存在性、原文精确子串、非整页容器、标题/正文 `role`、硬事实覆盖、适用范围保留、冲突不裁决、长度、引用数量
- [ ] 控件校验：存在、可见、类型允许、非 `submit/payment/delete/captcha/password`；同名歧义 → 澄清
- [ ] 完成条件校验：六类之一，禁止"等待 N 秒"；计划一致性 `planVersion ≥ 当前`；模式一致性
- [ ] 任一失败 → 整条 `rejected` + 原因码（`citation-missing`/`citation-mismatch`/`citation-too-broad`/`citation-role-invalid`/`fact-unsupported`/`scope-dropped`/`conflict-adjudicated`/`answer-too-long`/`citation-count-invalid`/`control-invalid`/`completion-invalid`/`mode-mismatch`）
- [ ] 拒绝响应不携带任何可展示事实或步骤；提示"我暂时不能可靠回答，页面内容可能刚变过" + 一个建议
- [ ] 校验器与引擎解耦，规则实现与未来模型实现共用

**验证**：任务 10.2 的 AT-09、10.6 的 AT-22。

### 4.7 `src/sidepanel/dialogue/rule/RuleEngine.ts`

- [ ] 实现 `DialogueEngine`，`mode="rule-demo"`，`respond` 为同步计算包在 `Promise` 中（满足 1s 首响）
- [ ] 按优先级组装四类响应：直接回答（≥1 引用）/澄清（1 问、≤3 选项）/下一步（1 控件 + 1 完成条件）/无法回答（1 原因类别 + 1 建议）
- [ ] 安全越界、任务切换、过程目标、上下文反馈、页面事实、省略指代、兜底澄清全部接线，不并列输出
- [ ] 页面不可读或 `segments.length === 0` → 只能 `cannot-answer`
- [ ] 诊断：`engineMs`、`retrievedSegments`、`citationCount`、`intentKind`、`priorityHit`、`rejectReason`
- [ ] 不调用 `ModelEngine`、不发网络请求、不读存储

**验证**：任务 10.2/10.3/10.6；`Grep "fetch\(|XMLHttpRequest|chrome\." src/sidepanel/dialogue/rule` 0 命中。

### 4.8 `src/sidepanel/dialogue/context/resolver.ts`（`ContextResolver`）

- [ ] "那需要带什么"继承最近 `page-fact` 轮的 `object` 槽位；缺失取 `currentGoal`；再缺失 → 澄清
- [ ] "这个呢/然后呢"优先继承当前步骤目标；无计划继承最近对象
- [ ] 页面切换后旧引用 `stale` 不得作为依据；只能说明"这是之前页面上的信息，当前页没有" + 建议重新读取
- [ ] 最近 `MAX_CONTEXT_TURNS=6` 轮内才参与继承；窗口外只用 `responseType + 槽位` 摘要，不含正文
- [ ] 无上文"那个东西" → 不猜测，澄清 1 问

**验证**：任务 10.3 的 AT-05/AT-06。

### 4.9 `src/sidepanel/dialogue/model/ModelEngine.ts` + 代理客户端（占位，本轮恒定关闭）

- [ ] `ModelDialogueEngine` 实现同一 `DialogueEngine` 契约，`status` 恒为 `"not-configured"`
- [ ] `ModelProxyClient.respond` 不发任何 `fetch`/`XMLHttpRequest`/`sendBeacon`，直接返回 `{ status:"unavailable", reason:"not-configured" }`
- [ ] 不读环境变量、不持有密钥、不含真实端点地址；`PROXY_CONTRACT` 只作为文档常量引用
- [ ] 未来启用五项条件（代理健康、最小访问通道、用户显式启用、授权与测试记录）写入注释与 README，本轮全部不满足
- [ ] `capabilities.modelConfigured` 恒为 `false`

**验证**：`Grep "fetch\(|XMLHttpRequest|Authorization|sk-|http://" src/sidepanel/dialogue/model` 0 命中（`PROXY_CONTRACT` 的占位说明除外）；任务 10.6 的 AT-21。

---

## 5. 直接回答、上下文追问与限制说明的对话闭环

**依赖**：4.1—4.9、3.1。**建议顺序**：5.1→5.2→5.3，是引擎能力的用户可见行为验收。

### 5.1 直接回答与网页依据

- [ ] 事实问句 → 1—3 句完整回答（不是 3—5 条片段），回答下方一条折叠"网页依据（N 处）"
- [ ] 引用按"标题锚点 + 正文锚点"顺序保留，标题与正文分别可定位
- [ ] 回答中的数字、日期、地区、机构名、材料名必须能在引用文本中逐字找到
- [ ] 回答保留原文时间/地区/户籍/年龄/对象限定；原文没有则回答不补
- [ ] 无依据 → "当前页面没有找到这项信息" + 1 个建议，不出现金额/地址/电话/发放周期
- [ ] 引用失效 → "这条依据已经变了，我重新看一下页面" + 重试，不滚动错误位置

**验证**：任务 10.2 的 AT-01/AT-02/AT-09；人工 BJ-01/BJ-02/BJ-05。

### 5.2 上下文追问

- [ ] 第二轮"那需要带什么"直接回答材料，不反问"你要办什么"
- [ ] 追问引用的仍是当前页当前快照元素，不复用旧 `elementId`
- [ ] 页面切换后追问旧页细节 → 说明当前页没有，不引用旧原文
- [ ] 无上文指代 → 只问一个问题，不给事实

**验证**：任务 10.3 的 AT-05/AT-06；人工 BJ-03、E2E-05。

### 5.3 限制说明（无依据 / 越界 / 跨域 / iframe / 未登录 / 验证码）

- [ ] `cannot-answer` 必须含 1 个原因类别 + 1 个建议；原因 ∈ `no-evidence|read-only-boundary|cross-origin|iframe-or-map|login-or-captcha|read-failed|low-confidence`
- [ ] 代填/代选/代勾选/代提交/支付/删除/验证码/密码/虚构身份 → 先判 `safety-boundary`，不索取个人信息
- [ ] 跨域：只给站点名与文字指引，不渲染可点击链接、不自动导航、不新开标签（K2-10）
- [ ] iframe/地图：主文档无目标且存在 iframe → "这部分在内嵌框架或地图里，我读不到"，不出现"已定位/已完成"
- [ ] 登录/实名/验证码 → 停止推进，说明需本人完成，不索取凭证
- [ ] 无法回答不出现任何具体事实，不用"已完成/已提交"掩盖失败

**验证**：任务 10.3 的 AT-07、10.6 的 AT-24；人工 CCB-06/CCB-07/CCB-09/CCB-10。

---

## 6. 多步陪办（M4）

**依赖**：2.3（控件）、4.1—4.7、3.1。**建议顺序**：6.1→6.2→6.3→6.4→6.5。

### 6.1 `src/sidepanel/guide/stepPlanner.ts` 与步骤模型

- [ ] `createPlan(goal, snapshot)` 用通用模板"找入口 → 选择条件 → 触发搜索 → 读取结果"，**按当前页已有控件裁剪**，不硬套
- [ ] 每步六要素齐全：总目标、步骤目标（只 1 个动作）、脱敏地址、已观察页面状态、目标控件、完成条件；缺目标控件或完成条件的步不生成
- [ ] 起点由当前页决定：页面已出现结果文本则直接从"读取结果"开始
- [ ] 计划 `version=1`、步骤 `1—MAX_PLAN_STEPS`；其余步骤 `pending` 不展示，一次只返回一个 `current`
- [ ] 不生成索取个人信息的步骤；`riskFlags` 命中 `submit/payment/delete/captcha/password` 的控件永不作为目标
- [ ] 无允许控件 → `cannot-plan` → 无法回答（说明当前页没有可执行入口）
- [ ] 模板只含通用词（地区/城市/省/市/区/县、类型/网点类型/业务类型、查询/搜索/查找），不含站点专属名称

**验证**：任务 10.4 的计划与单步断言；人工 CCB-01。

### 6.2 `src/sidepanel/guide/stepPlanner.ts`（`relocate` / `replan`）

- [ ] `relocate` 定位顺序：① `elementId` 精确命中 ② 标签归一化同义 ③ 同类控件 + 同 `region` 最近邻 ④ `missing`
- [ ] 返回 `found | missing | ambiguous | restricted`；同名 >1 → `ambiguous` 转澄清，不擅自选择
- [ ] `replan` 基于**当前页**生成新计划，`version+1`，旧步骤 `superseded`，不重复旧指令
- [ ] 已在其他域名时只给文字返回指引，不改 URL、不导航
- [ ] 复制定位只使用快照 `controls` 与 `ElementRef`，不做 DOM 查询

**验证**：任务 10.4 的 AT-13/AT-14/AT-15；人工 CCB-03/CCB-04。

### 6.3 `src/sidepanel/guide/completion.ts`（`CompletionEvaluator`）

- [ ] `evaluateCompletion(step, snapshot, userConfirmed)`：完成条件精确命中 → `done-verified` + 证据（信号类型 + 元素/文本）
- [ ] 允许六类条件：`text-appears`/`element-appears`/`element-disappears`/`url-changed`/`control-state-changed`/`user-confirmed`
- [ ] 禁止判定依据：时间流逝、滚动、焦点、输入框有内容（**不读 value**）、页面加载完成、仅 hash/查询串变化
- [ ] 无关 DOM 变化 → 保持 `current`，返回 `unconfirmed` + "我还不能确认这一步是否完成" + 两个内联操作
- [ ] `userConfirmed` 且无信号 → `done-user-unverified`，文案必须含"按你的确认继续，页面未能验证"
- [ ] 读取失败 → `blocked` + 重试，不推进
- [ ] 完成证据只进诊断，不把技术细节展示给用户

**验证**：任务 10.4 的 AT-10/AT-11/AT-12。

### 6.4 用户反馈分支（`guide` 层规则 + 后续 9.3 接线）

- [ ] 我找不到 → 重新读取 + `relocate`；找到 → 新高亮 + "我重新找到了"；找不到 → 真实原因（控件不存在/可能改版/可能在内嵌框架内/未登录）+ 1 个替代
- [ ] 我点错了 → `replan` + `version+1`；旧步骤不再出现；无自动导航
- [ ] 换一个任务 → 旧计划 `abandoned`（保留历史）；新目标明确 → 新计划，不明确 → 澄清
- [ ] 我已完成 → 强制 `recheck` 后判定（`done-verified` 或 `done-user-unverified`）
- [ ] 重新读取 → `EF_COLLECT(reason:"refresh")`，不清空会话
- [ ] 用户长时间不操作：不自动推进、不重复刷屏；用户再次发言时复审

**验证**：任务 10.4 的 AT-12—AT-15；人工 CCB-03/CCB-04、E2E-11。

### 6.5 只读边界与站点无关性（含建行申请页）

- [ ] 申请页"这个页面要填什么" → 只引用字段标签与页面解释文字，高亮标签；不读 `input.value`
- [ ] "指给我看手机号那一栏" → 只滚动高亮该字段 `label`（复用 `resolveTextElement`）；输入框未获得焦点、无输入
- [ ] "帮我填身份证号" → 无法回答 + 建议本人填写；不给填写步骤、不索取证件号
- [ ] "帮我勾选协议并提交"/"验证码是多少" → 无法回答；不代勾选、不提交、不索取验证码
- [ ] 页面层面不新增任何站点专属选择器或政策正文：行为完全由控件风险标注 + 只读规则通用产生
- [ ] 目标控件只允许滚动与高亮，不 `click`/`select`/`dispatchEvent`/`form.submit`

**验证**：`Grep` 验收站点域名/网点名/专属选择器 0 命中；人工 CCB-08—CCB-11、E2E-13。

---

## 7. DOM 观测、复审与并发作废

**依赖**：2.4、2.5、6.3、3.1。**建议顺序**：7.1→7.2→7.3。

### 7.1 观测驱动复审与节流

- [ ] 步骤进入 `current` → `EF_CONTENT_WATCH`；离开 `current` → `EF_CONTENT_UNWATCH` 并记录最终计数
- [ ] `EF_WATCH_TICK` 经 `background/index.ts` 转发到侧边栏 → 触发 `EF_COLLECT(reason:"recheck")`
- [ ] 变化防抖 `WATCH_DEBOUNCE_MS=600`；复审最小间隔 `RECHECK_MIN_INTERVAL_MS=1200`；每步自动复审 ≤`MAX_AUTO_RECHECK_PER_STEP=3` 次，超出只允许用户发言/点击触发
- [ ] 复审结论在 3s 内产出（已更新 / 仍需重读 / 无法确认）
- [ ] 无关变化（广告、轮播、时钟）只记诊断，不推进、不刷屏
- [ ] 页面切换时停止全部观测，不跨页残留 observer

**验证**：节流参数纯函数用例；人工 CCB-02、E2E-09；`Grep "setInterval" src/` 0 命中。

### 7.2 网页切换复审与会话保留

- [ ] `EF_PAGE_CHANGED` → 保留 `messages`、引用 `stale`、当前步骤 `needs-review`、追加系统提示"页面变了，我先核对当前进度"
- [ ] 复审完成前**不得**产生 `next-step`；复审失败 → 原因 + 重试
- [ ] 同域切换同样触发复审（不因同域跳过）；旧 `elementId` 不复用
- [ ] 复审成功 → "已更新" + 下一步（若条件命中）
- [ ] 关闭侧边栏 → `ended`，不持久化；重开重新读取当前页，不显示旧回答与引用

**验证**：任务 10.4 的 AT-16；人工 E2E-12。

### 7.3 版本与迟到响应作废

- [ ] 三代版本 `turnId`/`snapshotId`/`planVersion`；异步结果至少携带其中两个，不匹配即丢弃
- [ ] 迟到 `EF_COLLECT` 不覆盖 `currentSnapshot`；同一 `turnId` 不重复追加消息；`segmentId` 去重
- [ ] 连续发送、多步并发不产生重复消息、重复语义段或重复步骤
- [ ] 页面元素定位时已移除 → 提示依据失效 + 建议重新读取，不滚动错误位置

**验证**：自测构造乱序快照断言丢弃；人工快速连点两次"重试"确认只有一条状态消息。

---

## 8. 聊天界面（M6）

**依赖**：3.1、4.1—4.7、6.1—6.3。**建议顺序**：8.1→8.2→8.3→8.4→8.5→8.6→8.7。

### 8.1 布局与头部

- [ ] `src/sidepanel/App.tsx` 改为 `ChatHeader` + `ModeNotice` + `PageStatusLine` + `MessageList` + `ChatComposer` + `DiagnosticsPanel`
- [ ] `ModeNotice` 常驻"本地规则演示，未接入在线模型"；`ChatHeader` 短徽标同义；不出现"AI 已理解/智能体已规划"
- [ ] `PageStatusLine` 只显示"已看到 <域名> 的页面 / 正在读取 / 无法读取（原因）"，不显示条目数、快照 ID
- [ ] 主界面无"分析当前页/重新读取页面/选择模式/任务面板"常驻按钮
- [ ] 欢迎语 ≤2 句，包含"回答页面上的问题"与"一步一步陪你办"语义
- [ ] 首屏先渲染欢迎语与输入框，不等页面采集完成

**验证**：人工 E2E-01；`Grep "分析当前页|重新读取页面|选择模式" src/sidepanel` 0 命中；`Grep -i "大模型|智能体|已接入模型" src/sidepanel` 0 命中。

### 8.2 消息渲染

- [ ] `MessageList`/`UserBubble`/`AssistantMessage`/`SystemNotice`：纯文本、`aria-live="polite"`、自动滚底但不打断向上阅读
- [ ] 直接回答 ≤3 句；澄清 1 问；下一步内嵌 `StepCard`；无法回答含原因 + 建议
- [ ] 不渲染 `elementId`/`domPath`/`score`/`hash`/`EF-E0xx`/片段数
- [ ] 禁止 `dangerouslySetInnerHTML`/`innerHTML`；URL 不自动变成可点击链接
- [ ] 超长文本折行，用户消息不二次高亮敏感值

**验证**：`Grep "dangerouslySetInnerHTML|innerHTML" src/sidepanel` 0 命中；人工 E2E-02。

### 8.3 `EvidencePanel`（网页依据折叠）

- [ ] 默认折叠，仅一条"网页依据（N 处）"入口；展开即时渲染，**不发起** `EF_COLLECT`
- [ ] 按引用顺序显示原文片段 + "在网页中查看"；标题与正文条目分别可点
- [ ] 单条点击 → `EF_HIGHLIGHT({ref})`；标题+正文一起看 → `refs`（≤3）批量，共用 4s TTL
- [ ] `stale` → "这条依据已经变了，我重新看一下页面" + 重试读取，不高亮错误位置
- [ ] `folded` → "这段内容被折叠了，展开后我再指给你看"
- [ ] 引用 `status:"stale"` 时条目显示"已失效"，点击不滚动

**验证**：人工 E2E-03、BJ-06；单 ref 与双 ref 两条路径各验一次。

### 8.4 `StepCard` 与 `InlineActions`

- [ ] `StepCard` 显示步骤目标、完成条件（人话）、当前状态（含"用户确认（未页面校验）"）
- [ ] `InlineActions`：指给我看 / 我找不到 / 我点错了 / 我已完成，每点只做一件事
- [ ] 指给我看 → `EF_HIGHLIGHT({ref: controlRef})`；输入框类由 `resolveTextElement` 落到 label
- [ ] 不出现通用"下一步"大按钮；不出现承诺代操作的文案
- [ ] 步骤状态为 `blocked` 时只显示原因与替代，不显示"指给我看"

**验证**：人工 CCB-01/CCB-02/CCB-11；点击后 URL、表单值、焦点不变。

### 8.5 `ChatComposer` 与语音占位

- [ ] `maxLength=500`；空输入、去符号后为空不发送；超长提示"能精简成一句吗？"且保留输入
- [ ] Enter 发送、Shift+Enter 换行；发送中禁用重复发送
- [ ] 首响超过 `ENGINE_SLOW_HINT_MS=500` 显示"我正在看这个页面"轻量状态
- [ ] 语音：`voiceState="disabled"`，不渲染可用麦克风（或明确禁用态 + "暂未开放"）；不引入 `getUserMedia`/`MediaRecorder`/`SpeechRecognition`
- [ ] 不请求麦克风权限，不做持续监听

**验证**：`Grep "getUserMedia|MediaRecorder|SpeechRecognition" src/` 0 命中；人工 E2E-14（禁用态）。

### 8.6 `DiagnosticsPanel`（原 `RunLog` 扩展）

- [ ] 默认折叠；只显示运行标识、`turnId`、模式、读取耗时、引擎耗时、条目数、语义段数、引用数、控件数、校验结论、拒绝原因、出站字节数、是否检测敏感值
- [ ] 允许错误码与原因码；不允许页面正文、引用原文、用户话语、表单值、敏感值
- [ ] 展开不发起新请求；关闭后不占首屏空间

**验证**：人工 E2E-15；任务 10.5 的 AT-18。

### 8.7 样式与无障碍

- [ ] `src/sidepanel/styles/sidepanel.css` 适配 320—480px，长文本折行不溢出
- [ ] 折叠区用原生 `<details>`；焦点顺序：输入框 → 发送 → 最新消息操作
- [ ] 无远程字体/图片/CDN；颜色与时长使用命名常量（或在 CSS 变量中集中声明）

**验证**：`npm run build` 产出 `dist/sidepanel.css`；人工拖动侧边栏宽度无横向滚动错乱。

---

## 9. 会话编排（M5）

**依赖**：3.1、4.1—4.9、6.1—6.4、8.1—8.6。**建议顺序**：9.1→9.2→9.3→9.4→9.5。

### 9.1 `src/sidepanel/hooks/useConversation.ts` 数据流

- [ ] 复用 `usePageSession.ts` 的 `callBackground`（`chrome.runtime.sendMessage` 包装）与错误归一化，**不重写消息通道**
- [ ] 挂载顺序：`EF_LOAD_GOAL` → 渲染欢迎语 → `EF_GET_CONTEXT` → `EF_COLLECT(reason:"initial")`
- [ ] `retry()`/`refresh()` 更新**同一条**状态消息，不追加重复消息、不重复欢迎语
- [ ] 读取失败映射五种对话原因类别，错误码只进诊断
- [ ] 卸载时停止 watch、清空会话内存、不写 storage
- [ ] 异步结果按 `turnId`/`snapshotId` 作废

**验证**：人工 E2E-01（自动读取、失败重试）；`Grep "chrome.storage" src/` 仍只在 router 与 goal 相关处。

### 9.2 `send()` 单轮处理流水线

- [ ] 顺序：输入校验（空/纯符号/>500）→ 敏感样式检测（命中不记录原文、不进引擎、提示"这类信息不用发给我"）→ 组装最近 6 轮摘要 → `RuleDialogueEngine.respond` → `ResponseValidator` → 消息落地
- [ ] 校验拒绝 → 整条降级为无法回答 + 诊断记录拒绝原因
- [ ] 直接回答落地后登记引用；下一步落地后登记步骤并启动 watch
- [ ] 同一 `turnId` 只产生一条用户消息 + 一条助手消息
- [ ] 首响 1s 内出现，超过 500ms 显示轻量状态

**验证**：任务 10.2/10.3 的流水线纯函数部分；人工 BJ-01、CCB-01。

### 9.3 内联动作接口

- [ ] `askForEvidence(messageId)` 只读内存，不重新读取
- [ ] `locate(refs)` / `markDone()` / `notFound()` / `misclicked()` / `switchTask()` / `retry()` 按 6.4 规则接线
- [ ] 每个动作携带 `tabId` + `snapshotId`；页面变化后旧动作拒绝执行并提示重新读取
- [ ] `markDone()` 必须强制 `recheck` 后才产出结论
- [ ] 高亮结果按 `highlighted|partial|folded|stale` 分别提示，不误报"已定位"

**验证**：人工 CCB-02/CCB-03/CCB-04、E2E-06。

### 9.4 会话边界与目标持久化

- [ ] 关闭侧边栏即结束：不持久化页面正文、语义段、引用、聊天、步骤
- [ ] 仅 `EF_SAVE_GOAL` 保存 `currentGoal`（截断 200）；恢复只恢复文本，不作为当前页事实
- [ ] 重开重新读取当前页，显示新欢迎语，无旧回答与旧引用
- [ ] `voiceState` 恒为 `disabled`；`mode` 恒为 `rule-demo`

**验证**：检查 `chrome.storage.local` 只有 `easyflow.goal`；人工 E2E-01 关闭重开。

### 9.5 旧界面下线与清理

- [ ] `App.tsx` 不再引用 `GoalForm`/`CardList`/`Card`/`StatusBanner`/`usePageSession`
- [ ] 按设计保留旧文件至迁移完成（或完成后清理并在留痕说明），不得留下双界面入口
- [ ] 移除常驻工作流按钮；`ModeBadge` 文案替换为规则演示口径
- [ ] `src/sidepanel/main.tsx` 入口保持 `createRoot` + `#root`，无路由、无外部请求

**验证**：`Grep "CardList|GoalForm|StatusBanner|usePageSession" src/sidepanel/App.tsx` 0 命中；`npm run build` 通过。

---

## 10. 自动化测试与门禁（AT-01—AT-26）

**依赖**：1—9。**建议顺序**：10.1→10.2→10.3→10.4→10.5→10.6→10.7。用例只使用合成文本，不依赖 jsdom、真实站点或网络。

### 10.1 `scripts/selftest.mjs` 骨架扩展

- [ ] `stdin.contents` 追加导出：`buildSegments`、`classifyIntent`、`ruleEngine.respond`、`validateResponse`、`composeAnswer`、`createPlan`、`replan`、`evaluateCompletion`、`sanitizeOutbound`、`detectSensitive`、`redactUrl`
- [ ] 新增合成构造器：`makeSegment`/`makeControl`/`makePlan`/`makeSnapshotWithSegments`，样例文本只用"示例条款甲/乙""示例证件"类合成内容
- [ ] 用例名带 AT 编号，输出可见用例名与通过/失败；临时 bundle 写入系统临时目录，不落 `dist/`
- [ ] 保留第一轮 T-03—T-09 与 `mergeLineBoxes` 用例（回归）

**验证**：`npm run selftest` 退出码 0，输出同时包含 T-* 与 AT-* 用例。

### 10.2 语义段与直接回答（AT-01—AT-04、AT-08、AT-09）

- [ ] **AT-01 直接回答有原文依据**：标题"办理条件："+紧随正文；问"谁能申请"→ 回答 1—3 句且 ≤180 字；每个引用 `elementId` 存在于快照；引用原文是元素文本归一化后的精确子串；回答中数字/日期/地名/材料名出现在引用中
- [ ] AT-02 无依据不编造：无关快照 → `cannot-answer`，无金额/地址/电话，文案含"当前页面没有找到这项信息"
- [ ] AT-03 标题不得单独成答：只有"办理条件："→ 说明只有标题，不当作完整条件
- [ ] AT-04 语义段边界：标题 A+正文 A+标题 B+正文 B → 两段，标题与正文 ID 均保留，不跨段拼接
- [ ] AT-08 四类响应封闭：遍历输出 → 类型仅四类；`next-step` 只 1 个动作；`clarify` 只 1 问
- [ ] AT-09 引用校验拒绝：不存在 ID / 原文改一字 / 整页引用 → 全部拒绝，用户见无法回答，诊断有原因码

**验证**：`npm run selftest` 全绿（执行阶段补记真实输出）。

### 10.3 意图与上下文（AT-05—AT-07）

- [ ] **AT-05 连续追问使用上下文**：第一轮问高龄津贴申请 → 第二轮"那需要带什么" → 直接回答材料，不反问目标，引用仍来自当前页
- [ ] AT-06 上下文断裂：无上文"那个东西"→ 只 1 个澄清问题，不输出事实或步骤
- [ ] AT-07 意图优先级："帮我提交，谁能申请"→ `cannot-answer`（安全优先），不先回答条件

**验证**：`npm run selftest` 全绿。

### 10.4 陪办与复审（AT-10—AT-16）

- [ ] **AT-10 网页变化不误判完成**：步骤完成条件为"出现结果列表"；仅时间流逝、无关 DOM 变化、输入值变化 → 均不推进；消息"我还不能确认"；无下一步
- [ ] AT-11 完成条件命中：目标结果文本出现 / 地址变化符合条件 → `done-verified` + 证据正确
- [ ] AT-12 用户确认但页面无变化 → `done-user-unverified`，不声称页面已验证，可给下一步并说明
- [ ] AT-13 找不到重定位：标签变化但同类控件仍在 → 重新定位新高亮；控件移除 → `missing`，不假装高亮
- [ ] AT-14 点错重规划：`planVersion+1`；旧步骤 `superseded`；不重复旧指令；无自动导航
- [ ] AT-15 换任务：旧计划 `abandoned` 且保留历史；新目标清晰则新计划，否则澄清
- [ ] AT-16 页面切换会话保留与复审：消息保留；步骤 `needs-review`；复审前无下一步；旧 ID 不复用

**验证**：`npm run selftest` 全绿。

### 10.5 隐私（AT-17—AT-20）

- [ ] **AT-17 敏感 `input.value` 不进入快照**：构造 `value="张三 110101199001011234"` 的输入框 → 快照不含该值，只含标签/占位符（采集规则静态断言 + `sanitize` 用例）
- [ ] **AT-18 敏感值不进入日志**：触发读取与错误诊断 → 诊断不含正文、表单值、姓名、证件号、手机号、验证码、密码
- [ ] **AT-19 敏感值不进入模型请求**：`sanitizeOutbound` 输出不含 HTML、`input.value`、个人信息、URL 查询参数；超限截断并标记
- [ ] AT-20 地址脱敏：`?token=...&phone=...` → `redactUrl` 只保留协议+域名+路径
- [ ] 过滤失败即停止：`assertNoSensitive` 返回 `blocked` 时不出站，诊断记"隐私过滤拦截"

**验证**：`npm run selftest` 全绿；`Grep "input.value" src/` 0 命中。

### 10.6 模型占位、语音与限制（AT-21—AT-24、AT-26）

- [ ] AT-21 模型未配置：无端点/密钥/模型名 → 不发请求；`mode="rule-demo"`；界面文案正确；`outboundBytes=0`
- [ ] AT-22 非法输出拒绝：编造事实/无效元素 ID/多步/提交动作/仅超时完成条件 → 整条拒绝，不展示任何事实或步骤
- [ ] AT-23 语音降级（本轮禁用态）：文字输入仍可用；无自动发送路径；不支持说明存在
- [ ] AT-24 iframe/跨域限制：目标仅在 iframe / 下一步需其他域名 → 说明限制；不出现"已定位/已完成"；无自动导航
- [ ] AT-26 无远程请求默认：`dist/*.js` 检索 `fetch(`/`XMLHttpRequest`/`sendBeacon`/`WebSocket`/`apiKey` 0 命中

**验证**：`npm run selftest` 与 `npm run verify` 全绿；检索结果写入留痕。

### 10.7 AT-25 构建、清单与自测门禁

- [ ] `npm run build` 退出码 0（内含 `tsc --noEmit`、三入口打包、复制静态资源、`verify-manifest`）
- [ ] `npm run selftest` 退出码 0
- [ ] `npm run verify` 退出码 0；清单权限恰为四项；无 `host_permissions`/`content_scripts`/`<all_urls>`
- [ ] `dist/` 7 类产物 + 4 个图标齐全，各文件字节数 >0
- [ ] 完整输出与退出码写入 `codearts_proof/11-iteration2-impl-phase.md`

**验证**：三条命令真实执行；未执行不得写通过（本阶段均未执行）。

---

## 11. 三站点人工验收矩阵（Chrome ≥116）

**依赖**：10.7 构建成功。**建议顺序**：11.1→11.2→11.3→11.4→11.5→11.6。步骤、控件名称与结果内容一律以运行时实际可见 DOM 为准，不得预先写入站点数据。

### 11.1 通用前置

- [ ] `chrome://extensions` 开启开发者模式 → 加载 `dist/` → 确认无加载错误、无额外权限警告
- [ ] 每次打开站点后**点击扩展图标**授予 `activeTab`；切换标签页/跨源导航后重新点击
- [ ] 每条记录：站点、时间、页面状态（登录/地图/iframe）、实际响应类型、是否命中预期、失败原因、截图路径
- [ ] 未执行项单列"未执行事项"，不得用"已验证"概括

### 11.2 北京石景山高龄津贴指南（BJ-01—BJ-06 / E2E-01—E2E-07）

- [ ] E2E-01 主界面只看到欢迎语、对话、输入框、发送；自动读取当前页；无"分析当前页/重新读取"常驻按钮
- [ ] BJ-01 输入"高龄津贴谁能申请"→ 1—3 句回答 + 一条折叠"网页依据"；不只列片段、不只引"办理条件："标题
- [ ] BJ-02 输入"在哪里线下办理"→ 有地点/窗口/时间则回答并保留时间与地区限定；无则说明当前页没有
- [ ] BJ-03 追问"那需要带什么"→ 继承目标直接回答材料，不反问"你要办什么"
- [ ] BJ-04 输入"我找不到办理条件"→ 重新定位标题及其正文并提供"指给我看"，或如实说明找不到
- [ ] BJ-05 问页面未出现的"补贴多少钱"→ 无法回答 + 一个建议；不出现金额/发放周期
- [ ] BJ-06 展开"网页依据"→ 点"在网页中查看"→ 真实文字逐行高亮、约 4 秒移除；URL/表单值/焦点不变
- [ ] 记录实际通过的条目与失败条目，失败写明现象（如"只引标题""高亮整块"）

### 11.3 建行网点查询（CCB-01—CCB-07 / E2E-08—E2E-12）

- [ ] CCB-01 输入"第一次办借记卡，先找营业网点"→ 只给一个下一步（如"先选择所在城市"）+ 指给我看 + 完成条件
- [ ] CCB-02 用户在网页自行选择地区 → 重新读取复审；命中则给下一步（网点类型），未命中则"我还不能确认"
- [ ] CCB-03 输入"我找不到网点类型"→ 重新定位同一语义控件并新高亮，或说明原因与替代
- [ ] CCB-04 输入"我点错了"→ 基于当前页重规划，计划版本递增，旧步骤不再出现，无自动导航
- [ ] CCB-05 用户自行点击搜索 → 结果可见则引用真实网点名称/地址/营业时间；不可见则说明未加载/地图不可读；不编造
- [ ] CCB-06 目标位于 iframe/地图 → 明确"在内嵌框架/地图里，我读不到"，不出现"已定位/已完成"
- [ ] CCB-07 流程需跳另一域名 → 只给站点名与文字指引；URL 不变、不新开标签、无可点击链接
- [ ] E2E-12 第 2 步时切换标签页 → 聊天保留 + "页面变了，我先核对当前进度"；复审完成前无下一步

### 11.4 建行借记卡申请页只读边界（CCB-08—CCB-11 / E2E-13）

- [ ] CCB-08 问"这个页面要填什么"→ 引用字段标签与解释文字并高亮标签；不读出用户已填值
- [ ] CCB-09 问"帮我填身份证号"→ 无法回答；不索取证件号；不提供代填步骤
- [ ] CCB-10 问"帮我勾选协议并提交""验证码是多少"→ 无法回答；不代勾选、不提交、不索取验证码
- [ ] CCB-11 问"指给我看手机号那一栏"→ 只滚动高亮字段标签；输入框未获得焦点、无输入、值不变
- [ ] E2E-13 三步连续提问均符合边界；页面无表单提交、无勾选变化
- [ ] 对照每项"不通过条件"逐条判定，命中任一条即记失败

### 11.5 语音（E2E-14，本轮为禁用态）

- [ ] 确认界面不显示可用麦克风，或显示禁用说明"暂未开放"
- [ ] `chrome://extensions` 权限列表中没有麦克风相关权限
- [ ] 未点击时无任何麦克风权限请求；文字输入仍能完成一轮问答
- [ ] AT-23 用例结果与人工观察一致

### 11.6 性能实测

- [ ] 首屏（欢迎语 + 输入框）≤1.5s（不等采集完成）
- [ ] 自动读取 ≤3s；失败说明 ≤3.5s
- [ ] 单次采集 ≤1s（`collectMs`）；语义段 + 控件 ≤300ms（`segmentsMs`）
- [ ] 规则首响 ≤1s；超过 500ms 有"我正在看这个页面"
- [ ] 指给我看/在网页中查看 ≤500ms；页面变化后复审 ≤3s；展开网页依据即时
- [ ] 以"场景 | 实测 | 阈值 | 结论"表格记录；未达标写明原因与降级措施

---

## 12. 文档、留痕与收口

**依赖**：10、11。**建议顺序**：12.1→12.2→12.3→12.4。

### 12.1 `README.md` 重写

- [ ] 改为对话式入口说明：一句话提问、追问、逐步陪办、网页依据、指给我看、我找不到/我点错了/我已完成
- [ ] 明确"本地规则演示，未接入在线模型"；说明模型适配层只是占位、零请求
- [ ] 明确语音本轮未实施：无麦克风入口、无权限、无音频存储
- [ ] 写明三站点验收步骤（BJ-01—BJ-06、CCB-01—CCB-11、E2E-01—E2E-15）与已知限制（iframe/地图/登录/验证码/跨域/改版/懒加载/分页）
- [ ] 写明隐私边界：不读 `input.value`、不代填/勾选/提交、只存 goal ≤200、关闭侧边栏即结束
- [ ] 保留错误码表，并注明"错误码只在折叠运行诊断中出现"
- [ ] 更新目录结构（`src/content/semantic.ts`、`controls.ts`、`observe.ts`、`src/sidepanel/dialogue/**`、`guide/**`、`components/chat/**`、`shared/privacy/**`）

**验证**：按 README 从零加载扩展可复现 E2E-01/E2E-02/E2E-08；`Grep -i "大模型|智能体|已接入模型" README.md` 0 命中。

### 12.2 `codearts_proof/11-iteration2-impl-phase.md` 留痕

- [ ] 记录实际修改文件清单（新增 / 修改 / 降级下线），与任务清单逐项对照
- [ ] 记录 `npm run typecheck`、`npm run build`、`npm run selftest`、`npm run verify` 的真实命令、完整输出摘要与退出码
- [ ] 记录失败与修复过程，保留失败输出原文（不只写"已修复"）
- [ ] 记录 AT-01—AT-26 逐条结果（用例名 + pass/fail + 断言摘要）
- [ ] 记录 E2E-01—E2E-15 与 BJ/CCB 矩阵逐条结果（站点/时间/页面状态/响应类型/判定/失败原因/截图路径）
- [ ] 记录性能实测表与全部门禁检索结果
- [ ] 单列"未执行事项"：未运行的命令、未完成的站点、未实测的性能项

**验证**：抽查 5 条结论均能对应到一条已执行命令输出或一次人工操作记录。

### 12.3 合规复核（硬门禁，逐条写入留痕）

- [ ] 清单权限恰为 `["activeTab","scripting","sidePanel","storage"]`；无 `host_permissions`/`content_scripts`/`<all_urls>`/`tabs`/麦克风
- [ ] `src` 与 `dist` 检索 `fetch(`/`XMLHttpRequest`/`sendBeacon`/`WebSocket`/`getUserMedia`/`MediaRecorder`/`SpeechRecognition`/`apiKey`/`API_KEY`/`Authorization`/`sk-` → 0 命中
- [ ] `src/content` 检索 `.value` → 仅 `collect.ts:147` 的 button 文本兜底，其余 0 命中并逐处说明
- [ ] 检索 `click(`/`focus(`/`select(`/`submit(`/`requestSubmit`/`dispatchEvent` → 页面侧 0 命中（侧边栏自身输入框聚焦除外且不涉及页面）
- [ ] 检索 `localStorage`/`sessionStorage`/`document.cookie`/`navigator.clipboard`/`FileReader` → 0 命中
- [ ] 检索 `dangerouslySetInnerHTML`/`innerHTML` → 0 命中
- [ ] 检索验收站点政策正文、网点名称、地址、电话、专属选择器 → 0 命中
- [ ] 主对话区检索 `elementId`/`domPath`/`score`/`hash`/`EF-E0` → 0 命中（折叠诊断除外）

**验证**：每条检索的真实输出与"允许/需修正"判定写入 12.2 留痕。

### 12.4 交付总结

- [ ] 汇总产物位置（`dist/`）、构建命令、已完成能力、未完成能力、已知限制
- [ ] 明确写出"规则演示，未接入在线模型""语音未实施""在线模型适配层仅为契约占位"
- [ ] 列出仍未满足或需用户确认的项（若与规格附录 A 有偏差，记录偏差与原因）
- [ ] 不得声称未执行的测试或人工验收通过

---

## 13. 需求覆盖映射

### 13.1 规格章节 → 任务

| 规格章节 | 任务 |
|---|---|
| 4.1 性能 | 8.5（首响状态）、11.6（实测）、7.1（复审 3s） |
| 4.2 可靠性 | 3.1、7.2、7.3、9.1、9.4 |
| 4.3 安全性 | 全局硬约束、1.4、1.5、6.5、12.3 |
| 4.4 可维护性 | 4.1、4.6、8.1、8.6、12.1 |
| 4.5 兼容性 | 1.1、1.3、2.6、9.5 |
| 5.1 统一对话入口与会话状态 | 3.1、8.1、8.2、8.5、9.1、9.4 |
| 5.2 意图分类与响应类型 | 4.2、4.3、4.7、5.3 |
| 5.3 直接回答与语义段依据 | 2.2、4.4、4.5、4.6、5.1、8.3 |
| 5.4 逐步陪办 | 6.1、6.2、6.3、6.4、6.5、8.4 |
| 5.5 页面感知、切换复审与隐私过滤 | 2.1、2.4、2.5、7.1、7.2、7.3、1.4、1.5 |
| 5.6 对话引擎与模型边界 | 4.1、4.6、4.7、4.9 |
| 5.7 语音可选输入 | 8.5、11.5、AT-23 |
| 5.8 三站点验收矩阵 | 11.2、11.3、11.4 |
| 5.9 自动化测试与人工验收 | 10.1—10.7、11 |
| 5.10 交付与范围收口 | 12.1、12.2、12.3、12.4 |
| 6.1—6.9 数据约束 | 1.1、1.2、2.2、2.3、3.1、4.1、4.6、1.5、8.6 |

### 13.2 用户点名要求 → 任务

| 要求 | 任务 |
|---|---|
| 对话数据模型与消息协议 | 1.1、1.3、3.1 |
| `DialogueEngine` 接口 | 4.1 |
| 规则引擎 | 4.2、4.3、4.4、4.5、4.7 |
| `ResponseValidator` | 4.6 |
| 模型适配层占位 | 4.9、10.6（AT-21/22/26） |
| 语义段提取 | 2.2（基于已采集条目 + `domPath` 前缀推断） |
| 直接回答 / 上下文追问 | 4.5、4.8、5.1、5.2 |
| 多步陪办 / DOM 观测完成判定 | 6.1—6.4、7.1 |
| 聊天 UI / 自动读取与重试 | 8.1—8.7、9.1 |
| 网页切换复审 / 网页依据折叠 / 指给我看 | 7.2、8.3、8.4 |
| 我已完成 / 找不到 / 点错 / 换任务 | 6.4、9.3 |
| 跨域 / iframe 限制 | 5.3、6.5、11.3 |
| 诊断折叠 / 隐私过滤 | 8.6、1.4、1.5、10.5 |
| 语音可选入口占位 | 8.5、11.5 |
| `EF_HIGHLIGHT` 可选 `refs` 且单 ref 兼容 | 1.3、2.6 |
| 自动复审每步最多 3 次 | 1.2、7.1 |
| 跨域只给站点名与文字指引 | 5.3、6.5（K2-10） |
| 本轮规则演示、不接在线模型 | 4.9、8.1、12.1 |
| 建行申请页只高亮字段标签与解释文字 | 6.5、8.4 |
| 关闭侧边栏即结束会话 | 9.4 |
| 三站点人工验收矩阵 | 11.2—11.4 |
| 构建 / 自测 / 四类核心新增测试 | 10.1—10.7 |
| 留痕含命令与未执行声明 | 12.2 |

### 13.3 完成定义（DoD）

1. 任务组 1—9 全部子任务勾选，且无跨组隐含依赖未满足。
2. `npm run typecheck`、`npm run build`、`npm run selftest`、`npm run verify` 四条命令**真实执行**且退出码 0，输出已写入留痕。
3. AT-01—AT-26 全部落地，其中 AT-01/05/10/17/18/19 为用户点名的核心新增测试，必须有明确断言与通过输出。
4. 三站点矩阵逐条有记录：通过 / 失败 / 未执行，三者不得混淆。
5. 12.3 八条硬门禁全部通过；`input.value`、代填、勾选、提交、新增权限等禁止项 0 命中。
6. README 可按步骤复现 E2E-01/E2E-02/E2E-08。
7. 留痕中"未执行事项"完整，无"理论上通过/应该可用"类表述。

### 13.4 本阶段（任务规划）未执行事项

以下均**未执行**，不得在后续汇报中写成已完成：

1. `npm run typecheck`、`npm run build`、`npm run selftest`、`npm run verify`。
2. 任何 `src/**`、`scripts/**`、`public/**`、`README.md`、`package.json` 的实现修改。
3. 在 Chrome 中加载 `dist/`。
4. 三个真实站点的 DOM 读取与 E2E-01—E2E-15、BJ-01—BJ-06、CCB-01—CCB-11 人工验收。
5. 性能实测（首屏、采集、语义段、首响、高亮、复审）。
6. 语音能力实测（本轮设计为禁用态，未验证界面禁用表现）。
7. 在线模型模式实测（无端点、无密钥、无代理、无访问通道）。
8. 截图产出。