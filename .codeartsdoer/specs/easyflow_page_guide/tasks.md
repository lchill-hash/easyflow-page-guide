# EasyFlow 页面指引扩展 — 编码任务清单

**输入依据**：`spec.md`（502 行，6 章）、`design.md`（937 行，含 2.1～2.12）
**编码根目录**：`D:\hwproject\translator`（当前仅有 `.codeartsdoer/` 与 `codearts_proof/`）
**交付形态**：Manifest V3 扩展，`dist/` 可直接"加载已解压的扩展程序"

## 执行顺序总览

| 顺序 | 任务组 | 依赖 | 关键产物 |
|---|---|---|---|
| 1 | 项目脚手架与构建基线 | 无 | `package.json`、`tsconfig.json`、`scripts/*.mjs`、`node_modules/` |
| 2 | 共享契约层 | 1 | `src/shared/{types,messages,errors,constants,domPath}.ts` |
| 3 | 清单与静态页面 | 1、2 | `public/manifest.json`、`public/sidepanel.html` |
| 4 | 页面采集（content 只读） | 2 | `src/content/{entry,normalize,collect,registry}.ts` |
| 5 | 定位与高亮（content） | 4 | `src/content/highlight.ts` |
| 6 | 后台编排（Service Worker） | 2、3 | `src/background/{index,tabContext,injector,router}.ts` |
| 7 | 规则匹配层（纯函数） | 2 | `src/sidepanel/match/{lexicon,ruleMatcher,summarize}.ts` |
| 8 | 侧边栏 UI | 2、6、7 | `src/sidepanel/**`（含 `App.tsx`、组件、状态机、样式） |
| 9 | 自动化验证 | 1～8 | `scripts/selftest.mjs`、typecheck/build/verify 通过记录 |
| 10 | Chrome 人工端到端验收 | 9 | E2E-01～E2E-15 结果 |
| 11 | 文档与阶段留痕 | 9、10 | `README.md`、`codearts_proof/03-impl-phase.md` |
| 12 | 最终复核与交付 | 全量 | 合规复核记录 |

并行说明：任务组 4/5 与任务组 6/7 在任务组 2 完成后可并行；任务组 8 必须等 6、7 的接口签名稳定后再进入联调。

---

## 1. 项目脚手架与构建基线

**依赖**：无。**建议顺序**：最先执行，是后续所有任务的编译前提。

### 1.1 初始化 `package.json`
- [ ] 创建 `package.json`：`private: true`、`type: "module"`、`engines.node >= 20`
- [ ] 声明运行时依赖 `react`、`react-dom`（18.3.x），构建依赖 `esbuild`，类型依赖 `typescript`、`@types/chrome`、`@types/react`、`@types/react-dom`，全部锁定到具体版本、不使用 `^` 宽范围
- [ ] 声明 scripts：`typecheck`=`tsc --noEmit`、`build`=`tsc --noEmit && node scripts/build.mjs && node scripts/verify-manifest.mjs`、`verify`=`node scripts/verify-manifest.mjs`、`selftest`=`node scripts/selftest.mjs`
- [ ] 确认无 `postinstall`/`preinstall` 脚本；不引入 UI 库、路由库、图表库、任何远程 SDK
- [ ] 验证：`Get-Content package.json` 人工核对依赖清单与 scripts 与 `design.md` 2.9.1 一致；`npm pkg get scripts` 输出四项脚本名齐全

### 1.2 创建 `tsconfig.json`
- [ ] 配置 `strict: true`、`noUncheckedIndexedAccess: true`、`noImplicitOverride: true`、`exactOptionalPropertyTypes: true`
- [ ] 配置 `target: "ES2022"`、`module: "ESNext"`、`moduleResolution: "Bundler"`、`jsx: "react-jsx"`
- [ ] 配置 `lib: ["ES2022","DOM","DOM.Iterable"]`、`types: ["chrome"]`、`skipLibCheck: true`、`noEmit: true`
- [ ] `include` 覆盖 `src/**/*`，`exclude` 排除 `dist`、`node_modules`
- [ ] 验证：`npx tsc --noEmit`（在 1.6 安装依赖后执行）必须 0 error；若因空 `src/` 报 "No inputs"，需在任务组 2 首个文件落地后立即复测

### 1.3 创建 `scripts/gen-icons.mjs`
- [ ] 用 `node:zlib` 的 `deflateSync` 手工编码 PNG（IHDR/IDAT/IEND + CRC32），零第三方依赖
- [ ] 输出 4 个尺寸 16/32/48/128 的纯色圆角底 + 简单几何标记到 `dist/icons/`
- [ ] 不在 `public/` 写入任何生成物
- [ ] 验证：单独执行 `node scripts/gen-icons.mjs` 后，用 `Get-ChildItem dist\icons` 确认 4 个文件存在且字节数 >0；`file` 头字节为 `89 50 4E 47`

### 1.4 创建 `scripts/build.mjs`（三入口）
- [ ] 按序实现：清理 `dist/` → 生成图标 → 三入口打包 → 复制静态资源
- [ ] 后台入口：`src/background/index.ts` → `dist/background.js`，`format: "esm"`、`bundle: true`、`splitting: false`、`target: "chrome116"`
- [ ] content 入口：`src/content/entry.ts` → `dist/content.js`，`format: "iife"`、`bundle: true`、`platform: "browser"`、`target: "chrome116"`
- [ ] 侧边栏入口：`src/sidepanel/main.tsx` → `dist/sidepanel.js` + `dist/sidepanel.css`，`format: "esm"`、`jsx: "automatic"`、`loader: { ".css": "css" }`、生产模式 `minify`
- [ ] 复制 `public/manifest.json`、`public/sidepanel.html` 到 `dist/`
- [ ] 任一入口失败立即 `process.exit(1)`，禁止"部分产物 + 成功退出码"；结束时打印产物清单与各文件体积
- [ ] 验证：任务组 2/3 文件落地后执行 `npm run build`，检查退出码为 0 且 `dist/` 内 7 类文件 + `icons/` 齐全

