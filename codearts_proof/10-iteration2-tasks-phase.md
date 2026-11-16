# 10 — 第二轮编码任务规划阶段留痕（对话式陪办迭代）

## 1. 阶段目标与边界

本阶段按用户要求进入"编码任务规划"：把 `iteration2-spec.md` 的需求与 `iteration2-design.md` 的技术方案，转换为可独立执行、可验证、带依赖与顺序的编码任务清单。

本阶段实际做的：

- 读取第二轮规格、实现方案、两份阶段留痕、第一轮规格/设计/任务、现有实现与构建脚本；
- 执行**只读**基线核查命令（列目录、统计行数、六组 Grep 检索）；
- 生成 `.codeartsdoer/specs/easyflow_page_guide/iteration2-tasks.md`（12 个任务组、13 章含需求覆盖映射）；
- 追加本留痕。

本阶段**未做**：

- 未修改任何实现代码（`src/**`、`public/**`、`scripts/**`、`dist/**`、`README.md`、`package.json`、`tsconfig.json` 均无改动）；
- 未修改第一轮 `spec.md`、`design.md`、`tasks.md`；
- 未修改 `iteration2-spec.md`、`iteration2-design.md`（仅新写任务清单）；
- 未运行 `npm run typecheck`、`npm run build`、`npm run selftest`、`npm run verify`；
- 未在 Chrome 中加载扩展，未在三个真实站点执行任何人工验收或 DOM 读取；
- 不声称任何构建、自测、人工验收已通过。

## 2. 本阶段读取的输入

### 2.1 第二轮规格与设计

- `.codeartsdoer/specs/easyflow_page_guide/iteration2-spec.md`（Read 工具显示 1148 行；含 5.1—5.10 核心能力、6.1—6.9 数据约束、附录 A 取舍、附录 B 需求追踪）
- `.codeartsdoer/specs/easyflow_page_guide/iteration2-design.md`（Read 工具显示 1716 行；含 1.0 基线纠正、1.1 需求对比、1.2 存量分析、D-01—D-08、K2-01—K2-10、2.1—2.14 增量方案）

### 2.2 阶段留痕

- `codearts_proof/08-iteration2-spec-phase.md`
- `codearts_proof/09-iteration2-design-phase.md`

### 2.3 第一轮规格/设计/任务

- `.codeartsdoer/specs/easyflow_page_guide/spec.md`
- `.codeartsdoer/specs/easyflow_page_guide/design.md`
- `.codeartsdoer/specs/easyflow_page_guide/tasks.md`

### 2.4 现有实现（逐文件读取）

- `src/background/`：`index.ts`、`injector.ts`、`router.ts`、`tabContext.ts`
- `src/content/`：`collect.ts`、`entry.ts`、`highlight.ts`、`normalize.ts`、`registry.ts`（`highlight.ts` 全文 437 行、`collect.ts` 全文 356 行）
- `src/sidepanel/`：`App.tsx`、`hooks/usePageSession.ts`、`state/{initialState,sessionReducer}.ts`、`match/{lexicon,ruleMatcher,summarize}.ts`、`diagnostics/RunLog.tsx`
- `src/shared/`：`types.ts`、`messages.ts`、`errors.ts`、`constants.ts`、`domPath.ts`
- `scripts/`：`build.mjs`、`selftest.mjs`、`verify-manifest.mjs`
- `public/manifest.json`、`README.md`、`package.json`

## 3. 本阶段实际执行的命令与结果（只读）

### 3.1 目录与文件清单

命令：

```powershell
Get-ChildItem -Force -Recurse -Depth 1 .codeartsdoer/specs | Select-Object FullName, Length
Get-ChildItem -Force codearts_proof | Select-Object Name, Length
Get-ChildItem -Recurse -File src,public,scripts | Select-Object FullName, Length
```

结果摘要：

