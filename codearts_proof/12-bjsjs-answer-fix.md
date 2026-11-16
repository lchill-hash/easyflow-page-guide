# 12 — 石景山高龄津贴错误答案精准修复

> 验证性质：本文件中的 Chrome 复现均为工程内公开 HTML 夹具（`file://`）复现，不是访问真实网站，也不是真实网站验收。真实网站验收未执行。

## 1. 问题现象

用户在主验收页实测：

- 问“高龄津贴谁能申请”
- 追问“那怎么办理”

两次都被回答为：

```text
页面写明：日期:2026-01-26 09:16 来源:北京市民政局
```

这是严重错误答案。现有 20 项自测没有覆盖该真实页面结构。

## 2. 修复前本地夹具复现（公开页面 HTML）

### 2.1 复现方式

在工程内建立公开页面 HTML 夹具，通过 `file://` 访问；不是连接真实网站：

- `scripts/fixtures/bjsjs-highlights.html`
- `scripts/repro-bjsjs.mjs`：Chrome headless 注入 `dist/content.js`，stub `chrome.runtime`，调用 content 采集，再由 Node 加载规则引擎，执行“采集 → 分段 → 检索 → 答案 → 校验”。

修复前报告：

- `codearts_proof/repro-bjsjs-before.json`

### 2.2 修复前本地夹具实测

```text
itemCount: 4
segmentsFromSnapshot: 3
segmentsRebuilt: 3
diagnostics.candidateCount: 7
diagnostics.visibleCount: 4
```

相关条目：

| elementId | 文本 | 类型 | 说明 |
|---|---|---|---|
| `ef-p-1` | 日期:2026-01-26 09:16 来源:北京市民政局 | paragraph | 页面元信息 |
| `ef-p-2` | 办理条件： | paragraph | 标题候选，但没有正文 |

相关语义段：

```text
seg-2  标题：高龄老年人津贴办理指南
       正文：日期:2026-01-26 09:16 来源:北京市民政局
       hasBody=true
seg-3  标题：办理条件：
       正文：无
       hasBody=false
```

缺失：

- “办理条件”后的正文 `div` 没有进入快照；
- “办理流程”标题和网上申请/现场申请正文 `div` 完全没有进入快照；
- 页面元信息 `p.f1` 被当成“高龄老年人津贴办理指南”的正文。

检索结果：

```text
q1 = 高龄津贴谁能申请
命中 seg-2，score=2.25
matchedKeywords = ["高龄", "津贴"]
正文 = 日期:2026-01-26 09:16 来源:北京市民政局

q2 = 那办理 高龄津贴
命中 seg-2，score=3.38
matchedKeywords = ["办理", "高龄", "津贴"]
正文 = 日期:2026-01-26 09:16 来源:北京市民政局
```

答案：

```text
页面写明：日期:2026-01-26 09:16 来源:北京市民政局
```

引用：

```text
role=title, text=高龄老年人津贴办理指南, elementId=ef-h-2
role=body,  text=日期:2026-01-26 09:16 来源:北京市民政局, elementId=ef-p-1
```

`validateResponse` 当时仍返回 `passed`，说明引用校验只检查“引用确实来自页面”，没有识别“元信息不能作为答案依据”。

## 3. 根因

1. **采集选择器过窄**
   - 只收 `p/li/dd/dt/blockquote/figcaption`，不收 `div`。
   - 该页正文由 `div` 承载，所以条件正文和流程正文全部漏采。
2. **语义段把页面元信息当正文**
   - “高龄老年人津贴办理指南”标题后面紧跟 `p.f1` 日期/来源；
   - `buildSegments` 未过滤日期、来源、分享、字号等页面元信息，导致元信息成为标题正文。
3. **检索没有章节/槽位优先**
   - “高龄津贴”命中指南标题；
   - “办理”命中指南标题里的“办理指南”；
   - 条件段只有标题、无正文，被 `hasBody` 过滤。
4. **成句只取一段一句**
   - 即使流程段存在，每个语义段只取一句，无法同时表达网上申请与现场申请。
5. **引用校验缺少元信息禁令**
   - 日期/来源引用可以通过“原文子串”校验。

## 4. 修复内容

### 4.1 采集：支持 div/span/strong/br 承载正文

文件：`src/content/collect.ts`

