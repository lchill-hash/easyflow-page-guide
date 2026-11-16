# 09 — 第二轮实现方案阶段留痕（对话式陪办迭代）

## 1. 阶段目标与边界

本轮按用户要求进入"实现方案创建"阶段，把 `iteration2-spec.md` 的需求转换为技术设计。

本阶段实际做的：

- 读取第二轮规格、第一轮规格/设计/任务、现有实现与构建脚本；
- 生成本轮实现方案 `.codeartsdoer/specs/easyflow_page_guide/iteration2-design.md`；
- 追加本留痕。

本阶段**未做**：

- 未修改任何实现代码（`src/**`、`public/**`、`scripts/**`、`README.md`、`package.json`、`dist/**` 均无改动）；
- 未运行 `npm run build`、`npm run selftest`、`npm run verify`、`npm run typecheck`；
- 未在 Chrome 中加载扩展；
- 未在三个真实站点执行任何人工验收或 DOM 读取；
- 不声称任何构建、自测、人工验收已通过。

## 2. 本阶段读取的输入

### 2.1 本轮需求与留痕

- `.codeartsdoer/specs/easyflow_page_guide/iteration2-spec.md`（1148 行）
- `codearts_proof/08-iteration2-spec-phase.md`

### 2.2 既有规格/设计/任务

- `.codeartsdoer/specs/easyflow_page_guide/spec.md`（502 行）
- `.codeartsdoer/specs/easyflow_page_guide/design.md`（937 行）
- `.codeartsdoer/specs/easyflow_page_guide/tasks.md`（465 行）

### 2.3 现有实现（逐文件读取）

- `src/background/`：`index.ts`、`injector.ts`、`router.ts`、`tabContext.ts`
- `src/content/`：`collect.ts`、`entry.ts`、`highlight.ts`、`normalize.ts`、`registry.ts`
- `src/sidepanel/`：`App.tsx`、`main.tsx`、`components/{Card,CardList,GoalForm,ModeBadge,PageInfo,StatusBanner}.tsx`、`diagnostics/RunLog.tsx`、`hooks/usePageSession.ts`、`match/{lexicon,ruleMatcher,summarize}.ts`、`state/{initialState,sessionReducer}.ts`、`styles/sidepanel.css`
- `src/shared/`：`types.ts`、`messages.ts`、`errors.ts`、`constants.ts`、`domPath.ts`
- `scripts/`：`build.mjs`、`gen-icons.mjs`、`selftest.mjs`、`verify-manifest.mjs`
- `public/manifest.json`、`public/sidepanel.html`、`README.md`、`package.json`

## 3. 本阶段基线核查（真实执行）

| 核查项 | 结果 |
|---|---|
| 源文件规模 | `src` 29 个 `.ts/.tsx`、`scripts` 4 个 `.mjs`，约 1890 行 |
| `git` | 不可用；项目根目录不存在 `.git`；本留痕不含 `git diff`/提交记录 |
| 运行时模型请求 | 对 `src/**/*.{ts,tsx}` 检索 `fetch(`、`XMLHttpRequest`、`WebSocket`、`sendBeacon`、`apiKey`、`API_KEY`、`Authorization`：**无命中** |
| 密钥配置 | `Test-Path .env` 为 `False`；无 `.env*` 文件 |
| 清单权限 | `["activeTab","scripting","sidePanel","storage"]`；无 `host_permissions`、无静态 `content_scripts` |
| 高亮时长 | `HIGHLIGHT_TTL_MS = 4000`（`src/shared/constants.ts:13`） |
| 诊断现状 | 仅采集耗时、匹配耗时、条目数、卡片数、内容版本 |
| 界面现状 | 目标输入 + 分析当前页 + 重新读取 + 卡片墙 + 折叠诊断 |

结论：项目为**已有可运行实现**，第一轮 `design.md` 第 1.0 节"空目录"的描述已过期；本轮必须在现有实现上增量改造，不得重建。

## 4. 设计核心决策摘要

### 4.1 与现有架构的关系

