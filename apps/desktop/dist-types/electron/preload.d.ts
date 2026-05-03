declare const api: {
    /** Used by the renderer for platform-specific UI (e.g. custom macOS title bar). */
    platform: NodeJS.Platform;
    getPaths: () => Promise<{
        userData: string;
        documents: string;
        appData: string;
    }>;
    /** Full sqlite file bytes for sql.js (renderer). */
    loadDatabaseFile: () => Promise<ArrayBuffer | null>;
    saveDatabaseFile: (data: Uint8Array) => Promise<void>;
    sidecarBaseUrl: () => Promise<string>;
    sidecarStatus: () => Promise<{
        ok: boolean;
        loaded: boolean;
        model?: string | null;
        error?: string | null;
    }>;
    onSidecarReady: (cb: (ok: boolean) => void) => (() => void);
};
export type DesktopBridge = typeof api;
export {};
//# sourceMappingURL=preload.d.ts.map