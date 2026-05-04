/**
 * Downloads the Gemma 4 E4B Instruct HF snapshot into app-data/models/gemma-4-e4b-it/.
 * Run: pnpm --filter ./apps/desktop fetch-model
 *
 * Weights are gated — set HF_TOKEN (see https://huggingface.co/settings/tokens).
 * Override hub id with STUDYNEST_GEMMA4_HUB_ID or destination with STUDYNEST_GEMMA4_MODEL_PATH.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
const DEFAULT_HUB_ID = "google/gemma-4-E4B-it";
function resolvePython() {
    const apiRoot = resolve(process.cwd(), "..", "api");
    const isWin = process.platform === "win32";
    const py = isWin
        ? join(apiRoot, ".venv", "Scripts", "python.exe")
        : join(apiRoot, ".venv", "bin", "python3");
    if (!existsSync(py)) {
        throw new Error(`Need apps/api/.venv with huggingface_hub (run: cd apps/api && pip install -e ".[local-ai]") — missing ${py}`);
    }
    return py;
}
async function main() {
    const hubId = process.env.STUDYNEST_GEMMA4_HUB_ID ?? DEFAULT_HUB_ID;
    const dest = process.env.STUDYNEST_GEMMA4_MODEL_PATH ??
        resolve(process.cwd(), "..", "..", "app-data", "models", "gemma-4-e4b-it");
    mkdirSync(dirname(dest), { recursive: true });
    const marker = join(dest, "config.json");
    if (existsSync(marker)) {
        console.log(`Model snapshot already present at ${dest}`);
        return;
    }
    console.log(`Downloading ${hubId} → ${dest}`);
    const py = resolvePython();
    const script = `
from huggingface_hub import snapshot_download
snapshot_download(${JSON.stringify(hubId)}, local_dir=${JSON.stringify(dest)})
`;
    const r = spawnSync(py, ["-c", script], {
        stdio: "inherit",
        env: { ...process.env },
    });
    if (r.status !== 0) {
        throw new Error("snapshot_download failed — check HF_TOKEN for gated models.");
    }
    console.log("Done.");
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=fetch-model.js.map