# 07 — “查看原文”脉冲视觉增强与动画时机修复

## 1. 本轮范围

只调整“查看原文”的高亮视觉与动画触发：

- 不重构页面采集；
- 不修改卡片；
- 不修改侧边栏；
- 不修改匹配规则；
- 不增加对话界面；
- 不修改 `public/manifest.json` 权限。

## 2. 修改前检查结果

检查文件：

- `src/content/highlight.ts`
- `src/shared/constants.ts`

修改前状态：

```text
底色：rgba(99, 102, 241, 0.16) → rgba(99, 102, 241, 0.27)
时长：1100ms
重复：2 次
TTL：3000ms
边框：3px rgba(67, 56, 202, 0.95)
```

问题：

1. 亮暗相位差异偏小，视觉变化弱；
2. 动画在 `ensureBoxes()` 创建高亮盒时立即启动，此时 left/top/width/height 尚未写入；
3. 颜色、时长散落在函数内部，缺少集中常量；
4. 高亮存在时间偏短。

## 3. 新视觉参数

时长与 TTL 集中到 `src/shared/constants.ts`：

```ts
export const HIGHLIGHT_TTL_MS = 4000;
export const HIGHLIGHT_PULSE_DURATION_MS = 750;
export const HIGHLIGHT_PULSE_COUNT = 3;
```

颜色与描边集中到 `src/content/highlight.ts` 的 `HIGHLIGHT_COLORS` 与描边常量：

| 项目 | 值 |
|---|---|
| 描边宽度 | `3px` |
| 描边颜色 | 深紫色 `rgba(76, 29, 149, 0.95)` |
| 亮相位描边 | `rgb(49, 20, 110)` |
| 暗相位底色 | 淡紫 `rgba(139, 92, 246, 0.14)` |
| 亮相位底色 | 淡紫 `rgba(196, 181, 253, 0.36)` |
| 低动态静态底色 | 淡紫 `rgba(139, 92, 246, 0.30)` |
| 暗相位外发光 | 8px 靛蓝柔光 |
| 亮相位外发光 | 20px 靛蓝 + 28px 暖黄柔光 |
| 低动态静态外发光 | 16px 靛蓝柔光 |

动画：

- 每轮 `750ms`；
- 共 `3` 轮，总时长 `2250ms`，落在 2—3 秒范围；
- `ease-in-out`；
- 无 `opacity: 0`，无 `infinite`；
- 动画结束后保留 3px 静态边框与暗相位底色，直到 4 秒 TTL 清理。

## 4. 动画触发时机修复

修改前：

```text
ensureBoxes() 创建 box
  → animateBox(box) 立即播放
  → positionBoxes() 再写入坐标
```

修改后：

```text
buildTextHighlight()/fallback 先计算 initialBoxes
  → createOverlay()
  → ensureBoxes() 创建高亮盒
  → positionBoxes() 写入 left/top/width/height
  → restartPulse() 在坐标完成后播放
```

具体：

- `highlightRef()` 先得到 `initialBoxes`，无行框时安全降级为元素边界框。
- `createOverlay(element, range, initialBoxes)` 调用 `positionBoxes(initialBoxes, true)`。
- `positionBoxes()` 先创建高亮盒并写入坐标，再统一调用 `restartPulse()`。
- 滚动/缩放更新调用 `positionBoxes(boxes, false)`，只更新位置，不重新播放动画。
- 每次点击“查看原文”先 `cleanupHighlight()` 移除旧宿主与全部高亮盒，再创建新盒并播放。
- `restartPulse()` 会先取消该盒已有的动画，避免重复点击叠加动画。
- 滚动/缩放期间用捕获 `scroll` + `resize` + `requestAnimationFrame` 更新 Range 行框。

## 5. 低动态与文字可读性

- `prefers-reduced-motion: reduce` 时：
  - 不调用 `animate()`；
  - 使用 `fillStatic` 0.30 淡紫底 + 16px 柔光 + 3px 深紫边框；
  - `scrollIntoView` 使用 `auto`；
  - 高亮保持约 4 秒，目标始终可见，不闪烁。
- `Element.animate` 不可用时同样使用静态醒目样式。
- 亮相位底色 alpha 最高 0.36，文字保持可读；不使用整体透明度动画，因此不会出现整块消失。

## 6. Range 定位能力保持不变

- 仍使用 `range.selectNodeContents()` + `range.getClientRects()`；
- 短标题只按文字宽度绘制；
- 多行正文按行绘制；
- 高亮宿主与高亮盒均为 `pointer-events: none`；
- 不修改原网页节点，只新增阴影 DOM 宿主并在清理时移除；
- 不调用 `click()`、`focus()`、`dispatchEvent()`、`submit()`。

