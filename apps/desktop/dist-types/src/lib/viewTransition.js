import { flushSync } from "react-dom";
/**
 * Runs a React state update inside `document.startViewTransition` when the
 * browser supports it, using `flushSync` so the DOM matches the “after”
 * snapshot for the transition.
 *
 * No-ops to a plain synchronous update when View Transitions are unavailable.
 */
export function withViewTransition(runUpdate) {
    if (typeof document === "undefined") {
        runUpdate();
        return;
    }
    const doc = document;
    if (typeof doc.startViewTransition === "function") {
        doc.startViewTransition(() => {
            flushSync(runUpdate);
        });
    }
    else {
        runUpdate();
    }
}
//# sourceMappingURL=viewTransition.js.map