#!/usr/bin/env node
/**
 * Run FastAPI with the repo venv’s Python so `pnpm dev` / Turbo work without
 * `source .venv/bin/activate` (uvicorn is not on PATH globally).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";

const candidates = win
  ? [join(root, ".venv", "Scripts", "python.exe")]
  : [
      join(root, ".venv", "bin", "python3"),
      join(root, ".venv", "bin", "python"),
    ];

const python = candidates.find((p) => existsSync(p));

if (!python) {
  console.error(
    "[@studynest/api] No Python venv found under apps/api/.venv.\n" +
      "  cd apps/api && python3.12 -m venv .venv && .venv/bin/pip install -e .\n" +
      "See apps/api/README.md",
  );
  process.exit(1);
}

const child = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"],
  { cwd: root, stdio: "inherit", shell: false },
);

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
