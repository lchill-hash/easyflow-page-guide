# 20 — 预约成功页完成状态与消息去重

> 代码/fixture 通过；真实侧边栏完成状态**待验**。未重复提交真实预约。

## 修复

- 新增 `isBookingSuccessPage(snapshot, plan)`：
  - 仅当存在活动预约计划、路径形态匹配 `/(booking|bookings|confirmation|confirmed|success)/`、且可见标题精确为 `该会议已安排` / `会议已安排` / `This meeting is scheduled` 或 `Meeting is scheduled` 时返回 true。
  - 仅比较路径形态；预约计划 URL 使用 `booking-path` / `booking-success-path`，不保存完整预约 ID。
  - 不读取姓名、邮箱、会议链接等详情。
- 成功确认：
  - `completeBookingPlan` 将计划设为 `completed`。
  - `useConversation` 用 `bookingSuccessHandled` ref 保证只追加一次：
    `页面显示预约已安排；详情请以网页/确认邮件为准。`
  - 成功后停止 watch，不再自动复审；重复 page-changed 直接忽略。
- 去重：
  - page-changed 通知按 tabId + 1.5s 窗口去重。
  - “页面变了”“页面已更新”“我还不能确认”改为 `appendSystemOnce`，重复 tick 不再堆积。
  - 个人信息/最终提交边界保持不变。
- 普通页面仅含“已安排”文字不会命中：需要活动预约计划 + 成功路径 + 精确标题。

## 测试

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run selftest` | 27 项通过 |
| `npm run build` | 0 |
| `npm run verify` | 0 |

新增 AT-36：

- 活动预约计划 + `/booking/TEST-ID` + `该会议已安排` → true；
- 完成后同一成功页 → false（不再重复通知）；
- 普通路径 + 同标题 → false；
- 成功路径 + 仅“已安排” → false；
- 英文标题 → true。

日志：`codearts_proof/success-page-*.log`

## 修改文件

- `src/sidepanel/guide/stepPlanner.ts`
- `src/sidepanel/hooks/useConversation.ts`
- `scripts/selftest.mjs`
- `codearts_proof/20-booking-success.md`
- `dist/`（重新构建）

## 真实页待验

未在真实 Chrome 重新加载后的已有成功页验证侧栏完成状态与消息去重。成功检测要求当前会话存在活动预约计划；重新加载扩展会丢失该内存计划。不要为测试再次创建真实预约。

## 最短安全验收

1. 在**不重复提交预约**的前提下，使用测试环境或下一次自然预约流程。
2. 重新加载扩展、刷新页面并保持新会话。
3. 完成自然预约到成功页后，展开侧栏观察：
   - 只出现一次“页面显示预约已安排；详情请以网页/确认邮件为准。”
   - 诊断计划状态为 completed（如可见）。
   - 再触发一次页面更新/重新读取，不新增完成消息或“无法确认”。
4. 若已有成功页但扩展已重新加载、没有活动计划：这是预期不触发成功完成，不能据此认为失败；请用测试环境注入活动计划或下一次流程验证。
5. 不要为了测试再次提交真实预约。