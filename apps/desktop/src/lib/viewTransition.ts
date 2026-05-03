import { flushSync } from "react-dom";

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition: () => void;
  };
};

/**
 * Runs a React state update inside `document.startViewTransition` when the
 * browser supports it, using `flushSync` so the DOM matches the “after”
 * snapshot for the transition.
 *
 * No-ops to a plain synchronous update when View Transitions are unavailable.
 */
export function withViewTransition(runUpdate: () => void): void {
  if (typeof document === "undefined") {
    runUpdate();
    return;
  }
  const doc = document as ViewTransitionDoc;
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(() => {
      flushSync(runUpdate);
    });
  } else {
    runUpdate();
  }
}
