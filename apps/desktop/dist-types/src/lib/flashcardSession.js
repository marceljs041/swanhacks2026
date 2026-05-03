/**
 * Per-deck review session state, persisted to localStorage so a user
 * can navigate away and come back without losing their session XP /
 * streak / timer. The right-panel widgets pull from the same keys via
 * `loadSession`, so other parts of the app stay decoupled from React
 * state held in `Flashcards.tsx`.
 *
 * Storage layout:
 *   flashcards.session.<setId> → JSON FlashcardSessionState
 *   flashcards.goals.<setId>   → JSON FlashcardSessionGoals (overrides defaults)
 */
const SESSION_PREFIX = "flashcards.session.";
const GOALS_PREFIX = "flashcards.goals.";
export const DEFAULT_GOALS = {
    reviewTarget: 20,
    keepStreak: true,
    masterWeak: 5,
};
function freshSession() {
    return {
        startedAt: Date.now(),
        xp: 0,
        correct: 0,
        reviewed: 0,
        streak: 0,
        weakResolved: [],
    };
}
function safeGet(key) {
    try {
        return typeof localStorage !== "undefined"
            ? localStorage.getItem(key)
            : null;
    }
    catch {
        return null;
    }
}
function safeSet(key, value) {
    try {
        if (typeof localStorage !== "undefined")
            localStorage.setItem(key, value);
    }
    catch {
        /* quota / private mode — drop. */
    }
}
function safeRemove(key) {
    try {
        if (typeof localStorage !== "undefined")
            localStorage.removeItem(key);
    }
    catch {
        /* same as above. */
    }
}
export function loadSession(setId) {
    const raw = safeGet(SESSION_PREFIX + setId);
    if (!raw)
        return freshSession();
    try {
        const parsed = JSON.parse(raw);
        return {
            ...freshSession(),
            ...parsed,
            weakResolved: Array.isArray(parsed.weakResolved)
                ? parsed.weakResolved
                : [],
        };
    }
    catch {
        return freshSession();
    }
}
export function saveSession(setId, state) {
    safeSet(SESSION_PREFIX + setId, JSON.stringify(state));
}
export function resetSession(setId) {
    const fresh = freshSession();
    saveSession(setId, fresh);
    return fresh;
}
export function clearSession(setId) {
    safeRemove(SESSION_PREFIX + setId);
}
export function loadGoals(setId) {
    const raw = safeGet(GOALS_PREFIX + setId);
    if (!raw)
        return DEFAULT_GOALS;
    try {
        const parsed = JSON.parse(raw);
        return {
            reviewTarget: typeof parsed.reviewTarget === "number" && parsed.reviewTarget > 0
                ? parsed.reviewTarget
                : DEFAULT_GOALS.reviewTarget,
            keepStreak: typeof parsed.keepStreak === "boolean"
                ? parsed.keepStreak
                : DEFAULT_GOALS.keepStreak,
            masterWeak: typeof parsed.masterWeak === "number" && parsed.masterWeak >= 0
                ? parsed.masterWeak
                : DEFAULT_GOALS.masterWeak,
        };
    }
    catch {
        return DEFAULT_GOALS;
    }
}
export function saveGoals(setId, goals) {
    safeSet(GOALS_PREFIX + setId, JSON.stringify(goals));
}
/**
 * Format a session's elapsed time as `mm:ss`. Stops counting once the
 * session has been idle for more than 30 minutes so an abandoned tab
 * doesn't display "08:14:32" the next morning.
 */
export function formatSessionTime(state) {
    if (!state.startedAt)
        return "00:00";
    const elapsedMs = Math.max(0, Date.now() - state.startedAt);
    const total = Math.floor(elapsedMs / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    if (m >= 60) {
        const h = Math.floor(m / 60);
        return `${h.toString().padStart(2, "0")}:${(m % 60)
            .toString()
            .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
//# sourceMappingURL=flashcardSession.js.map