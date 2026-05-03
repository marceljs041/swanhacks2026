import { badgeIdsEarned } from "@studynest/shared";
import { fetchBadgeProgressMetrics } from "../db/repositories.js";
import { getProfile } from "./profile.js";
import { useApp } from "../store.js";
function sameBadgeSet(a, b) {
    if (a.length !== b.length)
        return false;
    const sb = new Set(b);
    return a.every((id) => sb.has(id));
}
/**
 * Recomputes earned badges from the local DB, merges with stored profile badges
 * (never removes), persists, and updates the app store.
 */
export async function refreshUserBadges() {
    let profile;
    try {
        profile = getProfile();
    }
    catch {
        return;
    }
    const metrics = await fetchBadgeProgressMetrics();
    const progress = {
        ...metrics,
        onboarded: !!profile.onboardedAt,
    };
    const earned = badgeIdsEarned(progress);
    const merged = [...new Set([...profile.badges, ...earned])];
    if (sameBadgeSet(merged, profile.badges))
        return;
    const next = { ...profile, badges: merged };
    useApp.getState().setProfile(next);
}
//# sourceMappingURL=badgesSync.js.map