### 1.5 创建 `scripts/verify-manifest.mjs`
- [ ] 校验 `dist/manifest.json` 的 `permissions` 集合恰为 `["activeTab","scripting","sidePanel","storage"]`（顺序无关、不得多不得少）
- [ ] 校验不存在 `host_permissions`、`content_scripts`、`web_accessible_resources`、`externally_connectable`
- [ ] 校验 `manifest_version === 3`、`minimum_chrome_version >= "116"`、`background.service_worker === "background.js"`、`side_panel.default_path === "sidepanel.html"`
- [ ] 校验清单引用的所有文件在 `dist/` 中真实存在（`background.js`、`sidepanel.html`、4 个 icons）
- [ ] 校验 `content_security_policy.extension_pages` 不含 `unsafe-eval`/`unsafe-inline`/远程域名
- [ ] 任一项不合规以非零退出并打印具体违规项
- [ ] 验证：人为在临时副本清单中加入 `"host_permissions":["<all_urls>"]`，执行 `node scripts/verify-manifest.mjs` 必须失败；恢复后必须通过（验证后不得留下临时改动）

### 1.6 执行 `npm install` 并留存真实输出
- [ ] 在项目根目录执行 `npm install`，完整捕获 stdout/stderr
- [ ] 记录成功时的依赖树摘要（`npm ls --depth=0`）与 `package-lock.json` 是否生成
- [ ] 若安装失败，保留原始错误文本，给出镜像源替代建议后重试；不得跳过该步骤
- [ ] 验证：`Test-Path node_modules`、`Test-Path package-lock.json` 均为 True；`npx tsc --version` 可执行

---

## 2. 共享契约层（`src/shared/`）

**依赖**：1.1、1.2。**建议顺序**：紧随脚手架，是 content、background、sidepanel 的唯一类型来源。

### 2.1 `src/shared/types.ts`
- [ ] 定义 `PageSnapshot`：`snapshotId`、`runId`、`schemaVersion: 1`、`url`、`origin`、`domain`、`title`、`titleMissing`、`capturedAt`、`itemCount`、`items`、`truncated`
- [ ] 定义 `ElementItem`：`elementId`、`type`、`text`、`textLength`、`truncated`、`order`、`region`、`domPath`、`textHash`、`tagName`、可选 `labelSource`
- [ ] 定义 `ItemType`（`heading|paragraph|link|button|inputLabel`）、`Region`（`main|nav|header|footer|aside|unknown`）
- [ ] 定义 `ElementRef`、`GuidanceCard`（含 `summary`、`excerpt`、`excerptTruncated`、`matchedKeywords`、`score`、`rank`）
- [ ] 定义 `AnalysisRun`（`mode: "rule-demo"` 固定字面量）、`RunStatus`（`success|partial|no-evidence|inject-failed|timeout|invalid-goal|stale`）
- [ ] 定义 `CollectDiagnostics`、`MatchDiagnostics`、`MatchResult`、`MatchStrategy` 接口
- [ ] 新增字段一律可选、不得改变既有字段语义（`spec.md` 4.5.4）
- [ ] 验证：`npx tsc --noEmit` 通过；评审时抽查 `AnalysisRun.mode` 为字面量类型而非 `string`

### 2.2 `src/shared/messages.ts`
- [ ] 定义消息常量：`EF_GET_CONTEXT`、`EF_COLLECT`、`EF_HIGHLIGHT`、`EF_SAVE_GOAL`、`EF_LOAD_GOAL`（侧边栏↔后台）与 `EF_CONTENT_COLLECT`、`EF_CONTENT_HIGHLIGHT`、`EF_CONTENT_PING`（后台↔content）、`EF_PAGE_CHANGED`（广播）
- [ ] 为每类消息定义请求/响应判别联合类型，统一携带 `v: 1` 与 `requestId`
- [ ] 定义响应包装 `EfResponse<T> = { ok: true; data: T } | { ok: false; error: EfError }`
- [ ] 断言所有消息体为可结构化克隆的纯 JSON（无 DOM 引用、无 `Map`/`WeakMap`、无函数）
- [ ] 验证：`npx tsc --noEmit` 通过；`Grep` 确认 `src/shared/messages.ts` 内无 `any`

### 2.3 `src/shared/errors.ts`
- [ ] 定义错误码联合 `EF-E001`～`EF-E013`，与 `design.md` 2.7.1 表逐条对齐
- [ ] 为每个错误码定义：`code`、`message`（用户可见中文文案）、`retryable`、`action`（下一步动作提示）
- [ ] 提供 `toEfError(unknown)` 归一化函数，把 Chrome `lastError`、超时、异常映射到错误码
- [ ] 验证：`Grep` 统计错误码数量为 13；随机取 3 个码核对文案与设计表一致

