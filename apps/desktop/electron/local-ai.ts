import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { app } from "electron";

const isWin = process.platform === "win32";

let proc: ChildProcessWithoutNullStreams | null = null;

const SIDECAR_PORT = Number(process.env.STUDYNEST_LOCAL_AI_PORT ?? 8765);

interface SidecarOptions {
  pythonExe?: string;
  apiDir?: string;
  modelPath?: string;
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

  return process.env.STUDYNEST_PYTHON_FALLBACK ?? "python3";
}

const GEMMA_FILENAME = "gemma-3-4b-it-q4_k_m.gguf";

/**
 * Must match `apps/desktop/scripts/fetch-model.ts` default destination:
 * `<repo>/app-data/models/<filename>`.
 *
 * Electron main often does not load `.env`, so we cannot rely on
 * `STUDYNEST_GEMMA_MODEL_PATH` being set; prefer the repo copy when present,
 * then Electron userData (packaged / manual install).
 */
function resolveModelPath(): string {
  const repoRoot = join(resolveApiDir(), "..", "..");
  const envPath = process.env.STUDYNEST_GEMMA_MODEL_PATH?.trim();

  if (envPath) {
    if (isAbsolute(envPath)) return envPath;
    return resolve(repoRoot, envPath);
  }

  const repoDefault = join(repoRoot, "app-data", "models", GEMMA_FILENAME);
  if (existsSync(repoDefault)) return repoDefault;

  return join(app.getPath("userData"), "models", GEMMA_FILENAME);
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
  const modelPath = opts.modelPath ?? resolveModelPath();

  const env = {
    ...process.env,
    STUDYNEST_LOCAL_AI_PORT: String(SIDECAR_PORT),
    STUDYNEST_GEMMA_MODEL_PATH: modelPath,
    PYTHONPATH: apiDir,
  };

  proc = spawn(python, ["-m", "local_sidecar.main"], {
    cwd: apiDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout?.on("data", (chunk) => {
    process.stdout.write(`[sidecar] ${chunk}`);
  });
  proc.stderr?.on("data", (chunk) => {
    process.stderr.write(`[sidecar] ${chunk}`);
  });
  proc.on("exit", (code) => {
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
