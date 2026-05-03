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

export interface FlashcardSessionState {
  /** ms epoch when the session was created. */
  startedAt: number;
  /** Total XP awarded so far in this session. */
  xp: number;
  /** Number of cards graded `easy` or `good`. */
  correct: number;
  /** Total cards graded (any rating). */
  reviewed: number;
  /** Current consecutive non-`again` streak within the session. */
  streak: number;
  /** Set of card IDs the user upgraded from weak to mastered this session. */
  weakResolved: string[];
}

export interface FlashcardSessionGoals {
  /** Cards to review this sitting. Drives the first goal-row. */
  reviewTarget: number;
  /** Whether to surface the "Keep streak alive" goal. */
  keepStreak: boolean;
  /** How many weak cards to upgrade. */
  masterWeak: number;
}

export const DEFAULT_GOALS: FlashcardSessionGoals = {
  reviewTarget: 20,
  keepStreak: true,
  masterWeak: 5,
};

function freshSession(): FlashcardSessionState {
  return {
    startedAt: Date.now(),
    xp: 0,
    correct: 0,
    reviewed: 0,
    streak: 0,
    weakResolved: [],
  };
}

function safeGet(key: string): string | null {
  try {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — drop. */
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    /* same as above. */
  }
}

export function loadSession(setId: string): FlashcardSessionState {
  const raw = safeGet(SESSION_PREFIX + setId);
  if (!raw) return freshSession();
  try {
    const parsed = JSON.parse(raw) as Partial<FlashcardSessionState>;
    return {
      ...freshSession(),
      ...parsed,
      weakResolved: Array.isArray(parsed.weakResolved)
        ? parsed.weakResolved
        : [],
    };
  } catch {
    return freshSession();
  }
}

export function saveSession(
  setId: string,
  state: FlashcardSessionState,
): void {
  safeSet(SESSION_PREFIX + setId, JSON.stringify(state));
}

export function resetSession(setId: string): FlashcardSessionState {
  const fresh = freshSession();
  saveSession(setId, fresh);
  return fresh;
}

export function clearSession(setId: string): void {
  safeRemove(SESSION_PREFIX + setId);
}

export function loadGoals(setId: string): FlashcardSessionGoals {
  const raw = safeGet(GOALS_PREFIX + setId);
  if (!raw) return DEFAULT_GOALS;
  try {
    const parsed = JSON.parse(raw) as Partial<FlashcardSessionGoals>;
    return {
      reviewTarget:
        typeof parsed.reviewTarget === "number" && parsed.reviewTarget > 0
          ? parsed.reviewTarget
          : DEFAULT_GOALS.reviewTarget,
      keepStreak:
        typeof parsed.keepStreak === "boolean"
          ? parsed.keepStreak
          : DEFAULT_GOALS.keepStreak,
      masterWeak:
        typeof parsed.masterWeak === "number" && parsed.masterWeak >= 0
          ? parsed.masterWeak
          : DEFAULT_GOALS.masterWeak,
    };
  } catch {
    return DEFAULT_GOALS;
  }
}

export function saveGoals(setId: string, goals: FlashcardSessionGoals): void {
  safeSet(GOALS_PREFIX + setId, JSON.stringify(goals));
}

/**
 * Format a session's elapsed time as `mm:ss`. Stops counting once the
 * session has been idle for more than 30 minutes so an abandoned tab
 * doesn't display "08:14:32" the next morning.
 */
export function formatSessionTime(state: FlashcardSessionState): string {
  if (!state.startedAt) return "00:00";
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
