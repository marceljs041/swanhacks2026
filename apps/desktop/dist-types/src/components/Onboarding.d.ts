/**
 * First-launch onboarding.
 *
 * Renders full-screen on top of nothing (App gates on `profile.onboardedAt`)
 * and walks the user through a small branching flow:
 *
 *     intro ─┬─ "I'm new" ──── name → role → classes → done
 *            └─ "I have data on another device" ── pair → done
 *
 * Returning users enter a pairing code generated on their existing device.
 * Confirming the code calls `setUserId()` so the already-running sync
 * worker (started in `App` regardless of onboarding state) starts pulling
 * remote rows on its next tick — typically within a couple of seconds.
 *
 * Step transitions are pure CSS — each step is keyed by name and the
 * rendered container picks an `enter-forward` / `enter-backward`
 * keyframe based on navigation direction. No motion library needed.
 */
import type { FC } from "react";
export declare const Onboarding: FC;
//# sourceMappingURL=Onboarding.d.ts.map