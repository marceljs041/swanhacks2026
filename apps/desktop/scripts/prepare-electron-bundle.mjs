/**
 * Prepares repo paths before `vite build && electron-builder`.
 * - Ensures app-data/models exists (Gemma 4 snapshot copied via extraResources).
 * - Verifies apps/api/.venv exists so the bundled sidecar can run.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(__dirname, "..");
const apiRoot = join(desktopRoot, "..", "api");
const repoRoot = join(desktopRoot, "..", "..");
const modelsDir = join(repoRoot, "app-data", "models");
const gemma4Config = join(modelsDir, "gemma-4-e4b-it", "config.json");
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

if (!existsSync(gemma4Config)) {
  const msg =
    "[electron-bundle] No Gemma 4 E4B snapshot at app-data/models/gemma-4-e4b-it/config.json.\n" +
    "  For a self-contained offline build run (needs HF_TOKEN for gated weights):\n" +
    "    pnpm --filter ./apps/desktop fetch-model\n" +
    "  Override with STUDYNEST_ALLOW_EMPTY_MODEL_BUNDLE=1 (app falls back to userData).";
  if (process.env.STUDYNEST_ALLOW_EMPTY_MODEL_BUNDLE === "1") {
    console.warn(msg);
  } else {
    console.error(msg);
    process.exit(1);
  }
}
