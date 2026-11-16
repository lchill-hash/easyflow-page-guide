import { readFile, stat, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const manifestPath = join(dist, "manifest.json");

const failures = [];
const notes = [];

function check(condition, message) {
  if (condition) {
    notes.push(`OK  ${message}`);
  } else {
    failures.push(`FAIL ${message}`);
  }
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  console.error(`FAIL 无法读取 dist/manifest.json: ${String(error)}`);
  process.exit(1);
}

const permissions = Array.isArray(manifest.permissions) ? [...manifest.permissions].sort() : [];
const expected = ["activeTab", "scripting", "sidePanel", "storage"].sort();
check(
  permissions.length === expected.length && permissions.every((item, index) => item === expected[index]),
  `permissions 恰为 ${expected.join(", ")}（实际：${permissions.join(", ") || "空"}）`,
);

for (const field of ["host_permissions", "content_scripts", "web_accessible_resources", "externally_connectable"]) {
  check(!(field in manifest), `清单不含 ${field}`);
}

check(manifest.manifest_version === 3, "manifest_version 为 3");
check(String(manifest.minimum_chrome_version) >= "116", "minimum_chrome_version >= 116");
check(manifest.background?.service_worker === "background.js", "background.service_worker 指向 background.js");
check(manifest.background?.type === "module", "background.type 为 module");
check(manifest.side_panel?.default_path === "sidepanel.html", "side_panel.default_path 指向 sidepanel.html");

const requiredFiles = [
  "background.js",
  "content.js",
  "sidepanel.html",
  "sidepanel.js",
  "sidepanel.css",
  "mic-permission.html",
  "mic-permission.js",
  "mic-permission.css",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
];

for (const relativePath of requiredFiles) {
  try {
    const info = await stat(join(dist, relativePath));
    check(info.size > 0, `产物 ${relativePath} 存在且非空（${info.size} bytes）`);
  } catch {
    failures.push(`FAIL 产物 ${relativePath} 不存在`);
  }
}

const csp = manifest.content_security_policy?.extension_pages ?? "";
check(typeof csp === "string" && csp.length > 0, "存在 extension_pages CSP");
check(!/unsafe-eval|unsafe-inline/i.test(csp), "CSP 不含 unsafe-eval/unsafe-inline");
check(!/https?:\/\//i.test(csp), "CSP 不含远程域名");

const micHtml = await readOptional(join(dist, "mic-permission.html"));
check(micHtml.includes('src="mic-permission.js"'), "授权页引用 mic-permission.js");
check(micHtml.includes('href="mic-permission.css"'), "授权页引用 mic-permission.css");
check(!/https?:\/\//i.test(micHtml), "授权页不含远程资源");

const micScript = await readOptional(join(dist, "mic-permission.js"));
check(
  /getUserMedia\(\s*\{\s*audio:\s*true\s*\}\s*\)/.test(micScript),
  "授权页 getUserMedia 参数只含 audio: true",
);
check(!/getUserMedia\([^)]*video/.test(micScript), "授权页 getUserMedia 不请求 video");
check(
  micScript.includes("getTracks()") && micScript.includes(".stop()"),
  "授权页获取后调用 getTracks() 并停止全部轨道",
);

const requestSource = await readOptional(join(root, "src", "mic-permission", "request.ts"));
check(!/video/.test(requestSource), "授权页请求源码不含 video");
check(requestSource.includes("getUserMedia({ audio: true })"), "授权页请求源码只含 audio: true");

const speechConstants = await readOptional(
  join(root, "src", "shared", "speech", "constants.ts"),
);
check(
  speechConstants.includes('"mic-permission.html"'),
  "授权页路径常量与 chrome.runtime.getURL 一致",
);

const runtimeForbidden = [
  "fetch(",
  "XMLHttpRequest",
  "sendBeacon",
  "WebSocket",
  "MediaRecorder",
  "apiKey",
  "API_KEY",
  "Authorization",
];

const sourceForbidden = [
  "host_permissions",
  "<all_urls>",
  "content_scripts",
  "dangerouslySetInnerHTML",
  "innerHTML",
];

const getUserMediaExemptions = [
  {
    scope: "src",
    path: "src/mic-permission/request.ts",
    pattern: "getUserMedia",
    used: false,
  },
  {
    scope: "dist",
    path: "dist/mic-permission.js",
    pattern: "getUserMedia",
    used: false,
  },
];

for (const exemption of getUserMediaExemptions) {
  check(
    !/[*?]/.test(exemption.path) && !exemption.path.endsWith("/"),
    `例外路径为精确文件：${exemption.path}`,
  );
  try {
    const info = await stat(join(root, exemption.path));
    check(info.size > 0, `例外路径存在且非空：${exemption.path}`);
  } catch {
    failures.push(`FAIL 例外路径不存在：${exemption.path}`);
  }
}

function findExemption(label, absolute, pattern) {
  const relativePath = relative(root, absolute).replaceAll("\\", "/");
  return getUserMediaExemptions.find(
    (item) =>
      item.scope === label &&
      item.path === relativePath &&
      item.pattern === pattern,
  );
}

async function scanDirectory(dir, extensions, patterns, label) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      await scanDirectory(absolute, extensions, patterns, label);
      continue;
    }
    if (!extensions.some((extension) => entry.name.endsWith(extension))) {
      continue;
    }
    const content = await readFile(absolute, "utf8");
    for (const pattern of patterns) {
      if (content.includes(pattern)) {
        const exemption = findExemption(label, absolute, pattern);
        if (exemption !== undefined) {
          if (!exemption.used) {
            exemption.used = true;
            notes.push(`例外 ${exemption.path} ← ${exemption.pattern}`);
          }
          continue;
        }
        failures.push(`FAIL ${label} ${relative(root, absolute)} 命中禁用内容：${pattern}`);
      }
    }
  }
}

await scanDirectory(dist, [".js"], runtimeForbidden, "dist");
await scanDirectory(join(root, "src"), [".ts", ".tsx"], [...runtimeForbidden, ...sourceForbidden], "src");
await scanDirectory(join(root, "public"), [".json"], sourceForbidden, "public");

await scanDirectory(dist, [".js"], ["getUserMedia"], "dist");
await scanDirectory(join(root, "src"), [".ts", ".tsx"], ["getUserMedia"], "src");

for (const exemption of getUserMediaExemptions) {
  if (!exemption.used) {
    failures.push(`FAIL 例外条目未被使用：${exemption.path} ← ${exemption.pattern}`);
  }
}

console.log(
  `[verify] 路径限定例外清单（共 ${getUserMediaExemptions.length} 条）`,
);
for (const exemption of getUserMediaExemptions) {
  console.log(`  ${exemption.path} ← ${exemption.pattern}`);
}

if (failures.length > 0) {
  console.error("[verify] 清单与门禁校验失败：");
  for (const failure of failures) {
    console.error(`  ${failure}`);
  }
  process.exit(1);
}

console.log("[verify] 清单与产物校验通过");
for (const note of notes) {
  console.log(`  ${note}`);
}