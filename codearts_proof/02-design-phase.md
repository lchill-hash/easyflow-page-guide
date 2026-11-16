# EasyFlow 校赛第一轮 — 实现方案（技术设计）阶段留痕

## 1. 阶段输入

| 输入 | 路径 | 读取结果 |
|---|---|---|
| 需求规格 | `.codeartsdoer/specs/easyflow_page_guide/spec.md` | 已完整读取（502 行，含 6 章：组件定位、领域术语、角色与边界、DFX 约束、核心能力、数据约束） |
| 上一阶段留痕 | `codearts_proof/01-spec-phase.md` | 已完整读取（110 行，含编码前设计、权限清单、验收步骤、未执行事项） |
| 项目目录 | `D:\hwproject\translator` | 仅 `.codeartsdoer/`、`codearts_proof/`；无 `package.json`、无 `src/`、无 `public/`、无 `dist/` |
| 项目规则 | `.codeartsdoer/rule/` | 仅 `metadata.properties`，无额外编码约束 |
| 用户补充约束 | 会话消息 | 延续 esbuild 三入口、最小权限、消息流、只读高亮、规则演示模式、第一轮不接模型 |

结论：代码基线为空，本次为**全新增量设计**；"存量"分析对象为 Chrome MV3 平台契约与 Node/npm 工具链。

## 2. 设计产出

| 文件 | 内容 | 行数 |
|---|---|---|
| `.codeartsdoer/specs/easyflow_page_guide/design.md` | 完整技术设计（一、需求与存量功能关系分析；二、增量设计方案） | 938 行（校验时统计） |

文档结构：

- 一、需求与存量功能关系分析
  - 1.0 分析前提（项目内存量为空 / 平台能力为外部存量）
  - 1.1 需求功能与存量功能对比（已实现 0 项、需要扩展 7 项、需要新增 19 项分 5 组）
  - 1.2 存量功能详细分析（Chrome 平台契约 6 条、工具链 4 条、规格冲突 K-01～K-05、约束 C-01～C-14）
- 二、增量设计方案
  - 2.1 实现模型（上下文视图 / 组件架构 / 目录结构 / 构建流程 / 会话状态机 / 分析活动图 / 扩展点 / 一致性）
  - 2.2 接口设计（3 层 8 个接口、稳定性与版本策略、前置/后置/异常映射/调用时序）
  - 2.3 数据模型（PageSnapshot / ElementItem / GuidanceCard / AnalysisRun / 诊断与引用模型、字段约束、序列化与版本）
  - 2.4 DOM 采集算法（五类选择器矩阵、可见性过滤、归一化/截断、区域判定、ID 稳定性、预算、性能、注入幂等）
  - 2.5 关键词匹配算法（目标校验、停用词+n-gram+同义词、打分公式、阈值、去重、数量裁决、摘要/片段生成、复杂度）
  - 2.6 定位与高亮（四级降级、Shadow DOM 叠加层、坐标与滚动跟随、3s 生命周期、时序图、禁止项）
  - 2.7 错误处理与权限边界（13 个错误码、权限矩阵、activeTab 授权时序、超时与单飞锁）
  - 2.8 安全与只读约束（威胁对策表、只读可验证方法、清单与 CSP）
  - 2.9 构建与交付（依赖与脚本、三入口参数、`dist/` 清单、manifest 字段、图标生成）
  - 2.10 验收与测试（自动化 T-01～T-10、人工 E2E-01～E2E-15、性能度量与留痕要求、README 章节）
  - 2.11 风险与限制（R-01～R-15）
  - 2.12 与上一阶段设计的差异与改进点（14 项）

## 3. 关键设计决策

