/**
 * Ensures a row exists in Supabase `devices` whenever the API is reachable.
 * Offline-first users have no row until this runs after `ping` succeeds.
 */
export declare function registerDeviceWithCloud(): Promise<void>;
//# sourceMappingURL=registerDevice.d.ts.map