- 复用：五类只读采集、稳定 `elementId`、`domPath + textHash` 定位、Range 行框高亮、幂等注入、单飞锁、超时、错误码、折叠诊断、构建与自测链。
- 扩展：采集输出新增可选 `segments`/`controls`；`EF_COLLECT.reason` 增加 `recheck`；`EF_HIGHLIGHT` 增加可选 `refs` 批量高亮；诊断字段扩展。
- 替换：卡片墙 → 对话界面；片段列表 → 1—3 句回答；`SessionStatus` → 会话/页面/步骤三套状态；`page-dirty` 清空 → 保留会话 + 引用失效 + 步骤待复核。
- 不重建：构建入口、注入链、采集链、定位链、权限矩阵均不变。

### 4.2 会话与响应

- 会话阶段：`greeting → reading → ready → composing → reviewing → read-blocked → ended`。
- 页面状态：`readable / rechecking / changed / unsupported / restricted`。
- 响应类型封闭四类：`direct-answer / clarify / next-step / cannot-answer`。
- 系统提示（页面变化、正在核对）使用独立 `SystemNotice`，不参与四类响应统计（K2-01）。
- 判定优先级：安全越界 > 任务切换 > 明确过程目标 > 上下文反馈 > 页面事实 > 省略指代 > 兜底澄清。

### 4.3 语义段与引用

- 标题候选：`heading` 全部；`paragraph` 长度 ≤30 且以 `：`/`:` 结尾。
- 正文归属：从标题后按 `order` 顺序收集，遇下一个标题候选 / 区域切换 / 容器前缀变化 / 列表结束即停；单段 ≤500 字。
- 引用锚点：标题锚点 + 正文锚点分别保留 `ElementRef`；原文必须是元素文本归一化后的精确子串。
- 批量高亮：一条回答可一次高亮标题与正文（最多 3 个目标），共用 4s TTL；单 `ref` 路径保持原行为。

### 4.4 对话引擎与模型边界

- `DialogueEngine.respond(request)` 为规则与模型共用的唯一契约；输出必须过同一 `ResponseValidator`。
- 本轮只有 `RuleDialogueEngine` 生效；`ModelDialogueEngine.status` 恒为 `not-configured`，不发起任何 `fetch`。
- 代理契约只写在文档中（端点、环境变量名、限额、审计、禁止字段）；扩展侧不持有密钥、不读环境变量（扩展无进程环境变量）。
- 未来启用需同时满足五条件并单独评审最小访问通道（附录 A-07）。

### 4.5 陪办

- 一次一步；每步六要素齐全（总目标/步骤目标/地址/已观察状态/目标控件/完成条件）。
- 完成条件六类：文本出现、元素出现、元素消失、地址变化、控件状态变化、用户确认；禁止定时器/滚动/焦点/输入值。
- 观测：`MutationObserver` 只回传变更计数与时间戳（不含文本）；防抖 600ms、复审最小间隔 1200ms、每步自动复审 ≤3 次。
- "我找不到"→重定位；"我点错了"→计划版本 +1；"换一个任务"→旧计划终止；跨域/iframe/登录/验证码/提交类一律说明限制。
- 建行申请页：复用 `resolveTextElement` 把输入框引用落到 label，只高亮标签，不聚焦、不输入、不读值。

### 4.6 UI 与隐私

- 主界面只有欢迎语、对话、输入框、发送；工作流按钮移入内联操作；技术字段只进折叠诊断。
- 三层过滤：采集层（不读 value/排除 password）、展示层（纯文本）、出站层（allowlist + 敏感检测 + 地址脱敏）。
- 权限保持四项；不新增 `host_permissions`/`<all_urls>`/麦克风/模型主机权限。

### 4.7 验收

- 自动化用例按 AT-01—AT-26 落到具体模块；`selftest.mjs` 增加导出，仍只使用合成文本。
- 人工验收按 E2E-01—E2E-15 与三站点矩阵执行；未执行项必须如实单列。

## 5. 规格冲突与设计裁决（本轮新增）