| 编号 | 决策 | 理由 |
|---|---|---|
| D-01 | 构建改为 `scripts/build.mjs` + esbuild 三入口（background ESM / content IIFE / sidepanel ESM+CSS）+ `tsc --noEmit` 门禁 | content 世界不支持 ESM；Vite 需额外配置才能保证 IIFE 与多入口 HTML，esbuild 显式可控且产物更小 |
| D-02 | 权限调用集中于后台 Service Worker；侧边栏只发消息 | 权限调用点单一、错误映射一致、SW 生命周期与 UI 解耦、为第二轮模型调用留统一入口 |
| D-03 | 不申请 `tabs` 权限；域名/标题/URL 全部由 content 快照回传 | 最小权限（C-01），并规避 `tabs.query` 在无权限时省略 `url/title` 的差异 |
| D-04 | 侧边栏入口用 `setPanelBehavior({openPanelOnActionClick:true})`，并保留 `action.onClicked + sidePanel.open()` 兜底 | 同一用户手势内打开，避免 SW 冷启动丢失手势；兜底覆盖行为未生效的环境 |
| D-05 | 元素 ID 用 `WeakMap` 会话内稳定分配，定位采用 "内存引用 → domPath+textHash → 最近可见祖先 → stale" 四级降级 | 满足"两次采集 ID 一致"与"元素失效不误跳"，且不向页面写入任何标记属性 |
| D-06 | 摘要 = 原文关键词窗口切片（≤40 字），原文片段 = 归一化全文（≤240 字） | 从构造上保证"逐字摘自页面、不改写、不引入外部事实" |
| D-07 | 匹配 = 停用词切分 + 2/3/4 字 n-gram + 同义词组 + 区域权重 + 长度阻尼 + 绝对/相对阈值 + Jaccard/父子去重 | 本地纯函数、可复现、可单测；词库集中维护，第二轮整体替换为模型实现 |
| D-08 | 高亮 = Shadow DOM 宿主 + 绝对坐标 + 滚动跟随 + 3s 自动移除；不修改任何原有节点 | 满足"只叠加高亮层"、"移除后视觉恢复"、"页面 CSS 不干扰" |
| D-09 | 采集绝不读取 `input.value`、排除 `password`/`hidden` | 隐私最小化，避免读取用户已填内容 |
| D-10 | 第一轮不采集 iframe，只覆盖主文档 | 与 spec 5.2.1.6"主文档可见内容"一致；跨源 iframe 无法只读访问，列入限制 R-06 |
| D-11 | 图标由 `gen-icons.mjs` 构建期生成 PNG 到 `dist/icons/` | 清单 `icons` 不支持 SVG；避免依赖 `sharp`/`canvas` 与提交二进制占位 |
| D-12 | 匹配层以 `MatchStrategy` 接口隔离，第一轮 `RuleMatcher`（`mode="rule-demo"`） | 第一轮禁止模型表述（C-04）；第二轮可替换实现而不改 UI 与数据模型 |

## 4. 规格冲突裁决（需评审知晓）

| 编号 | 冲突 | 裁决 |
|---|---|---|
| K-01 | spec 5.3.3.3（命中 <3 展示实际片段）与 6.3.5（卡片数必须为 0 或 3–5） | 采用更具体的 5.3.3：命中 1–2 条时展示实际数量 + "仅找到少量相关片段"（状态 `partial`）；命中 0 条输出无依据；命中 ≥3 取前 5 |
| K-02 | 5.2.1.6 "跨框架与动态内容" | 第一轮只采主文档；动态内容以采集时刻为准，靠"重新读取"刷新 |
| K-03 | 4.1.1（首屏 1.5s）与 4.1.2（采集 1s） | 侧边栏先渲染骨架/标识/页面元信息，采集结果异步补全 |
| K-04 | 5.2.1.5 / 6.2.3 文本长度上限未给数值 | 采集单条 300 字符；卡片原文片段 240 字符；摘要 40 字符 |
| K-05 | 6.4.3 持久化范围 | 仅 `goal`（≤200 字符）入 `storage.local`；快照/卡片只存内存 |

## 5. 与 01-spec-phase 编码前设计的差异

