# 04 — 实现与构建阶段留痕

## 1. 阶段输入

本阶段按要求先读取了以下文档：

- 需求规格：`.codeartsdoer/specs/easyflow_page_guide/spec.md`
- 实现方案：`.codeartsdoer/specs/easyflow_page_guide/design.md`
- 任务清单：`.codeartsdoer/specs/easyflow_page_guide/tasks.md`
- 前序留痕：`codearts_proof/01-spec-phase.md`、`02-design-phase.md`、`03-tasks-phase.md`

阶段目标：按 `tasks.md` 任务组 1—9 落地 Manifest V3 + TypeScript + React 扩展，并真实执行安装、类型检查、构建、自测与门禁检索。

## 2. 用户指令与执行边界

- 用户明确要求：作品是“帮助用户操作真实第三方网页的浏览器指引智能体”，不得创建报名站、官网首页或静态设计稿。
- 用户明确要求：本轮使用 `activeTab + scripting + sidePanel` 最小权限，不申请所有网站永久访问。
- 用户明确要求：不得把政策正文写死在源码，卡片必须实时来自当前 DOM。
- 用户后续明确要求：**停止重试 `npm install`，不要清空代理或请求绕过网络限制；依赖已在 `node_modules` 中，直接运行 `npm run build`，修复编译错误，再重新构建，并保留报错和修复记录。**
- 本阶段遵守该指令：网络安装尝试在首次失败后停止；后续只执行本地构建、自测与校验。未清空代理，未尝试绕过网络限制。

## 3. 环境

| 项 | 值 |
|---|---|
| 平台 | Windows 10 / PowerShell |
| Node.js | 20.15.1（环境预置） |
| npm | 10.7.0（环境预置） |
| 构建 | esbuild 0.24.2、TypeScript 5.6.3 |
| 运行时 | React 18.3.1、React DOM 18.3.1 |
| 类型 | @types/chrome 0.0.287、@types/react 18.3.12、@types/react-dom 18.3.1 |

## 4. 依赖安装记录

### 4.1 首次在线安装：失败

命令：

```powershell
npm install 2>&1 | Tee-Object -FilePath codearts_proof\npm-install.log
```

真实错误（日志 `npm-install.log`）：

```text
Sandbox Network Error: hit restricted [127.0.0.1:7897]
```

原因：环境变量 `HTTP_PROXY` / `HTTPS_PROXY` 指向本机代理 `127.0.0.1:7897`，该地址被沙箱限制。按用户后续指令，未继续重试、未清空代理、未请求绕过限制。

失败后检查发现：

- `node_modules/` 已存在；
- `package-lock.json` 已存在；
- `node_modules` 包含 `react`、`react-dom`、`esbuild`、`typescript`、`@types/chrome` 等；
- npm 缓存中存在 `react@18.3.1`、`esbuild@0.24.2`、`typescript@5.6.3` 的 tarball。

### 4.2 离线安装校验：成功

命令：

```powershell
npm install --offline 2>&1 | Tee-Object -FilePath codearts_proof\npm-install.offline.log
```

真实输出：

```text
up to date, audited 17 packages in 11s
found 0 vulnerabilities
```

结论：依赖树完整，未再访问网络。

## 5. 编译错误与修复记录

### 5.1 第一次 `npm run typecheck`：10 个错误

日志：`codearts_proof/typecheck.log`

```text
src/background/injector.ts(39,26): error TS2339: Property 'data' does not exist on type 'EfResponse<PingData>'.
  Property 'data' does not exist on type 'EfFail'.
src/background/router.ts(261,27): error TS2339: Property 'requestId' does not exist on type 'never'.
src/content/collect.ts(124,43): error TS2339: Property 'innerText' does not exist on type 'Element'.
src/content/entry.ts(76,27): error TS2339: Property 'requestId' does not exist on type 'never'.
src/shared/domPath.ts(9,11): error TS7022: 'parent' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.
src/shared/domPath.ts(16,13): error TS18046: 'sibling' is of type 'unknown'.
src/sidepanel/App.tsx(1,33): error TS2307: Cannot find module '../../shared/types' or its corresponding type declarations.
src/sidepanel/App.tsx(6,24): error TS2307: Cannot find module './components/RunLog' or its corresponding type declarations.
src/sidepanel/match/lexicon.ts(1,29): error TS2307: Cannot find module '../shared/types' or its corresponding type declarations.
src/sidepanel/match/ruleMatcher.ts(219,50): error TS18048: 'regionWeight' is possibly 'undefined'.
```

对应修复：

