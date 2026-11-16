# 11 — 第二轮对话式陪办实现与测试留痕

## 1. 阶段输入

- 需求规格：`.codeartsdoer/specs/easyflow_page_guide/iteration2-spec.md`
- 实现方案：`.codeartsdoer/specs/easyflow_page_guide/iteration2-design.md`
- 任务清单：`.codeartsdoer/specs/easyflow_page_guide/iteration2-tasks.md`
- 前序留痕：`codearts_proof/08-iteration2-spec-phase.md`、`09-iteration2-design-phase.md`、`10-iteration2-tasks-phase.md`
- 现有工程：`D:\hwproject\translator`，MV3 + TypeScript + React + esbuild

环境事实：

- Node.js 20.15.1、npm 10.7.0；
- `git` 命令在本机不可用，目录不是已初始化 Git 仓库；
- 本轮没有运行时模型端点、模型名或密钥配置；
- 未执行 Chrome 人工验收。

## 2. 实际完成的能力

### 2.1 统一聊天入口

- `App.tsx` 改为 `ChatHeader + ModeNotice + PageStatusLine + MessageList + ChatComposer + DiagnosticsPanel`。
- 主界面没有“分析当前页”“重新读取页面”“选择模式”等常驻工作流按钮。
- 首屏显示欢迎语与输入框，不等页面采集完成。
- 打开侧边栏自动 `EF_GET_CONTEXT + EF_COLLECT(initial)`。
- 读取失败在聊天里说明原因，并提供“重试”。

### 2.2 对话引擎

新增：

- `DialogueEngine` 接口与 `InvalidDialogueRequestError`；
- `classifyIntent` 七级优先级：安全边界 > 换任务 > 过程目标 > 上下文反馈 > 页面事实 > 省略指代 > 兜底澄清；
- `retrieveSegments` 段级检索；
- `composeAnswer` 从语义段正文取原句，生成 1—3 句、≤180 字回答；
- `validateResponse` 校验引用存在、原文子串、标题/正文角色、长度、数字事实覆盖、控件与完成条件；
- `RuleDialogueEngine` 规则实现；
- `ModelDialogueEngine` 占位，状态恒为 `not-configured`，零请求；
- 上下文继承：最近对象用于“那需要带什么”等追问；
- 安全边界：代填、代选、代提交、支付、删除、验证码、密码、身份证号/银行卡号会被拒绝。

### 2.3 语义段与依据

- `src/content/semantic.ts` 从已采集 `ElementItem[]` 生成“标题 + 紧随正文”语义段，不二次遍历 DOM。
- 标题候选：heading，或 ≤30 字且以冒号结尾的 paragraph。
- 段边界：下一标题、区域切换、`domPath` 容器前缀不共享、累计 500 字、最多 8 条正文。
- 标题与正文分别保留 `ElementRef`；回答引用标题锚点 + 正文锚点。
- 修正“只摘到‘办理条件：’标题”的问题：标题无正文时明确说明“后面没有具体说明”，不当作完整事实。
- 仍复用第一轮 Range 行框高亮，不重写高亮实现。

### 2.4 多步陪办

- `src/sidepanel/guide/stepPlanner.ts`：
  - 通用模板“选择地区 → 选择网点类型 → 点击查询”；
  - 按当前页已有安全控件裁剪；
  - `riskFlags` 命中提交/支付/删除/验证码/密码的控件不作为目标；
  - `relocate` 支持按 elementId、标签、同类控件与区域重定位；
  - `replan` 基于当前页生成新版本计划；
  - `advancePlan` 标记当前步完成并推进。
- `src/sidepanel/guide/completion.ts`：
  - 支持 `text-appears`、`element-appears`、`element-disappears`、`url-changed`、`control-state-changed`、`user-confirmed`；
  - 不以时间、滚动、焦点、输入值判定完成；
  - 无法自动确认时返回 `unconfirmed`；
  - 用户确认但页面无信号时返回 `done-user-unverified`。
