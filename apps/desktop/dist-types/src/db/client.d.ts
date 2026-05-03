import { type CompatibleDb } from "./sqljs-wrapper.js";
export declare function getDb(): Promise<CompatibleDb>;
export declare function getDeviceId(): Promise<string>;
export declare function getUserId(): Promise<string | null>;
export declare function setUserId(userId: string): Promise<void>;
//# sourceMappingURL=client.d.ts.map