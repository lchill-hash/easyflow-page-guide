# 28 — 第九轮实现：高亮自动停止诊断与侧栏视觉重构

> 依据：`.codeartsdoer/specs/easyflow_page_guide/iteration9-spec.md`、`iteration9-design.md`、`iteration9-tasks.md`。
>
> 自动测试与构建门禁通过；**真实 Chrome 视觉验收（高亮停止、普通/关怀截图、逐秒录像、200% 缩放）待用户执行**。本环境未真实复现“必须点击网页才停止”，因此**根因尚未最终确认**；本轮按规格加入计数诊断并实现单轮/静态/自动清理，不以“已修复”结论收尾。

## 1. 根因证据（先列证据，不武断）

### 1.1 已核实

- 修改前源码与 `dist/content.js` 均为 `750ms × 3`、`HIGHLIGHT_TTL_MS=4000`，与“源码本应停止”一致，**不能用“源码写死无限动画”解释真实闪烁**。
- 旧实现每次 `highlightRef()` 开头调用 `cleanupHighlight()`，随后重建宿主、重建全部框并 `positionBoxes(..., true)`，每框 `restartPulse()` 重新启动动画；滚动/resize 只 `positionBoxes(..., false)`，不延长 TTL。
- 旧宿主无 `data-ef-highlight` 标识，shadow 为 closed，**无法枚举“当前有几个高亮层”**。
- 旧测量顺序为“先测量、后 `scrollIntoView({behavior:"smooth"})`”，首帧可能错位（G-01）。
- `observe.ts` 未过滤高亮宿主自身 mutation，可能把每次高亮变化计为页面变化（G-03）。
- `CONTENT_VERSION` 原为 `0.3.0`；重载扩展后若页面未刷新，可能仍运行旧 content 实例（H-07）。

### 1.2 未确认（需真实 Chrome 计数）

真实 Chrome 现象为“持续闪烁，似乎点击网页才停”。本环境无法操作真实页面，**未确认根因**。候选：

- H-01 一次点击触发多次 `highlightRef()`；
- H-02 多宿主/旧实例残留；
- H-03 动画被重复启动；
- H-04 清理定时器被覆盖/未执行；
- H-05 DOM 变化触发再高亮；
- H-06 多行框相位差造成“持续闪烁”观感；
- H-07 旧构建/旧 content 实例；
- H-08 `prefers-reduced-motion` 未生效。

本轮新增计数可区分：`refCalls/roundStartCount/overlayLiveMax/legacyHostCount/pulseStartCount/cleanupScheduledCount/cleanupFiredCount/cleanupReason/positionUpdateCount/domTickCount/pageInjectionCount/contentVersionSeen`。

## 2. 修改文件

### 2.1 新增

| 文件 | 内容 |
|---|---|
| `src/content/highlightRound.ts` | 纯逻辑 `idle→pulsing→static→cleared`、24 项计数、TTL/脉冲时间、清理原因与不变式 |

### 2.2 修改

| 文件 | 改动 |
|---|---|
| `src/shared/constants.ts` | `CONTENT_VERSION 0.4.0`；脉冲 600×3；TTL 4000；`HIGHLIGHT_STATIC_MIN_MS=1600`；框池 60；宿主/轮次属性；stats 序列化 1024 |
| `src/shared/types.ts` | `CleanupReason`、27 字段 `HighlightStats`、`HighlightResult.stats?` |
| `src/content/highlight.ts` | 单会话/单宿主、宿主标识、框池、同帧脉冲、TTL 自动清理、滚动/resize 只更新位置、`pagehide`、`cleanup(reason)`、`noteDomTick`、先滚动后测量、真实 stats |
| `src/content/observe.ts` | 过滤仅高亮宿主的 mutation，不关闭监听；记录 `dom-tick` |
| `src/content/entry.ts` | `CONTENT_COLLECT` 使用 `cleanupHighlight("collect")` |
| `src/background/injector.ts` | 注入次数、页面实际版本；`getInjectionDiagnostics` |
| `src/background/router.ts` | 高亮响应合并注入次数/版本 stats |
| `src/sidepanel/hooks/useConversation.ts` | 高亮请求计数、最近 stats 局部状态 |
| `src/sidepanel/App.tsx` | 向诊断面板传 `highlightStats`/`highlightRequestCount` |
| `src/sidepanel/components/chat/DiagnosticsPanel.tsx` | 新增默认折叠“高亮”区，仅计数/时间/版本 |
| `src/sidepanel/styles/sidepanel.css` | 单 token 源六层重构；删除重复 `:root`/末尾覆盖；冷白/深蓝灰/靛蓝/青绿；去紫渐变；统一圆角/间距/边框/阴影/焦点；400px/200%/reduce |
| `scripts/selftest.mjs` | 新增 AT-106—AT-114，105 项 |
| `dist/` | 重新构建（content.js 68406、sidepanel.js 295250 bytes） |

