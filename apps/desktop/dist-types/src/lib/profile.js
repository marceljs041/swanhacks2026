/**
 * Lightweight user profile, persisted to `localStorage` so we don't have
 * to wait for the SQLite WASM bundle before deciding whether to render
 * onboarding. The `onboarded` flag gates the main app on first launch.
 *
 * SQLite still owns class records and other domain data — this module
 * only stores the bits we need before the DB is open (name, role) and
 * the once-per-install onboarding flag.
 */
const STORAGE_KEY = "notegoat:profile";
const EMPTY = { name: "", role: null, onboardedAt: null };
export function getProfile() {
    if (typeof window === "undefined")
        return EMPTY;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return EMPTY;
        const parsed = JSON.parse(raw);
        return {
            name: typeof parsed.name === "string" ? parsed.name : "",
            role: parsed.role ?? null,
            onboardedAt: typeof parsed.onboardedAt === "string" ? parsed.onboardedAt : null,
        };
    }
    catch {
        return EMPTY;
    }
}
export function saveProfile(p) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    }
    catch {
        /* private mode, ignore */
    }
}
export function isOnboarded() {
    return !!getProfile().onboardedAt;
}
/** Best-effort first-name. Falls back to the full string if there's no space. */
export function firstName(full) {
    const trimmed = full.trim();
    if (!trimmed)
        return "";
    const space = trimmed.indexOf(" ");
    return space === -1 ? trimmed : trimmed.slice(0, space);
}
//# sourceMappingURL=profile.js.map