| 文件 | 修复 |
|---|---|
| `src/background/injector.ts` | PING 响应类型守卫从 `EfResponse<PingData>` 收窄为 `EfOk<PingData>`，确保 `.data` 可访问 |
| `src/background/router.ts` | 将收窄后的请求保存为 `const request`，避免异步回调中丢失收窄 |
| `src/content/collect.ts` | `closest("label")` / `closest("td,th")` 的结果显式转为 `HTMLElement` 后再读 `innerText` |
| `src/content/entry.ts` | 同样用 `const request` 保留消息判别联合的收窄结果 |
| `src/shared/domPath.ts` | 显式标注 `const parent: Element | null`，消除循环推断与 `sibling: unknown` |
| `src/sidepanel/App.tsx` | 修正 `shared/types` 相对路径；`RunLog` 改为从 `./diagnostics/RunLog` 导入 |
| `src/sidepanel/match/lexicon.ts` | 修正 `shared/types` 相对路径 |
| `src/sidepanel/match/ruleMatcher.ts` | `REGION_WEIGHTS[item.region] ?? 0.6`；`ScoredEntry.type` 改用 `ItemType` |

### 5.2 第二次类型检查：2 个错误

日志：`codearts_proof/typecheck.after-fix.log`

```text
src/background/router.ts(261,27): error TS2339: Property 'requestId' does not exist on type 'never'.
src/content/entry.ts(76,27): error TS2339: Property 'requestId' does not exist on type 'never'.
```

原因：`switch` 已覆盖全部联合成员，`default` 分支中的请求被收窄为 `never`，访问 `request.requestId` 不合法。

修复：两个 `default` 分支改用固定请求 ID：

```ts
return fail("unknown", createEfError("EF-E005", "未知的消息类型"));
```

### 5.3 第三次修复：注入失败分类顺序

首次构建成功后复核发现：`activeTab` 缺失时 Chrome 的错误文本可能包含 “Cannot access …”，原分类顺序会误判为 `EF-E002`（页面不支持），而不是 `EF-E003`（未授权）。已调整 `src/shared/errors.ts` 的判定顺序：

1. `chrome://` / `chrome-extension://` / 扩展商店 / `view-source:` / `about:` → `EF-E002`
2. `activeTab` / `manifest must request permission` / `permission` 等 → `EF-E003`
3. 其余 `Cannot access` / `cannot be scripted` → `EF-E002`
4. 标签页关闭 → `EF-E004`
5. 通道中断 → `EF-E007`
6. 其他 → `EF-E005`

修改后重新构建，退出码 0。

## 6. 最终执行命令与真实结果

| 序号 | 命令 | 日志 | 结果 |
|---|---|---|---|
| 1 | `npm install` | `npm-install.log` | 失败：沙箱拦截本机代理 `127.0.0.1:7897`；按用户指令停止 |
| 2 | `npm install --offline` | `npm-install.offline.log` | 成功：audited 17 packages，0 vulnerabilities |
| 3 | `npm run typecheck` | `typecheck.log` | 失败：10 个类型错误 |
| 4 | `npm run typecheck`（修复后） | `typecheck.after-fix.log` | 失败：2 个 `never` 收窄错误 |
| 5 | `npm run build` | `build.log` | 成功，产物与清单校验通过 |
| 6 | `npm run build`（按用户要求直接复跑） | `build.retry.log` | 成功 |
| 7 | `npm run build`（错误分类修复后） | `build.final.log` | 成功 |
| 8 | `npm run build` + `npm run selftest` + `npm run verify` | `build.final.utf8.log`、`selftest.final.utf8.log`、`verify.final.utf8.log` | 三个退出码均为 0 |

最终退出码输出：

```text
BUILD_EXIT_CODE=0
SELFTEST_EXIT_CODE=0
VERIFY_EXIT_CODE=0
```

说明：PowerShell 控制台对部分中文输出存在编码乱码（显示为“浜х墿娓呭崟”等），但命令退出码为 0，`verify-manifest` 全部检查项输出 `OK`，不影响产物内容。UTF-8 落盘日志为 `*.final.utf8.log`。

## 7. 构建产物

`dist/` 实测清单：

```text
background.js       16096 bytes
content.js          24955 bytes
icons/icon16.png      111 bytes
icons/icon32.png      167 bytes
icons/icon48.png      209 bytes
icons/icon128.png     446 bytes
manifest.json         987 bytes
sidepanel.css        6707 bytes
sidepanel.html        370 bytes
sidepanel.js       167052 bytes
```

构建链路：`tsc --noEmit` → 清空 `dist/` → 生成 PNG 图标 → esbuild 三入口 → 复制 manifest/html → `verify-manifest`。

入口格式：

- `background.js`：ESM，MV3 `service_worker` + `type: "module"`；
- `content.js`：IIFE，可直接由 `chrome.scripting.executeScript({ files: ["content.js"] })` 注入；
- `sidepanel.js`：ESM，CSS 抽取到 `sidepanel.css`。