### 2.3 未修改

采集/语义/控件/registry、`dialogue/**`、`guide/**`、`state/**`、`match/**`、`speech/**`、`mic-permission/**`、`shared/messages.ts`、`shared/errors.ts`、`manifest.json` 与权限四项、`build.mjs`、`verify-manifest.mjs`、StepCard/MessageList/ChatComposer props 与结构。

## 3. 实现行为

- **普通模式**：一次点击一轮；600ms×3=1800ms 强调，随后静态描边；4000ms TTL 自动清除；不点击网页也停止。
- **重复点击**：先结束旧轮（`replaced`）、取消动画/定时器/监听、移除旧宿主，再开新轮；`overlayLiveMax ≤1`。
- **滚动/resize/DOM 变化**：只重算位置（`position-updated`），不重启脉冲、不延长 TTL。
- **关怀/减少动态**：`care` 或 `prefers-reduced-motion` 直接静态；不闪烁；同样按时清除。
- **不挡点击/不改原节点**：宿主 `pointer-events:none`，仅 append 到 `documentElement`；仍优先文字 Range 定位。
- **诊断**：`EF_HIGHLIGHT` 响应携带 stats；后台补注入次数与版本；侧栏只显示计数/时间/版本，不含网页文本、URL、输入。
- **CSS**：单一 `:root` token 源；冷白背景、深蓝灰正文、靛蓝主色、青绿状态；无紫渐变；焦点/禁用/错误/成功态；400px 与 200% 布局规则；care token 覆盖。

## 4. 自动测试

- `npm run selftest`：**105 项通过**（`# tests 105 / # pass 105 / # fail 0`）。
- 新增 AT-106—AT-114：状态机/常量关系、静态模式、清理原因/单宿主、宿主与框池计数、stats 最小化、CSS 单 token 源、诊断接线、回归边界。
- 未访问真实网页/Chrome；自动测试不能证明真实视觉。

## 5. 门禁

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 0 error |
| `npm run build` | 通过；`dist` 更新 |
| `npm run selftest` | 105 项通过 |
| `npm run verify` | 通过；例外 2 条 |

日志：`codearts_proof/iteration9-{typecheck,build,selftest,verify}.log`。

清洁检索：

- `highlight.ts` 无 `querySelectorAll`/`setInterval`/`750`/`4000` 字面量（`iteration9-clean-highlight.log`）。
- CSS 仅 1 个 `:root`；care/focus/reduce 存在（`iteration9-clean-css.log`）。
- `dist/content.js` 含 `data-ef-highlight`、`data-ef-round`、`0.4.0`（`iteration9-clean-dist.log`）。
- 权限四项不变（`iteration9-clean-manifest.log`）。

## 6. 真实 Chrome 视觉验收（待用户执行）

### 6.1 已执行

（空）

### 6.2 步骤（人工验收待用户执行 / 真实视觉待验）

1. 扩展管理页重新加载 EasyFlow → **刷新目标网页** → 重开侧栏（确保 `content.js 0.4.0`）。
2. 打开政务指南页，鼠标停在侧栏，点一次“指给我看”：逐秒记录 0.5/1/1.8/2/3/4/5/6s 是否闪烁、约 2s 后静态、约 4s 后消失；**不点击网页**。
3. 连续点 3 次：每次重新开始一轮，不叠框。
4. 滚动页面、缩放浏览器：位置更新但不重新闪烁、不延长消失时间。
5. 切换到长者关怀：无闪烁，静态描边，按时消失。
6. 在系统/浏览器开启“减少动态”：普通与关怀均无闪烁。
7. Cal.com 可用时段页重复第 2 步（时段区滚动后）。
8. 展开“运行诊断 → 高亮”：记录 `refCalls/roundStartCount/overlayLiveMax/cleanupReason/cleanupFiredCount/contentVersionSeen`；若仍持续闪烁，记录这些计数与相对时间，**不记录网页文本/URL/输入**。
9. 400px 侧栏与 200% 缩放：当前步骤、输入框、发送键可达；普通/关怀各截图一张。

本环境未生成真实截图/录像；**不得把本轮写成“视觉已修复”**。

## 7. 已知限制与风险

- 真实根因未确认：若计数显示 `refCalls` 持续增长，是外部重复请求；若 `overlayLiveMax>1`，是宿主残留；若 `cleanupFiredCount=0`，是定时器被阻断；若 `pulseStartCount` 持续增长，是动画被重启。按计数分支再修，不再盲改时长。
- 旧 content 实例在未刷新页面时可能残留到其原 TTL；诊断会显示页面/期望版本不一致。
- 即时 `scrollIntoView({behavior:"auto"})` 改变平滑滚动观感（D9-11 备选 B）。
- CSS 重构删除了仅旧原型使用的未引用类；当前组件类均保留。
- 自动测试只证明计数/常量/状态机与 CSS 文本，不证明真实观感、对比度实测或 200% 实际布局。