# 22 — 第三轮实现：预约成功页识别、一次性完成消息与完成回答

> fixture/自测门禁通过；**真实页只读验收待验**。未为测试创建任何真实预约。
>
> 依据：`.codeartsdoer/specs/easyflow_page_guide/iteration3-spec.md`、`iteration3-design.md`、`iteration3-tasks.md`。

## 1. 实现范围

只修复“用户已到预约成功页，侧栏仍显示旧填写提示；用户说‘完成了’却回答‘我还没有正在陪办的步骤’”这一缺陷：

- 成功判定与陪办计划解耦，只看“路径形态 + 主文档可见精确标题”；
- 成功判定收口到 `readPage`，覆盖首读、页面变化、观察 tick、重试、完成表述预读；
- 成功后一次性完成消息、清空当前卡、结束计划、停止自动复审；
- 无活动计划时“完成了”给出客观完成回答；
- 成功态所有旧步骤卡显示“这一步已结束”、无按钮、无完成条件；
- 诊断展示成功判定结果，成功后禁用“重新读取页面”；
- 清理生产源码中的测试时刻示例。

未新增权限、未新增消息协议、未修改采集/高亮/对话引擎/校验器，未创建真实预约。

## 2. 变更文件

### 2.1 新增

| 文件 | 内容 |
|---|---|
| `src/sidepanel/guide/bookingSuccess.ts` | 四条标题、五个路径段、固定文案、`normalizeSuccessTitle`、`hasBookingSuccessPath`、`evaluateBookingSuccess`、`isBookingSuccessPage`、`buildSuccessCitation`、`buildBookingDoneResponse`、`buildBookingUnconfirmedResponse`、`buildBookingAfterSuccessResponse` |
| `src/sidepanel/components/chat/stepCardModel.ts` | `resolveStepCardMode`、`stepCardActions`、`shouldShowCompletion`、`stepCardLabel` |
| `scripts/fixtures/booking-success-with-plan.html` | 有活动计划成功页结构（虚构） |
| `scripts/fixtures/booking-success-no-plan.html` | 无活动计划成功页结构（模拟重载） |
| `scripts/fixtures/booking-arranged-only.html` | 成功路径 + 正文仅“已安排” |
| `scripts/fixtures/booking-fake-url.html` | 伪成功 URL 场景说明 |
| `scripts/fixtures/booking-normal-path-precise-title.html` | 普通路径 + 精确标题 |
| `scripts/fixtures/booking-success-hidden-title.html` | 隐藏精确标题 |
| `scripts/fixtures/booking-success-repeat.html` | 重复通知 + 近似标题变体 |

### 2.2 修改

| 文件 | 改动 |
|---|---|
| `src/shared/types.ts` | `NoticeKind` 增加 `booking-complete`；新增 `BookingSuccessReason`、`BookingSuccessSignals`、`BookingCheck` |
| `src/sidepanel/guide/stepPlanner.ts` | 删除本地成功标题/路径常量；`bookingUrlShape` 改用 `hasBookingSuccessPath`；`isBookingSuccessPage` 改为 re-export |
| `src/sidepanel/state/conversationReducer.ts` | 新增 `pageSuccess`、`lastBookingCheck`、`booking-check`、`booking-success`（原子收口 + 按消息种类去重） |
| `src/sidepanel/hooks/useConversation.ts` | `readPage` 统一判定与收口；`finalizeBookingSuccess`、`recordBookingCheck`；`handleRecheck` 守卫；`runTurn` 完成回答/成功态护栏；`retry`/`locateControl` 成功态处理 |
| `src/sidepanel/components/chat/StepCard.tsx` | 新增 `ended` 态，使用卡片模型；结束后隐藏完成条件与全部按钮 |
| `src/sidepanel/components/chat/MessageList.tsx` | 新增 `bookingCompleted` 并透传 `ended` |
| `src/sidepanel/App.tsx` | 传递 `bookingCompleted`、`lastBookingCheck` |
| `src/sidepanel/components/chat/DiagnosticsPanel.tsx` | 成功判定行、原因类别映射、成功态禁用重读、中性化时刻示例 |
| `src/sidepanel/dialogue/intent/classifier.ts` | 新增 `isCompletionUtterance`（复用 `FEEDBACK_DONE`） |
| `scripts/selftest.mjs` | AT-36 调整；新增 AT-39—AT-45；新增导出 |
| `dist/` | 重新构建 |

### 2.3 明确未修改

`src/content/**`、`src/background/**`、`src/shared/messages.ts`、`src/sidepanel/dialogue/rule/RuleEngine.ts`、`src/sidepanel/guide/completion.ts`、`src/sidepanel/dialogue/validate/validator.ts`、`public/manifest.json`、`scripts/build.mjs`、`scripts/verify-manifest.mjs`。