- 段落选择器增加 `div` 和块级 `span`：
  ```text
  p,li,dd,dt,blockquote,figcaption,div,span
  ```
- 对 `div` 增加容器噪声过滤：
  - 有块级子元素且直接文本 <20 字 → 视为容器，跳过；
  - 条件正文、流程正文这类无块级子元素的 `div` 正常采集。
- 对 `span`：
  - 位于 `div/p/li/...` 内的 inline span 跳过，避免与父元素重复；
  - 仅收集不在块级正文容器内、且 display 非 inline 的块级 span。
- `span/strong/br` 位于已采集的 `p/div` 内时，其文本由父元素 `innerText` 一并读取。
- `PARAGRAPH_INNER` 增加 `div`，继续做父子重复过滤。
- 仍不读 `input.value`，仍不写页面。

效果（固件快照）：

- 条目数从 4 增至 26；
- “办理条件”正文 `div` 被采集；
- “办理流程”标题 `div` 及网上申请、现场申请 `div` 被采集；
- 日期/来源 `p` 仍被采集但后续被语义段过滤。

### 4.2 语义段：过滤页面元信息

文件：`src/content/semantic.ts`

新增 `isBoilerplate`：

```text
日期 / 来源 / 分享 / 字号 / 扫一扫 / 打印 / 主办 / 承办 /
京ICP / 京公网安备 / 政府网站标识码 / 客服信箱 /
政务服务热线 / 建议您使用 / 关于我们 / 建议意见 / 站点地图 / 法律声明
```

以及 `YYYY-MM-DD HH:MM` 形式日期。

- 元信息不再作为标题候选；
- 元信息在正文扫描中跳过；
- 无标题页面的 fallback 段也过滤元信息；
- 条件标题只吸收紧随其后的条件正文，遇“办理流程”标题停止；
- 流程标题吸收流程正文，遇“发放标准”标题停止；实测流程段 472 字，包含网上申请与现场申请，不含发放标准。

### 4.3 意图与槽位

文件：`src/sidepanel/match/lexicon.ts`

- `PROCESS_VERBS` 移除“怎么申请/如何办理”，避免把文章中的办理方式误判为需要逐步点控件。
- `FACT_WH` 新增：
  - 怎么办理
  - 怎么去办
  - 怎么去申请
  - 如何申请
  - 如何办理
  - 怎么申请
  - 办理流程
  - 办理方式
- `SLOT_TERMS.condition` 移除“标准”，避免“发放标准”被误当资格条件。
- “带我去/下一步/点哪里”仍属于逐步陪办；只有当前页存在可操作控件时才生成步骤。

### 4.4 章节优先检索

文件：`src/sidepanel/dialogue/retrieval/segmentRetriever.ts`

- 新增章节优先级：
  1. 条件 / 资格 / 对象 / 要求
  2. 流程 / 步骤 / 方式 / 网上申请 / 现场申请
  3. 材料 / 证件 / 证明
  4. 地点 / 地址 / 窗口 / 线下 / 现场
  5. 时间 / 时限 / 工作日
  6. 电话 / 联系 / 咨询
  7. 标准 / 金额 / 补贴 / 津贴 / 补助
- 如果问题槽位命中了某个章节标题，只在该章节内检索；不再只因标题含“高龄津贴”或句子含“办理”就给高分。
- 未显式传槽位时，根据查询词推断章节。
- 查询中补充“办理流程/步骤/方式/网上申请/现场申请”等行动词。
- 过滤标题为日期/来源等元信息的段。

### 4.5 成句：同段可出多句，行动词加权

文件：`src/sidepanel/dialogue/answer/composer.ts`

- 每个语义段最多选 2 句，总句数仍 ≤3。
- `action` 槽位对“网上申请/现场申请”等长词加权（长词 +3，短词 +1）。
- 先选句子、按 180 字预算裁剪，再生成引用，避免引用句中未展示的句子。
- 引用仍保留标题锚点 + 对应正文锚点。

### 4.6 引用校验：元信息不得作为直接回答依据

文件：`src/sidepanel/dialogue/validate/validator.ts`

- 若直接回答的引用文本以日期、来源、分享、字号、扫一扫、主办、承办、页脚等开头，直接拒绝：
  ```text
  citation-mismatch
  ```
- 即使语义段或检索回归，也不会再把“日期/来源”展示为结论依据。

### 4.7 连续点击“在网页中查看”不堆叠提示