## 8. 自动化验证

### 8.1 清单与产物（T-01 / T-02）

`npm run verify` 退出码 0，实际检查项包括：

```text
OK permissions 恰为 activeTab, scripting, sidePanel, storage
OK 清单不含 host_permissions
OK 清单不含 content_scripts
OK 清单不含 web_accessible_resources
OK 清单不含 externally_connectable
OK manifest_version 为 3
OK minimum_chrome_version >= 116
OK background.service_worker 指向 background.js
OK background.type 为 module
OK side_panel.default_path 指向 sidepanel.html
OK 全部 9 个产物存在且非空
OK 存在 extension_pages CSP
OK CSP 不含 unsafe-eval/unsafe-inline
OK CSP 不含远程域名
```

### 8.2 规则匹配与采集纯函数（T-03—T-09 及摘要用例）

`npm run selftest` 退出码 0，9 项全部通过：

```text
# tests 9
# pass 9
# fail 0
```

覆盖：

- T-03：≥3 条相关 → 3 张卡片、分数降序；
- T-04：无关目标 → `no-evidence` 且卡片 0；
- T-05：仅 2 条命中 → `partial` 且卡片 2；
- T-06：空目标 / 仅停用词 / 201 字 → `invalid-goal`；
- T-07：父子重复去重后仅 1 条；
- T-08：`\u00a0`、全角空格、连续换行归一化与 300 字截断；
- T-09：3001 条按预算截断为 3000 条；
- T-10：DOM 路径白名单与文本哈希稳定性；
- 摘要必须为原文子串且 ≤40 字，片段 ≤240 字。

测试样例仅使用合成文本（“示例条款甲/乙/丙”），未内置验收页政策正文。

### 8.3 类型门禁（T-10）

最终 `npm run build` 内包含 `tsc --noEmit`，退出码 0。源码检索无 `: any`、`as any`、`@ts-ignore`、`@ts-expect-error`。

## 9. 只读、权限与禁用表述门禁

| 检查项 | 检索范围 | 实际结果 | 判定 |
|---|---|---|---|
| 远程请求 | `src/**/*.{ts,tsx}`：`fetch(`、`XMLHttpRequest`、`sendBeacon`、`WebSocket` | 无命中 | 通过 |
| 全站权限 | `src` 与 `dist/manifest.json`：`<all_urls>`、`host_permissions`、`content_scripts` | 无命中 | 通过 |
| DOM 写入 | `src`：`setAttribute`、`classList.`、`appendChild`、`innerHTML` | 仅 `content/highlight.ts` 第 117、119 行 `appendChild`（阴影 DOM 高亮盒 + 叠加宿主） | 允许：只新增高亮层，`cleanupHighlight()` 中 `remove()` 移除 |
| `innerHTML` | `src` | 无命中 | 通过 |
| `any` / 忽略类型 | `src` | 无命中 | 通过 |
| 界面禁用表述 | `src`、`README.md`：`AI`、`大模型`、`智能体`、`模型规划`、`模型分析` | 无命中 | 通过 |
| 第三方政策正文 | `src`：验收页专有政策词 | 仅 `GoalForm` 的 placeholder 含用户指定示例目标“高龄津贴的申请条件和线下办理方式” | 允许：用户要求的输入示例，不是页面摘要或政策正文 |
| 构建产物 content 脚本 | `dist/content.js`：行首 `import` / `export` | 无命中 | 通过：IIFE 有效 |
| 构建产物远程请求 | `dist/background.js`、`content.js`、`sidepanel.js` | 无命中 | 通过 |
| README 禁用表述 | `README.md` | 无命中 | 通过 |

只读说明：

- 采集路径只调用只读 API，未写 `setAttribute`、`classList`、`innerHTML`；
- 唯一页面写入是“查看原文”的阴影 DOM 叠加层；
- 不读取 `input.value`（`inputLabel` 只读 `labels`、`aria-label`、`aria-labelledby`、`placeholder`、邻近 `label`/`td` 文本）；
- 未调用 `click()`、`focus()`、`submit()`、`dispatchEvent()`；
- 无 `localStorage`、`sessionStorage`、`cookie`、`clipboard` 读写。

## 10. 新增/修改文件清单

### 配置与构建

- `package.json`
- `tsconfig.json`
- `public/manifest.json`
- `public/sidepanel.html`
- `scripts/build.mjs`
- `scripts/gen-icons.mjs`
- `scripts/verify-manifest.mjs`
- `scripts/selftest.mjs`

### 共享契约

- `src/shared/types.ts`
- `src/shared/messages.ts`
- `src/shared/errors.ts`
- `src/shared/constants.ts`
- `src/shared/domPath.ts`

