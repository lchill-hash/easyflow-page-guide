# 17 — Cal.com 时段误判与时间候选诊断

> 真实页状态：**待验**。本轮以用户真实截图的诊断数字为基线，未再次在用户 Chrome 中执行日期→时间→下一步，未声称真实网站通过。

## 1. 用户真实基线

```text
button 候选 58 / button 采集 58
日期控件 54 / 时间控件 2
iframe 2 / 开放 shadow root 1 / 预算截断 否
```

页面已选 2026-11-17，向下滚动可见 `02:00、02:15、02:30、02:45、03:00`，但 EasyFlow 仍答“我还没看到可预约的日历或可靠的下一步入口”。

## 2. 诊断结论

- `controls.ts` 旧 `TIME_LABEL` 的冒号和 AM/PM 可选，`12 小时 / 24 小时` 会被当作时段；用户诊断中的“时间控件 2”很可能对应显示格式开关，但真实标签未取得，保持待核实。
- `createBookingPlan` 在 `selectedTime` 存在但无 Next/提交时返回 `calendar-incomplete`；与当前答复吻合。
- 真实 02:00 时段未计入，可能原因包括：
  - 时段不是 button/`[role=button]`，而是 `role=option/radio`；
  - 时段尚未渲染/快照早于滚动；
  - 时间上下文未命中；
  - 位于 iframe/开放 shadow root。
  未取得真实 DOM，不把其中任一项断言为唯一原因。

## 3. 修复

### 时间语义

- `TIME_LABEL` 改为必须有可靠钟点：
  - `HH:MM`（00—23 时、00—59 分）；
  - `H AM/PM`；
  - 上午/下午/凌晨/晚上。
- 新增格式开关排除：
  - `12 小时 / 24 小时 / 12h / 24h / hour format / 12-hour / 24-hour / 时间格式 / 小时制`
  - 永不为 `time`，不计入目标/完成证据。
- 日期语义不会吞掉时间；时间仍要求时间列表/时段上下文（或角色在真实时间列表内）。

### 非 button 时段

- 采集 selector 增加 `[role="option"]`、`[role="radio"]`、`[role="menuitemradio"]`。
- 仍要求真实可点击、可见、未禁用、非 ambiguous；高亮使用同一 elementId。
- 若在 iframe/开放 shadow root 内且无法安全覆盖，诊断明确提示边界。

### 预约阶段

- 已选日期且存在真实时间控件 → “选择可用时间”，目标为真实时段。
- 已选日期但未看到时间控件 → `time-controls-missing`，回答“时段可能未渲染，请滚动/重新读取”，不再返回“没看到日历”。
- 所有时间禁用 → `no-available-times`。
- 只有格式开关 → 不是时段；仍为 `time-controls-missing`。
- `time-controls-appear` 只由真实 `kind=time` 控件触发。
- 未选日期 → 仍先引导选择可用日期。
- 页面变化后重新读取、重新规划；无关 DOM 更新不跳步。

### 诊断

“运行诊断 → 页面采集诊断”新增：

- 可用日期数、已选日期标签、已选时间标签、快照时间；
- 最多 12 个时间候选：
  - 标签、标签名、role、可见性、disabled/selected；
  - 上下文及理由、语义分类（date/time/generic/format-toggle）、过滤原因；
- 日期候选同样补充标签名、可见性、语义；
- iframe/开放 shadow root 提示；
- “重新读取页面”按钮。

不显示姓名、邮箱、输入值、cookie、完整 HTML；不自动点击。

## 4. 测试

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | `TYPECHECK_EXIT_CODE=0` |
| `npm run selftest` | `SELFTEST_EXIT_CODE=0`，24 项全部通过 |
| `npm run build` | `BUILD_EXIT_CODE=0` |
| `npm run verify` | `VERIFY_EXIT_CODE=0` |

新增回归覆盖：

- `12 小时 / 24 小时` → `generic`，不是 time；
- `role=option` 的 `02:00` → time；
- 已选日期 + 仅格式开关 → `time-controls-missing`；
- 已选日期 + 02:00 时段 → 目标 02:00，不是格式开关；
- 原预约阶段、政府津贴两轮问答继续通过。

日志：

- `codearts_proof/cal-booking-typecheck-5.log`
- `codearts_proof/cal-booking-selftest-4.log`
- `codearts_proof/cal-booking-build-final3.log`
- `codearts_proof/cal-booking-verify-final3.log`

## 5. 修改文件

- `src/shared/types.ts`
- `src/content/collect.ts`
- `src/content/controls.ts`
- `src/sidepanel/guide/stepPlanner.ts`
- `src/sidepanel/dialogue/rule/RuleEngine.ts`
- `src/sidepanel/hooks/useConversation.ts`
- `src/sidepanel/state/conversationReducer.ts`
- `src/sidepanel/components/chat/DiagnosticsPanel.tsx`
- `src/sidepanel/App.tsx`
- `scripts/selftest.mjs`
- `scripts/fixtures/cal-booking-time.html`
- `codearts_proof/17-cal-time-diagnostic.md`
- `dist/`（重新构建）

## 6. 真实页待验

未执行：

- 用户真实 Chrome 重新加载后的原句验收；
- 真实 02:00 时段高亮；
- 点击时段后的下一步/个人信息边界；
- 真实诊断截图。

必须以用户重新验收为准，不能把 fixture 通过写成真实网站通过。

## 7. 下一次 Chrome 最短操作

1. `chrome://extensions` → EasyFlow → 重新加载。
2. 刷新 `https://cal.com/jsfour/15min?layout=mobile`。
3. 关闭并重开侧栏，左栏滚动到能看到 `02:00`。
4. 展开“运行诊断” → “页面采集诊断”。
5. 输入原句并截图。截图必须包含：
   - 时间控件数；
   - 时间候选中的 `02:00`（语义=time、过滤为空）；
   - `12 小时/24 小时`（语义=format-toggle/generic、过滤=format-toggle）；
   - 已选日期 2026-11-17；
   - 时间候选的标签、role、可见/禁用/选中、上下文理由。
6. 回答应为“选择可用时间”；点“指给我看”应高亮 02:00，而不是 12/24 小时开关。
7. 若仍失败，只发上述诊断截图，不再盲改。