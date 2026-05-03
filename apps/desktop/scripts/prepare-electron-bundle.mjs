/**
 * Prepares repo paths before `vite build && electron-builder`.
 * - Ensures app-data/models exists (GGUF copied into the app via extraResources).
 * - Verifies apps/api/.venv exists so the bundled sidecar can run.
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(__dirname, "..");
const apiRoot = join(desktopRoot, "..", "api");
const repoRoot = join(desktopRoot, "..", "..");
const modelsDir = join(repoRoot, "app-data", "models");
const isWin = process.platform === "win32";
const venvPy = isWin
  ? join(apiRoot, ".venv", "Scripts", "python.exe")
  : join(apiRoot, ".venv", "bin", "python3");
const venvPyAlt = isWin ? null : join(apiRoot, ".venv", "bin", "python");

mkdirSync(modelsDir, { recursive: true });

if (!existsSync(venvPy) && !(venvPyAlt && existsSync(venvPyAlt))) {
  console.error(
    "[electron-bundle] No Python interpreter at apps/api/.venv. Create the venv and install deps, then rebuild.",
  );
  process.exit(1);
}

const ggufs = readdirSync(modelsDir).filter((f) => f.endsWith(".gguf"));
if (ggufs.length === 0) {
  const msg =
    "[electron-bundle] No .gguf file in app-data/models/. For a self-contained build run:\n" +
    "  pnpm --filter @studynest/desktop fetch-model\n" +
    "Or copy gemma-3-4b-it-q4_k_m.gguf there. Override with STUDYNEST_ALLOW_EMPTY_MODEL_BUNDLE=1 (app falls back to userData).";
  if (process.env.STUDYNEST_ALLOW_EMPTY_MODEL_BUNDLE === "1") {
    console.warn(msg);
  } else {
    console.error(msg);
    process.exit(1);
  }
}
