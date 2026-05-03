/**
 * Lightweight user profile, persisted to `localStorage` so we don't have
 * to wait for the SQLite WASM bundle before deciding whether to render
 * onboarding. The `onboarded` flag gates the main app on first launch.
 *
 * SQLite still owns class records and other domain data — this module
 * only stores the bits we need before the DB is open (name, role) and
 * the once-per-install onboarding flag.
 */
export type LearnerRole = "high-school" | "college" | "grad" | "self-learner" | "other";
export interface Profile {
    name: string;
    role: LearnerRole | null;
    onboardedAt: string | null;
}
export declare function getProfile(): Profile;
export declare function saveProfile(p: Profile): void;
export declare function isOnboarded(): boolean;
/** Best-effort first-name. Falls back to the full string if there's no space. */
export declare function firstName(full: string): string;
//# sourceMappingURL=profile.d.ts.map