1. 构建：`vite.config.ts` → `scripts/build.mjs` + esbuild 三入口。
2. 消息流：侧边栏 `tabs.query` / `scripting.executeScript` → 全部收敛到后台（侧边栏只发消息，仍由后台取 `tabId`、注入、超时与错误映射）。
3. 页面信息：不再依赖 `tabs.query` 的 `url/title`，改由快照回传（不申请 `tabs` 权限）。
4. 新增：注入幂等守卫 + PING 握手、元素 ID 双通道定位、打分/阈值/去重公式、摘要生成规则、13 个错误码、区域权重、单飞锁、图标生成、自测脚本、activeTab 跨源失效处理。
5. 权限清单：延续 `activeTab + scripting + sidePanel + storage`，继续不申请 `host_permissions`，不静态声明 `content_scripts`。
6. 验收步骤：延续 01-spec-phase 第 3.4 节 12 步，并扩展为 E2E-01～E2E-15（补充陈旧卡片、断网、可选首页、节点不变性对比）。

## 6. 本阶段实际执行的命令与结果

| 序号 | 操作 | 结果 |
|---|---|---|
| 1 | Read `spec.md`、`codearts_proof/01-spec-phase.md` | 均成功读取（502 行 / 110 行） |
| 2 | `Get-ChildItem -Force .` + `.codeartsdoer`、`.codeartsdoer\specs`、`codearts_proof` | 确认项目为空基线；`specs/easyflow_page_guide` 已存在，`codearts_proof` 仅 `01-spec-phase.md` |
| 3 | `Get-ChildItem -Recurse .codeartsdoer\rule` / `.codeartsdoer\skills` | 规则目录仅 `metadata.properties`，技能目录为空 |
| 4 | Write `design.md`（第 1 段：一、需求与存量功能关系分析） | 成功 |
| 5 | Edit 追加 `design.md`（2.1 实现模型 / 2.2 接口 / 2.3 数据模型） | 成功 |
| 6 | Edit 追加 `design.md`（2.4 采集 / 2.5 匹配 / 2.6 高亮） | 成功 |
| 7 | Edit 追加 `design.md`（2.7 错误与权限 / 2.8 安全 / 2.9 构建 / 2.10 验收 / 2.11 风险 / 2.12 差异） | 成功 |
| 8 | `Select-String` 校验标题结构与禁用表述（写作指导/大模型分析） | 标题层级完整（一、二两章 + 2.1～2.12 全部小节）；仅"常见错误"为正文业务用词（README 常见错误章节、C-12），无模板指导残留 |
| 9 | Edit 修正内部一致性问题（图标输出路径 `public/icons` → `dist/icons`、构建顺序、`storage` 权限口径、接口后置条件、R-06/R-08/R-11 措辞、错误分支计数） | 成功（7 处） |
| 10 | Write `codearts_proof/02-design-phase.md` | 成功（本文件） |

## 7. 未执行事项（如实声明）

- `npm install`：**尚未执行**（本阶段不创建 `package.json` / 不编码）
- `npm run build`、`npm run typecheck`、`npm run selftest`：**尚未执行**
- Chrome 扩展加载与 E2E 验收：**尚未执行**
- 验收页真实 DOM 结构核对（含正文是否位于 iframe）：**尚未执行**（编码阶段实测，用于确认 R-06 是否需要提前处理）

以上事项属于编码实施阶段，本文件不记录任何未经执行的构建或验收成功结论。

## 8. 下一阶段入口

设计已就绪，可进入任务分解与编码阶段。编码阶段必须遵守：

1. 先 `tsc --noEmit` 通过再打包；构建失败必须修复并复测，输出真实日志到 `codearts_proof/03-impl-phase.md`。
2. 清单权限严格为 `activeTab / scripting / sidePanel / storage`，不得出现 `host_permissions`、`content_scripts`、`<all_urls>`。
3. 源码与测试样例不得内置验收页政策原文；界面常驻"规则演示模式"，禁止 AI/模型/智能体规划表述。
4. 采集与高亮对页面只读；高亮仅新增 1 个 Shadow DOM 宿主并在 3s 后移除。
5. 交付前完成 T-01～T-10 与 E2E-01～E2E-15，性能实测值填入 03 留痕。