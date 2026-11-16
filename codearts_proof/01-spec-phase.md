# EasyFlow 校赛第一轮 — 需求规格阶段留痕

## 1. 环境确认

- 工作目录：`D:\hwproject\translator`
- 首次检查时间：2026-11-13
- 根目录内容：仅 `.codeartsdoer/`（IDE 元目录，含 `.codebase`、`agent-team`、`agents`、`mcp`、`rule`、`skills`、`.gitignore`、`mem-exp-config.json`、`package.json`）
- 项目代码：不存在（无 `package.json`、无 `src/`、无 `public/`）
- 结论：**目录为空项目状态，未覆盖任何既有项目**
- `.codeartsdoer/specs/`：不存在 → 本阶段创建
- `codearts_proof/`：不存在 → 本阶段创建

## 2. 需求阶段决策记录

| 决策项 | 结论 |
|---|---|
| 产品定位 | 浏览器指引智能体：在用户主动打开的第三方网页上做页面感知与依据定位，非报名站、非官网首页、非静态设计稿 |
| 运行形态 | Manifest V3 浏览器扩展，Chrome「加载已解压的扩展程序」 |
| 技术栈 | TypeScript + React + 构建工具产出 `dist/` |
| 权限策略 | `activeTab` + `scripting` + `sidePanel`（可选 `storage`），**禁止** `<all_urls>` 永久站点权限 |
| 匹配方式 | 本轮仅本地关键词匹配，明确标注「规则演示模式」，禁止表述为 AI 模型规划 |
| 卡片数量 | 3–5 张；无相关片段时为 0 张并输出「当前页面未找到依据」 |
| 内容来源 | 卡片摘要与原文片段必须实时取自当前 DOM，源码中禁止硬编码目标站政策内容 |
| 页面改动 | 只读采集；高亮通过叠加图层实现；禁止改源码、禁止代填/勾选/提交 |
| 运行时模型 | 本轮不接入；第二轮再接入运行时模型与来源校验 |

## 3. 编码前设计输出（供下一阶段使用）

### 3.1 目录结构规划

```
translator/
├─ .codeartsdoer/specs/easyflow_page_guide/spec.md
├─ codearts_proof/01-spec-phase.md
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ public/manifest.json
├─ public/sidepanel.html
├─ public/icons/
├─ src/background/index.ts
├─ src/content/extract.ts
├─ src/content/highlight.ts
├─ src/sidepanel/App.tsx
├─ src/sidepanel/main.tsx
├─ src/sidepanel/match/ruleMatcher.ts
├─ src/shared/messages.ts
├─ src/shared/types.ts
└─ README.md
```

### 3.2 扩展消息流

```
用户点击图标
  → Service Worker 调用 sidePanel.open()
  → 侧边栏就绪，发送 EXTRACT_PAGE
  → background 以 activeTab 授权调用 chrome.scripting.executeScript 注入采集脚本
  → content 采集可见标题/段落/链接/按钮/输入框标签
  → 回传 PageSnapshot → 侧边栏渲染页面信息
  → 用户输入目标 + 点击「分析当前页」
  → 侧边栏本地规则匹配（ruleMatcher）→ 3–5 张 GuidanceCard
  → 点击「查看原文」→ 发送 FOCUS_ELEMENT(elementId)
  → content 滚动定位 + 叠加高亮 + 定时移除
失败分支：
  注入被拒 → INJECT_FAILED → 侧边栏展示明确错误原因与重试指引
  元素已失效 → FOCUS_MISS → 提示「该依据已不在页面中，请重新读取页面」
```

### 3.3 权限清单

| 权限 | 用途 | 备注 |
|---|---|---|
| `activeTab` | 点击图标后临时获取当前页访问 | 不产生永久站点授权 |
| `scripting` | 注入采集/高亮脚本 | 依赖 activeTab 授权 |
| `sidePanel` | 打开侧边栏 | `openPanelOnActionClick: true` |
| `storage` | 记忆上次输入目标 | 不存储页面内容 |
| `host_permissions` | 不申请 | 明确禁止 `<all_urls>` |

### 3.4 实际验收步骤

1. `npm install`（记录真实输出）
2. `npm run build`（记录真实输出）
3. 确认 `dist/manifest.json` 存在
4. Chrome 打开 `chrome://extensions`，开启开发者模式，加载已解压的 `dist/`
5. 打开 `https://www.bjsjs.gov.cn/gongkai/zwgkpd/ztzl/2024/wqfw/lnrzq/cjcs/202402/t20240229_79299.shtml`
6. 点击扩展图标，确认侧边栏出现，展示 EasyFlow 标识、域名与页面标题
7. 输入「我想知道高龄津贴的申请条件和线下办理方式」，点击「分析当前页」
8. 校验卡片数 3–5、摘要 ≤40 字、原文片段与 DOM 一致、元素 ID 可定位、展示「规则演示模式」
9. 点击「查看原文」，校验页面滚动到对应元素并出现临时高亮，且页面原有节点未被修改
10. 输入无关目标，校验「当前页面未找到依据」且卡片数为 0
11. 在同域页面间切换/刷新后点击「重新读取页面」，校验标题与内容更新
12. 于 `chrome://` 页面点击图标，校验注入失败提示

## 4. 本阶段实际执行命令与结果

| 序号 | 命令 | 结果 |
|---|---|---|
| 1 | `Test-Path .codeartsdoer; Test-Path .codeartsdoer\specs; Test-Path codearts_proof; Test-Path package.json` | `True` / `False` / `False` / `False` |
| 2 | `Get-ChildItem -Force .codeartsdoer` + 根目录清单 | 根目录仅 `.codeartsdoer`；项目代码为空 |
| 3 | Write `.codeartsdoer/specs/easyflow_page_guide/spec.md` | 成功 |
| 4 | Write `codearts_proof/01-spec-phase.md` | 成功 |

## 5. 未执行事项（如实声明）

- `npm install`：**尚未执行**（本阶段未创建 `package.json`）
- `npm run build`：**尚未执行**
- Chrome 内实际加载与端到端点击验收：**尚未执行**

以上三项属于后续编码实施阶段，本文件不记录任何未经执行的构建或测试成功结论。