- `specs/easyflow_page_guide/`：`spec.md`（29815 B）、`design.md`（66272 B）、`tasks.md`（36458 B）、`iteration2-spec.md`（105946 B）、`iteration2-design.md`（120102 B，本阶段新增 `iteration2-tasks.md`）；
- `codearts_proof/`：`01`—`09` 阶段文档 + 构建/自测/安装日志 + 本轮新增 `10-iteration2-tasks-phase.md`；
- `src/` 29 个 `.ts/.tsx`、`scripts/` 4 个 `.mjs`、`public/` 2 个文件（`manifest.json`、`sidepanel.html`），与设计文档 1.0 的基线描述一致（规模数字不同，见 3.2）。

### 3.2 源码规模统计

命令：

```powershell
$files = Get-ChildItem -Recurse -File src,scripts,public
$ts = $files | Where-Object { $_.Extension -in '.ts','.tsx' }
$mjs = $files | Where-Object { $_.Extension -eq '.mjs' }
$tsLines = ($ts | Get-Content | Measure-Object -Line).Lines
$mjsLines = ($mjs | Get-Content | Measure-Object -Line).Lines
"SRC_TS_COUNT=$($ts.Count)"; "SCRIPTS_MJS_COUNT=$($mjs.Count)"; "TS_LINES=$tsLines"; "MJS_LINES=$mjsLines"; "TOTAL_LINES=$($tsLines + $mjsLines)"
```

实际结果：

```text
SRC_TS_COUNT=29
SCRIPTS_MJS_COUNT=4
TS_LINES=3032
MJS_LINES=470
TOTAL_LINES=3502
```

说明：

- `iteration2-design.md` 1.0 节与 `09` 留痕写"约 1890 行"，本阶段实测为 `src` 3032 行 + `scripts` 470 行 = 3502 行（`Measure-Object -Line` 为非空行口径）。
- 该差异只影响规模预估，不影响任务拆分；任务清单 0 章已按实测值记录，未修改设计文档。

### 3.3 规格/设计文档行数

命令：

```powershell
Get-ChildItem .codeartsdoer\specs\easyflow_page_guide\*.md | ForEach-Object { $n = (Get-Content $_.FullName | Measure-Object -Line).Lines; "$($_.Name) = $n 行" }
```

实际结果（非空行）：

```text
design.md = 765 行
iteration2-design.md = 1433 行
iteration2-spec.md = 982 行
spec.md = 395 行
tasks.md = 374 行
```

说明：Read 工具显示的总行数（含空行）为 `iteration2-spec.md` 1148 行、`iteration2-design.md` 1716 行、`tasks.md` 465 行；两种口径不冲突，本留痕保留两种记录。

### 3.4 远程请求与密钥检索

检索范围：`src/**`；检索项：`fetch(`、`XMLHttpRequest`、`WebSocket`、`sendBeacon`、`getUserMedia`、`MediaRecorder`、`SpeechRecognition`、`apiKey`、`API_KEY`、`Authorization`。

实际结果：

```text
No files found
```

结论：现状无任何远程请求、模型 SDK、语音 API 或密钥字样；任务 4.9 必须保持这一状态（只做契约占位、零请求）。

### 3.5 `input.value` 检索

检索范围：`src/content/**`；检索项：`\.value\b`。

实际结果：

```text
src/content/collect.ts:147: return { text: element.value };
```

结论：唯一命中为既有 `input[type=button/submit/reset]` 的文本兜底，用于按钮文字而不是用户输入；任务 1.6/12.3 将该处列为"允许并需逐处说明"的唯一例外。

### 3.6 清单禁用字段检索

检索范围：`manifest.json`；检索项：`host_permissions`、`all_urls`、`content_scripts`。

实际结果：

```text
No files found
```

结论：现状权限仍为四项；任务 1.6 只扩展校验脚本，不申请新权限。

### 3.7 渲染安全与页面写操作检索

检索范围：`src/**`。

| 检索项 | 结果 |
|---|---|
| `dangerouslySetInnerHTML`、`innerHTML` | 0 命中 |
| `click(`、`focus(`、`submit(`、`requestSubmit`、`dispatchEvent` | 1 命中：`src/sidepanel/components/GoalForm.tsx:28` 的 `inputRef.current?.focus()`（侧边栏自身输入框，不涉及页面；该组件在本轮 9.5 下线） |
| `localStorage`、`sessionStorage`、`document.cookie`、`navigator.clipboard`、`FileReader` | 0 命中 |

