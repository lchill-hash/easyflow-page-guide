import { build } from "esbuild";
import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateIcons } from "./gen-icons.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");

async function resetDist() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await mkdir(join(dist, "icons"), { recursive: true });
}

async function buildBackground() {
  await build({
    absWorkingDir: root,
    entryPoints: ["src/background/index.ts"],
    outfile: join(dist, "background.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome116",
    splitting: false,
    sourcemap: false,
    minify: false,
    logLevel: "warning",
  });
}

async function buildContent() {
  await build({
    absWorkingDir: root,
    entryPoints: ["src/content/entry.ts"],
    outfile: join(dist, "content.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome116",
    sourcemap: false,
    minify: false,
    logLevel: "warning",
  });
}

async function buildSidePanel() {
  await build({
    absWorkingDir: root,
    entryPoints: ["src/sidepanel/main.tsx"],
    outfile: join(dist, "sidepanel.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome116",
    jsx: "automatic",
    loader: { ".css": "css" },
    sourcemap: false,
    minify: true,
    logLevel: "warning",
  });
}

async function buildMicPermission() {
  await build({
    absWorkingDir: root,
    entryPoints: ["src/mic-permission/main.tsx"],
    outfile: join(dist, "mic-permission.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome116",
    jsx: "automatic",
    loader: { ".css": "css" },
    sourcemap: false,
    minify: false,
    logLevel: "warning",
  });
}

async function copyStatic() {
  await copyFile(join(root, "public", "manifest.json"), join(dist, "manifest.json"));
  await copyFile(join(root, "public", "sidepanel.html"), join(dist, "sidepanel.html"));
  await copyFile(
    join(root, "public", "mic-permission.html"),
    join(dist, "mic-permission.html"),
  );
}

async function listFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...(await listFiles(absolute, relative)));
    } else {
      const info = await stat(absolute);
      results.push(`${relative} (${info.size} bytes)`);
    }
  }
  return results;
}

try {
  await resetDist();
  await generateIcons(join(dist, "icons"));
  await Promise.all([buildBackground(), buildContent(), buildSidePanel(), buildMicPermission()]);
  await copyStatic();
  console.log("[build] dist/ 产物清单：");
  for (const file of await listFiles(dist)) {
    console.log(`  ${file}`);
  }
  console.log("[build] 完成");
} catch (error) {
  console.error("[build] 失败：");
  console.error(error);
  process.exit(1);
}