- 聊天步骤卡内嵌“指给我看 / 我找不到 / 我点错了 / 我已完成 / 换一个任务”。

### 2.5 DOM 观测与复审

- `src/content/observe.ts` 使用 `MutationObserver` 只统计变更次数与时间，不读取文本、不写 DOM、不使用 `setInterval`。
- 600ms 防抖发送 `EF_WATCH_TICK`（不含正文）。
- 后台把 `EF_WATCH_TICK` 转发到侧边栏。
- 侧边栏按 1200ms 最小间隔、每步最多 3 次自动复审。
- 页面变化保留聊天、引用标记失效、当前步骤待复核。
- 复审前不推进下一步；复审无信号时恢复步骤为 current，并提示“我还不能确认”。

### 2.6 隐私与边界

- `src/shared/privacy/detect.ts` 检测身份证、手机号、银行卡号、验证码、邮箱、密码提示；命中不保留原文。
- `src/shared/privacy/redact.ts`：
  - URL 去掉 query/hash；
  - 文本替换敏感值为“手机号/证件号/银行卡号/验证码/邮箱/密码”；
  - 出站载荷限制分段数、字符数与控件数；
  - 检测 HTML、`value` 与敏感数据，命中即 `blocked`；
  - `PROXY_CONTRACT` 仅文档常量，不含真实端点或密钥。
- 用户消息命中敏感值时先脱敏再显示，不进入引擎。
- 不读取 `input.value`；输入框只读标签、aria 标签、placeholder、邻近标签。
- 不点击、不聚焦、不勾选、不提交、不处理验证码。
- 权限仍为四项，无 `all_urls`、无主机权限、无麦克风权限。

### 2.7 模型与语音口径

- 当前界面固定显示“本地规则演示，未接入在线模型”。
- `ModelDialogueEngine` 仅占位，零请求；扩展内无 API Key。
- 未来代理契约记录在 `PROXY_CONTRACT`，代理侧环境变量使用 `EASYFLOW_MODEL_SECRET` 等名称。
- 语音本轮为禁用态：输入框旁只显示“语音未开放”，不申请麦克风、不持续监听。

## 3. 实际修改文件

### 新增

- `src/shared/privacy/detect.ts`
- `src/shared/privacy/redact.ts`
- `src/content/semantic.ts`
- `src/content/controls.ts`
- `src/content/observe.ts`
- `src/sidepanel/dialogue/DialogueEngine.ts`
- `src/sidepanel/dialogue/intent/classifier.ts`
- `src/sidepanel/dialogue/retrieval/segmentRetriever.ts`
- `src/sidepanel/dialogue/answer/composer.ts`
- `src/sidepanel/dialogue/validate/validator.ts`
- `src/sidepanel/dialogue/rule/RuleEngine.ts`
- `src/sidepanel/dialogue/model/ModelEngine.ts`
- `src/sidepanel/guide/stepPlanner.ts`
- `src/sidepanel/guide/completion.ts`
- `src/sidepanel/state/conversationReducer.ts`
- `src/sidepanel/hooks/useConversation.ts`
- `src/sidepanel/components/chat/ChatHeader.tsx`
- `src/sidepanel/components/chat/PageStatusLine.tsx`
- `src/sidepanel/components/chat/MessageList.tsx`
- `src/sidepanel/components/chat/EvidencePanel.tsx`
- `src/sidepanel/components/chat/StepCard.tsx`
- `src/sidepanel/components/chat/ChatComposer.tsx`
- `src/sidepanel/components/chat/DiagnosticsPanel.tsx`

### 修改