### 3.8 文案禁用表述检索

检索范围：`src/**`；检索项：`大模型`、`智能体`、`AI 已`、`已接入模型`。

实际结果：

```text
No files found
```

结论：现状未出现夸大表述；任务 8.1/12.1 要求继续保持"本地规则演示，未接入在线模型"。

## 4. 本阶段任务拆分的核心结论

### 4.1 任务清单结构

`iteration2-tasks.md` 共 12 个任务组：

| 组 | 内容 | 依赖 | 设计迁移步 |
|---|---|---|---|
| 1 | 契约扩展与隐私纯函数（类型/常量/消息/脱敏/检测/门禁） | 无 | M1 |
| 2 | 页面读取扩展（语义段、控件标注、变更计数、批量高亮） | 1 | M2 |
| 3 | 对话数据模型与会话状态（reducer、响应封闭性） | 1 | M5 前置 |
| 4 | 对话引擎、规则引擎、检索、成句、校验、上下文、模型占位 | 1、3 | M3 |
| 5 | 直接回答 / 上下文追问 / 限制说明闭环 | 4 | M3 收口 |
| 6 | 多步陪办（计划、定位、重规划、完成判定、用户反馈、只读边界） | 2、4 | M4 |
| 7 | DOM 观测、复审节流、网页切换、并发作废 | 2、6 | M4 收口 |
| 8 | 聊天界面（头部、消息、依据、步骤、输入、诊断、样式） | 3、4、6 | M6 |
| 9 | 会话编排（自动读取、单轮流水线、内联动作、会话边界、旧界面下线） | 3、4、6、8 | M5 |
| 10 | 自动化测试与门禁（AT-01—AT-26） | 1—9 | M7 |
| 11 | 三站点人工验收矩阵（BJ/CCB/E2E/性能） | 10 | — |
| 12 | 文档、留痕、合规复核、交付总结 | 10、11 | M7 收口 |

### 4.2 用户指定默认取舍的落点

| 取舍 | 任务落点 |
|---|---|
| 语义段用已采集条目 + `domPath` 前缀推断，不二次遍历 DOM | 2.2（纯函数、不访问 DOM、容器前缀判定） |
| `EF_HIGHLIGHT` 增加可选 `refs`，保持单 ref 兼容 | 1.3（协议）、2.6（实现，单 ref 路径行为不变） |
| 自动复审每步最多 3 次 | 1.2（`MAX_AUTO_RECHECK_PER_STEP=3`）、7.1（含 600ms 防抖、1200ms 最小间隔） |
| 跨域只给站点名与文字指引 | 5.3、6.5（K2-10，不渲染可点击链接、不导航） |
| 本轮规则演示、不接在线模型 | 4.9（`status` 恒 `not-configured`、零请求）、8.1、12.1 |
| 语音仅入口与降级 | 8.5（`voiceState="disabled"`、不渲染可用麦克风）、11.5、AT-23 |
| 建行申请页只高亮字段标签与解释文字 | 6.5、8.4（复用 `resolveTextElement`，不聚焦、不读值） |
| 关闭侧边栏即结束会话 | 9.4（只持久化 goal ≤200，不存正文/引用/聊天） |

### 4.3 验证方式设计

任务清单要求每步都有可执行的验证方式，分四类：

1. **静态门禁**：`Grep` 指定检索项 0 命中（远程请求、`input.value`、页面写操作、存储、权限、站点内容、技术术语）。
2. **类型与构建**：`npm run typecheck`、`npm run build`、`npm run verify` 退出码 0。
3. **自动化用例**：`npm run selftest` 覆盖 AT-01—AT-26，其中用户点名的四项核心新增测试为：
   - AT-01 直接回答有原文依据（引用元素存在、原文精确子串、硬事实覆盖）；
   - AT-05 连续追问使用上下文（"那需要带什么"不反问目标）；
   - AT-10 网页变化不误判完成（时间流逝/无关 DOM 变化/输入值变化均不推进）；
   - AT-17/18/19 敏感 `input.value` 不进入快照、日志、模型请求。