| 编号 | 裁决 |
|---|---|
| K2-01 | 四类响应封闭与系统提示冲突 → 系统提示用独立 `SystemNotice`，不参与响应类型统计 |
| K2-02 | 输入 ≤500 字 vs 目标持久化 ≤200 字 → 输入与内存目标 500，`storage` 截断 200 |
| K2-03 | 1—3 句 vs ≤180 字 → 双约束同时满足；超限先删解释性分句 |
| K2-04 | 语义段 ≤500 字 vs 单条采集 ≤300 字 → 段可合并多正文至 500；单元素截断时段标记 `truncated` |
| K2-05 | 标题候选含"冒号结尾短段落" → 新增可选 `titleCandidate`，不改 `ItemType` 枚举 |
| K2-06 | 高亮"约 4 秒" → 沿用现有 `HIGHLIGHT_TTL_MS=4000` |
| K2-07 | 模型"可启用条件" → 本轮五条件均不满足，固定关闭、零请求 |
| K2-08 | 语音"可选" → 本轮不实现真实识别，仅保留 `voiceState="disabled"` 字段，界面不显示可用麦克风 |
| K2-09 | 错误码可见性 → 主对话区禁止错误码，折叠诊断允许 |
| K2-10 | 跨域链接是否可点 → 本轮不渲染可点击链接，只给站点名与文字指引 |

## 6. 本阶段产出

- `.codeartsdoer/specs/easyflow_page_guide/iteration2-design.md`（1716 行，约 120 KB）
  - 一、需求与存量功能关系分析（含基线纠正、已实现/需扩展/需新增、存量详细分析、D-01—D-08、K2-01—K2-10）
  - 二、增量设计方案（2.1 实现模型、2.2 接口设计、2.3 数据模型、2.4 语义段算法、2.5 意图与回答、2.6 多步陪办、2.7 聊天 UI、2.8 隐私安全、2.9 三站点验收矩阵、2.10 测试与人工验收、2.11 迁移与文件改动预估、2.12 风险、2.13 与第一轮差异、2.14 明确不做）
- `codearts_proof/09-iteration2-design-phase.md`（本文件）

## 7. 本阶段未修改的文件

- `src/**`、`public/**`、`scripts/**`、`dist/**`
- `README.md`、`package.json`、`tsconfig.json`
- 既有 `spec.md`、`design.md`、`tasks.md`

## 8. 未执行事项（如实声明）

以下项目本阶段均**未执行**，不声称通过：

1. `npm run typecheck`
2. `npm run selftest`
3. `npm run build`
4. `npm run verify`
5. 在 Chrome 中加载 `dist/`
6. 三个真实站点的人工验收与 DOM 读取（BJ-01—BJ-06、CCB-01—CCB-11、E2E-01—E2E-15）
7. 语义段算法在真实页面上的边界验证
8. 批量高亮改造的回归验证
9. 语音能力实测（本轮不实施）
10. 在线模型模式实测（当前无配置、无通道）
11. 性能实测（首屏、采集、语义段、首响、复审、高亮）
12. 截图产出

## 9. 已知限制与风险（设计阶段）

1. 语义段边界依赖 `domPath` 容器前缀推断，复杂布局可能误判；失败时按"无依据"处理，不编造。
2. 规则演示语义泛化有限，换问法可能答不上；以"有依据才答、无依据明说"为验收口径。
3. 观测只能知道"页面有变化"，不能知道"用户做了什么"；无关变化不会推进步骤，但可能触发一次"正在核对"。
4. 批量高亮改变现有"全局单 overlay"假设，需在实现阶段重点回归单 `ref` 路径。
5. `activeTab` 切换/跨源失效属浏览器安全模型，只能如实说明并引导重新点图标。
6. iframe（含同源）、地图、附件正文、登录后内容、验证码后内容不可读。
7. 建行页面可能存在反自动化、地图加载差异或登录要求，不可读时如实说明。
8. 在线模型仅存在契约与校验位置，未接入、未启用、未验证。
9. 语音仅保留字段与禁用态，未实现识别。

## 10. 下一步

1. 等待用户审阅 `iteration2-design.md` 并确认或提出修改；
2. 用户确认后，再进入编码任务规划（`tasks`）；
3. 设计未确认前不修改实现代码、不运行构建。