## 3. 关键行为

1. **成功证据**：`new URL(snapshot.url).pathname` 的独立成功段 + 主文档 `heading`/`paragraph` 归一化后整句等于四条允许标题之一。不读查询串、片段、域名、`document.title`、控件、表单值、链接地址。
2. **一次性收口**：`readPage` 成功返回前判定；`booking-success` 同一次状态更新完成“计划 completed（若存在）/ 清空当前卡 / `pageSuccess=confirmed` / 1 条完成消息 / 忙态复位”；ref + 消息种类双重幂等。
3. **完成回答**：无活动计划或页面成功时，用户“完成了”得到 `direct-answer`“页面显示预约已安排。请以网页和确认邮件中的信息为准。”，引用逐字来自当前快照标题并经过 `validateResponse`。
4. **旧卡**：`ended` 优先于 `expired` 与 `cardActive`；所有历史卡“这一步已结束”、0 按钮、不显示完成条件；`expired` 语义保持不变。
5. **误报防护**：普通路径、仅“已安排”、伪成功查询串、隐藏标题、读取失败、近似标题均不判定成功。

## 4. 门禁结果

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run typecheck` | 0 | 0 error |
| `npm run selftest` | 0 | **36 项通过**（原 29 + AT-39—AT-45） |
| `npm run build` | 0 | `dist/` 产物齐全 |
| `npm run verify` | 0 | 权限仍为 `activeTab`、`scripting`、`sidePanel`、`storage` |

日志：

- `codearts_proof/iteration3-typecheck.log`
- `codearts_proof/iteration3-selftest.log`
- `codearts_proof/iteration3-build.log`
- `codearts_proof/iteration3-verify.log`

## 5. 清洁检索

| 检索 | 结果 |
|---|---|
| `src/**/*.{ts,tsx}` 含 `02:00` / `02:15` / `03:00` | 0 hits（`iteration3-clean-clock.log`） |
| `src/**/*.{ts,tsx}` 邮箱样式 | 0 hits（`iteration3-clean-email.log`） |
| `src/**/*.{ts,tsx}` 真实站点域名 | 0 hits（`iteration3-clean-domain.log`） |
| `scripts/fixtures/booking-*.html` 含 `cal.com` / `TEST-ID` | 0 hits（`iteration3-clean-fixture.log`） |
| `public/manifest.json` 权限 | `["activeTab","scripting","sidePanel","storage"]`（`iteration3-clean-manifest.log`） |

## 6. F-01—F-10 状态

| 编号 | 场景 | 状态 |
|---|---|---|
| F-01 | 有活动计划成功页：完成消息 1 次、计划结束、旧卡不可操作、停止复审 | fixture 通过（AT-39/AT-40/AT-44）；真实页待验 |
| F-02 | 无活动计划成功页：完成消息 1 次；“完成了”回答客观且附引用 | fixture 通过（AT-40/AT-41）；真实页待验 |
| F-03 | 普通路径 + 精确标题不误报 | fixture 通过（AT-42） |
| F-04 | 仅“已安排”不误报 | fixture 通过（AT-42） |
| F-05 | 成功路径无可见精确标题不误报；证据不足诚实回答 | fixture 通过（AT-42/AT-43） |
| F-06 | 伪成功查询串不误报 | fixture 通过（AT-42） |
| F-07 | 重复通知/读取/完成表述：消息仍 1 条 | reducer 幂等通过（AT-40）；真实页待验 |
| F-08 | 源码、fixture、权限清洁 | 通过（AT-45 + 清洁检索） |
| F-09 | 动态时段与旧卡过期语义不回退 | AT-37/AT-38 通过 |
| F-10 | 姓名/邮箱/会议链接/查询串不进入判定结果与展示 | AT-45 通过 |

## 7. 真实页待验

尚未在用户已有真实成功页上执行只读验收。不得据此写“真实页已通过”。

只读验收步骤（不创建新预约）：

1. 重新加载扩展，打开**已有**成功页与侧栏。
2. 观察完成消息：文案等于“预约已完成。请以网页和确认邮件中的信息为准。”，计数为 1；5 秒内无重复。
3. 检查历史步骤卡：标签“这一步已结束”、无按钮、无“完成条件：”。
4. 输入“完成了”：回答以“页面显示预约已安排”开头，可展开网页依据；不出现“我还没有正在陪办的步骤”。
5. 检查诊断：成功判定通过；不含姓名、邮箱、会议链接、完整查询串；成功后“重新读取页面”禁用。
6. 确认未新建预约、未自动点击/提交、URL 与表单值未被修改。

若真实页标题不在四条允许集合内，记录实际标题原文并回到取舍点 T3-06，不擅自扩大集合。