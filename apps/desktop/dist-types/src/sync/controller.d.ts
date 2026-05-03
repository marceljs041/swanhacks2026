import type { SyncWorker } from "@studynest/sync";
export declare function registerDesktopSyncWorker(w: SyncWorker): void;
export declare function unregisterDesktopSyncWorker(): void;
/** Triggers an immediate push/pull pass (same as the periodic worker tick). */
export declare function requestDesktopSync(): Promise<void>;
//# sourceMappingURL=controller.d.ts.map