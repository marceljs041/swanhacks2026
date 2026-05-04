import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { app } from "electron";

const isWin = process.platform === "win32";

let proc: ChildProcess | null = null;

const SIDECAR_PORT = Number(process.env.STUDYNEST_LOCAL_AI_PORT ?? 8765);

interface SidecarOptions {
  pythonExe?: string;
  apiDir?: string;
  /** Override Gemma 4 snapshot directory (must contain `config.json` when offline). */
  gemma4ModelPath?: string;
}

function resolveApiDir(): string {
  // In dev, the python package lives in the monorepo at apps/api.
  const dev = join(__dirname, "..", "..", "api");
  if (existsSync(dev)) return dev;
  // In production, electron-builder bundles it under resources/api.
  return join(process.resourcesPath ?? "", "api");
}

/**
 * Prefer the monorepo `apps/api/.venv` interpreter (has FastAPI + deps).
 * Without this, `python3` often resolves to Apple's Xcode Python 3.9 with no packages.
 */
function resolvePythonExe(apiDir: string): string {
  const fromEnv = process.env.STUDYNEST_PYTHON?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const venvBin = isWin
    ? join(apiDir, ".venv", "Scripts", "python.exe")
    : join(apiDir, ".venv", "bin", "python3");
  if (existsSync(venvBin)) return venvBin;

  const venvPy = join(apiDir, ".venv", "bin", "python");
  if (!isWin && existsSync(venvPy)) return venvPy;

  const fb = process.env.STUDYNEST_PYTHON_FALLBACK?.trim();
  if (fb) return fb;

  /* Windows zips built on Linux ship a Linux .venv only — Scripts\\python.exe is absent. */
  return isWin ? "python" : "python3";
}

/** Directory name under `app-data/models/` for HF snapshot / `pnpm fetch-model`. */
const GEMMA4_SNAPSHOT_DIR = "gemma-4-e4b-it";

/**
 * HuggingFace snapshot folder for Gemma 4 E4B (text + audio). Electron main often
 * does not load `.env`; resolve repo `app-data/models/<dir>` when present.
 */
function resolveGemma4ModelPath(): string {
  const envPath = process.env.STUDYNEST_GEMMA4_MODEL_PATH?.trim();

  if (envPath) {
    if (isAbsolute(envPath)) return envPath;
    const base = app.isPackaged
      ? process.resourcesPath
      : join(resolveApiDir(), "..", "..");
    return resolve(base, envPath);
  }

  if (app.isPackaged) {
    const bundled = join(
      process.resourcesPath,
      "app-data",
      "models",
      GEMMA4_SNAPSHOT_DIR,
    );
    if (existsSync(join(bundled, "config.json"))) return bundled;
    return join(app.getPath("userData"), "models", GEMMA4_SNAPSHOT_DIR);
  }

  const repoRoot = join(resolveApiDir(), "..", "..");
  const repoDefault = join(
    repoRoot,
    "app-data",
    "models",
    GEMMA4_SNAPSHOT_DIR,
  );
  if (existsSync(join(repoDefault, "config.json"))) return repoDefault;

  return join(app.getPath("userData"), "models", GEMMA4_SNAPSHOT_DIR);
}

export interface SidecarHandle {
  port: number;
  baseUrl: string;
  stop: () => void;
}

export function startSidecar(opts: SidecarOptions = {}): SidecarHandle {
  if (proc) return current();

  const apiDir = opts.apiDir ?? resolveApiDir();
  const python = opts.pythonExe ?? resolvePythonExe(apiDir);
  const modelDir = opts.gemma4ModelPath ?? resolveGemma4ModelPath();

  const env = {
    ...process.env,
    STUDYNEST_LOCAL_AI_PORT: String(SIDECAR_PORT),
    STUDYNEST_GEMMA4_MODEL_PATH: modelDir,
    PYTHONPATH: apiDir,
  };

  console.log(`[sidecar] spawn python=${python} cwd=${apiDir} modelDir=${modelDir}`);

  const child = spawn(python, ["-m", "local_sidecar.main"], {
    cwd: apiDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    /* Windows: bare `python` is often a launcher app; shell helps some setups. */
    shell: isWin,
  });
  proc = child;

  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[sidecar] ${chunk}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[sidecar] ${chunk}`);
  });
  child.on("exit", (code) => {
    console.log(`[sidecar] exited with code ${code}`);
    proc = null;
  });

  return current();
}

function current(): SidecarHandle {
  return {
    port: SIDECAR_PORT,
    baseUrl: `http://127.0.0.1:${SIDECAR_PORT}`,
    stop: stopSidecar,
  };
}

export function stopSidecar(): void {
  if (!proc) return;
  try {
    proc.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  proc = null;
}

export async function waitForSidecar(
  baseUrl: string,
  timeoutMs = 30000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return true;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
