import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

/** Monorepo root — `.env` lives here so cloud URL matches apps/api and turbo. */
const repoRoot = resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const apiUrl = env.STUDYNEST_API_URL ?? "http://127.0.0.1:8000";
  const localAiUrl = env.STUDYNEST_LOCAL_AI_URL ?? "http://127.0.0.1:8765";

  return {
    /** Required for packaged Electron (`file://`); absolute `/logo.svg` breaks. */
    base: "./",
    assetsInclude: ["**/*.wasm"],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    /**
     * The renderer bundle must see `STUDYNEST_*` from the repo `.env`. Without
     * this, Vite leaves `process.env` empty in client code and
     * `@studynest/shared` falls back to localhost — but more importantly
     * custom `STUDYNEST_API_URL` never applies, so sync pings the wrong host
     * and the UI stays "offline".
     */
    define: {
      "process.env.STUDYNEST_API_URL": JSON.stringify(apiUrl),
      "process.env.STUDYNEST_LOCAL_AI_URL": JSON.stringify(localAiUrl),
    },
    plugins: [
      react(),
      electron([
        {
          entry: "electron/main.ts",
          vite: {
            build: {
              outDir: "dist-electron",
              rollupOptions: {
                external: ["electron"],
              },
            },
          },
        },
        {
          entry: "electron/preload.ts",
          onstart(options) {
            options.reload();
          },
          vite: {
            build: { outDir: "dist-electron" },
          },
        },
      ]),
      renderer(),
    ],
    server: { port: 5173, strictPort: true },
  };
});
