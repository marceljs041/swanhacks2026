let worker = null;
export function registerDesktopSyncWorker(w) {
    worker = w;
}
export function unregisterDesktopSyncWorker() {
    worker = null;
}
/** Triggers an immediate push/pull pass (same as the periodic worker tick). */
export function requestDesktopSync() {
    if (!worker) {
        console.warn("[studynest] requestDesktopSync: no SyncWorker — did React Strict Mode skip registration?");
        return Promise.resolve();
    }
    return worker.syncNow();
}
//# sourceMappingURL=controller.js.map