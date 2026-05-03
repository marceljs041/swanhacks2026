import { contextBridge, ipcRenderer } from "electron";
const api = {
    /** Used by the renderer for platform-specific UI (e.g. custom macOS title bar). */
    platform: process.platform,
    getPaths: () => ipcRenderer.invoke("app:get-paths"),
    /** Full sqlite file bytes for sql.js (renderer). */
    loadDatabaseFile: () => ipcRenderer.invoke("db:load-file"),
    saveDatabaseFile: (data) => ipcRenderer.invoke("db:save-file", data),
    sidecarBaseUrl: () => ipcRenderer.invoke("sidecar:base-url"),
    sidecarStatus: () => ipcRenderer.invoke("sidecar:status"),
    onSidecarReady: (cb) => {
        const listener = (_e, ok) => cb(ok);
        ipcRenderer.on("sidecar:ready", listener);
        return () => ipcRenderer.off("sidecar:ready", listener);
    },
};
contextBridge.exposeInMainWorld("studynest", api);
//# sourceMappingURL=preload.js.map