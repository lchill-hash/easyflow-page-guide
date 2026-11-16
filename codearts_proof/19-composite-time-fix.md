# 19 — 复合日期+时段标签分类修复

> 真实页待复测。本轮依据用户真实诊断标签修复语义分类，未宣称 Cal.com 已验收通过。

## 真实基线

- 已选 2026-11-17，可见 02:00、02:15。
- 诊断：时间候选 12、日期控件 54、时间控件 0。
- 02:00 可访问名称：`2026年11月17日星期二 02:00 (Asia/Shanghai)`。
- `12 小时 / 24 小时` 已为 format-toggle。

## 根因

`semanticOf` 先判 `FULL_DATE_LABEL` 再判时间；复合标签同时含完整日期与时间，被错分为 `date`，因此 `timeControlCount=0`，`createBookingPlan` 无法得到真实时间。

## 修复

- `classifyControlSemantic` 优先级：
  1. 格式开关 → `generic`；
  2. 时间标签 + `time-list` 上下文，或复合标签（时间 + 完整日期 + 时区/option/radio）→ `time`；
  3. 日历上下文/纯日期 → `date`；
  4. Next → `next`。
- `annotateControls` 使用同一函数，保留真实 02:00 的 `kind=time`、disabled、selected、ref。
- 诊断时间候选语义也使用同一函数，避免诊断显示 generic 而控件是 time。
- 日程规划：已选日期 + 真实 time 控件 → 选择可用时间，目标为真实时段；格式开关永不为目标。
- 已选日期但无真实时段 → `time-controls-missing`，提示滚动/重新读取。
- `aria-current=date` 仍只作今天，不作 selected；诊断可滚动、时间候选优先。

## 新增回归 AT-35

同一 snapshot 含：

- `2026年11月17日星期二，可预约` → date
- `2026年11月17日星期二 02:00 (Asia/Shanghai)`（context unknown、role option）→ time
- `12 小时 / 24 小时` → generic

断言 time 控件 `disabled=false`、`ambiguous=false`；`createPlan` 目标为 02:00 元素；格式开关不是目标；`ruleEngine` 返回 next-step 且 `validateResponse=passed`。

## 结果

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run selftest` | 26 项通过 |
| `npm run build` | 0 |
| `npm run verify` | 0 |

日志：`codearts_proof/composite-time-*.log`

## 修改文件

- `src/content/controls.ts`
- `src/content/collect.ts`
- `scripts/selftest.mjs`
- `dist/`（重新构建）
- 本留痕

## 真实页待复测

未在用户 Chrome 重新读取；未确认时间控件数 >0、02:00 高亮、点时段后的下一步。若仍为 0，需截图 02:00 候选的 tagName/role/上下文/语义行，不再盲改。

## 最短复测

1. `chrome://extensions` → EasyFlow → 重新加载。
2. 刷新 Cal.com，左侧保留已选 17 日与 02:00 可见。
3. 右侧“重新读取页面”，重问原句。
4. 期望：时间控件数 >0，回答指向可用时段。
5. 若仍为 0，截图 02:00 候选的 tagName/role/上下文理由/语义/过滤原因。