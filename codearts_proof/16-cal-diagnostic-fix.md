# 16 — Cal.com 日期未采集修复与运行诊断

> 验证性质：本轮完成了可运行的采集修复与合成日历 fixture 回归；**没有采样到用户真实 Chrome 中 Cal.com 渲染后的 DOM**，因此不能声称真实网站已修复通过。已加入运行诊断，供用户展开并截图反馈真实控件数量与过滤原因。

## 1. 用户真实页面现象

用户真实 Chrome 打开：

```text
https://cal.com/jsfour/15min?layout=mobile
```

页面左侧可见 17、18、19 等日期日历。输入：

```text
我想预约这个15分钟会议，请一步一步告诉我先点哪里
```

EasyFlow 回答：

```text
我还没看到可预约的日历或可靠的下一步入口。
```

上一轮合成 fixture 通过，不代表真实 Cal.com DOM 通过。

## 2. 当前代码确切漏采路径

### 2.1 最可能的漏采点：aria-label-only 按钮在取名称前被过滤

修复前流程：

1. `textOfElement(button)` 基本只取 `innerText`；
   - 如果日期按钮只有 `aria-label`/`title`，`innerText` 为空；
   - 少数 input 按钮才有 `value` 兜底。
2. `normalizeText` 得到空文本。
3. `isMeaningfulText` 立即拒绝空文本。
4. 只有进入 `item` 构建后，才调用 `accessibleNameOf` 读取 `aria-label`/`title`。

结果是：**仅有 aria-label 的日期按钮根本进不了 `snapshot.items`**，后续 `annotateControls` 和预约规划都看不到它。

### 2.2 日历上下文只依赖固定选择器

修复前 `controlContextOf` 只检查：

- `[data-testid="day"]`
- `calendar` / `date-picker` / `rdp`
- `role=grid`
- time/slot/time-list/listbox
- form 等

真实 Cal.com 的祖先容器如果使用不同的 class/id/data 属性，会被判为 `unknown`，数字日期也不会被认定为日期。

### 2.3 iframe / shadow root / 预算未进入诊断

修复前没有证据回答：

- 日期是否在同源 iframe；
- 是否在开放 shadow root；
- 是否被 `MAX_ITEMS` / 字符预算截断；
- 采集前 button 候选数与采集后 button 数的差异。

### 2.4 当前页快照是否更新

侧边栏读取的是 `EF_COLLECT` 返回的当前快照；若首次读取发生在日历渲染前，用户需要“重新读取页面”或页面变化触发复审。诊断需要显示采集当时的数据，不能事后猜测。

## 3. 本轮诊断设计

在“运行诊断”折叠区新增“页面采集诊断”：

```text
button 候选
button 采集
日期控件
时间控件
空文字按钮
隐藏按钮
禁用按钮
iframe
开放 shadow root
预算截断
日期候选（最多 8 个）
  - 标签
  - 角色
  - 上下文 + 上下文匹配原因
  - disabled / selected
  - 过滤原因（hidden / empty-text / disabled）
```

约束：

- 只记录日期候选的非敏感元数据；
- 标签命中姓名/邮箱/身份/手机号/验证码/密码等时不进入候选列表；
- 不读取 input.value；
- 不记录 cookie、完整页面 HTML、用户资料；
- 不自动点击页面；
- 诊断只在侧栏内展示，不上传。

实现：

- `src/shared/types.ts`：新增 `ControlDiagnostic` 与 `CollectDiagnostics` 字段。
- `src/content/collect.ts`：
  - 采集前统计原始 `button/[role=button]/input button`；
  - 统计空标签、隐藏、禁用；
  - 统计开放 shadow root；
  - 输出最多 8 个日期候选；
  - 记录上下文匹配原因与过滤原因。
- `src/sidepanel/state/conversationReducer.ts`：保存本次 `CollectDiagnostics`。
- `src/sidepanel/components/chat/DiagnosticsPanel.tsx`：展示诊断区。
- `src/sidepanel/App.tsx`：传入 `collectDiagnostics`。

## 4. 采集修复

### 4.1 先取可访问名称，再过滤

`src/content/collect.ts`：

- `accessibleNameOf` 顺序：
  1. `aria-label`
  2. `aria-labelledby`
  3. `title`
  4. 可见文字
  5. button/submit/reset 的 `value`
- 对 button/link/inputLabel，在 `isMeaningfulText` 之前先取得可访问名称，并用它作为采集文本。
- 仅有 `aria-label` 的日期按钮不再因空 innerText 被丢弃。
- 仍不读取 inputLabel 的 value。
- `textHash` 使用可见文字（若可见文字为空才用可访问名称），保证高亮定位仍按原文字校验。

### 4.2 日历上下文识别

不再只依赖固定 `closest` 选择器，改为向上最多 8 层扫描：

- time：`time-slot/timeslot/time slot/time-list/available-time/slot-list/slot/time/listbox`
- calendar：`calendar/datepicker/date-picker/date picker/rdp/month/day-picker/day/grid`
- form：`form/field/booking-form`

记录匹配原因：

