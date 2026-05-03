import type { SyncWorker } from "@studynest/sync";

let worker: SyncWorker | null = null;

export function registerDesktopSyncWorker(w: SyncWorker): void {
  worker = w;
}

export function unregisterDesktopSyncWorker(): void {
  worker = null;
}

/** Triggers an immediate push/pull pass (same as the periodic worker tick). */
export function requestDesktopSync(): Promise<void> {
  if (!worker) {
    console.warn(
      "[studynest] requestDesktopSync: no SyncWorker — did React Strict Mode skip registration?",
    );
    return Promise.resolve();
  }
  return worker.syncNow();
}
