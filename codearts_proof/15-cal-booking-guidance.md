# 15 — Cal.com 预约导办与日历阶段修复

> 验证性质：本轮通过的是“日历语义 fixture + 规则引擎”的回归，不等于 Cal.com 真实网站验收。未能采样 Cal.com 渲染后的真实日期/时间 DOM，真实 Chrome 人工验收仍由用户完成。

## 1. 现场诊断

目标页：

```text
https://cal.com/jsfour/15min?layout=mobile
```

只读取证结果：

1. `webfetch` 返回的 HTML 是 Cal.com 客户端外壳：
   - `<main class="flex ...">` 内没有服务端渲染的日期/时间控件；
   - 只有 `<noscript>` 中的活动摘要和客户端 bundle；
   - 没有日期按钮、时间按钮、disabled/selected 属性可采样。
2. `https://cal.com/jsfour/15min.md` 公开 agent 文档可读到：
   - Host: Jimi Smoot
   - Duration: 15 min
   - Location: Google Meet
   - 必填字段：name、email
   - 公开 slots 接口：`GET https://api.cal.com/v2/slots?...`，需要 `cal-api-version: 2024-09-04` 请求头。
3. 直接请求 slots 接口返回 404（缺少请求头；webfetch 不能设置该头）。
4. 本轮没有通过 Chrome 自动化采样用户当前页面的渲染 DOM。

### 现场证据缺口

**未获得**：

- Cal.com 真实渲染后的日期按钮 DOM；
- 一个真实可用日期和一个真实禁用日期；
- 选择日期后真实时间按钮的标签、角色、disabled/selected 状态；
- 真实可预约时间或当前无可用时间的结论。

因此本轮不在报告中声称“已在 Cal.com 实测通过”。实现为通用日历语义规则 + 合成日历 DOM fixture，真实站点由用户按第 9 节复测。

## 2. 代码问题

1. `PROCESS_VERBS` 缺少“预约/我想预约/先点哪里/一步一步”等表达；“哪里”让原句落到 `page-fact`，进入事实检索。
2. `createPlan` 只处理“地区、类型、查询”，没有日历预约阶段。
3. `PageControl` 没有保留 `disabled/selected/可访问名称/日历上下文`，无法区分可用/禁用日期与时间。
4. 没有“日期→时间→下一步/个人信息”复审重规划。
5. 页面更新后，单步导办计划完成会结束，不能继续生成时间步骤。

## 3. 修改计划与落实

### 3.1 控件元数据

文件：

- `src/shared/types.ts`
- `src/content/collect.ts`
- `src/content/controls.ts`

新增：

```text
ElementItem: accessibleName, disabled, selected, role, controlContext
PageControl: kind(date/time/next/form/generic), disabled, selected, context
ControlContext: calendar / time-list / form / unknown
```

采集只读：

- `aria-label` / `title` / 可见文本作为可访问名称；
- `disabled`、`aria-disabled`、`data-disabled`、`data-state=disabled`；
- `aria-selected`、`aria-pressed`、`aria-current`、`data-state=selected/checked/on`；
- 日历上下文：`[data-testid="day"]`、`calendar`、`date-picker`、`role=grid` 等；
- 时间上下文：`time`、`slot`、`role=listbox` 等；
- 表单上下文：`form`、`role=form` 等。

不读取 `input.value`，不读取姓名、邮箱、cookie、表单值。

### 3.2 意图

文件：`src/sidepanel/match/lexicon.ts`

新增办事表达：

```text
我想预约 / 我要预约 / 帮我预约 / 预约这个 / 预订这个 /
订个时间 / 约个时间 / 订一个时间 / 先点哪里 /
一步一步 / 一步步 / 带我预约 / 教我预约 / 怎么预约 / 如何预约
```

保留事实判断：

- “这项预约多少钱” → `page-fact`（“多少”）
- “这个会议什么时候” → `page-fact`（“什么”）
- “我想预约这个15分钟会议，请一步一步告诉我先点哪里” → `process-goal`

### 3.3 日期/时间控件语义

文件：`src/content/controls.ts`

- 日期：日历上下文 + 完整日期/月名/星期/数字日；
- 时间：时间列表上下文 + 时间标签；
- 下一步：`Next/Continue/下一步/继续`，且不是 submit/payment；
- 表单：input-label 且命中姓名/邮箱/电话/地址等个人信息；
- 禁用控件不进入 `isSafeTarget`；
- ambiguous（同一标签重复）不进入可点击目标；
- 不根据截图猜测选择器，使用通用 DOM 语义。