## 7. 真实构建与自测

### 7.1 构建

命令：

```powershell
$output = npm run build 2>&1
$code = $LASTEXITCODE
$output | Out-File -Encoding utf8 codearts_proof\fix-highlight-pulse-build.log
```

实际结果：

```text
BUILD_EXIT_CODE=0
```

### 7.2 自测

命令：

```powershell
$output = npm run selftest 2>&1
$code = $LASTEXITCODE
$output | Out-File -Encoding utf8 codearts_proof\fix-highlight-pulse-selftest.log
```

实际结果：

```text
SELFTEST_EXIT_CODE=0
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

### 7.3 产物检查

`dist/content.js` 实测包含：

```text
var HIGHLIGHT_TTL_MS = 4e3;
var HIGHLIGHT_PULSE_DURATION_MS = 750;
var HIGHLIGHT_PULSE_COUNT = 3;
fillPeak: "rgba(196, 181, 253, 0.36)"
fillStatic: "rgba(139, 92, 246, 0.30)"
glowPeak: "... 20px ... 28px rgba(250, 204, 21, 0.22)"
```

未出现 `infinite`。

## 8. 修改文件

- `src/content/highlight.ts`
- `src/shared/constants.ts`
- `README.md`（高亮时长说明从约 3 秒改为约 4 秒）
- `dist/`（重新构建）
- `codearts_proof/07-highlight-pulse.md`
- `codearts_proof/fix-highlight-pulse-build.log`
- `codearts_proof/fix-highlight-pulse-selftest.log`

未修改：

- `src/content/collect.ts`
- `src/content/registry.ts`
- `src/sidepanel/**`
- `src/sidepanel/match/**`
- `public/manifest.json`

## 9. Chrome 重新加载与刷新

1. 打开 `chrome://extensions`。
2. 找到 EasyFlow，点击“重新加载”。
3. 回到主验收页，按 `Ctrl+R` 或 `F5` 刷新：
   ```text
   https://www.bjsjs.gov.cn/gongkai/zwgkpd/ztzl/2024/wqfw/lnrzq/cjcs/202402/t20240229_79299.shtml
   ```
4. 点击 EasyFlow 图标，输入目标并“分析当前页”。
5. 点击任意卡片的“查看原文”。

## 10. 人工验收要点

### 10.1 脉冲强度与次数

- 点击后应立即看到高亮位置；
- 约 2.25 秒内出现 3 次明显明暗变化；
- 亮相位为淡紫底 + 明显柔光，暗相位明显减弱；
- 动画结束后保留静态 3px 深紫边框，直到约 4 秒自动清除；
- 不出现快速闪烁、整块消失或无限循环。

### 10.2 短标题文字宽度

- 选择“办理条件：”这类短标题卡片；
- 高亮框应紧贴文字，不横跨整行空白；
- 不得回退到整行容器矩形。

### 10.3 跨行正文

- 选择长段落卡片；
- 每一行应有独立高亮框；
- 行尾空白不应被大矩形覆盖；
- 正文文字应保持可读。

### 10.4 重复点击与滚动/缩放

- 第一次点击后，动画播放 3 轮；
- 第二次点击同一卡片，动画应从第一轮重新开始，不叠加多个高亮宿主；
- 在高亮存活期内滚动页面或缩放浏览器，高亮框应跟随文字，不漂移。

### 10.5 减少动态效果

- Windows：设置 → 辅助功能 → 视觉效果 → 关闭“动画效果”；
- 或 Chrome DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion` → `reduce`；
- 点击“查看原文”应只有静态醒目高亮，不闪烁，目标仍清晰可见。

### 10.6 鼠标穿透

- 在高亮区域点击网页原有链接/按钮，事件应穿透；
- 页面原有交互与表单状态不变；
- 高亮清理后 DOM 宿主节点被移除。

## 11. 未自动验证的视觉点

以下内容无法由 `npm run build` / `npm run selftest` 证明，未声称已在 Chrome 人工验收：

- 目标验收页上实际的 3 次脉冲观感与亮度是否合适；
- 淡紫底 + 暖黄柔光在政务页配色上的实际可读性；
- “办理条件：”短标题的实际框选宽度；
- 多行段落的逐行框选效果；
- 浏览器缩放、嵌套滚动容器下的跟随精度；
- `prefers-reduced-motion: reduce` 的系统级效果；
- 鼠标点击穿透与页面原有交互。

这些点需要按第 9、10 节在 Chrome 中人工确认。