### 2.4 `src/shared/constants.ts`
- [ ] 集中定义：`CONTENT_VERSION`、`MAX_ITEMS=3000`、`MAX_TEXT_LENGTH=300`、`MAX_EXCERPT=240`、`MAX_SUMMARY=40`、`MAX_GOAL_LENGTH=200`、`COLLECT_TIMEOUT_MS=3000`、`LOCATE_TIMEOUT_MS=1000`、`PING_TIMEOUT_MS=300`、`HIGHLIGHT_TTL_MS=3000`、`CHAR_BUDGET=400000`
- [ ] 不在此文件放入任何站点相关字符串或政策文本
- [ ] 验证：`Grep` 检查无第三方域名、无政策业务词；数值与 `design.md` 2.3.2、2.4、2.6 一致

### 2.5 `src/shared/domPath.ts`
- [ ] 实现 `buildDomPath(el)`：`tag:nth-of-type` 链，最多 12 层，超出取尾段
- [ ] 实现 `isValidDomPath(path)`：白名单字符校验（标签名、`nth-of-type`、`>`），拒绝一切引号/括号/伪类，供 `querySelector` 前把关
- [ ] 实现 `textHash(text)`：32 位 FNV-1a → 十六进制字符串
- [ ] 实现 `normalizeWhitespace` 供 content 与 matcher 共用的纯字符串处理（不含 DOM 访问）
- [ ] 验证：`npm run selftest` 中包含 `textHash` 同输入稳定性与 `isValidDomPath` 非法输入拒绝用例

---

## 3. 清单与静态页面

**依赖**：1.4、1.5、2.2。**建议顺序**：与任务组 2 同批完成，`npm run verify` 在此组收口。

### 3.1 创建 `public/manifest.json`
- [ ] 设置 `manifest_version: 3`、`name`（含 EasyFlow）、`version`、`description`、`minimum_chrome_version: "116"`
- [ ] `permissions` 严格为 `["activeTab","scripting","sidePanel","storage"]`
- [ ] 配置 `background.service_worker: "background.js"` + `type: "module"`
- [ ] 配置 `side_panel.default_path: "sidepanel.html"` 与 `action.default_title`、`action.default_icon`（4 尺寸）
- [ ] 配置 `icons`（16/32/48/128）指向 `icons/icon*.png`
- [ ] 配置 `content_security_policy.extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'"`
- [ ] 明确不写 `host_permissions`、`content_scripts`、`web_accessible_resources`、`externally_connectable`、`tabs`
- [ ] 验证：`node scripts/verify-manifest.mjs` 通过；`Grep -i "all_urls|host_permissions|content_scripts" public/manifest.json` 无命中

### 3.2 创建 `public/sidepanel.html`
- [ ] 加载 `sidepanel.css` 与 `sidepanel.js`（`type="module"`），`<html lang="zh-CN">`
- [ ] 设置 `meta charset`、`viewport`、标题含 EasyFlow；提供 `#root` 挂载点
- [ ] 不引用任何 CDN、远程字体、远程图片
- [ ] 验证：`Grep "http" public/sidepanel.html` 无外部地址；构建后 `dist/sidepanel.html` 与源文件一致

### 3.3 清单与产物自检收口
- [ ] 执行 `npm run build`，确认 `verify-manifest` 作为构建链最后一步被调用
- [ ] 逐项核对 `dist/` 产物：`manifest.json`、`background.js`、`content.js`、`sidepanel.html`、`sidepanel.js`、`sidepanel.css`、`icons/` 四个 PNG
- [ ] 验证：退出码 0；`Get-ChildItem dist -Recurse` 输出与 `design.md` 2.9.3 清单一一对应

---

## 4. 页面采集（content 只读）

**依赖**：2.1、2.2、2.3、2.4、2.5、4 组内部顺序 4.2→4.3→4.4→4.1。**建议顺序**：与任务组 6/7 并行。

### 4.1 `src/content/normalize.ts`
- [ ] 实现全角标点转半角、`\u00a0`→空格、连续空白（含换行）→单空格、去首尾空白
- [ ] 实现长度截断：单条 ≤300 字符，超出追加 `…` 并返回 `truncated=true`
- [ ] 实现无效条目判定：归一化后长度 <2 的丢弃；纯符号丢弃；`button` 允许 1 字符
- [ ] 不读取任何节点 `value`
- [ ] 验证：`npm run selftest` 覆盖 T-08（`\u00a0`、全角标点、连续换行）与超长截断用例

### 4.2 `src/content/registry.ts`
- [ ] 用 `WeakMap<Element, ElementItem>` 实现会话内元素 ID 稳定分配
- [ ] ID 格式 `ef-<type 首字母>-<序号>`（`ef-h-`/`ef-p-`/`ef-l-`/`ef-b-`/`ef-i-`），同会话多次采集复用同一 ID
- [ ] 维护 `Map<elementId, Element>` 供高亮定位使用；不向 DOM 写入任何标记属性（禁止 `data-*` 落盘到页面）
- [ ] 提供 `lookup(elementId)`、`resetIfStale()`
- [ ] 验证：人工在验收页连续两次"重新读取"，同一元素 `elementId` 一致；`Grep "setAttribute|dataset" src/content/registry.ts` 无命中