### 3.4 预约阶段规划

文件：`src/sidepanel/guide/stepPlanner.ts`

新增预约计划：

- 有可用日期、无时间列表 → 一步“选择可用日期”，目标为第一个非禁用、非 ambiguous 日期，完成条件 `time-controls-appear`。
- 选择日期后出现时间列表 → 一步“选择可用时间”，目标为第一个非禁用时间，完成条件 `control-selected`。
- 时间已选、出现表单 → 失败 `personal-info`（不指向输入框）。
- 时间已选、出现 Next → 一步“点击继续进入下一步”，完成条件 `form-controls-appear`。
- 时间已选、只有 Book/Confirm/Submit → 失败 `confirmation`（不代点）。
- 所有日期禁用 → `no-available-dates`。
- 无可用时间 → `no-available-times`。
- 日历/下一步不可靠 → `calendar-incomplete`。
- 保留原有地区/网点/查询流程；仅当预约目标且有日历/表单/下一步语义控件，或页面完全无控件时进入预约分支。

### 3.5 完成判定与复审

文件：

- `src/sidepanel/guide/completion.ts`
- `src/sidepanel/hooks/useConversation.ts`

新增完成条件：

- `time-controls-appear`：出现时间控件才算日期步骤完成；
- `control-selected`：目标控件 selected，或（时间步骤）出现表单/Next；
- `form-controls-appear`：出现个人信息表单；
- 无关 DOM 更新不满足以上条件，返回 `unconfirmed`，不跳步。

页面变化后：

- 若当前是预约计划，重新 `createPlan` 判断下一阶段；
- 日期步骤完成 → 重新指向时间；
- 时间步骤完成 → 指向 Next 或说明个人信息边界；
- 无可用时间/无可用日期/个人信息/确认 → 明确说明事实与限制。

### 3.6 预约失败反馈

文件：`src/sidepanel/dialogue/rule/RuleEngine.ts`

预约规划失败不再退回“当前页面没有找到这项信息”，而是：

- 无可用日期：页面可预约日期都不可选；
- 无可用时间：这个日期目前没有可预约时间；
- 个人信息：需要你本人填写姓名、邮箱，不读取不代填；
- 最终确认：需要你本人核对提交，不代点；
- 日历未加载/入口不可靠：说明未看到可靠日历/下一步。

## 4. 日历语义 fixture

新增（合成日历语义，**不是** Cal.com 真实 DOM 抓取）：

- `scripts/fixtures/cal-booking-date.html`
  - 可用日期：Monday, November 16, 2026
  - 禁用日期：Tuesday, November 17, 2026（disabled）
- `scripts/fixtures/cal-booking-time.html`
  - 已选日期：16
  - 禁用时间：9:00 AM
  - 可用时间：10:00 AM、10:15 AM
- `scripts/fixtures/cal-booking-form.html`
  - 已选时间：10:00 AM
  - Name、Email 表单（无 value）
  - Book 提交按钮
- `scripts/fixtures/cal-booking-no-times.html`
  - 已选日期
  - 所有时间 disabled

fixture 仅用于回归，不进入 `dist/` 运行链路。

## 5. 回归测试

文件：`scripts/selftest.mjs`

新增 **AT-32**：预约意图与日期、时间、个人信息阶段

- 原句“我想预约这个15分钟会议，请一步一步告诉我先点哪里” → `process-goal`；
- “这项预约多少钱”“这个会议什么时候” → `page-fact`；
- 日期计划目标为可用日期 `ef-b-1`，不是禁用日期 `ef-b-2`；
- 日期计划完成条件是 `time-controls-appear`；
- 日期步骤在原始页面未出现时间时 `unconfirmed`；
- 无关按钮出现也不跳步；
- 出现时间列表后日期步骤 `done-verified`；
- 时间计划目标为可用时间 `ef-b-4`，不是禁用时间；
- 日期目标与时间目标不同，且都非禁用；
- 时间未选中时 `unconfirmed`；
- 选中时间/出现表单后 `done-verified`；
- 个人信息页 `createPlan` 返回 `personal-info`；RuleEngine 返回 `cannot-answer` + `read-only-boundary`；
- 无可用时间返回 `no-available-times`，回答“没有可预约时间”；
- 所有日期禁用返回 `no-available-dates`；
- 只有 Book 提交时返回 `confirmation`。

新增 **AT-33**：日历控件语义与 DOM fixture

