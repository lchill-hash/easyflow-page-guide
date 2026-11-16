# 18 — 诊断可滚动、今天标记与时间候选诊断

> 真实页状态：**待验**。未确认 02:00 已识别或高亮。

## 真实基线

用户真实 Cal.com 诊断：

```text
button 58 / 采集 58 / 日期 54 / 时间 2 / iframe 2 / shadow root 1 / 预算未截断
已选外观：2026-11-17；页面可见 02:00、02:15、02:30、02:45、03:00
```

## 修复

- 诊断内容使用 `maxHeight: 48vh` 独立滚动容器，`overflowY:auto`、`tabIndex={0}`；标题、已选日期/时间候选数、快照时间、“重新读取页面”按钮固定可见。
- 时间候选排在日期候选前，最多 12 条；日期候选最多 8 条。
- 诊断顶部显示“已选日期：17 日 / 未确认”和“时间候选数”。
- `aria-current="date"` 只写入 `isToday`，不再写入 `selected`；`selected` 只由 `aria-selected=true`、`aria-pressed=true`、`data-state=selected/checked/on` 产生。
- 日期/时间候选显示标签、tagName、role、可见性、disabled/selected/isToday、上下文理由、语义分类、过滤原因。
- 时间语义：必须有 `HH:MM` 或可靠 AM/PM/中文钟点 + 时间列表上下文；`12 小时/24 小时/12h/24h/hour format` 一律为 `format-toggle/generic`，不当目标或完成证据。
- 已选日期但无真实时段 → `time-controls-missing`：提示时段可能未渲染，滚动后重新读取；不再说“没看到日历”。
- 采集支持 `role=option/radio/menuitemradio`；未修改时段选择器以外的猜测规则。
- 未新增 iframe/shadow 采集；诊断显示 iframe/开放 shadow root 限制。

## 验证

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run selftest` | 25 项通过 |
| `npm run build` | 0 |
| `npm run verify` | 0 |

新增 AT-34：`aria-current=date` 不算 selected；诊断含 48vh 滚动区、tabIndex、时间候选在日期候选前。

日志：`codearts_proof/diagnostics-scroll-*.log`

## 修改文件

- `src/shared/types.ts`
- `src/content/collect.ts`
- `src/content/controls.ts`
- `src/sidepanel/components/chat/DiagnosticsPanel.tsx`
- `src/sidepanel/App.tsx`
- `src/sidepanel/guide/stepPlanner.ts`
- `src/sidepanel/dialogue/rule/RuleEngine.ts`
- `src/sidepanel/hooks/useConversation.ts`
- `src/sidepanel/state/conversationReducer.ts`
- `scripts/selftest.mjs`
- `scripts/fixtures/cal-booking-time.html`
- `dist/`（重新构建）

## 真实页待验

未执行真实 Chrome 重新验收；未确认时间候选是否出现 02:00；未确认 17 日是否被 Cal.com 的某个属性标记为 selected；未确认高亮。

## 下一次 Chrome 最短操作

1. `chrome://extensions` → EasyFlow → 重新加载。
2. 刷新 `https://cal.com/jsfour/15min?layout=mobile`。
3. 左侧滚到 02:00 仍可见。
4. 右侧点“重新读取页面”，展开“运行诊断”，滚到“时间候选”。
5. 截图必须包含：
   - 顶部“已选日期：17 日 / 未确认”和“时间候选数”；
   - 时间候选中 `02:00` 或“未发现时间候选”；
   - `12 小时/24 小时` 归为 format-toggle/generic；
   - 候选标签、tagName、role、上下文、语义、过滤原因；
   - iframe/开放 shadow root 数。

若失败，只发该诊断截图，不继续盲改。