- `src/shared/types.ts`
- `src/shared/constants.ts`
- `src/shared/messages.ts`
- `src/content/collect.ts`
- `src/content/entry.ts`
- `src/background/router.ts`
- `src/background/index.ts`
- `src/sidepanel/match/lexicon.ts`
- `src/sidepanel/App.tsx`
- `src/sidepanel/styles/sidepanel.css`
- `scripts/verify-manifest.mjs`
- `scripts/selftest.mjs`
- `README.md`
- `dist/`（重新构建）
- `codearts_proof/11-iteration2-impl-phase.md` 及本轮日志

### 未修改

- `public/manifest.json`（权限仍为四项）
- `src/content/highlight.ts`（复用第一轮 Range 行框高亮）
- `src/shared/errors.ts`（错误码语义不变）
- 第一轮 `GoalForm`/`CardList`/`Card` 文件保留但 `App.tsx` 不再引用，无双重界面入口

## 4. 实际执行的命令与结果

### 4.1 类型检查

多次执行，日志：

- `iteration2-typecheck-1.log`：0 error
- `iteration2-typecheck-2.log`：失败，模块相对路径层级错误
- `iteration2-typecheck-3.log`：0 error
- `iteration2-typecheck-4.log`：失败，`exactOptionalPropertyTypes` 与会话消息类型
- `iteration2-typecheck-5.log`：0 error
- `iteration2-typecheck-6.log`：0 error
- `iteration2-typecheck-7.log`：0 error

最终 `npm run build` 内含 `tsc --noEmit`，退出码 0。

修复问题：

- dialogue 子目录到 shared 的相对路径应为 `../../../shared`；
- `ConversationContextTurn.responseType` 可选值不能显式赋 `undefined`；
- `response.diagnostics.rejectReason` 赋值需先判断非 `undefined`；
- `advancePlan` 中下一项可能为 `undefined`，需先收窄。

### 4.2 自测

最终命令：

```powershell
npm run selftest
```

实际结果：

```text
SELFTEST_EXIT_CODE=0
# tests 20
# suites 0
# pass 20
# fail 0
```

20 项包括：

- 第一轮 T-03—T-10；
- 高亮行框合并回归；
- AT-01 直接回答有原文依据且可校验；
- AT-04 标题+正文语义段聚合；
- AT-05 连续追问使用上下文；
- AT-07 安全边界优先；
- AT-10/11 完成判定只认页面信号或用户确认；
- AT-13/14 陪办计划生成、重规划、推进；
- AT-16 页面切换保留消息、引用失效；
- AT-17/19 敏感值不进入脱敏出站、URL 去查询串；
- AT-21/22 模型未配置、非法引用拒绝；
- AT-25 申请页字段只读回答与定位。

日志：`codearts_proof/iteration2-selftest-final2.log`

### 4.3 构建

最终命令：

```powershell
npm run build
```

实际结果：

```text
BUILD_EXIT_CODE=0
```

构建链路包含 `tsc --noEmit`、esbuild 三入口、静态资源复制、`verify-manifest`。

最终产物：

```text
background.js      20742
content.js         42563
manifest.json        987
sidepanel.css      11429
sidepanel.html       370
sidepanel.js      199026
icons/icon16.png     111
icons/icon32.png     167
icons/icon48.png     209
icons/icon128.png    446
```

日志：`codearts_proof/iteration2-build-final3.log`

### 4.4 清单与门禁

单独执行：

```powershell
npm run verify
```

实际结果：

```text
VERIFY_EXIT_CODE=0
```

门禁包含：

- 权限恰为 `activeTab/scripting/sidePanel/storage`；
- 无 `host_permissions`、`content_scripts`、`web_accessible_resources`、`externally_connectable`；
- `dist/*.js` 与 `src/**/*.{ts,tsx}` 检索 `fetch(`、`XMLHttpRequest`、`sendBeacon`、`WebSocket`、`getUserMedia`、`MediaRecorder`、`SpeechRecognition`、`apiKey`、`API_KEY`、`Authorization`；
- `src` 检索 `host_permissions`、`<all_urls>`、`content_scripts`、`dangerouslySetInnerHTML`、`innerHTML`；
- `public/manifest.json` 同步检查；
- 产物存在且非空。