- `time ancestor`
- `calendar ancestor`
- `form ancestor`
- `input-label`
- `no matching ancestor`

### 4.3 日期语义

- 日历上下文 + 数字日（如 16/17/18）可判为日期；
- 完整日期/月名/星期标签即使上下文未识别，也允许判为日期；
- 全页任意数字仍不会因为数字本身被当作日期；
- 禁用/选中状态保留；
- 重复标签标记 ambiguous，不进入目标。

## 5. 预约规划与完成判定

- 日历阶段：
  - 可用日期 → 选择可用日期；
  - 时间区域出现 → 日期步骤完成，重新规划时间；
  - 可用时间 → 选择可用时间；
  - 时间选中或出现表单/Next → 时间步骤完成；
  - 表单 → 个人信息边界；
  - Book/Confirm/Submit → 最终确认边界。
- 无关 DOM 更新不会满足 `time-controls-appear` / `control-selected` / `form-controls-appear`，不会跳步。
- 页面变化后重新读取并重新判断日期/时间阶段，不预设下一步一定存在。

## 6. 实际测试

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | `TYPECHECK_EXIT_CODE=0` |
| `npm run build` | `BUILD_EXIT_CODE=0` |
| `npm run selftest` | `SELFTEST_EXIT_CODE=0`，24 项全部通过 |
| `npm run verify` | `VERIFY_EXIT_CODE=0` |

新增/保留：

- AT-32：预约意图 + 可用/禁用日期 + 日期→时间 + 个人信息/确认/无时间；
- AT-33：日历控件语义与 DOM fixture；
- AT-30：政府津贴两轮问答回归；
- 原有 T/AT 测试全部通过。

日志：

- `codearts_proof/cal-booking-typecheck-4.log`
- `codearts_proof/cal-booking-build-final2.log`
- `codearts_proof/cal-booking-selftest-final2.log`
- `codearts_proof/cal-booking-verify-final2.log`

## 7. 修改文件

- `src/shared/types.ts`
- `src/content/collect.ts`
- `src/content/controls.ts`
- `src/sidepanel/state/conversationReducer.ts`
- `src/sidepanel/components/chat/DiagnosticsPanel.tsx`
- `src/sidepanel/App.tsx`
- `src/sidepanel/guide/stepPlanner.ts`
- `src/sidepanel/guide/completion.ts`
- `src/sidepanel/dialogue/validate/validator.ts`
- `src/sidepanel/dialogue/rule/RuleEngine.ts`
- `src/sidepanel/hooks/useConversation.ts`
- `src/sidepanel/match/lexicon.ts`
- `scripts/selftest.mjs`
- `scripts/fixtures/cal-booking-*.html`
- `codearts_proof/16-cal-diagnostic-fix.md`
- `dist/`（重新构建）

## 8. 真实 DOM 未验证

本轮**没有**用户真实 Chrome 的 Cal.com DOM 采样，因此：

- 不能确认真实日期按钮是否使用 `aria-label`、日历祖先是否命中新规则；
- 不能确认真实日期/时间的 disabled/selected 属性；
- 不能确认页面是否在 iframe/开放 shadow root 中；
- 不能提供真实可用/禁用日期样本；
- 未产出真实截图；
- 合成 fixture 通过不等于真实页面通过。

## 9. 用户需要在 Chrome 中完成的验收

1. `chrome://extensions` → EasyFlow → “重新加载”。
2. 刷新 `https://cal.com/jsfour/15min?layout=mobile`。
3. 关闭并重新打开侧边栏，从新对话开始。
4. 展开“运行诊断” → “页面采集诊断”。
5. 输入原句：
   ```text
   我想预约这个15分钟会议，请一步一步告诉我先点哪里
   ```
6. 期望：
   - `button 候选` > 0；
   - `button 采集` > 0；
   - `日期控件` ≥ 1；
   - 日期候选中至少一个 `禁用 否`，且上下文/原因不是 `no matching ancestor`；
   - 回答为“先做这一步：选择可用日期”，不是“没看到日历”。
7. 点“指给我看”，确认高亮真实可点击日期。
8. 自己点击可用日期，等待时间出现；扩展应复审并指向真实可用时间。
9. 自己点击时间；若出现 Next/继续，扩展指向该入口；若出现姓名/邮箱，扩展只说明需本人填写；Book/Submit 不自动点击。
10. 若仍失败，请发“运行诊断”截图，至少包含：
    - button 候选/采集
    - 日期控件/时间控件
    - 空文字/隐藏/禁用按钮
    - iframe/开放 shadow root/预算截断
    - 日期候选的标签、上下文原因、过滤原因
11. 不要继续盲改；以真实诊断数量为依据再修。

## 10. 结论

- 已修复最明确的漏采顺序问题：aria-label-only 按钮先入文本，再过滤。
- 已增强日历上下文识别与运行诊断；预约链路和既有问答 24 项回归通过。
- 真实 Cal.com DOM 仍未验证；需用户按第 9 节展开诊断并反馈截图，不能把本轮 fixture 通过写成真实网站已验收。