# 14 — 连续追问重复上一答案修复

> 验证性质：本轮通过的是“公开网页原始条目夹具 + 规则引擎”的回归，不等于真实 Chrome 验收。真实 Chrome 人工复测仍由用户执行。

## 1. 问题

用户真实 Chrome 实测：

```text
第一轮：高龄津贴谁能申请 → 回答正确
第二轮：那怎么办理       → 重复办理条件
```

Codex 定位到两处根因：

1. `useConversation` 在直接回答后把 `normalizeGoal(trimmed).slice(0,24)` 整句存为 `lastObject`，实际保存的是“高龄津贴谁能申请”。
2. `RuleEngine.answerFact` 调用 `retrieveSegments(query, segments, 3)` 时没有传本轮 `slots`，检索器只能从混入旧问题的 query 推断；先看到“谁”就选条件章节。

## 2. 修复前本地夹具输出

修复前报告：

- `codearts_proof/repro-bjsjs-before.json`

性质：工程内公开 HTML 夹具 + Chrome headless，`file://` 访问；不是真实网站访问。

关键数据：

```text
itemCount: 4
segments: 3
q1 高龄津贴谁能申请 → seg-2，score=2.25
q2 那办理 高龄津贴 → seg-2，score=3.38
答案：页面写明：日期:2026-01-26 09:16 来源:北京市民政局
```

两轮都引用：

```text
title: 高龄老年人津贴办理指南（ef-h-2）
body:  日期:2026-01-26 09:16 来源:北京市民政局（ef-p-1）
```

## 3. 修复内容

### 3.1 新增统一话题提取器

文件：`src/sidepanel/dialogue/context/topic.ts`

- `sanitizeReusableObject(value)` 去除：
  - 前缀：请问、我想知道、我想了解、那、这个、那个等；
  - 后缀：谁能申请、怎么办理、如何申请、需要带什么、办理流程、办理指南等；
  - 纯泛词与仍含问句残留的文本返回 `undefined`。
- `extractReusableObject(utterance, pageTitle, previousObject)`：
  1. 先提取当前话语的业务对象；
  2. 提取不出时回退最近有效业务对象；
  3. 再回退页面标题（去掉“办理指南/申请指南/通知”等）；
  4. 仍无把握返回 `undefined`，不把整句问题当对象。

示例：

```text
高龄津贴谁能申请 → 高龄津贴
那怎么办理       → 高龄津贴（继承上一轮）
那需要带什么     → 高龄津贴（继承上一轮）
高龄老年人津贴办理指南 → 高龄老年人津贴（标题回退）
```

### 3.2 `useConversation` 只保存业务对象

文件：`src/sidepanel/hooks/useConversation.ts`

- 直接回答后不再保存 `normalizeGoal(trimmed).slice(0,24)`。
- 改为：
  ```ts
  extractReusableObject(trimmed, snapshot.title, current.lastObject)
  ```
- `buildContext` 对旧 `lastObject` 再做一次 `sanitizeReusableObject`，即使旧状态残留“高龄津贴谁能申请”，传下去也会变成“高龄津贴”。
- 提取不出对象时不覆盖，不保存整句。
- 同时移除已不使用的 `normalizeGoal` 导入。

### 3.3 `RuleEngine` 显式传本轮 slots

文件：`src/sidepanel/dialogue/rule/RuleEngine.ts`

```ts
const hits = retrieveSegments(query, request.segments, 3, slots, request.utterance);
```

- 当前轮 `slots` 优先于上一轮话题。
- 同时传入当前话语，用于“当前话语内容词必须存在”的校验。

### 3.4 检索：章节优先 + 当前内容词保护

文件：`src/sidepanel/dialogue/retrieval/segmentRetriever.ts`

- 有本轮 `slots` 时按章节优先：
  - 条件 → “办理条件”
  - action → “办理流程”
  - material → “材料/证件”章节；无材料章节时回退流程章节
- 当前话语中的内容词（如“体检”）必须在页面语义段中出现，否则返回空，避免旧话题 + 泛词“条件”套用条件段。
- “那怎么办理”不再因为旧 `lastObject` 里的“谁”选条件。
- 材料追问补充“身份证/户口簿/原件”查询词，并优先流程段，避免混入发放标准。

### 3.5 成句

文件：`src/sidepanel/dialogue/answer/composer.ts`

- 材料槽位补充“身份证/户口簿/原件”句子词表。
- 保持同段最多 2 句，因此“那怎么办理”能同时表达网上申请与现场申请。

## 4. 修复后本地夹具全链路输出

报告：

- `codearts_proof/repro-bjsjs-after-fixture.json`

性质：公开页面原始条目夹具（26 条），不是真实网站验收。

```text
savedTopic: 高龄津贴
simulatedStateLastObject: 高龄津贴
```

第一轮：

```text
问：高龄津贴谁能申请
答：页面写明：具有本市户籍，且年满80周岁及以上的老年人可申请办理高龄老年人津贴。
引用：
- 办理条件：（ef-p-2）
- 具有本市户籍，且年满80周岁及以上的老年人可申请办理高龄老年人津贴。（ef-p-3）
```

第二轮：

```text
问：那怎么办理
答：页面写明：现场申请：可以就近在本市任一街道(乡镇)办事窗口出示居民身份证或户口簿原件提出申请。网上申请：申请人可登录北京市政务服务网、北京市民政局官方网站或微信公众号，输入姓名和身份证号码后填报申请。
引用：
- 办理流程：（ef-p-4）
- 现场申请正文（ef-p-8）
- 网上申请正文（ef-p-7）
```