- fixture 含 `data-testid="day"`、完整 aria-label、disabled；
- `annotateControls` 正确识别：
  - 可用日期 → `date`
  - 禁用日期 → `disabled=true`
  - 时间 → `time`
  - Name → `form`
  - Next → `next`

政府津贴回归 AT-30 仍通过：两轮答案不同，第二轮为办理流程。

## 6. 实际命令与结果

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | `TYPECHECK_EXIT_CODE=0` |
| `npm run build` | `BUILD_EXIT_CODE=0` |
| `npm run selftest` | `SELFTEST_EXIT_CODE=0`，24 项全部通过 |
| `npm run verify` | `VERIFY_EXIT_CODE=0` |

日志：

- `codearts_proof/cal-booking-typecheck-final.log`
- `codearts_proof/cal-booking-build-final.log`
- `codearts_proof/cal-booking-selftest-final.log`
- `codearts_proof/cal-booking-verify-final.log`
- `codearts_proof/cal-booking-selftest-1.log`（测试读取路径错误，已修正）
- `codearts_proof/cal-booking-selftest-2.log`（24 项通过）

## 7. 修改文件

- `src/shared/types.ts`
- `src/content/collect.ts`
- `src/content/controls.ts`
- `src/sidepanel/match/lexicon.ts`
- `src/sidepanel/guide/stepPlanner.ts`
- `src/sidepanel/guide/completion.ts`
- `src/sidepanel/dialogue/validate/validator.ts`
- `src/sidepanel/dialogue/rule/RuleEngine.ts`
- `src/sidepanel/hooks/useConversation.ts`
- `scripts/selftest.mjs`
- `scripts/fixtures/cal-booking-*.html`（新增 4 个）
- `codearts_proof/15-cal-booking-guidance.md`
- `dist/`（重新构建）

未修改：

- `public/manifest.json`（权限仍四项）
- 未新增 `<all_urls>` / host permissions
- 未读取表单值
- 未自动点击提交/支付/确认

## 8. 未执行事项

1. **未采样 Cal.com 真实渲染 DOM**：没有真实日期/禁用日期/时间控件的现场证据。
2. **未在真实 Cal.com 页面执行日期→时间→下一步验收**。
3. **未产出真实页面截图**（侧边栏与高亮截图）。
4. 未验证真实 Cal.com 的 DOM 是否使用 `data-testid="day"` / `data-testid="time"` 或兼容语义；若不一致，运行时可能提示“没看到可靠日历”，不会伪造步骤。
5. 未验证真实网站当前是否有可预约时段。
6. 未接在线模型；仍为本地规则演示。

## 9. Chrome 人工验收步骤

1. `chrome://extensions` 重新加载 EasyFlow。
2. 刷新 `https://cal.com/jsfour/15min?layout=mobile`。
3. 关闭并重新打开侧边栏，从新对话开始。
4. 输入：
   ```text
   我想预约这个15分钟会议，请一步一步告诉我先点哪里
   ```
5. 预期侧边栏出现“先做这一步：选择可用日期”，并显示“指给我看”。
6. 点击“指给我看”，确认网页高亮的是真实可点击日期，不是禁用日期，也不是页面随机数字。
7. 用户自己在网页上点击一个可用日期。等待页面出现时间列表；扩展重新读取后应给出“选择可用时间”，并高亮真实可用时间。
8. 用户自己点击时间。若页面出现 Next/继续入口，扩展指向该入口；若页面出现姓名/邮箱表单，扩展应说明需要本人填写，不读取、不回显、不代填。
9. 到了最终确认/Book/Submit，扩展只说明需要本人操作，不自动点击。
10. 若该日期没有可用时间，扩展应说“这个日期目前没有可预约时间”，请换日期或等加载；不得给假时间。
11. 截图记录：侧边栏日期/时间提示 + 网页高亮；若无可预约时间，记录实际“无时间”状态。
12. 复测政府津贴页：“谁能申请”答条件，“那怎么办理”答流程，确认旧功能未回退。

## 10. 结论

- 代码层已完成预约意图、日历控件语义、日期/时间阶段规划、完成判定、复审重规划与隐私边界。
- 24 项自动化回归、构建、类型检查、权限门禁真实通过。
- 因缺少 Cal.com 真实 DOM 采样，本轮**不能**声称 Cal.com 已实测通过；必须在 Chrome 中按第 9 节验收，并记录实际日期/时间与截图。若真实 DOM 不匹配通用规则，应返回真实限制而不是编造步骤。