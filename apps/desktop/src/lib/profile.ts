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

export type LearnerRole =
  | "high-school"
  | "college"
  | "grad"
  | "self-learner"
  | "other";

export interface Profile {
  name: string;
  role: LearnerRole | null;
  onboardedAt: string | null;
  /** Unlocked badge ids (see `@studynest/shared` / `badges`). */
  badges: string[];
}

const EMPTY: Profile = { name: "", role: null, onboardedAt: null, badges: [] };

export function getProfile(): Profile {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const rawBadges = parsed.badges;
    const badges = Array.isArray(rawBadges)
      ? rawBadges.filter((b): b is string => typeof b === "string")
      : [];
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      role: (parsed.role as LearnerRole) ?? null,
      onboardedAt:
        typeof parsed.onboardedAt === "string" ? parsed.onboardedAt : null,
      badges,
    };
  } catch {
    return EMPTY;
  }
}

export function saveProfile(p: Profile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* private mode, ignore */
  }
}

export function isOnboarded(): boolean {
  return !!getProfile().onboardedAt;
}

/** Best-effort first-name. Falls back to the full string if there's no space. */
export function firstName(full: string): string {
  const trimmed = full.trim();
  if (!trimmed) return "";
  const space = trimmed.indexOf(" ");
  return space === -1 ? trimmed : trimmed.slice(0, space);
}
