# 29 — 第十轮实现：紫色复原、八项审计与 DeepSeek 接入收口

> 依据：`.codeartsdoer/specs/easyflow_page_guide/iteration10-spec.md`、`iteration10-design.md`、`iteration10-tasks.md`。
>
> 自动测试与构建门禁通过；**真实 DeepSeek Key 链路、真实模型回退、普通/关怀截图与 200% 缩放：未验证（人工验收待用户执行）**。未读取或写入 `.env.local`，未提交或推送。

## 0. 接手与 git 限制

- 本机 `git` 命令不可用（`CommandNotFoundException`），**未执行 `git diff/status/log`**；不得声称已查看 diff。
- 已保留此前高亮修复：`highlight.ts`、`highlightRound.ts`、`observe.ts`、`entry.ts`、高亮常量未被本轮覆盖；工作区已有紫/冷混合 CSS 与 DeepSeek 初稿按现有内容继续收口。
- `.env.local` 当前**不存在**；`.gitignore` 已包含 `.env.*` 并保留 `.env.example` 例外，因此 `.env.local` 被忽略。

## 1. 紫色系恢复

只改 token 值，保留单一 `:root`、六层结构、布局/圆角/间距/阴影/边框/420/320/reduce/长者尺寸：

- `--ef-bg: #faf8ff`
- `--ef-text: #1f1a38`
- `--ef-text-soft: #383051`
- `--ef-muted: #5b5378`
- `--ef-border: #e6e0f2`
- `--ef-border-strong: #8f7fd6`
- `--ef-success: #2f6b74` / `#e8f4f5`
- `--ef-step-surface-expired: #eee9f7`、`--ef-step-ink: #221b3d`
- 关怀：`--ef-muted: #4a3f6b`、`--ef-step-ink: #1c1533`、`--ef-step-surface-expired: #e9e3f5`
- 保留 `--ef-primary: #5b42ed`、头部 `linear-gradient(135deg, #4f46e5…)`、18/22/44/48px、3px 焦点、圆角/间距/阴影/断点。
- 错误红 `#9f1d35`、警告棕 `#8a5a00` 保留。

普通/关怀/400px/200% 截图**未生成**，视觉“待验”。

## 2. 八项功能审计

审计文档：`docs/iteration10-function-audit.md`。

- 已有：智能聚光灯（P0）、长者模式（P1）、回答溯源（P0）。
- 部分实现：任务进度（P1）、错误纠偏（P1）、有限代操作（P0 边界，仅只读辅助）。
- 未实现：办事条件预检查（P2）、任务收藏（P2）。
- 本轮只审计，未实现缺失项。

## 3. DeepSeek 接入收口

### 3.1 Key 与配置

- Key 仅通过 `npm run model:proxy` 的 `--env-file=.env.local` 读取；源码/`dist`/日志/留痕/聊天不出现真实 Key。
- `.env.example` 仅占位 `your_deepseek_api_key_here`；`.gitignore` 覆盖 `.env.*`，`.env.local` 例外保留示例。
- 扫描 `src/scripts/public/dist` 的真实密钥模式 `sk-[A-Za-z0-9]{20,}`：0 命中（`iteration10-clean-key.log`）。
- `.env.local` 不存在，真实请求**未执行**。

### 3.2 代理

- 仅绑定 `127.0.0.1:8765`；校验 `Host` 必须为 `127.0.0.1:8765` 或 `localhost:8765`；`Origin` 必须精确等于配置的 `chrome-extension://<extensionId>`。
- CORS 预检 + `Access-Control-Allow-Private-Network`；请求体上限 32KB；10s 超时；20 次/分钟。
- 载荷只接受 `utterance/page/segments/controls/truncated`；显式拒绝 `slots`/`bytes`/`value`；错误只返回枚举（`invalid-payload`/`request-too-large`/`upstream-error`/`invalid-model-output`），日志只记 code，不记 Key/正文。
- 默认模型 `deepseek-chat`，超时 10000ms；均可用 `.env.local` 覆盖。

### 3.3 扩展权限

- `public/manifest.json` 已移除 `host_permissions`；权限仍四项（`activeTab/scripting/sidePanel/storage`）。
- `verify-manifest.mjs` 断言改为“host_permissions 不存在或为空”。
- `verify` 例外现为 4 条并逐条打印：`getUserMedia` 两处（授权页源码/产物）与 `fetch(` 两处（`ModelEngine.ts`/`sidepanel.js`，仅指向本机代理）。

### 3.4 脱敏与姓名