文件：`src/sidepanel/hooks/useConversation.ts`

- 高亮成功时不再向聊天追加“已经指给你看了”，由页面高亮本身反馈。
- 折叠、部分定位、失效等失败提示改为“与最后一条相同则不重复追加”。
- 连续点击同一依据不会在聊天里堆叠多条相同状态消息。

## 5. 修复后固件全链路报告

由于修复后的 Chrome 复现命令被当前环境阻止，使用公开页面 HTML 捕获的原始条目快照：

- 夹具：`scripts/fixtures/bjsjs-captured-items.json`
- 生成脚本：`scripts/generate-bjsjs-captured-items.mjs`
- 说明：26 条原始可见条目，来自公开页面 `p/div/strong` DOM 顺序，不是理想的 `SemanticSegment`。
- 报告：`codearts_proof/repro-bjsjs-after-fixture.json`

### 5.1 条目与语义段

```text
itemCount: 26
segmentCount: 5
```

关键段：

```text
seg-3 标题：办理条件：
      hasBody=true
      正文：具有本市户籍，且年满80周岁及以上的老年人可申请办理高龄老年人津贴。

seg-4 标题：办理流程：
      hasBody=true
      正文包含：
      - 1、提出申请
      - 网上申请：……
      - 现场申请：可以就近在本市任一街道(乡镇)办事窗口出示居民身份证或户口簿原件提出申请……
      - 注：……
      - 2、审核
      - 各街道(乡镇)受理窗口……
      不含“发放标准”。

seg-5 标题：发放标准：
      80-89 周岁、90-99 周岁、100 周岁及以上标准。
```

日期/来源条目仍在快照中，但**没有进入任何可作为答案的语义段**。

### 5.2 检索

```text
q1 query = 高龄津贴谁能申请 高龄津贴 条件 资格 对象
命中 seg-3（办理条件），score=2.7，matchedKeywords=["高龄","津贴","申请"]

q2 query = 那办理 高龄津贴 办理流程 步骤 方式 网上申请 现场申请 办理
命中 seg-4（办理流程），score=2.7，matchedKeywords=["办理流程","请现场申","申请现场"]
```

### 5.3 最终回答

问：“高龄津贴谁能申请？”

```text
页面写明：具有本市户籍，且年满80周岁及以上的老年人可申请办理高龄老年人津贴。
```

引用：

```text
role=title, text=办理条件：, elementId=ef-p-2
role=body,  text=具有本市户籍，且年满80周岁及以上的老年人可申请办理高龄老年人津贴。, elementId=ef-p-3
```

追问：“那怎么办理？”

```text
页面写明：现场申请：可以就近在本市任一街道(乡镇)办事窗口出示居民身份证或户口簿原件提出申请。网上申请：申请人可登录北京市政务服务网、北京市民政局官方网站或微信公众号，输入姓名和身份证号码后填报申请。
```

引用：

```text
role=title, text=办理流程：, elementId=ef-p-4
role=body,  text=现场申请：可以就近在本市任一街道(乡镇)办事窗口出示居民身份证或户口簿原件提出申请。, elementId=ef-p-8
role=body,  text=网上申请：申请人可登录北京市政务服务网、北京市民政局官方网站或微信公众号，输入姓名和身份证号码后填报申请。, elementId=ef-p-7
```

两次回答不同；均不包含日期/来源；两次 `validateResponse` 均为 `passed`。

## 6. 回归测试

文件：`scripts/selftest.mjs`

新增 AT-30：

```text
真实公开页面捕获快照：资格与办理流程全链路
```

覆盖：

- 原始条目中存在 `div` 条件正文；
- `buildSegments` 生成有正文的“办理条件”段和“办理流程”段；
- “高龄津贴谁能申请” → 直接回答，含“本市户籍”“80周岁”，不含日期/来源；
- “那怎么办理” → 直接回答，同时含“网上申请”“现场申请”，含“身份证/户口簿”；
- 两次回答不同；
- 所有引用不以日期/来源开头；
- `validateResponse` 两次均为 `passed`。

## 7. 实际命令与结果

