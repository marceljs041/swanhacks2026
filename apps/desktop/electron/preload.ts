import { contextBridge, ipcRenderer } from "electron";

const api = {
  /** Used by the renderer for platform-specific UI (e.g. custom macOS title bar). */
  platform: process.platform,
  getPaths: () =>
    ipcRenderer.invoke("app:get-paths") as Promise<{
      userData: string;
      documents: string;
      appData: string;
    }>,
  /** Full sqlite file bytes for sql.js (renderer). */
  loadDatabaseFile: () =>
    ipcRenderer.invoke("db:load-file") as Promise<ArrayBuffer | null>,
  saveDatabaseFile: (data: Uint8Array) =>
    ipcRenderer.invoke("db:save-file", data) as Promise<void>,
  sidecarBaseUrl: () => ipcRenderer.invoke("sidecar:base-url") as Promise<string>,
  sidecarStatus: () =>
    ipcRenderer.invoke("sidecar:status") as Promise<{
      ok: boolean;
      loaded: boolean;
      model?: string | null;
      error?: string | null;
    }>,
  onSidecarReady: (cb: (ok: boolean) => void): (() => void) => {
    const listener = (_e: unknown, ok: boolean) => cb(ok);
    ipcRenderer.on("sidecar:ready", listener);
    return () => ipcRenderer.off("sidecar:ready", listener);
  },
};

contextBridge.exposeInMainWorld("studynest", api);

export type DesktopBridge = typeof api;
