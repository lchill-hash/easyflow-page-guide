# EasyFlow 校赛第一轮 — 编码任务规划阶段留痕

## 1. 阶段输入

| 输入 | 路径 | 读取结果 |
|---|---|---|
| 需求规格 | `.codeartsdoer/specs/easyflow_page_guide/spec.md` | 已完整读取（502 行，6 章：组件定位、领域术语、角色与边界、DFX 约束、核心能力、数据约束） |
| 实现方案 | `.codeartsdoer/specs/easyflow_page_guide/design.md` | 已完整读取（937 行，一、需求与存量功能关系分析；二、增量设计方案 2.1～2.12） |
| 需求阶段留痕 | `codearts_proof/01-spec-phase.md` | 已完整读取（110 行，含决策记录、编码前设计、验收步骤、未执行声明） |
| 设计阶段留痕 | `codearts_proof/02-design-phase.md` | 已完整读取（109 行，含 D-01～D-12 决策、K-01～K-05 冲突裁决、下一阶段约束） |

结论：任务分解以 `spec.md` 的 5.1～5.7 能力条目与 `design.md` 的 2.1～2.12 设计条目为唯一依据，未凭空拆分。

## 2. 阶段产出

| 文件 | 内容 | 规模 |
|---|---|---|
| `.codeartsdoer/specs/easyflow_page_guide/tasks.md` | 12 个任务组、51 个子任务、267 个可勾选检查项 | 465 行 |
| `codearts_proof/03-tasks-phase.md` | 本文件 | — |

## 3. 任务分解结构

| 任务组 | 名称 | 依赖 | 覆盖需求 |
|---|---|---|---|
| 1 | 项目脚手架与构建基线（`package.json`、`tsconfig.json`、`build.mjs`、`gen-icons.mjs`、`verify-manifest.mjs`、`npm install`） | 无 | 4.4.4、4.5.2、5.7.1、5.7.2 |
| 2 | 共享契约层（`types`、`messages`、`errors`、`constants`、`domPath`） | 1 | 4.5.4、6.1、6.2、6.5 |
| 3 | 清单与静态页面（MV3 四项权限、无 `host_permissions`、无静态 `content_scripts`、`sidepanel.html`） | 1、2 | 1.4.5、4.3.1、5.1.1、5.7.1 |
| 4 | 页面采集（选择器矩阵、可见性、归一化、WeakMap 元素 ID、domPath/textHash、预算） | 2 | 5.2、6.1、6.2 |
| 5 | 定位与高亮（四级降级 + Shadow DOM 叠加层 + 3s 生命周期 + 只读约束） | 4 | 5.4、4.3.3、4.3.5 |
| 6 | 后台编排（`tabContext`、`injector`、`router`、`index`、事件广播） | 2、3 | 1.2.1 平台契约、5.1.3、5.5.1.4 |
| 7 | 规则匹配层（`lexicon`、`ruleMatcher`、`summarize`） | 2 | 5.3、5.6、6.3、6.4 |
| 8 | 侧边栏 UI（EasyFlow 标识、域名/标题、目标输入、分析/重新读取、规则演示模式徽标、卡片、错误与无依据状态） | 2、6、7 | 5.1.1、5.3.1.7、5.6.1、4.4.1 |
| 9 | 自动化验证（`selftest.mjs`、typecheck、build、只读与无远程依赖门禁） | 1～8 | 4.1、4.2、5.7.3 |
| 10 | Chrome 人工端到端验收（E2E-01～E2E-15、性能实测） | 9 | 5.7.1、4.1、4.2 |
| 11 | 文档与阶段留痕（README、`03-impl-phase.md`、未执行项声明） | 9、10 | 4.4.5、5.7.4 |
| 12 | 最终复核与交付 | 全量 | 4.3、4.4.1、5.6.1 |

关键顺序约束：
1. 任务组 2 必须先于 4/5/6/7/8，因为它是跨消息边界的唯一类型来源。
2. 任务组 4 与 5 内部为 `normalize` → `collect`/`registry` → `entry` → `highlight`，`highlight` 依赖 `registry` 的 `lookup`。
3. 任务组 8 必须在 6、7 的接口签名稳定后进入联调，否则会产生返工。
4. 任务组 9 的三个门禁为串行：`selftest` → `typecheck` → `build`（`build` 内部已含 `typecheck` 与 `verify`）。

## 4. 写作约束落实

| 约束 | 落实方式 | 校验结果 |
|---|---|---|
| 两层结构，主任务与子任务 | `## 1.`～`## 12.` + `### x.y` | 13 个 `## `（含"执行顺序总览"）、51 个 `### ` |
| 顺序编号不重复 | 主任务 1～12、子任务 x.1～x.8 | 编号连续，无重复 |
| 全部任务可勾选 | `- [ ]` 前缀 | 267 个勾选项 |
| 每步有可验证方式 | 子任务末项统一为"验证：…" | 51 个子任务中 45 个含独立验证项，其余由所属任务组的收口项覆盖（1.5/3.3/9.3/10.5/12.x） |
| 标注文件路径 | 每条涉及文件的子任务均带 `src/…`、`scripts/…`、`public/…`、`dist/…` 路径 | 人工通读确认 |
| 不写死第三方站点政策内容 | 任务中只出现站点域名与"主验收页（spec 5.1.1.3 指定站点）"，无条文、材料、流程、电话 | 见第 5 节检索 |
| 规则演示模式不得表述为 AI | 8.4 明确禁用 `AI`/`模型`/`大模型`/`智能体`/`推理`；9.4、11.1、12.1 设检索门禁 | 见第 5 节检索 |

