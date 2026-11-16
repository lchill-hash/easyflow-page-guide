# 21 — 时段失效后的最新快照核对与动态改指

> fixture/自测通过；真实 Chrome 侧边栏**待验**。未为测试提交任何真实预约。

## 问题

真实 Cal.com 页面中，已选日期下原目标时段从列表消失（列表从 `02:15` 开始），但侧栏仍显示旧步骤“现在这一步：02:00”；点“指给我看”只得到“这个位置已经不在页面上了”，旧步骤卡仍可继续点击；`relocate` 的“同类型同 region 邻居”兜底还可能把旧引用悄悄重定向到别的时段。

## 修复

1. **最新快照核对（`reconcileBookingPlan`）**
   - 仅对活动预约计划生效。
   - 先用 `elementId` 在同一元素上核对；元素 id 变化时只接受“同类型 + 完整标签唯一且可见、未禁用、非歧义、无风险”的同一入口。
   - 目标消失/禁用/不可见/歧义时，立即把旧计划置为 `superseded`，并基于**同一任务目标 + 最新 snapshot** 重新 `createPlan`，生成指向页面当下真实可用时段的新计划（版本 +1）。
   - 无可用时段时返回 `unavailable`，不指向任何邻居控件。
   - 页面进入个人信息/最终确认时返回 `personal-info` / `confirmation` 边界提示，旧卡失效。
2. **旧卡失效**
   - 会话状态新增 `currentCardMessageId`：只有“当前计划 + 当前步骤”对应的消息卡可操作。
   - 计划 `superseded` / `completed` / 被替换后，旧卡标题变为“这一步已过期”，按钮隐藏，保留文字作为历史。
   - 每次重规划只追加一条新指引消息，不刷屏。
3. **`relocate` 严格匹配**
   - 删除“同类型同 region 任意邻居”兜底。
   - 预约时段只允许同一元素或同一完整标签（同 controlType）唯一匹配；多个同标签返回 `ambiguous`，否则 `missing`。
4. **所有入口都先核对最新页面**
   - “指给我看”/当前步骤卡点击：先重新读取页面，再核对并高亮最新目标；若目标失效则生成新指引，不高亮旧位置。
   - “我找不到”“我点错了”：先重新读取最新页面，再交给规则引擎。
   - 发送预约/定位类指令：先重新读取最新页面再规划。
   - 自动复审 / page-changed / highlight 返回 `stale`：重新读取并核对。
5. **偏好筛选**
   - `timePreferenceOf` 识别“下午 / 上午 / 更晚 / 更早”。
   - 重规划时在可用时段中筛选；没有符合偏好的时段返回 `no-preferred-times`，提示换日期或不限时间，不误指其它时段。
   - 无偏好时新指引明确“目前可选的最早时段是……”。
6. **不写死数据**
   - 生产源码不含 `02:00` / `02:15` / `03:00` 等测试时段分支，也不依赖 `cal.com` URL 特判（成功页仍沿用上一轮的路径形态 + 精确标题）。

## 测试

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run selftest` | 29 项通过（原 27 + AT-37/38） |
| `npm run build` | 0 |
| `npm run verify` | 0 |

新增 AT-37（最新快照核对）：

- A：`02:00` 可选 → `unchanged`；
- B：`02:00` 消失、`02:15` 可用 → `replanned` 指向 `02:15`，旧目标保留为 `previousTarget`，计划版本 +1；
- C：`02:15` 也消失、`03:00` 可用 → 再次指向 `03:00`；
- D：`02:00` 仍在 DOM 但 `disabled` → 跳过并指向 `02:15`；
- E：全部时段不可用 → `unavailable` + `superseded` + `no-available-times`，不指向任意邻居；
- F：不同 URL/不同结构页面（已选日期 + `13:45`）→ 仍能生成新指引；
- 同一元素 id 变化但完整标签一致 → `updated`，同步更新完成条件引用；
- `relocate`：只有同 region 邻居 → `missing`；两个同标签 → `ambiguous`；
- 偏好：`下午` 选 `2:00 PM`；无符合项 → `no-preferred-times`；`更晚` 从原目标改指 `03:00`；
- 生产源码不含固定测试时刻。

新增 AT-38（卡片状态）：

- 新卡替换旧卡；`plan-set(active)` 保留当前卡；
- 计划 `superseded` 后 `currentCardMessageId` 清空；
- `MessageList` / `StepCard` / `App` 使用 `currentCardMessageId`、`planActive`、`expired` 与“已过期”。

日志：

- `codearts_proof/stale-times-selftest.log`
- `codearts_proof/stale-times-build.log`

## 修改文件

- `src/sidepanel/guide/stepPlanner.ts`
- `src/sidepanel/hooks/useConversation.ts`
- `src/sidepanel/state/conversationReducer.ts`
- `src/sidepanel/components/chat/MessageList.tsx`
- `src/sidepanel/components/chat/StepCard.tsx`
- `src/sidepanel/App.tsx`
- `src/sidepanel/styles/sidepanel.css`
- `src/sidepanel/dialogue/rule/RuleEngine.ts`
- `scripts/selftest.mjs`
- `codearts_proof/21-stale-booking-times.md`
- `dist/`（重新构建）

## 真实页待验

自测使用合成快照，不能代替真实 Cal.com 验收。真实页需确认：时段列表变化后侧栏自动改指下一条实际可用时段、旧卡变灰、按钮可点但不会指向已消失时段。

## 最短安全验收

1. 重新加载扩展并刷新预约页面（保持新会话）。
2. 让侧栏完成一次规划，指向页面上当前可用的某个时段。
3. 改变页面状态（例如下拉/滚动让列表更新，或另开同一预约页制造时段变化），再点“重新读取页面”或对旧卡点“我找不到”。
4. 观察：
   - 新指引指向页面**当下**真实可用时段（不是已消失的旧时段）；
   - 旧卡显示“这一步已过期”，按钮不再可点；
   - 若该日期已无可用时段，只提示换日期，不指向任意邻居；
   - 每次重规划只新增一条指引。
5. 不需要为了测试完成新的真实预约；个人信息与最终提交仍由用户本人处理。