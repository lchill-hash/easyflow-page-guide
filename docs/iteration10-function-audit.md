# 功能建议翻译官 — 八项能力审计（2026-11-16）

> 只读审计，不实现缺失项。状态口径：**已有** = 主链路可用且有代码路径；**部分实现** = 有基础能力但缺少完整体验或边界；**未实现** = 无对应代码/数据。

| 功能 | 状态 | 代码证据（文件:函数/行） | 能力与边界 | 用户价值 | 风险 | 优先级 | 下一步建议 |
|---|---|---|---|---|---|---|---|
| 智能聚光灯 | 已有 | `src/content/highlight.ts` `highlightRef`；`src/content/highlightRound.ts`；`src/sidepanel/components/chat/StepCard.tsx` 当前卡“指给我看” | 文字范围高亮、单轮强调/静态/TTL、滚动只更新位置、关怀/减动效静态；不改原节点、不挡点击 | 快速找到当前操作位置 | 真实视觉曾持续闪烁，计数诊断刚接入，视觉待验 | P0 | 先完成真实 Chrome 6 秒验收；若仍闪，按 `overlayLiveMax/cleanupFiredCount` 分支修 |
| 任务进度 | 部分实现 | `src/sidepanel/guide/stepPlanner.ts` `createPlan/advancePlan/currentStep`；`src/sidepanel/components/chat/StepCard.tsx` | 有计划步骤与 `currentIndex`，但 UI 只显示“当前步骤”，无总步数/完成比例/时间线 | 让长者知道“还剩几步” | 进度展示过多会挤占首屏 | P1 | 后续加轻量“第 N/M 步”文本，不新增流程 |
| 错误纠偏 | 部分实现 | `src/sidepanel/hooks/useConversation.ts` `notFound/misclicked/handleRecheck`；`src/sidepanel/guide/stepPlanner.ts` `reconcileBookingPlan`；`src/sidepanel/guide/completion.ts` | 有“我找不到/我点错了/我已完成”、目标失效重规划、完成核验；无独立“纠错后回退到上一步/恢复之前选择” | 目标变化时不被错指引 | 误判可能导致重复规划 | P1 | 后续补“取消当前指引并恢复上一步”单按钮 |
| 有限代操作 | 部分实现（仅只读辅助） | `src/content/highlight.ts`；`src/sidepanel/App.tsx` 无自动点击；`useConversation` 只发送指令与高亮 | 只高亮/指路，不代填、不点击、不提交、不读取输入值；属于“有限辅助”而非代操作 | 降低操作风险 | 用户可能误以为扩展会自动办理 | P0（边界） | 保持边界；在说明/首屏明确“不代填不提交” |
| 长者模式 | 已有 | `src/sidepanel/hooks/useUiMode.ts`；`sidepanel.css` care tokens（18/22/44/48、3px 焦点） | 顶部开关、偏好存储、字号/触控/对比度、静态高亮 | 长者首屏可读可点 | 真实 Chrome 200% 布局仍需人工验收 | P1 | 完成普通/关怀/400px/200% 截图验收 |
| 办事条件预检查 | 未实现 | `RuleEngine.ts` 仅页面事实问答；无 eligibility 规则/资料清单校验；`collect` 只读页面 | 不具备“根据用户情况判断是否符合条件”的能力 | 减少白跑 | 误判政策风险高 | P2 | 先做“仅引用页面条件原文 + 让用户自行对照”，不做资格结论 |
| 回答溯源 | 已有 | `src/shared/types.ts` `CitationAnchor`；`src/sidepanel/dialogue/validate/validator.ts` 引用/数字校验；`EvidencePanel.tsx` 折叠依据 | 回答必须引用当前页 item，数字需在引用中；可“在网页中查看” | 建立信任、可核对 | 页面变化后引用会 stale | P0 | 保持；模型回答失败一律回退本地 |
| 任务收藏 | 未实现 | 存储仅 `easyflow.goal`、`easyflow.ui.mode`、`easyflow.model.enabled`；无收藏 UI/键 | 无法保存任务/步骤 | 多次办事复用 | 需新增存储键与隐私说明 | P2 | 后续设计“收藏任务 + 恢复目标”，不存页面内容 |

## 本轮结论

- 本轮只做审计与 DeepSeek 收口，**不实现任务进度增强、纠偏回退、条件预检查、收藏**。
- P0：智能聚光灯真实视觉验收、有限代操作边界、回答溯源。
- P1：任务进度轻量展示、错误纠偏回退、长者模式视觉验收。
- P2：办事条件预检查（仅原文引用）、任务收藏。