### 4.3 `src/content/collect.ts`
- [ ] 五类选择器矩阵按 `design.md` 2.4.1 表实现：heading / paragraph / link / button / inputLabel 各一次 `querySelectorAll`
- [ ] paragraph 跳过"仅含块级子节点且自身直接文本 <20 字符"的容器；嵌套标题只留最内层
- [ ] link 跳过无文本的纯图标链接，不读取 `href` 目标
- [ ] inputLabel 只读标签链路 `labels[]` → `aria-label` → `aria-labelledby` → `placeholder` → 邻近 `label`/`td`；排除 `type=password`/`hidden`；**绝不读取 `value`**
- [ ] 可见性过滤顺序执行：祖先链 `[hidden]`/`aria-hidden="true"`/`<template>` → `checkVisibility` 或 `getComputedStyle`（`display`/`visibility`/`opacity`）→ `getBoundingClientRect` 宽高为 0；不使用 `offsetParent` 判断
- [ ] 确保"长页面视口外但未隐藏"的内容必须被采集
- [ ] 区域判定：`closest("main,article,nav,header,footer,aside")` → `region`，未命中 `unknown`
- [ ] 预算控制：条目上限 3000、字符预算 400k，超限按文档顺序保留并置 `truncated=true`，计入 `droppedByBudget`
- [ ] 组装 `PageSnapshot`：`url/origin/domain` 取自 `location`，标题空时用域名占位并 `titleMissing=true`
- [ ] `performance.now()` 记录 `collectMs`，填充 `CollectDiagnostics`
- [ ] 只采集主文档，不进入 iframe；全程仅调用只读 API（`querySelectorAll`/`getComputedStyle`/`getBoundingClientRect`/`innerText`/`labels`/`closest`/`getAttribute`）
- [ ] 验证：`Grep "setAttribute|classList\.|\.style\.|appendChild|outerHTML|innerHTML" src/content/collect.ts` 无写操作命中；合成 DOM 自测覆盖 T-09（3001 条截断至 3000 且 `truncated=true`）

### 4.4 `src/content/entry.ts`
- [ ] IIFE 包裹；顶层先检查 `window.__EASYFLOW_CONTENT__`：版本一致则直接返回，版本不同则移除旧监听并覆盖
- [ ] 顶层同步注册 `chrome.runtime.onMessage` 监听，处理 `EF_CONTENT_PING`、`EF_CONTENT_COLLECT`、`EF_CONTENT_HIGHLIGHT`
- [ ] 采集处理先清理上一个高亮宿主，再执行采集，保证"采集后页面 DOM 与采集前一致"
- [ ] 消息响应为同步 `return` 或 `Promise`，均由 `requestId` 回显
- [ ] `console.debug("[EF]", { runId, phase, ms, counts })` 记录诊断，**不打印完整页面文本**（只打印长度与 hash 前 8 位）
- [ ] 不使用 `fetch`/`XMLHttpRequest`/`navigator.sendBeacon`
- [ ] 验证：`Grep "fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document.cookie" src/content/` 无命中；`npm run build` 后确认 `dist/content.js` 无 `import`/`export` 语句（IIFE 有效）

---

## 5. 定位与高亮（`src/content/highlight.ts`）

**依赖**：4.2、4.3、2.5。**建议顺序**：紧随任务组 4。

### 5.1 四级降级定位
- [ ] 第一级：`registry` 内存引用，`isConnected` 且 `textHash` 一致即命中
- [ ] 第二级：`isValidDomPath` 通过后 `querySelector(domPath)`，`textHash` 一致才命中
- [ ] 第三级：元素存在但不可见（折叠容器/`details` 未展开）→ 返回 `folded`，**不代替用户展开、不点击**
- [ ] 第四级：全部失败 → 返回 `stale`，不滚动到任何位置
- [ ] 验证：自测覆盖 `isValidDomPath` 非法路径被拒绝；人工切换页面结构后点击"查看原文"得到 `stale` 文案而非误跳

### 5.2 Shadow DOM 叠加层生命周期
- [ ] 创建 `<div data-ef-overlay>` 挂到 `document.documentElement`，`attachShadow({mode:"closed"})`，shadow 内 `all: initial`
- [ ] 宿主仅设置 `position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none` 内联样式，不新增 `<style>`/`<link>`
- [ ] 坐标 = `rect.left + scrollX` / `rect.top + scrollY`，盒尺寸外扩 4px，2px 描边 + 12% 透明填充 + 圆角
- [ ] `scrollIntoView({block:"center", inline:"nearest", behavior:"smooth"})`；`prefers-reduced-motion` 时用 `auto`
- [ ] 存活期内监听 `scroll`（passive）与 `resize`，用 `requestAnimationFrame` 合并更新
- [ ] 3 秒后 `cleanup()`：移除宿主与所有监听器；重复点击先 `cleanup()` 再新建，全局最多 1 个 overlay
- [ ] 不调用 `click()`/`focus()`/`dispatchEvent`/`form.submit()`/`select()`，不读写 `localStorage`/`cookie`/`clipboard`
- [ ] 验证：`Grep "click\(|\.focus\(|dispatchEvent|submit\(|setAttribute|\.style\." src/content/highlight.ts` 仅允许出现 overlay 宿主自身的 `style` 赋值；人工检查高亮结束后 `document.documentElement.childNodes` 数量恢复

---

## 6. 后台编排（Service Worker）

**依赖**：2.1、2.2、2.3、2.4、3.1。**建议顺序**：6.2→6.3→6.4→6.1→6.5。

### 6.1 `src/background/tabContext.ts`
- [ ] 实现 `getActiveTab()`：`chrome.tabs.query({active:true, lastFocusedWindow:true})`，**只取 `tabId`/`windowId`，不读 `tab.url`/`title`**
- [ ] 实现可注入性预判：仅允许 `http:`/`https:`，对 `chrome://`、`chrome-extension://`、`about:`、`view-source:`、Chrome 应用商店、`file://` 返回 `EF-E002`
- [ ] 无活动页返回 `EF-E001`；标签页不存在返回 `EF-E004`
- [ ] 验证：在 `chrome://extensions` 页面打开侧边栏，界面出现"当前页面不支持读取"（E2E-12）；`Grep "tab\.url|tab\.title" src/background/` 无命中