| 命令 | 结果 |
|---|---|
| `node scripts/repro-bjsjs.mjs before codearts_proof\repro-bjsjs-before.json` | 成功，复现 4 条目与错误答案 |
| Chrome 修复后复现（带/不带 `--snapshot`） | 被当前环境阻止，未执行 |
| `node scripts/generate-bjsjs-captured-items.mjs` | 生成 26 条公开页面原始条目 |
| `node scripts/repro-bjsjs-fixture.mjs` | 生成修复后固件全链路报告 |
| `npm run build` | `BUILD_EXIT_CODE=0` |
| `npm run selftest` | `SELFTEST_EXIT_CODE=0`，21 项全部通过 |
| `npm run verify` | `VERIFY_EXIT_CODE=0` |

日志：

- `codearts_proof/iteration2-build-bjsjs-final3.log`
- `codearts_proof/iteration2-selftest-bjsjs-final3.log`
- `codearts_proof/iteration2-verify-bjsjs-final3.log`
- `codearts_proof/iteration2-selftest-bjsjs-fix1.log`（首次 AT-30 失败，流程回答未含网上申请）
- `codearts_proof/iteration2-selftest-bjsjs-fix2.log`（修复后 21 项通过）

## 8. 修改文件

- `src/content/collect.ts`
- `src/content/semantic.ts`
- `src/sidepanel/match/lexicon.ts`
- `src/sidepanel/dialogue/retrieval/segmentRetriever.ts`
- `src/sidepanel/dialogue/answer/composer.ts`
- `src/sidepanel/dialogue/validate/validator.ts`
- `src/sidepanel/hooks/useConversation.ts`
- `scripts/selftest.mjs`
- `scripts/fixtures/bjsjs-highlights.html`（新增）
- `scripts/fixtures/bjsjs-captured-items.json`（新增）
- `scripts/generate-bjsjs-captured-items.mjs`（新增）
- `scripts/repro-bjsjs.mjs`（新增）
- `scripts/repro-bjsjs-fixture.mjs`（新增）
- `codearts_proof/repro-bjsjs-before.json`
- `codearts_proof/repro-bjsjs-after-fixture.json`
- `codearts_proof/12-bjsjs-answer-fix.md`
- `dist/`（重新构建）

未修改：

- `public/manifest.json`（权限仍四项）
- `src/content/highlight.ts`
- `src/shared/errors.ts`
- `src/sidepanel/dialogue/rule/RuleEngine.ts`（章节优先通过检索器推断实现）

## 9. 未执行事项

1. 修复后 Chrome 真实页面采集复现：命令被环境阻止，未执行。
2. 修复后真实页面 DOM 条目数/语义段数未在浏览器中实测；AT-30 使用公开 HTML 捕获的原始条目快照。
3. Chrome 人工验收：问“高龄津贴谁能申请”、追问“那怎么办理”、展开网页依据、点击“在网页中查看”。
4. 浏览器内验证日期/来源不再出现为答案。
5. 未知信息（如“补贴多少钱”）的真实页面无依据回答。
6. 连续点击“在网页中查看”的轻量状态去重表现。
7. 性能与截图。

## 10. Chrome 中仍需人工确认

1. `chrome://extensions` 重新加载扩展，回到目标页刷新，重新点击 EasyFlow 图标。
2. 问“高龄津贴谁能申请”，确认回答出现“本市户籍”“80 周岁及以上”，不是日期/来源。
3. 追问“那怎么办理”，确认回答出现“网上申请”“现场申请”，并提到街道（乡镇）窗口、身份证或户口簿原件。
4. 展开“网页依据”，确认引用为“办理条件/办理流程”正文，不是日期/来源。
5. 点击“在网页中查看”，确认高亮的是条件/流程正文，不是署名或页面顶部。
6. 问“补贴多少钱”或页面没有的信息，确认回答“当前页面没有找到这项信息”，不编造。
7. 若仍出现日期/来源，查看“运行诊断”的条目数/语义段数，并反馈真实页面是否改版、正文是否仍在 `div` 中。

## 11. 结论

- 修复前问题已用公开页面 HTML 夹具完整复现并记录；这不代表真实网站验收通过。
- 代码层已完成采集、语义段、意图、章节检索、成句与引用校验修复。
- 21 项自测、构建与清单门禁真实通过，退出码均为 0。
- 修复后的真实网站采集与人工问答尚未执行，不能声称已在浏览器中最终验收通过。
- 运行时代码没有写入该网站的政策答案；夹具只存在于 `scripts/fixtures/`，不进入 `dist/` 运行链路。