- 新增 `src/shared/privacy/name.ts`：标签姓名（姓名/名字/申请人/联系人/办理人/客户姓名）替换为“姓名”；`先生/女士/同志/老师` 等无标签姓名风险整段跳过/整体阻断。
- `sanitizeOutbound` 删除 `slots` 与 `bytes`；只发问题/域名/路径/标题/有限段落/控件标签；URL 去查询串；HTML/`value`/证件/手机/银行卡/验证码/密码仍阻断。
- 已知限制：无标签、无称谓的 2–4 字姓名无法可靠识别；当前采用保守策略，命中才阻断。

### 3.5 在线模式与回退

- 默认关闭；顶部状态显示“本地规则/在线智能已开启/待连接”。
- **仅 `enabled && ready` 才请求模型**；未就绪直接本地规则。
- 8s 超时；失败/无依据/不安全控件/不安全文本/脱敏阻断/校验失败全部回退 `RuleEngine`；同会话只提示一次，不锁输入框。
- 模型结果必须经 `validateResponse`；引用必须匹配当前 snapshot；步骤控件必须可见、未禁用、非歧义、无风险、非 form；文本含提交/支付/验证码/代填/自动提交等直接拒绝。
- 不自动点击/提交/发送。

## 4. 自动测试与门禁

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 0 error |
| `npm run build` | 通过；`sidepanel.js 304286` |
| `npm run selftest` | **114 项通过**（`# tests 114 / # pass 114 / # fail 0`） |
| `npm run verify` | 通过；权限四项、host 为空、4 条例外逐条打印 |

测试变更：

- 原无编号“在线模型只接受当前页引用与安全控件”改为 **AT-115**，断言不变（错误信息更新为 `model-fallback:unsafe-control`）。
- 新增 **AT-116—AT-123**：在线未就绪门控/回退提示、Key 不落源码/示例、姓名替换与阻断、出站键白名单、模型无依据/不安全文本回退、代理本机与载荷策略、回退接线、紫色 token 回归。
- 既有 106 项全部保留并通过；总计 114。

日志：`codearts_proof/iteration10-{typecheck,build,selftest,verify}.log`；清洁：`iteration10-clean-{key,purple,manifest}.log`。

## 5. 真实 API Key 验收（未验证）

### 5.1 已执行

（空，未提供 Key，`.env.local` 不存在）

### 5.2 待用户执行

1. 在 Chrome 扩展管理页复制 EasyFlow 扩展 ID。
2. 在项目根目录创建 `.env.local`（**不提交**）：
   - `EASYFLOW_MODEL_SECRET=<你的 DeepSeek Key>`
   - `EASYFLOW_EXTENSION_ID=<扩展 ID>`
   - 可选 `EASYFLOW_MODEL_NAME=deepseek-chat`、`EASYFLOW_MODEL_TIMEOUT_MS=10000`
3. `npm run model:proxy`；确认只打印 `listening on http://127.0.0.1:8765`，不打印 Key。
4. 重新加载扩展 → 刷新网页 → 重开侧栏 → 点顶部“本地规则”开启在线；确认显示“在线智能已开启”。
5. V-01 页面事实：问“办理条件是什么” → 1–3 句 + 折叠依据 + 可高亮。
6. V-02 安全下一步：问“下一步点哪里” → 只给一个安全入口 + “指给我看”；不出现提交/支付/验证码/代填。
7. V-03–V-06 回退：停代理、断网、制造无依据回答、让模型指向危险控件；均应回退本地并有一条可见提示，输入框不锁。
8. V-07/V-08：含姓名/证件/手机/查询串的页面不出现在线请求；无法保证姓名时保持本地。
9. V-09：普通/关怀/400px/200% 四张截图。
10. 失败记录只写：请求 ID、耗时、状态、类别、回退原因、引用数；**不写 Key、正文、URL 查询串、输入值**。

## 6. 失败/未验证项（不得虚报）

- 真实 DeepSeek 请求：**未验证**（无 Key）。
- 真实代理 CORS/PNA 与 Chrome 侧联通：**未验证**。
- 模型无依据/不安全控件的真实回退：自动测试已覆盖逻辑，真实模型行为**未验证**。
- 普通/关怀/400px/200% 截图：**未生成，待验**。
- 8s 超时是否足够真实模型：**未验证**。
- 高亮真实视觉：沿用上轮“待验”。
- `git diff`：无法执行，**未核对**。

## 7. 最短复测

```powershell
# 1) 本地创建 .env.local（不要把 Key 贴到聊天/代码）
npm run model:proxy
# 2) 扩展管理页重载 EasyFlow → 刷新目标网页 → 重开侧栏
# 3) 点顶部“本地规则”开启
# 4) 问事实 → 看依据；问下一步 → 点“指给我看”
# 5) 停代理再问 → 应回退本地并提示一次，输入框仍可用
```

完成前不提交、不推送。