#!/usr/bin/env node
/**
 * pnpm often skips or fails Electron's postinstall (binary download). This script
 * runs electron/install.js when path.txt is missing or points at a missing file.
 *
 * Run manually:  node scripts/ensure-electron.cjs
 * Or:           pnpm electron:download
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const desktopRoot = path.join(__dirname, "..", "apps", "desktop");
let pkgPath;
try {
  pkgPath = require.resolve("electron/package.json", { paths: [desktopRoot] });
} catch {
  console.warn("[ensure-electron] electron not installed — skip");
  process.exit(0);
}

const electronRoot = path.dirname(pkgPath);
const pathTxt = path.join(electronRoot, "path.txt");
const installJs = path.join(electronRoot, "install.js");

function binaryMissing() {
  if (!fs.existsSync(pathTxt)) return true;
  try {
    const p = fs.readFileSync(pathTxt, "utf8").trim();
    if (!p) return true;
    return !fs.existsSync(p);
  } catch {
    return true;
  }
}

if (!binaryMissing()) {
  console.log("[ensure-electron] Electron binary OK");
  process.exit(0);
}

if (!fs.existsSync(installJs)) {
  console.error("[ensure-electron] Missing install.js:", installJs);
  process.exit(1);
}

console.log("[ensure-electron] Downloading Electron binary (needs network)…");
const env = { ...process.env };
delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;

const result = spawnSync(process.execPath, [installJs], {
  cwd: electronRoot,
  stdio: "inherit",
  env,
});

process.exit(result.status === 0 ? 0 : result.status ?? 1);
