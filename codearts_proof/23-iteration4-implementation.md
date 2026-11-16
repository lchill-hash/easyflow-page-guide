# 23 — 第四轮实现：一句话当前步骤、操作收纳与长者关怀

> 依据：`.codeartsdoer/specs/easyflow_page_guide/iteration4-spec.md`、`iteration4-design.md`、`iteration4-tasks.md`。
>
> 自测与门禁通过；**真实 Chrome 侧栏截图、字号/对比度测量与 200% 缩放检查：人工验收待用户执行**。本轮未创建真实预约、未提交表单、未读取输入框值。

## 1. 本轮需求（码道）

1. 当前步骤卡首行用一句易懂短句；有明确目标时显示来自最新页面快照的动态时刻；长原始标签不整段出现在主句；详情折叠保留原文与完成条件；“指给我看”仍定位真实元素。
2. 主区只突出“指给我看”；“我找不到 / 我点错了 / 我已完成 / 换任务”收进默认折叠的“遇到问题 / 更多操作”；规则演示说明降级；诊断默认折叠；旧卡不呈现可操作状态；成功页只显示完成状态。
3. 顶部“普通 / 长者关怀”开关，偏好保存在现有 `storage`；关怀模式正文 18px、当前步骤 22px、主按钮 48px、可点目标 44px；窄侧栏与 200% 缩放可滚动、可达；关怀高亮稳态，`prefers-reduced-motion` 下无动画。

## 2. 修改文件

### 2.1 新增

| 文件 | 内容 |
|---|---|
| `src/shared/uiMode.ts` | `UiMode`、`normalizeUiMode`、`parseStoredUiMode`、`serializeUiMode`（仅 `v/mode/updatedAt`） |
| `src/sidepanel/hooks/useUiMode.ts` | 偏好读取/写入/切换、根 `data-ui-mode` 同步、`read-failed`/`write-failed` |
| `src/sidepanel/components/chat/stepCardCopy.ts` | `buildStepCardCopy`、`completionTextOf`、时刻/日期/时区 token、宽度估算、L0—L3 回退、`targetRef` 原样 |
| `src/sidepanel/components/chat/StepDetails.tsx` | 默认折叠“详细信息 / 网页依据”，保留原文、截断标注、完成条件、引用 |
| `src/sidepanel/components/chat/ModeToggle.tsx` | `role="switch"`、`aria-checked`、文字与滑块状态 |
| `src/sidepanel/components/chat/AboutPanel.tsx` | 默认折叠“说明”（规则演示事实 + 语音暂未开放小字，无按钮） |

### 2.2 修改

| 文件 | 改动 |
|---|---|
| `src/shared/constants.ts` | `CONTENT_VERSION 0.3.0`；`UI_MODE_STORAGE_KEY`、`UI_MODE_SCHEMA_VERSION`、短句阈值 |
| `src/shared/types.ts` | `PageControl.labelTruncated?` |
| `src/shared/messages.ts` | `HighlightRequest.mode?`、`ContentHighlightRequest.mode?` |
| `src/content/controls.ts` | 记录 `labelTruncated`（不扩 80 上限） |
| `src/content/highlight.ts` | care 粗边框/稳态底色；care/reduce 无脉冲；`highlightRef(ref, mode)`；care 下 `auto` 滚动 |
| `src/content/entry.ts` | 透传高亮 `mode` |
| `src/background/router.ts` | 仅合法 `mode` 透传到 content |
| `src/sidepanel/components/chat/stepCardModel.ts` | 新增 `stepCardLayout`；`shouldShowCompletion` 仅 current |
| `src/sidepanel/components/chat/StepCard.tsx` | 当前卡短句 + 唯一主按钮 + 详情 + 折叠更多操作；旧卡只留“已过期/已结束”状态行 |
| `src/sidepanel/components/chat/MessageList.tsx` | 当前卡展示源改为 `currentStep(plan)` + 最新快照；当前卡定向滚动；旧卡不再可操作 |
| `src/sidepanel/components/chat/EvidencePanel.tsx` | 抽出并复用 `CitationList` |
| `src/sidepanel/components/chat/ChatHeader.tsx` | 受控 header + `ModeToggle`；移除“规则演示”徽章 |
| `src/sidepanel/components/chat/ChatComposer.tsx` | 移除“语音未开放”禁用按钮；输入框增加 `aria-describedby` |
| `src/sidepanel/components/chat/DiagnosticsPanel.tsx` | 内联高度改为 `var(--ef-diag-max-h)`，保留内部滚动与默认折叠 |
| `src/sidepanel/App.tsx` | `useUiMode`、`activeStep`、移除顶部规则横幅、`AboutPanel`、传 `uiMode` 给对话 |
| `src/sidepanel/main.tsx`、`public/sidepanel.html` | 首帧 `data-ui-mode="normal"`、`data-mode-ready="false"` 双保险 |
| `src/sidepanel/hooks/useConversation.ts` | 接收 `uiMode`，高亮请求带 `mode` |
| `src/sidepanel/styles/sidepanel.css` | 两套 token、开关/详情/更多操作/说明/焦点样式、窄宽与 200% 布局、`prefers-reduced-motion` |
| `scripts/selftest.mjs` | AT-44 一处口径调整；新增 AT-46—AT-50；更新 AT-34 诊断高度断言 |
| `dist/` | 重新构建 |

### 2.3 未修改（按任务约束）

