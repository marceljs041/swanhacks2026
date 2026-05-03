import { type SyncDb } from "@studynest/sync";
import { type SyncPullResponse, type SyncPushRequest, type SyncPushResponse } from "@studynest/shared";
export declare const desktopSyncDb: SyncDb;
export declare const desktopTransport: {
    ping(): Promise<boolean>;
    push(req: SyncPushRequest): Promise<SyncPushResponse>;
    pull(req: any): Promise<SyncPullResponse>;
};
//# sourceMappingURL=adapter.d.ts.map