### 6.2 `src/background/injector.ts`
- [ ] 用 `chrome.scripting.executeScript({target:{tabId}, files:["content.js"]})` 注入，捕获 `lastError` 映射 `EF-E005`
- [ ] 注入后发 `EF_CONTENT_PING`（最多 2 次、间隔 150ms），确认监听器就绪；版本不一致则强制重新注入
- [ ] 维护"已注入"标记；`onUpdated(status="complete")` 后复位为未注入
- [ ] 注入 Promise resolve 成功后方可转发采集消息
- [ ] 验证：`npm run build` 后 `dist/content.js` 存在且可被 `files` 引用；人工刷新页面后点"重新读取"能自动重新注入成功

### 6.3 `src/background/router.ts`
- [ ] 实现消息路由：`EF_GET_CONTEXT`、`EF_COLLECT`、`EF_HIGHLIGHT`、`EF_SAVE_GOAL`、`EF_LOAD_GOAL`
- [ ] 运行时入参校验：`tabId` 为正整数；`elementId` 匹配 `^ef-[hplbi]-\d{1,5}$`，非法返回 `EF-E010`/`EF-E002`
- [ ] 超时用 `Promise.race`：采集 3000ms（`EF-E006`）、定位 1000ms、PING 300ms；超时返回结构化错误而非抛异常
- [ ] 维护 `Map<tabId, Promise>` 单飞锁：同一标签页并发 `EF_COLLECT` 合并为一次
- [ ] 迟到响应按 `runId`/`requestId` 丢弃，不写入结果
- [ ] `EF_SAVE_GOAL`/`EF_LOAD_GOAL` 仅写 `goal`（≤200 字符）与 `updatedAt`；`storage` 不可用时降级内存并返回 `EF-E013` 提示，不阻塞主流程
- [ ] 验证：`Grep "chrome.storage" src/` 只出现在 router 的目标读写处；自测/人工确认快速连点两次"重新读取"不产生两份快照错配

### 6.4 `src/background/index.ts`
- [ ] 顶层同步注册：`chrome.runtime.onMessage`、`chrome.tabs.onActivated`、`chrome.tabs.onUpdated`、`chrome.runtime.onInstalled`
- [ ] 调用 `chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true})`，并注册 `chrome.action.onClicked` 作为兜底（`sidePanel.open({tabId})`）；两条路径互斥，不重复打开
- [ ] 后台不持有快照/卡片，仅做无状态路由
- [ ] 验证：`npm run build` 后 `dist/background.js` 含顶层监听注册；Chrome 加载后点击图标侧边栏打开且不切换标签页

### 6.5 标签页事件广播
- [ ] `onActivated`/`onUpdated(status="complete")` → 向侧边栏广播 `EF_PAGE_CHANGED`，仅携带 `tabId` 与 `kind`（`activated|navigated|reloaded`）
- [ ] 广播失败（侧边栏未打开）时静默忽略，不抛未捕获异常
- [ ] 不携带 URL/标题，避免依赖 `tabs` 权限
- [ ] 验证：切换标签页后侧边栏出现"页面已切换，请重新读取"且分析按钮禁用（E2E-11）

---

## 7. 规则匹配层（纯函数，规则演示模式）

**依赖**：2.1、2.4。**建议顺序**：与任务组 6 并行，供任务组 8 调用。

### 7.1 `src/sidepanel/match/lexicon.ts`
- [ ] 维护停用词表（代词、助词、疑问词、通用动词）与语气词剥离规则
- [ ] 维护同义词组（如"申请条件"→条件/资格/对象/标准/要求；"线下办理"→办理/窗口/受理/现场/地点），组内最多取 8 个
- [ ] 维护区域权重与长度阻尼参数、`MIN_SCORE`、相对阈值系数 0.35
- [ ] **只含语言层面的通用词与同义关系**，不含任何政策条文、办理流程、机构名称、电话号码
- [ ] 词库以独立常量对象导出，可整体替换为 JSON
- [ ] 验证：人工通读词库，确认无第三方站点业务内容；`Grep` 检查无验收页专有名词

### 7.2 `src/sidepanel/match/ruleMatcher.ts`
- [ ] 实现 `MatchStrategy` 接口的首个实现 `RuleMatcher`，`mode: "rule-demo"`，同步纯函数
- [ ] 目标校验：`trim` 后 1–200 字符；空 → `invalid-goal`（"请先输入你想了解的内容"）；>200 → 提示精简；仅停用词 → 提示补充更具体的关键词
- [ ] 目标归一化：全角转半角、去标点空白、英文小写、去语气词
- [ ] 关键词组生成：2/3/4 字滑窗 n-gram（丢单字）+ 同义词组，最多 8 组
- [ ] 打分实现 `design.md` 2.5.2 公式：`base`（exact=1.0、synonym=0.5、每组一次、最多 3 组）× `titleBonus` × `regionWeight` × `lengthDamp`，保留 2 位
- [ ] 阈值：绝对 `MIN_SCORE=1.0`，相对 `max(MIN_SCORE, topScore×0.35)`
- [ ] 排序：`finalScore` 降序，同分按 `order` 升序
- [ ] 去重：3-gram Jaccard ≥0.75 或 `domPath` 互为前缀且文本互相包含 → 跳过，保留分高者
- [ ] 数量裁决（K-01）：候选 ≥3 取前 5；候选 1–2 返回 `partial` + 实际卡片 + "仅找到少量相关片段"；候选 0 → `no-evidence` + 卡片数 0；不得补造卡片
- [ ] 全程使用 `String.prototype.includes`，禁止把用户输入拼进 `RegExp` 或 CSS 选择器
- [ ] 输出 `AnalysisRun`（唯一 `runId`、`snapshotId`、`mode`、`status`、`cards`、`diagnostics`）
- [ ] 验证：`npm run selftest` 覆盖 T-03（≥3 条相关→3 张、score 降序）、T-04（无关→`no-evidence`+0 张）、T-05（2 条命中→2 张+`partial`）、T-06（空/停用词/201 字→`invalid-goal`）、T-07（父子重复→去重后 1 条）