### 内容脚本

- `src/content/entry.ts`
- `src/content/normalize.ts`
- `src/content/registry.ts`
- `src/content/collect.ts`
- `src/content/highlight.ts`

### 后台

- `src/background/index.ts`
- `src/background/tabContext.ts`
- `src/background/injector.ts`
- `src/background/router.ts`

### 侧边栏

- `src/sidepanel/main.tsx`
- `src/sidepanel/App.tsx`
- `src/sidepanel/state/initialState.ts`
- `src/sidepanel/state/sessionReducer.ts`
- `src/sidepanel/hooks/usePageSession.ts`
- `src/sidepanel/match/lexicon.ts`
- `src/sidepanel/match/ruleMatcher.ts`
- `src/sidepanel/match/summarize.ts`
- `src/sidepanel/components/PageInfo.tsx`
- `src/sidepanel/components/GoalForm.tsx`
- `src/sidepanel/components/ModeBadge.tsx`
- `src/sidepanel/components/StatusBanner.tsx`
- `src/sidepanel/components/Card.tsx`
- `src/sidepanel/components/CardList.tsx`
- `src/sidepanel/diagnostics/RunLog.tsx`
- `src/sidepanel/styles/sidepanel.css`

### 文档与留痕

- `README.md`
- `docs/screenshots/README.md`
- `codearts_proof/04-impl-phase.md`
- `codearts_proof/` 下的安装、类型检查、构建、自测、校验日志

## 11. 未执行事项（如实声明）

以下项目**尚未实际执行**，本文件不声称其通过：

1. `chrome://extensions` 加载 `dist/` 的 Chrome 人工验收（E2E-01）。
2. 主验收页上的侧边栏展开、页面读取、卡片生成、查看原文高亮（E2E-02—E2E-09）。
3. 同域跳转/刷新后的重新读取、标签页切换提示、受限页错误提示（E2E-10—E2E-13）。
4. 断网分析与可选首页验证（E2E-14、E2E-15）。
5. 四项性能实测：侧边栏首屏、采集耗时、匹配耗时、高亮反馈。
6. 真实截图产出（`docs/screenshots/` 目前仅有占位说明）。
7. 主验收页正文是否位于 iframe 内的实测确认（设计风险 R-06）。

原因：用户在构建阶段明确要求停止网络相关尝试；后续浏览器/站点可达性探测命令被中止，因此未继续执行需要访问真实站点的 Chrome 端到端验收。

## 12. 剩余问题与限制

1. **Chrome 人工验收待执行**：构建产物已生成，但未在真实 Chrome 中加载并与目标站点联调。
2. **iframe 不采集**：第一轮只采主文档；若验收页正文位于 iframe，需要人工确认后再决定是否补充同源 iframe 只读采集。
3. **`activeTab` 授权边界**：切换标签页或跨源导航后通常需要重新点击扩展图标；失败时显示 `EF-E003` 并引导重新授权。
4. **规则匹配能力有限**：本地 n-gram + 同义词匹配对复述式问法可能只命中少量片段，界面会显示 `partial` 或“当前页面未找到依据”。
5. **在线安装未验证**：当前依赖来自既有 `node_modules` 与 npm 缓存；`npm install` 在受限网络下失败，正常网络环境的全新安装未实测。
6. **截图与性能数据缺失**：需在 Chrome 人工验收时补充。
7. **控制台编码**：部分 PowerShell 日志中文显示为乱码，退出码与校验结论不受影响。

## 13. 码道对话与阶段索引

| 阶段 | 文档/记录 | 结论 |
|---|---|---|
| 需求规格 | `.codeartsdoer/specs/easyflow_page_guide/spec.md`、`codearts_proof/01-spec-phase.md` | 已确认浏览器指引层边界、6 项核心能力、DFX 与禁止项 |
| 实现方案 | `.codeartsdoer/specs/easyflow_page_guide/design.md`、`codearts_proof/02-design-phase.md` | 已确认 esbuild 三入口、后台收敛、四级定位、Shadow DOM 高亮、13 个错误码 |
| 编码任务规划 | `.codeartsdoer/specs/easyflow_page_guide/tasks.md`、`codearts_proof/03-tasks-phase.md` | 12 组任务、51 个子任务 |
| 实现与构建 | 本文件、`codearts_proof/*.log` | 代码落地；最终 `build`、`selftest`、`verify` 退出码均为 0；Chrome 人工验收待执行 |

## 14. 复现命令

```bash
npm install --offline   # 当前环境依赖已就绪；正常网络可直接 npm install
npm run build
npm run selftest
npm run verify
```

加载扩展：

```text
chrome://extensions → 开发者模式 → 加载已解压的扩展程序 → 选择 dist/
```