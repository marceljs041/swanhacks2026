/**
 * Runs a React state update inside `document.startViewTransition` when the
 * browser supports it, using `flushSync` so the DOM matches the “after”
 * snapshot for the transition.
 *
 * No-ops to a plain synchronous update when View Transitions are unavailable.
 */
export declare function withViewTransition(runUpdate: () => void): void;
//# sourceMappingURL=viewTransition.d.ts.map