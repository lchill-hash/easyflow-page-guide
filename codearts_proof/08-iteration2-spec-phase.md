# 08 — 第二轮需求规格阶段留痕（对话式陪办迭代）

## 1. 阶段目标与边界

本轮用户要求在现有 EasyFlow Chrome 扩展上做一次重大功能迭代，把“输入目标 → 分析当前页 → 卡片 → 查看原文”的工具型流程，改为“一个聊天界面，用户说一句话，助手主动回答、追问或逐步陪办”。

本阶段只做需求规格设计：

- 生成 `.codeartsdoer/specs/easyflow_page_guide/iteration2-spec.md`；
- 追加本留痕；
- **未修改任何实现代码**；
- **未运行 `npm run build`、`npm run selftest`、`npm run verify`**；
- **未在 Chrome 或三个真实站点执行人工验收**；
- 不声称任何构建、自测、人工验收已通过。

## 2. 本阶段读取的输入

### 2.1 既有规格与设计

- `.codeartsdoer/specs/easyflow_page_guide/spec.md`
- `.codeartsdoer/specs/easyflow_page_guide/design.md`
- `.codeartsdoer/specs/easyflow_page_guide/tasks.md`

### 2.2 既有留痕

- `codearts_proof/01-spec-phase.md`
- `codearts_proof/02-design-phase.md`
- `codearts_proof/03-tasks-phase.md`
- `codearts_proof/04-impl-phase.md`
- `codearts_proof/05-e003-fix.md`
- `codearts_proof/06-highlight-range.md`
- `codearts_proof/07-highlight-pulse.md`

### 2.3 现有实现与文档

- `src/background/**`：`index.ts`、`injector.ts`、`router.ts`、`tabContext.ts`
- `src/content/**`：`collect.ts`、`entry.ts`、`highlight.ts`、`normalize.ts`、`registry.ts`
- `src/sidepanel/**`：`App.tsx`、`components/**`、`diagnostics/RunLog.tsx`、`hooks/usePageSession.ts`、`match/**`、`state/**`
- `src/shared/**`：`types.ts`、`messages.ts`、`errors.ts`、`constants.ts`、`domPath.ts`
- `scripts/build.mjs`、`scripts/selftest.mjs`、`scripts/verify-manifest.mjs`
- `public/manifest.json`、`README.md`、`package.json`

## 3. 环境与基线核查（真实执行）

### 3.1 Git

命令：

```powershell
git status --short
Test-Path .git
```

实际结果：

```text
git : 无法将“git”项识别为 cmdlet、函数、脚本文件或可运行程序的名称。
请检查名称的拼写，如果包括路径，请确保路径正确，然后再试一次。
GIT_EXIT=（空）
False
```

结论：

- 本机 `git` 命令不可用；
- 项目根目录不存在 `.git`；
- 本项目不是已初始化 Git 仓库；
- 本阶段留痕不包含 `git diff`、`git status` 或提交记录。

### 3.2 运行时模型、密钥与远程请求

命令与检索：

```text
grep: src/**/*.{ts,tsx} 中 fetch( | XMLHttpRequest | WebSocket | sendBeacon | apiKey | API_KEY | Authorization
结果：No files found
```

```text
Get-ChildItem -Force -Filter '.env*'
结果：无匹配文件
```

结论：

- 当前 `src` 中没有任何远程请求、模型 SDK、API Key 或鉴权头；
- 项目根目录没有 `.env` 或等价密钥配置；
- 当前不存在可用的运行时模型 API；
- 规格与界面只能使用“规则演示”，不得声称已接入模型。

### 3.3 清单与权限

`public/manifest.json` 实际权限：

```json
["activeTab", "scripting", "sidePanel", "storage"]
```

未发现 `host_permissions`、`<all_urls>`、静态 `content_scripts`。

结论：

- 本轮继续使用最小权限；
- 不能直接访问任意远程模型端点；
- 跨域页面不能由扩展自动操作；
- 若未来启用在线模型，需要另行确认本地代理与最小访问通道（见规格附录 A）。

### 3.4 现有实现能力与界面

已确认：

- 采集覆盖标题、段落、链接、按钮、输入框标签；
- 元素注册提供会话内稳定 `elementId`，定位使用 `elementId` + `domPath` + `textHash` 降级校验；
- 高亮使用 Range 行框 + Shadow DOM 叠加层，约 4 秒清理；
- 规则匹配为本地 n-gram + 同义词 + 阈值 + 去重；
- 侧边栏仍为“目标输入 + 分析当前页 + 重新读取页面 + 卡片 + 查看原文”；
- 侧边栏关闭重开会重新采集；页面切换会广播“页面已变化”。

本阶段未在真实站点读取 DOM，未验证三个站点的实际控件结构。

## 4. 本轮规格的核心决策

### 4.1 交互模型

- 主界面只保留欢迎语、对话记录、输入框、发送按钮；
- 打开侧边栏自动读取当前页，不要求用户点击“重新读取页面”；
- 读取失败在聊天中说明原因并提供“重试”；
- 网页切换保留聊天记录，但当前步骤标记“待复核”，复审完成前不得给下一步；
- 关闭侧边栏即结束会话，不持久化页面正文、引用与聊天记录；仅保留用户目标文本。

### 4.2 响应逻辑