4. **人工验收**：Chrome ≥116 真实站点逐条记录（站点、时间、页面状态、响应类型、是否命中、失败原因、截图路径），未执行项单列。

### 4.4 硬约束在任务清单中的固化方式

任务清单第 0 章列出 11 条"全局硬约束"，并在第 12.3 节设为八条硬门禁；其中与本轮范围直接相关的三条：

1. 任何阶段不得新增 `<all_urls>`/`host_permissions`/静态 `content_scripts`/麦克风权限（权限恒四项）；
2. 不得读取 `input.value`/下拉选中值/可编辑区内容，不得读取个人敏感值；
3. 不得代填、代选、代勾选、代提交、代支付、代删除、不处理验证码、不使用虚构身份。

## 5. 本阶段产出

- `.codeartsdoer/specs/easyflow_page_guide/iteration2-tasks.md`（12 个任务组，含执行顺序总览、依赖图、阶段门禁、需求覆盖映射、DoD）
- `codearts_proof/10-iteration2-tasks-phase.md`（本文件）

未修改：

- `src/**`、`public/**`、`scripts/**`、`dist/**`
- `README.md`、`package.json`、`tsconfig.json`
- 第一轮 `spec.md`、`design.md`、`tasks.md`
- `iteration2-spec.md`、`iteration2-design.md`

## 6. 未执行事项（如实声明）

以下项目本阶段均**未执行**，不声称通过：

1. `npm run typecheck`
2. `npm run build`
3. `npm run selftest`
4. `npm run verify`
5. 在 Chrome 中加载 `dist/`
6. 三个真实站点的人工验收（BJ-01—BJ-06、CCB-01—CCB-11、E2E-01—E2E-15）
7. 真实站点的 DOM 读取、控件定位、iframe/地图可读性确认
8. 语义段算法在真实页面上的边界验证
9. 批量高亮改造的回归验证
10. 语音能力实测（本轮设计为禁用态）
11. 在线模型模式实测（无端点、无密钥、无代理、无访问通道）
12. 性能实测（首屏、采集、语义段、首响、高亮、复审）
13. 截图产出

## 7. 已知限制与风险（任务规划阶段）

1. 任务清单中的文件路径与函数名为设计预期值；实现阶段若因编译或依赖原因调整路径，必须在留痕中记录"设计偏差 + 原因"，不得静默改名。
2. 语义段边界仍依赖 `domPath` 容器前缀推断，复杂布局可能误判；任务 2.2 已把"失败即无依据"写为强制降级，不允许编造段落。
3. 批量高亮改变现有"全局单 overlay"假设，任务 2.6 明确要求单 `ref` 路径行为不变，并在任务 11.2 设回归项；该回归本阶段未执行。
4. AT-17 涉及 DOM 值不进入快照，Node 自测只能验证"采集规则静态断言 + `sanitize` 纯函数"，真实 DOM 行为仍需人工核验（任务 11.4/12.3）。
5. 规则演示泛化能力有限，任务 5.1—5.3 的验收口径是"有依据才答、无依据明说"，不追求换问法都能答。
6. `activeTab` 在切换标签页/跨源导航后通常失效，任务 11.1 已要求每次重新点击图标；无法通过代码规避。
7. 建行页面可能存在反自动化、地图加载差异或登录要求；任务 11.3/11.4 的通过标准是"如实说明限制"，不是"必须完成流程"。
8. 任务清单未对"是否实施真实语音""是否接受关闭重开不恢复会话"作新决策，与规格附录 A 保持一致，仍待用户在实现阶段前确认。

## 8. 下一步

1. 等待用户审阅 `iteration2-tasks.md` 并确认或提出修改；
2. 用户确认后，才进入任务执行（编码实现）；
3. 任务清单未确认前不修改实现代码、不运行构建与测试。