`src/content/collect.ts`、`semantic.ts`、`observe.ts`、`registry.ts`、`normalize.ts`；`stepPlanner.ts`；`completion.ts`；`bookingSuccess.ts`；`src/sidepanel/dialogue/**`；`conversationReducer.ts`；`manifest.json`；`build.mjs`；`verify-manifest.mjs`；前三轮文档。

## 3. 关键行为

1. **短句与动态时刻**：`copy` 只从 `currentStep(plan)` + 最新 `state.snapshot` 同 `ref` 控件生成；目标不可用或快照不匹配时回退通用句，不输出旧时刻；短句宽度按 24 阈值降级；多日期/多时区补最短限定或回退。
2. **原文与详情**：主句只显示短名称；`StepDetails` 内保留 `rawLabel`、截断标注、完成条件与引用；详情不渲染技术字段。
3. **唯一主操作**：当前卡主区仅“指给我看”，点击使用 `copy.targetRef`（与原 `ref` 同一对象）；其余 4 个动作在默认折叠区。
4. **旧卡与成功页**：`expired`/`ended` 不渲染目标、完成条件、详情或按钮；成功页所有卡“已结束”，只强调完成消息。
5. **模式**：默认 `normal`；开关切换即时、不重读页面；偏好写入 `easyflow.ui.mode`（仅 `v/mode/updatedAt`）；非法/读取失败回退 `normal`。
6. **样式**：`html[data-ui-mode="care"]` 驱动 18/22/48/44px 与对比度 token；窄宽单列；`prefers-reduced-motion` 关闭侧栏动画/过渡；高亮 care 稳态、无脉冲。

## 4. 门禁结果

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run typecheck` | 0 | 0 error |
| `npm run selftest` | 0 | **41 项通过**（AT-01—AT-50，含新增 AT-46—AT-50） |
| `npm run build` | 0 | `dist/` 产物齐全（sidepanel.js 242221 bytes） |
| `npm run verify` | 0 | 权限仍为 `activeTab / scripting / sidePanel / storage` |

日志：

- `codearts_proof/iteration4-typecheck.log`
- `codearts_proof/iteration4-selftest.log`
- `codearts_proof/iteration4-build.log`
- `codearts_proof/iteration4-verify.log`

测试侧说明：

- AT-44 仅将 `shouldShowCompletion("expired")` 由 `true` 收紧为 `false`（第四轮 R-57），其余断言保留；新增 `stepCardLayout` 断言。
- AT-34 的既有“诊断内联高度”断言从 `48vh` 更新为 `var(--ef-diag-max-h)`，与 I4-T9 的 CSS 变量改造一致。
- AT-37/38/39—45 全部保持通过。

## 5. 清洁检索

| 检索 | 结果 |
|---|---|
| `src/**/*.{ts,tsx}` 含 `02:00`/`02:15`/`03:00` | 0 hits（`iteration4-clean-clock.log`） |
| `src/**/*.{ts,tsx}` 真实站点域名 | 0 hits（`iteration4-clean-domain.log`） |
| `src/**/*.{ts,tsx}` 邮箱样式 | 0 hits（`iteration4-clean-email.log`） |
| `public/manifest.json` 权限 | `["activeTab","scripting","sidePanel","storage"]`（`iteration4-clean-manifest.log`） |
| CSS 含 `ef-voice-btn`/`ef-mode-notice` | AT-50 断言 0 命中 |
| 偏好存储字段 | AT-46 断言仅 `v/mode/updatedAt` |

## 6. 人工验收待用户执行

本机未打开真实 Chrome 侧栏，无法生成真实截图或测量对比度；**不得据此宣称“长者实测通过”**。待执行项：

1. 重新加载扩展，打开约 400px 宽侧栏；在普通模式截图：`iteration4-sidebar-normal.png`。
2. 点击顶部“长者关怀”，确认字号/按钮变大后截图：`iteration4-sidebar-care.png`。
3. 记录：
   - 正文：普通 13px / 关怀 18px；
   - 当前步骤：普通 15px / 关怀 22px；
   - 主按钮高度：普通 32px / 关怀 48px；
   - 可点目标：普通 28px / 关怀 44px；
   - 正文与背景对比度：目标 ≥4.5:1（`--ef-muted` 普通 `#4b5563`、关怀 `#374151`）；
   - 普通高亮 3 次、2—3 秒后稳态至 4 秒 TTL；关怀无脉冲；系统“减少动态”下两种模式无动画。
4. 200% 缩放：当前卡、“指给我看”、详情、更多操作、输入框、发送、诊断内部滚动均可达；无横向裁切。
5. 政府津贴问答：主句短、原文与完成条件在详情、网页依据可展开、“指给我看”定位真实元素。
6. Cal.com 日期→时段：主句含最新可用时刻，时段失效后旧时刻不残留；预约验收只用只读页面或虚构 fixture，**不提交新预约**。

## 7. 风险

| 风险 | 说明 / 缓解 |
|---|---|
| 短句模板覆盖不足 | 已回退通用句并保留主按钮；`fallbackReason` 可供后续诊断 |
| 关怀大字号布局 | 已加窄宽单列、固定区上限与内部滚动；需 200% 人工确认 |
| 高亮 care 观感 | 4px 粗边框 + 稳态底色；需真实页面人工确认 |
| 模式读取前短暂普通态 | 首帧 `normal` + `modeReady`，读取后最多切换一次；无过渡 |
| 真实截图未执行 | 明确“人工验收待用户执行”，不伪造、不虚报 |