- 响应类型封闭为四类：直接回答、澄清、下一步、无法回答；
- 规则模式判定优先级：安全越界 > 任务切换 > 明确过程目标 > 上下文反馈 > 页面事实 > 上下文省略/指代 > 兜底澄清；
- 直接回答 1—3 句，不以片段列表代替；每个事实必须有当前页语义段支持；
- 无依据必须说“当前页面没有找到这项信息”，禁止用常识补政策内容或网点结果；
- 上下文追问（“那需要带什么”）必须继承最近目标，不重复询问。

### 4.3 语义段与引用

- 标题候选（标题元素或以冒号结尾的短段落）与其后紧随正文合并为语义段；
- 标题后存在正文时，禁止把标题单独作为事实依据；
- 引用必须含当前快照中存在的 `elementId`，原文必须是元素文本精确子串；
- 引用覆盖标题与正文时分别保留可定位引用，高亮复用现有 Range 能力；
- 回答下方只显示一条折叠“网页依据”，展开后显示原文与“在网页中查看”。

### 4.4 陪办

- 一次只给一个下一步，消息内嵌“指给我看”；
- 每步记录总目标、步骤目标、当前地址、已观察页面状态、目标控件、依据、完成条件；
- 完成判定只允许页面可观察信号或用户显式确认；禁止定时器、滚动、焦点变化、输入值变化；
- 用户点“我已完成”但页面无变化时，标记“用户确认（未页面校验）”，不得声称页面已验证；
- “我找不到”重新定位；“我点错了”基于当前页重规划；“换一个任务”终止旧计划；
- 跨域只说明限制，不自动跳转；iframe/地图不可读时如实说明；
- 建行申请页只指向字段标签与解释文字，不读 `input.value`，不代填、不勾选、不提交、不处理验证码。

### 4.5 对话引擎与模型

- 规则实现与可选模型实现共用同一输入输出契约与校验规则；
- 引擎输入只含筛选后的公开语义段、控件标签与类型、脱敏地址、用户话语与会话摘要；
- 输出必须为四类之一，并携带引用、目标控件、完成条件、澄清或限制说明；
- 引用元素、原文、事实关键词、控件类型、完成条件任一校验失败，整条拒绝，不得部分展示；
- 当前无运行时模型 API，默认规则演示；
- 不硬编码密钥；若未来接入，密钥只在本地代理环境变量，扩展只调用代理；
- 禁止向模型发送 HTML、`input.value`、姓名、证件号、手机号、验证码、密码、完整页面内容。

### 4.6 语音

- 用户主动按住/点击麦克风才识别一次，不持续监听；
- 识别文本先入输入框，用户确认后才发送；
- 不支持/失败时文字输入照常；
- 不保存音频，不把识别文本写日志；
- 本轮默认不启用真实识别，是否实施待用户确认。

### 4.7 验收

- 自动化测试项 AT-01—AT-26，覆盖直接回答有依据、连续追问、网页变化不误判完成、敏感 `input.value` 不进入快照/日志/模型请求；
- 人工验收项 E2E-01—E2E-15，覆盖三个真实站点；
- 三站点矩阵：北京石景山高龄津贴（信息问答 + 来源定位）、建行网点查询（地区 → 网点类型 → 搜索/结果）、建行借记卡申请页（只读边界）；
- 所有未执行项必须如实记录，不得声称通过。

## 5. 本阶段产出文件

- `.codeartsdoer/specs/easyflow_page_guide/iteration2-spec.md`
- `codearts_proof/08-iteration2-spec-phase.md`（本文件）

未修改：

- `src/**`
- `public/**`
- `scripts/**`
- `README.md`
- `package.json`
- `dist/**`

## 6. 未执行事项（如实声明）

以下项目本阶段均**未执行**，不声称通过：

1. `npm run build`
2. `npm run selftest`
3. `npm run verify`
4. 在 Chrome 中加载 `dist/`
5. 三个真实站点的人工验收（BJ-01—BJ-06、CCB-01—CCB-11、E2E-01—E2E-15）
6. 真实站点的 DOM 读取、控件定位、iframe/地图可读性确认
7. 语音能力实测
8. 在线模型模式实测（当前无配置）
9. 性能实测
10. 截图产出

## 7. 已知限制与风险（本阶段）

1. 当前没有运行时模型 API，规格中的在线模型模式只是可选适配层设计，未实现、未启用、未验证。
2. 语音是否本轮实施未确定；规格按“默认不启用真实识别、必须满足主动触发与确认后发送边界”编写。
3. 三个站点未执行真实 DOM 读取；步骤与控件名称必须以运行时实际可见内容为准，规格未固化站点结构。
4. `activeTab` 切换标签页/跨源导航后通常需要重新点击扩展图标；跨域流程只能说明，不能自动跳转。
5. iframe、地图、登录、验证码、支付、附件正文均不在本轮可读/可操作范围。
6. 规则演示的语义泛化能力有限；换问法可能无法回答，必须以“有依据才答、无依据明说”为准。
7. 建行页面可能存在反自动化、地区限制或地图加载差异；无法读取时必须如实说明。
8. 会话跨侧边栏关闭的恢复策略已建议“关闭即结束”，尚待用户确认。
9. 主界面是否完全移除常驻读取按钮、跨域是否允许展示可点击文字链接，尚待用户确认。

## 8. 下一步

1. 等待用户审阅 `iteration2-spec.md` 并确认或提出修改；
2. 用户确认后，再进入实现方案（design）与编码任务规划（tasks）；
3. 规格未确认前不修改实现代码、不运行构建。