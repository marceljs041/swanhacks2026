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
export declare const DEFAULT_GOALS: FlashcardSessionGoals;
export declare function loadSession(setId: string): FlashcardSessionState;
export declare function saveSession(setId: string, state: FlashcardSessionState): void;
export declare function resetSession(setId: string): FlashcardSessionState;
export declare function clearSession(setId: string): void;
export declare function loadGoals(setId: string): FlashcardSessionGoals;
export declare function saveGoals(setId: string, goals: FlashcardSessionGoals): void;
/**
 * Format a session's elapsed time as `mm:ss`. Stops counting once the
 * session has been idle for more than 30 minutes so an abandoned tab
 * doesn't display "08:14:32" the next morning.
 */
export declare function formatSessionTime(state: FlashcardSessionState): string;
//# sourceMappingURL=flashcardSession.d.ts.map