### 7.3 `src/sidepanel/match/summarize.ts`
- [ ] `summary`（≤40 字）：在原文中定位首个命中位置，取 `[pos-8, pos+32]` 窗口，按标点/空格边界收缩，前后加 `…`，超长硬截断；**必须为原文子串**
- [ ] `excerpt`（≤240 字）：取条目归一化全文，超长截断加 `…` 并置 `excerptTruncated`
- [ ] `matchedKeywords`：记录命中的目标词或同义词面
- [ ] 不生成、不改写、不拼接任何页面外事实
- [ ] 验证：`npm run selftest` 断言每张卡片 `summary.length <= 40` 且 `sourceText.includes(summary.replace(/^…|…$/g,""))` 为真

---

## 8. 侧边栏界面（React）

**依赖**：2.1～2.4、6.1～6.5、7.1～7.3。**建议顺序**：8.1→8.2→8.3→8.4→8.5→8.6→8.7→8.8。

### 8.1 状态层 `src/sidepanel/state/`
- [ ] 实现 `initialState.ts` 与 `sessionReducer.ts`，状态机覆盖 `Idle → Resolving → Collecting → Ready / InjectFailed / Unsupported`、`Analyzing → Ready/Partial/NoEvidence/InvalidGoal`、`Locating → Ready/StaleRef`、`Dirty`
- [ ] 进入 `Collecting` 同步清空 `cards` 与 `goalResult`（禁止陈旧卡片）
- [ ] `Dirty` 状态禁用"分析当前页"
- [ ] 所有异步响应以 `runId + snapshotId` 作废过期结果
- [ ] 验证：`npm run selftest` 或临时脚本驱动 reducer 走"Ready→Dirty→Collecting"序列，断言 `cards` 长度归零

### 8.2 会话钩子 `src/sidepanel/hooks/usePageSession.ts`
- [ ] 挂载即发 `EF_GET_CONTEXT` + `EF_COLLECT(reason:"initial")`，先渲染骨架再异步补全
- [ ] 提供 `refresh()`（重新读取）、`analyze(goal)`、`highlight(ref)` 三个动作
- [ ] 监听 `EF_PAGE_CHANGED` → 置 `Dirty` 并显示提示
- [ ] 挂载时 `EF_LOAD_GOAL` 恢复目标；目标变更时 `EF_SAVE_GOAL`（≤200 字符）
- [ ] 为每个错误码接住并转成 UI 可显示的状态，不抛未捕获异常
- [ ] 首次渲染到可见骨架 ≤1.5s（不等采集完成）
- [ ] 验证：Chrome 中使用 DevTools 检查侧边栏首屏先出现标识与骨架，随后页面信息补全

### 8.3 `src/sidepanel/App.tsx`
- [ ] 组合 `PageInfo`、`GoalForm`、`ModeBadge`、`StatusBanner`、`CardList`、`RunLog`
- [ ] 首屏可见 **EasyFlow 标识**（文本或内联 SVG，无外部图片）
- [ ] 不出现报名入口、机构导航、广告位、营销内容
- [ ] 加载态覆盖所有 >500ms 操作
- [ ] 验证：侧边栏首屏截图可见 EasyFlow 标识；`Grep "报名|广告|banner-ad" src/sidepanel/` 无命中

### 8.4 头部与输入组件
- [ ] `components/PageInfo.tsx`：展示域名与页面标题；标题缺失时展示域名并标注"页面无标题"
- [ ] `components/GoalForm.tsx`：目标输入框（placeholder 为"我想知道高龄津贴的申请条件和线下办理方式"）、"分析当前页"按钮、"重新读取页面"按钮
- [ ] 目标为空点分析 → 提示"请先输入你想了解的内容"并使输入框聚焦，不执行匹配
- [ ] `components/ModeBadge.tsx`：常驻展示"规则演示模式"，文案不得出现 `AI`/`模型`/`大模型`/`智能体`/`推理`
- [ ] `components/StatusBanner.tsx`：错误横幅展示错误文案 + 下一步动作；不覆盖已有卡片
- [ ] 验证：输入框为空时可见示例；`Grep -i "AI|大模型|智能体|模型分析" src/sidepanel/` 无命中（允许 `rule-demo`/`规则演示`）