## 5. 本阶段实际执行的命令与结果

| 序号 | 命令 | 实际结果 |
|---|---|---|
| 1 | Read `spec.md` | 成功，502 行 |
| 2 | Read `design.md`（offset 1） | 成功，正文至 792 行 |
| 3 | Read `design.md`（offset 793） | 成功，793～937 行，读到 2.11 风险与 2.12 差异 |
| 4 | Read `codearts_proof/01-spec-phase.md` | 成功，110 行 |
| 5 | Read `codearts_proof/02-design-phase.md` | 成功，109 行 |
| 6 | `Get-ChildItem -Force . ; Get-ChildItem .codeartsdoer\specs\easyflow_page_guide ; Get-ChildItem codearts_proof` | 根目录仅 `.codeartsdoer`、`codearts_proof`；specs 目录含 `design.md`、`spec.md`；proof 目录含 `01-spec-phase.md`、`02-design-phase.md` |
| 7 | `(Get-Content spec.md).Count; (Get-Content design.md).Count; Test-Path package.json; Test-Path src; Test-Path public; Test-Path dist` | `502` / `937` / `False` / `False` / `False` / `False` |
| 8 | Write `.codeartsdoer/specs/easyflow_page_guide/tasks.md` | 成功，465 行 |
| 9 | `node -e` 结构统计（行数、`## `、`### `、`- [ ]`） | `splitLF 465`、`groups 13`、`sub 51`、`checks 267` |
| 10 | `Select-String tasks.md -Pattern '写作指导\|正确示例\|错误示例'` | 无命中（无模板指导残留） |
| 11 | `Select-String tasks.md -Pattern 'AI\|大模型\|智能体\|模型规划'` | 14 处命中，全部为"禁用表述/检索门禁/复核规则"语境（位于 8.4、9.4、11.1、12.1），无一处把规则演示模式表述为 AI 能力 |
| 12 | Write `codearts_proof/03-tasks-phase.md` | 成功（本文件） |

说明：第 9 项首次使用的正则统计受 PowerShell 引号转义影响，返回了错误的行数；改用 `String.fromCharCode(10)` 分割后得到上表结果，`Get-Content ... .Count` 的 465 行与之互相印证。

## 6. 覆盖度自查

| spec 能力条目 | 对应任务组 | 是否覆盖 |
|---|---|---|
| 5.1 侧边栏唤起（含 5.1.3 三种异常） | 3.2、6.4、6.1、8.2、8.3、10.2、10.4 | 是 |
| 5.2 页面可见内容采集（含三类异常） | 4.1～4.4、10.4、10.5 | 是 |
| 5.3 目标匹配与依据卡片（含三类异常） | 7.1～7.3、8.5、9.1、10.2 | 是 |
| 5.4 依据定位与高亮（含两类异常） | 5.1、5.2、8.5、10.3 | 是 |
| 5.5 重新读取与页面切换（含两类异常） | 8.1、8.2、6.5、10.4 | 是 |
| 5.6 无依据与信息真实性 | 7.2、8.5、9.1、10.3 | 是 |
| 5.7 交付与验收留痕 | 1.6、9.3、10.1～10.5、11.1～11.3 | 是 |
| 4.1 性能 | 8.2、10.5 | 是 |
| 4.2 可靠性 | 5.1、8.1、8.2、10.4 | 是 |
| 4.3 安全性 | 3.1、4.3、5.2、9.4、12.2 | 是 |
| 4.4 可维护性 | 2.4、7.1、8.6、11.1 | 是 |
| 4.5 兼容性 | 1.2、1.4、3.1 | 是 |
| 数据约束 6.1～6.5 | 2.1、2.4、4.3、7.2、8.1 | 是 |

## 7. 未执行事项（如实声明）

以下事项属于编码实施阶段，本阶段**均未执行**，不记录任何成功结论：

- `npm install`：**尚未执行**（项目仍无 `package.json`）
- `npm run typecheck`、`npm run selftest`、`npm run build`、`npm run verify`：**尚未执行**
- Chrome 加载 `dist/` 与 E2E-01～E2E-15 人工验收：**尚未执行**
- 性能实测（首屏 1.5s、采集 1s、匹配 1s、高亮 500ms）：**尚未执行**
- 验收页真实 DOM 结构与"正文是否位于 iframe"的核对：**尚未执行**（`design.md` R-06 已列入编码阶段实测项）

## 8. 下一阶段入口

编码阶段按 `tasks.md` 的任务组 1→12 顺序推进，硬性要求：

1. 任务组 1.6 与 9.3 必须真实执行 `npm install` 与 `npm run build`，完整输出写入 `codearts_proof/03-impl-phase.md`；失败必须修复后复测，保留两次输出。
2. 清单权限严格为 `activeTab / scripting / sidePanel / storage`；不得出现 `host_permissions`、`content_scripts`、`<all_urls>`。
3. 源码、测试样例、README 不得内置验收页政策原文；界面常驻"规则演示模式"，禁止 AI/模型/智能体规划表述。
4. 采集与高亮对页面只读；高亮仅新增 1 个 Shadow DOM 宿主并在 3s 后移除，E2E-07 需留节点对比记录。
5. 交付前完成 T-01～T-10 与 E2E-01～E2E-15，性能实测值以"场景 | 实测 | 阈值 | 结论"表格填入 03 留痕。