日志：`codearts_proof/iteration2-verify-final3.log`

## 5. 未执行事项（如实声明）

以下均**未执行**，不声称通过：

1. Chrome 中加载 `dist/` 的人工验收。
2. 石景山高龄津贴页的 BJ-01—BJ-06 实际问答与定位。
3. 建行网点查询页 CCB-01—CCB-07 的地区、网点类型、查询、结果与复审。
4. 建行借记卡申请页 CCB-08—CCB-11 的字段标签、拒绝代填、拒绝验证码。
5. 页面切换、同域导航、刷新后的真实复审。
6. iframe/地图、跨域、登录/验证码的真实站点限制验证。
7. 性能实测：首屏、自动读取、语义段、首响、高亮、复审。
8. 截图产出。
9. 语音识别（本轮设计为禁用态）。
10. 在线模型请求（无端点、无密钥、无代理）。
11. 标题+正文批量高亮的 UI 联动（`refs` 字段已预留，UI 本轮只用单条引用）。
12. AT-01—AT-26 全量覆盖；当前仅落地第 4.2 节列出的自动化用例。

## 6. 已知限制与残余风险

1. **规则匹配不是语义理解**：复述式问法可能命中不足；无依据时会坦诚说明。
2. **语义段依赖 `domPath` 前缀推断**：复杂布局可能把一个语义块拆开或误并。
3. **控件规划依赖运行时 DOM**：建行网点页真实控件标签若与通用词典差异较大，可能无法生成计划；不会编造步骤。
4. **输入值不读取**：地区/类型选择完成只能靠页面信号或用户“我已完成”，不会以“输入框有内容”判定。
5. **跨域**：只在无可用控件且页面出现“在线申请/去办理”等文字时给出文字限制；不做真实跨域检测与导航。
6. **iframe/地图**：只统计 `iframeCount` 并说明读不到，不进入 iframe。
7. **批量高亮**：消息协议保留 `refs` 可选字段，但 content/UI 本轮未启用多目标高亮。
8. **模型适配层**：仅为契约占位；缺少端点、模型名、授权方式、本机代理运行环境。
9. **语音**：未实现真实识别，无麦克风权限。
10. **未人工验收**：界面观感、真实站点语义段质量、步骤推进和定位均需 Chrome 实测。

## 7. 复测步骤

1. 打开 `chrome://extensions`，重新加载 EasyFlow；必要时移除后重新加载 `dist/`。
2. 打开石景山高龄津贴页，点击 EasyFlow 图标：
   - 输入“高龄津贴谁能申请”；
   - 看回答与折叠“网页依据”；
   - 追问“那需要带什么”；
   - 点击“在网页中查看”。
3. 打开建行网点查询页，点击图标：
   - 输入“第一次办借记卡，先找营业网点”；
   - 点击“指给我看”；
   - 自行选择地区/类型后点“我已完成”或等待复审；
   - 输入“我找不到”“我点错了”“换一个任务”。
4. 打开建行借记卡申请页，点击图标：
   - 输入“这个页面要填什么”“指给我看手机号那一栏”；
   - 输入“帮我填身份证号”“帮我勾选协议并提交”“验证码是多少”，确认被拒绝且无代操作。
5. 切换标签页/刷新，确认聊天保留、引用失效、步骤待复核。
6. 查看“运行诊断”，确认只含运行标识、耗时、条数、校验结论、拒绝原因与出站字节，不含页面正文和用户原话。

## 8. 交付结论

- 构建、清单门禁、20 项自测真实通过，退出码均为 0。
- 当前仍是本地规则演示，未接入在线模型；语音未开放。
- 真实站点人工验收未执行，不能据此声称三站点验收通过。
- 后续优先级：真实站点验收 → 语义段质量修正 → 步骤完成信号校准 → 批量高亮 → 语音/模型接入评审。