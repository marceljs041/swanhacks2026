import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { app } from "electron";
const isWin = process.platform === "win32";
let proc = null;
const SIDECAR_PORT = Number(process.env.STUDYNEST_LOCAL_AI_PORT ?? 8765);
function resolveApiDir() {
    // In dev, the python package lives in the monorepo at apps/api.
    const dev = join(__dirname, "..", "..", "api");
    if (existsSync(dev))
        return dev;
    // In production, electron-builder bundles it under resources/api.
    return join(process.resourcesPath ?? "", "api");
}
/**
 * Prefer the monorepo `apps/api/.venv` interpreter (has FastAPI + deps).
 * Without this, `python3` often resolves to Apple's Xcode Python 3.9 with no packages.
 */
function resolvePythonExe(apiDir) {
    const fromEnv = process.env.STUDYNEST_PYTHON?.trim();
    if (fromEnv && existsSync(fromEnv))
        return fromEnv;
    const venvBin = isWin
        ? join(apiDir, ".venv", "Scripts", "python.exe")
        : join(apiDir, ".venv", "bin", "python3");
    if (existsSync(venvBin))
        return venvBin;
    const venvPy = join(apiDir, ".venv", "bin", "python");
    if (!isWin && existsSync(venvPy))
        return venvPy;
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
function resolveModelPath() {
    const envPath = process.env.STUDYNEST_GEMMA_MODEL_PATH?.trim();
    if (envPath) {
        if (isAbsolute(envPath))
            return envPath;
        const base = app.isPackaged
            ? process.resourcesPath
            : join(resolveApiDir(), "..", "..");
        return resolve(base, envPath);
    }
    if (app.isPackaged) {
        const bundled = join(process.resourcesPath, "app-data", "models", GEMMA_FILENAME);
        if (existsSync(bundled))
            return bundled;
        return join(app.getPath("userData"), "models", GEMMA_FILENAME);
    }
    const repoRoot = join(resolveApiDir(), "..", "..");
    const repoDefault = join(repoRoot, "app-data", "models", GEMMA_FILENAME);
    if (existsSync(repoDefault))
        return repoDefault;
    return join(app.getPath("userData"), "models", GEMMA_FILENAME);
}
export function startSidecar(opts = {}) {
    if (proc)
        return current();
    const apiDir = opts.apiDir ?? resolveApiDir();
    const python = opts.pythonExe ?? resolvePythonExe(apiDir);
    const modelPath = opts.modelPath ?? resolveModelPath();
    const env = {
        ...process.env,
        STUDYNEST_LOCAL_AI_PORT: String(SIDECAR_PORT),
        STUDYNEST_GEMMA_MODEL_PATH: modelPath,
        PYTHONPATH: apiDir,
    };
    const child = spawn(python, ["-m", "local_sidecar.main"], {
        cwd: apiDir,
        env,
        stdio: ["ignore", "pipe", "pipe"],
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
function current() {
    return {
        port: SIDECAR_PORT,
        baseUrl: `http://127.0.0.1:${SIDECAR_PORT}`,
        stop: stopSidecar,
    };
}
export function stopSidecar() {
    if (!proc)
        return;
    try {
        proc.kill("SIGTERM");
    }
    catch {
        /* ignore */
    }
    proc = null;
}
export async function waitForSidecar(baseUrl, timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(`${baseUrl}/health`);
            if (res.ok)
                return true;
        }
        catch {
            /* not ready yet */
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    return false;
}
//# sourceMappingURL=local-ai.js.map