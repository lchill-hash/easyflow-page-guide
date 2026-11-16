# 13 — 复现脚本改为工程内临时目录与本地夹具口径

## 1. 本轮要求

修改 `scripts/repro-bjsjs.mjs`：

1. 去掉 Chrome 的 `--no-sandbox` 参数；
2. 临时文件放在工程内，并在结束后清理；
3. 重新运行复现；
4. 若仍需要授权启动 Chrome，先显示具体命令和访问路径；
5. 明确区分“本地网页夹具复现”和“真实网站验收”，不得把前者报告成真实网站已验证。

## 2. 脚本修改

文件：`scripts/repro-bjsjs.mjs`

### 2.1 去掉 `--no-sandbox`

Chrome 参数不再包含：

```text
--no-sandbox
```

当前参数由 `buildChromeArgs` 统一生成，包含：

```text
--headless=new
--disable-gpu
--disable-dev-shm-usage
--no-first-run
--no-default-browser-check
--user-data-dir=<工程内临时目录>/profile
--allow-file-access-from-files
--virtual-time-budget=3000
--dump-dom
<本地 harness.html 的 file:// 地址>
```

### 2.2 临时文件放到工程内

修改前：

```text
mkdtemp(join(tmpdir(), "easyflow-repro-"))
```

修改后：

```text
mkdtemp(join(root, ".tmp-repro-"))
```

其中 `root` 是工程根目录 `D:\hwproject\translator`。

临时目录包含：

- `harness.html`
- `engine.mjs`
- `profile/`（Chromium user data）

### 2.3 清理策略

- 启动前扫描并删除工程根目录下残留的 `.tmp-repro-*` 目录；
- `finally` 中执行 `rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })`；
- 注册 `process.once("exit")`，使用 `rmSync` 做退出时的同步兜底清理。

本轮曾发现被中断的 Chrome 留下了：

```text
.tmp-repro-XXXXXXnmagQY/profile/CrashpadMetrics-active.pma
```

已删除；随后运行 `--print-command`，检查结果为：

```text
NO_TEMP_REPRO_DIR
```

### 2.4 启动前显示命令与访问路径

新增 `--print-command` 模式：只打印计划命令、夹具路径、临时页面路径和 `file://` 访问路径，不启动 Chrome。

实际输出：

```text
[repro] 本地网页夹具复现（非真实网站验收）
[repro] Chrome: C:\Program Files\Google\Chrome\Application\chrome.exe
[repro] 本地夹具: D:\hwproject\translator\scripts\fixtures\bjsjs-highlights.html
[repro] 临时页面: D:\hwproject\translator\.tmp-repro-XXXXXXK6zXY9\harness.html
[repro] 访问路径: file:///D:/hwproject/translator/.tmp-repro-XXXXXXK6zXY9/harness.html
[repro] 启动命令: & "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check --user-data-dir=D:\hwproject\translator\.tmp-repro-XXXXXXK6zXY9\profile --allow-file-access-from-files --virtual-time-budget=3000 --dump-dom file:///D:/hwproject/translator/.tmp-repro-XXXXXXK6zXY9/harness.html
[repro] 仅预览命令，未启动 Chrome；该路径是本地文件，不是真实网站。
```

### 2.5 报告口径

报告新增字段：

```json
{
  "verificationMode": "local-fixture-reproduction",
  "isRealSiteAcceptance": false,
  "fixtureSource": "scripts/fixtures/bjsjs-highlights.html",
  "note": "本地网页夹具注入 content.js 复现；不是访问真实网站，不能作为真实网站验收。",
  "harnessPath": ".../.tmp-repro-xxxx/harness.html",
  "harnessAccessPath": "file:///.../.tmp-repro-xxxx/harness.html",
  "chromeCommands": ["..."]
}
```

运行输出首行固定为：

```text
[repro] 本地网页夹具复现（非真实网站验收）
```

结束输出固定为：

```text
[repro] 结论仅代表本地网页夹具复现，不代表真实网站验收。
```

## 3. 重新运行复现

### 3.1 语法检查

```powershell
node --check scripts/repro-bjsjs.mjs
```

通过。

### 3.2 命令预览

```powershell
node scripts/repro-bjsjs.mjs after codearts_proof\repro-bjsjs-after.json --print-command
```

成功，输出见 2.4；临时目录清理验证为 `NO_TEMP_REPRO_DIR`。

### 3.3 实际启动 Chrome

命令：

```powershell
node scripts/repro-bjsjs.mjs after codearts_proof\repro-bjsjs-after.json --snapshot
```

结果：

```text
用户拒绝了执行此命令的请求。命令被沙箱拦截,用户选择不直接执行。
```

因此：

- **本轮没有生成新的本地夹具复现报告**；
- **没有启动 Chrome**；
- **没有执行真实网站访问**；
- **没有真实网站验收**。

已先按要求显示具体 Chrome 命令与 `file://` 访问路径；实际授权启动仍被环境阻止。

## 4. 本地夹具复现与真实网站验收的区分

| 项目 | 本地网页夹具复现 | 真实网站验收 |
|---|---|---|
| 访问地址 | `file:///D:/hwproject/translator/.tmp-repro-*/harness.html` | `https://www.bjsjs.gov.cn/...` |
| 页面来源 | `scripts/fixtures/bjsjs-highlights.html` | 真实网站运行时 DOM |
| 网络 | 不访问网站 | 访问真实网站 |
| 扩展方式 | 在本地 harness 里 stub `chrome.runtime` 并注入 `dist/content.js` | Chrome 加载扩展，点击图标，activeTab 授权 |
| 证明能力 | 采集/分段/意图/检索/成句/校验的夹具级回归 | 真实 DOM、真实授权、真实交互验收 |
| 本轮状态 | 实际 Chrome 启动被阻止，未产生新报告 | 未执行 |

此前 `repro-bjsjs-before.json`、`repro-bjsjs-after-fixture.json` 也只代表本地夹具或原始条目快照，不代表真实网站验收。

## 5. 基线复跑

脚本修改不影响运行时代码，但仍复跑：

```text
BUILD_EXIT_CODE=0
SELFTEST_EXIT_CODE=0
# tests 21
# pass 21
# fail 0
```

日志：

- `codearts_proof/iteration2-build-repro-script.log`
- `codearts_proof/iteration2-selftest-repro-script.log`

## 6. 修改文件

- `scripts/repro-bjsjs.mjs`
- `codearts_proof/12-bjsjs-answer-fix.md`（补充本地夹具/真实网站验收声明）
- `codearts_proof/13-repro-script-local-fixture.md`
- `codearts_proof/iteration2-build-repro-script.log`
- `codearts_proof/iteration2-selftest-repro-script.log`

## 7. 未执行事项

1. 修改后脚本的实际 Chrome 启动（被环境阻止）。
2. 本地夹具复现的新 JSON 报告。
3. 真实网站访问与真实网站验收。
4. 真实页面上的“高龄津贴谁能申请 / 那怎么办理”人工复核。
5. 真实网站上的日期/来源排除、网页依据定位、连续点击提示去重。

## 8. 下一步

- 若允许启动 Chrome，可执行 2.4 中的命令；它访问的是本地 harness，不是真实网站。
- 真实网站验收需在 Chrome 中加载 `dist/`、打开目标网页、点击扩展图标，按 README/`codearts_proof/12-bjsjs-answer-fix.md` 的步骤人工确认。
- 不得将本地夹具结果写成“真实网站已验证”。