### 8.5 卡片组件
- [ ] `components/CardList.tsx`：按 `rank` 渲染卡片列表，卡片区顶部展示"规则演示模式"标识
- [ ] `components/Card.tsx`：展示 `summary`、`excerpt`、`elementId`、"查看原文"按钮、`matchedKeywords`
- [ ] 所有文本以 React 文本节点渲染，禁止 `dangerouslySetInnerHTML`/`innerHTML`
- [ ] "查看原文"点击 → 发 `EF_HIGHLIGHT`，按返回 `highlighted|stale|folded` 展示对应轻提示
- [ ] 无依据状态：卡片 0 张 + "当前页面未找到依据" + 更换关键词/重新读取建议
- [ ] 少量命中状态：展示实际卡片 + "仅找到少量相关片段"
- [ ] 验证：`Grep "dangerouslySetInnerHTML|innerHTML" src/sidepanel/` 无命中；人工核对卡片数与提示文案

### 8.6 诊断区 `src/sidepanel/diagnostics/RunLog.tsx`
- [ ] 折叠展示 `runId`、`collectMs`、`matchMs`、`items`、`truncated`、`contentVersion`、命中数
- [ ] 不展示页面原文，不展示用户完整输入以外的敏感信息
- [ ] 验证：展开后可见运行 ID 与耗时；关闭后不占首屏空间

### 8.7 样式 `src/sidepanel/styles/sidepanel.css`
- [ ] 适配 320–480px 侧边栏宽度，长文本可换行不溢出
- [ ] 卡片、横幅、徽标、折叠区样式完整；不使用远程字体与远程资源
- [ ] 验证：构建后生成 `dist/sidepanel.css`；Chrome 侧边栏中拖动窗口宽度无横向滚动错乱

### 8.8 入口 `src/sidepanel/main.tsx`
- [ ] `createRoot` 挂载 `App` 到 `#root`，引入 `styles/sidepanel.css`
- [ ] 无路由、无外部请求
- [ ] 验证：`npm run build` 产出 `dist/sidepanel.js`；加载扩展侧边栏能渲染（非空白）

---

## 9. 自动化验证

**依赖**：任务组 1～8 完成。**建议顺序**：9.1→9.2→9.3→9.4。

### 9.1 `scripts/selftest.mjs`（T-03～T-09）
- [ ] 用 esbuild 将 `ruleMatcher`/`summarize`/`normalize`/`domPath` 打包为临时 ESM 供 `node:test` 导入
- [ ] 用例样例**只使用合成文本**（如"示例条款甲/乙"），不得内置验收页政策原文
- [ ] 覆盖 T-03、T-04、T-05、T-06、T-07、T-08、T-09
- [ ] 验证：`npm run selftest` 退出码 0 且输出用例通过数；临时产物写入系统临时目录或构建后清理，不落到 `dist/`

### 9.2 类型门禁
- [ ] 执行 `npm run typecheck`（`tsc --noEmit`）
- [ ] 修复所有类型错误，不使用 `any`/`as any`/`@ts-ignore` 绕过
- [ ] 验证：退出码 0，输出 "Found 0 errors"；`Grep ": any|as any|@ts-ignore|@ts-expect-error" src/ scripts/` 无命中

### 9.3 完整构建与清单自检
- [ ] 执行 `npm run build`（内部含 `tsc --noEmit` → esbuild 三入口 → 复制静态资源 → 生成图标 → `verify-manifest`）
- [ ] 记录完整输出、各产物体积、退出码
- [ ] 验证：退出码 0；`dist/` 7 类产物 + 4 个图标齐全；`npm run verify` 单独复跑亦通过

### 9.4 只读与无远程依赖门禁
- [ ] 全量检索 `src/`：`fetch(`、`XMLHttpRequest`、`sendBeacon`、`WebSocket`、`<all_urls>`、`postinstall`
- [ ] 全量检索写入类 DOM API：`setAttribute`、`classList.`、`appendChild`、`innerHTML`（`highlight.ts` 的 overlay 宿主创建与 `collect.ts` 的只读读取需逐处评审说明）
- [ ] 检索界面禁用表述：`AI`、`大模型`、`智能体`、`模型规划`
- [ ] 检索第三方站点业务内容：验收页专有政策词是否出现在 `src/`、`scripts/`、测试样例中
- [ ] 验证：四项检索结果写入 `codearts_proof/03-impl-phase.md`，每处命中给出"允许/需修正"判定与理由

---

## 10. Chrome 人工端到端验收

**依赖**：9.3 构建成功。**建议顺序**：10.1→10.2→10.3→10.4→10.5。

### 10.1 加载扩展
- [ ] `chrome://extensions` 开启开发者模式 → "加载已解压的扩展程序" → 选择 `dist/`
- [ ] 校验无加载错误、无额外权限警告（除 activeTab 类）、图标显示正常（E2E-01）
- [ ] 验证：扩展卡片无红色错误；`chrome://extensions` 详情页权限列表只显示主动申请的四项能力

### 10.2 主验收页核心路径
- [ ] 打开主验收页（`spec.md` 5.1.1.3 指定站点），点击扩展图标：侧边栏出现、不切换标签页、≤1.5s 见骨架与标识（E2E-02）
- [ ] 页面信息区显示 `www.bjsjs.gov.cn` 与真实页面标题，三控件齐备（E2E-03）
- [ ] 输入示例目标并点击"分析当前页"：卡片 3–5 张、按相关性排序、顶部"规则演示模式"、每卡含摘要/片段/元素 ID（E2E-04）
- [ ] 任取一张卡片，人工在页面中比对原文片段逐字一致（E2E-05）
- [ ] 记录：卡片数、摘要最大长度、元素 ID 样例、`collectMs`/`matchMs`

