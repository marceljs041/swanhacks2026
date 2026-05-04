interface SidecarOptions {
    pythonExe?: string;
    apiDir?: string;
    /** Override Gemma 4 snapshot directory (must contain `config.json` when offline). */
    gemma4ModelPath?: string;
}
export interface SidecarHandle {
    port: number;
    baseUrl: string;
    stop: () => void;
}
export declare function startSidecar(opts?: SidecarOptions): SidecarHandle;
export declare function stopSidecar(): void;
export declare function waitForSidecar(baseUrl: string, timeoutMs?: number): Promise<boolean>;
export {};
//# sourceMappingURL=local-ai.d.ts.map