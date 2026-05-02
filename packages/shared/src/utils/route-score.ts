import type { AccessibilityPreferences } from "../types/user-preferences";
import type { IndoorPath, IndoorPoint } from "../types/indoor";

/**
 * Score a candidate indoor path against the user's accessibility preferences.
 * Lower scores are better.
 */
export function scoreIndoorPath(
  path: IndoorPath,
  waypoints: IndoorPoint[],
  prefs: AccessibilityPreferences,
): number {
  let score = 0;

  // Hard penalty for inaccessible paths when the user needs accessibility.
  if (!path.accessible && (prefs.avoidStairs || prefs.preferAccessibleEntrances)) {
    score += 1000;
  }

  for (const wp of waypoints) {
    if (wp.type === "stairs" && prefs.avoidStairs) score += 100;
    if (wp.type === "elevator" && prefs.preferElevators) score -= 25;
    if (wp.type === "entrance" && prefs.preferAccessibleEntrances && !wp.accessible) score += 80;
  }

  // Prefer shorter paths as a tiebreaker.
  score += path.points.length * 0.5;

  return score;
}