### 10.3 定位、无依据与只读校验
- [ ] 点击"查看原文"：≤500ms 元素进入视区并出现高亮，3s 后高亮消失（E2E-06）
- [ ] 高亮前后记录 `document.querySelectorAll("*").length` 与 3 个代表节点 `outerHTML`，比对完全一致；URL 与表单状态不变（E2E-07）
- [ ] 输入完全无关目标：卡片 0 张 + "当前页面未找到依据"（E2E-08）
- [ ] 改回相关目标：卡片随目标重算且无重复卡片（E2E-09）
- [ ] 输入框在执行采集与定位后，页面原有已填内容与勾选状态未变化

### 10.4 页面变化与异常路径
- [ ] 同域跳转/刷新后点"重新读取页面"：标题更新、旧卡片清空（E2E-10）
- [ ] 切换标签页后回到侧边栏：出现"页面已切换，请重新读取"，分析按钮禁用（E2E-11）
- [ ] 在 `chrome://extensions` 点击图标：侧边栏保留并显示"当前页面不支持读取…"，不白屏（E2E-12）
- [ ] 关闭侧边栏后重开：自动重新采集，不显示上次页面卡片（E2E-13）
- [ ] 断开网络后执行一次分析：仍能生成卡片或无依据结论（E2E-14）
- [ ] 打开同站可选首页重复图标→分析→查看原文（E2E-15）

### 10.5 性能实测记录
- [ ] 记录四项实测：侧边栏首屏呈现（阈值 1.5s）、单次采集（阈值 1s，观察 `collectMs`）、单次匹配（阈值 1s，观察 `matchMs`）、定位高亮反馈（阈值 500ms）
- [ ] 未达标项写明降级/优化措施或如实列为剩余问题
- [ ] 验证：实测值以表格形式写入 `codearts_proof/03-impl-phase.md`，格式"场景 | 实测 | 阈值 | 结论"

---

## 11. 文档与阶段留痕

**依赖**：9、10。**建议顺序**：11.1 与 11.2 可同批，11.3 最后收口。

### 11.1 `README.md`
- [ ] 章节顺序：项目简介 → 安装（Node/npm 版本）→ 构建（`npm install`、`npm run build`、`dist/` 位置）→ 加载已解压扩展 → 目标网址 → 操作步骤 → 预期界面与截图位置 → 常见错误 → 权限与隐私声明 → 第一轮范围与第二轮计划
- [ ] 常见错误章节覆盖 E002/E003/E005/E006/E007/E008/E009 的定位方法与处理步骤
- [ ] 说明"规则演示模式"为本地关键词匹配，明确本轮无模型调用
- [ ] 说明数量规则裁决（K-01）：命中 1–2 条展示实际数量并提示"仅找到少量相关片段"
- [ ] 说明第一轮限制：不采集 iframe、不读 `input.value`、不离开本地
- [ ] 截图位置以 `docs/screenshots/` 目录占位说明，未产出截图时如实标注
- [ ] 验证：按 README 从零操作可复现侧边栏与卡片结果（自测一遍流程）；`Grep -i "AI|大模型|智能体" README.md` 无禁用表述

### 11.2 `codearts_proof/03-impl-phase.md`
- [ ] 记录环境确认（Node 20.15.1 / npm 10.7.0）
- [ ] 记录 `npm install` 真实输出摘要与结果
- [ ] 记录 `npm run typecheck`、`npm run selftest`、`npm run build`、`npm run verify` 的命令与真实输出/退出码
- [ ] 记录构建失败与修复的完整过程（若有），保留修复前后两次输出
- [ ] 记录文件新增清单
- [ ] 记录 T-01～T-10 与 E2E-01～E2E-15 的逐条结果
- [ ] 记录性能实测表格
- [ ] 记录第九组四项检索门禁结果
- [ ] 验证：留痕内每条结论都能对应到一条已执行命令或一次人工操作；未执行项在专门章节声明

### 11.3 未执行事项如实声明
- [ ] 在 `03-impl-phase.md` 单列章节，逐项列出尚未执行的验证（如未实际加载扩展、未在目标站点完成的用例）
- [ ] 禁止把"理论上可运行""预计通过"写成已完成结论
- [ ] 验证：通读该章节，确认无愿望式表述

---

## 12. 最终复核与交付

**依赖**：全量任务。**建议顺序**：最后执行。

### 12.1 合规复核
- [ ] 复核清单权限仍恰为 4 项，`dist/` 与 `public/` 均无 `host_permissions`、`content_scripts`、`<all_urls>`
- [ ] 复核界面常驻"规则演示模式"，源码与 README 无 AI/模型/智能体规划表述
- [ ] 复核 `src/` 与测试样例无第三方站点政策原文，卡片内容全部来自快照
- [ ] 复核无任何远程请求与远程资源
- [ ] 验证：把四项复核结果写入 `03-impl-phase.md` 复核章节

### 12.2 只读性最终确认
- [ ] 复核采集路径无写操作，高亮仅新增 1 个 shadow 宿主并在 3s 后移除
- [ ] 复核未读取 `input.value`、未触碰 cookie/storage/clipboard
- [ ] 验证：`Grep` 结果 + E2E-07 节点对比记录双重佐证

### 12.3 交付总结
- [ ] 汇总产物位置（`dist/`）、构建命令、验收结论、剩余问题与限制
- [ ] 明确本轮不进入模型接入，第二轮范围另行规划
- [ ] 验证：交付说明中每条结论均可回溯到 `codearts_proof/` 中的记录