两轮答案不同，引用不同；第二轮同时包含网上申请与现场申请。

### 4.1 旧整句话题反例

即使旧状态仍为：

```text
lastObject = 高龄津贴谁能申请
```

第二轮“那怎么办理”仍输出办理流程正文：

```text
现场申请：……出示居民身份证或户口簿原件提出申请……
网上申请：……填报申请。
```

引用：

```text
ef-p-4（办理流程标题）
ef-p-8（现场申请）
ef-p-7（网上申请）
```

不包含 `ef-p-2` / `ef-p-3` 条件引用。

### 4.2 材料追问

```text
问：那需要带什么
答：现场申请：……出示居民身份证或户口簿原件提出申请……（含第二段申请表/身份证或户口簿说明）
引用：办理流程标题 + 现场申请正文
```

不再混入“80-89 周岁每月 100 元”等发放标准。

### 4.3 无依据问题

```text
问：体检条件是什么
答：当前页面没有找到这项信息。
citations: []
```

## 5. 回归测试

文件：`scripts/selftest.mjs`

### AT-30

`真实公开页面捕获快照：两轮话题切换全链路`

- 使用 `scripts/fixtures/bjsjs-captured-items.json` 原始条目，`buildSegments` 生成语义段；
- 第一轮回答后使用 `extractReusableObject` 计算实际保存的话题，并通过 `conversationReducer` 的 `last-object` 更新状态；
- **没有手工指定 `lastObject="高龄津贴"`**；
- 第二轮使用更新后的状态；
- 检查两轮答案/引用不同、第二轮同时有网上申请/现场申请、引用为流程正文；
- 额外检查旧 `lastObject="高龄津贴谁能申请"` 反例仍输出流程；
- 检查材料追问含身份证/户口簿且不含 100 元；
- 检查“体检条件是什么”返回 `cannot-answer`。

### AT-31

`追问话题只保留业务对象，不保存问句`

- “高龄津贴谁能申请” → “高龄津贴”
- “那怎么办理” + 上一轮“高龄津贴” → “高龄津贴”
- “那需要带什么” + 上一轮“高龄津贴” → “高龄津贴”
- 旧“高龄津贴谁能申请”回退 → “高龄津贴”
- 无把握“怎么办” + 空标题 → `undefined`

## 6. 实际命令与结果

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | `TYPECHECK_EXIT_CODE=0` |
| `npm run build` | `BUILD_EXIT_CODE=0` |
| `npm run selftest` | `SELFTEST_EXIT_CODE=0`，22 项全部通过 |
| `npm run verify` | `VERIFY_EXIT_CODE=0` |
| `node scripts/repro-bjsjs-fixture.mjs` | 生成本地夹具两轮/材料/未知信息报告 |

日志：

- `codearts_proof/iteration2-typecheck-repeat-fix2.log`
- `codearts_proof/iteration2-selftest-repeat-final.log`
- `codearts_proof/iteration2-build-repeat-final.log`
- `codearts_proof/iteration2-verify-repeat-final.log`
- `codearts_proof/iteration2-selftest-repeat-fix1.log`（首次 AT-30 失败：未知问题误答条件）
- `codearts_proof/iteration2-selftest-repeat-fix2.log`（修复内容词保护后通过）
- `codearts_proof/iteration2-selftest-repeat-fix3.log`（材料章节回退后通过）

## 7. 修改文件

- `src/sidepanel/dialogue/context/topic.ts`（新增）
- `src/sidepanel/hooks/useConversation.ts`
- `src/sidepanel/dialogue/rule/RuleEngine.ts`
- `src/sidepanel/dialogue/retrieval/segmentRetriever.ts`
- `src/sidepanel/dialogue/answer/composer.ts`
- `scripts/selftest.mjs`
- `scripts/repro-bjsjs-fixture.mjs`
- `codearts_proof/repro-bjsjs-after-fixture.json`
- `codearts_proof/14-repeat-answer-fix.md`
- `dist/`（重新构建）

未修改：

- `public/manifest.json`
- 采集与高亮逻辑（本轮只改追问链路）

## 8. 未执行事项

1. 真实 Chrome 人工验收未在本轮执行。
2. 未在真实网站中重新输入两句话验证。
3. 未验证真实 Chrome 中连续点击“在网页中查看”的视图表现。
4. 本地夹具通过不等于真实 Chrome 验收通过。

## 9. 需要用户复测

1. `chrome://extensions` 重新加载 EasyFlow。
2. 回到目标网页刷新。
3. 关闭并重新打开侧边栏，从新对话开始（避免旧会话内存）。
4. 输入“高龄津贴谁能申请”，确认回答为办理条件正文。
5. 再输入“那怎么办理”，确认回答为办理流程正文，同时包含网上申请、现场申请、街道（乡镇）窗口、身份证或户口簿。
6. 再输入“那需要带什么”，确认仍为流程/证件与申请表内容，不出现发放金额。
7. 输入“体检条件是什么”，确认回答“当前页面没有找到这项信息”。

## 10. 结论

- 两处根因均已修复：话题只保存业务对象；检索显式使用本轮 slots 与话语。
- 22 项自测、构建、门禁真实通过，退出码均为 0。
- 本地公开页面原始条目夹具回归通过，不代表真实 Chrome 验收通过；真实网站仍需用户按第 9 节复测。