/**
 * Downloads Gemma 3 4B Instruct (Q4_K_M GGUF) into app-data/models/.
 * Run with: pnpm --filter @studynest/desktop fetch-model
 *
 * Set STUDYNEST_GEMMA_MODEL_URL to override the source.
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
const DEFAULT_URL = "https://huggingface.co/lmstudio-community/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf?download=true";
async function main() {
    const url = process.env.STUDYNEST_GEMMA_MODEL_URL ?? DEFAULT_URL;
    const dest = process.env.STUDYNEST_GEMMA_MODEL_PATH ??
        resolve(process.cwd(), "..", "..", "app-data", "models", "gemma-3-4b-it-q4_k_m.gguf");
    mkdirSync(dirname(dest), { recursive: true });
    if (existsSync(dest) && statSync(dest).size > 1_000_000_000) {
        console.log(`Model already present at ${dest}`);
        return;
    }
    console.log(`Downloading Gemma 3 4B Instruct (Q4_K_M) → ${dest}`);
    const res = await fetch(url);
    if (!res.ok || !res.body) {
        throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }
    const total = Number(res.headers.get("content-length") ?? 0);
    let downloaded = 0;
    const out = createWriteStream(dest);
    const reader = res.body.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        out.write(value);
        downloaded += value.byteLength;
        if (total) {
            const pct = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(`\r  ${pct}% (${(downloaded / 1e9).toFixed(2)} GB)`);
        }
    }
    out.end();
    process.stdout.write("\nDone.\n");
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
// Silence "unused" when executed via tsx with custom flags.
void join;
//# sourceMappingURL=fetch-model.js.map