/**
 * User-configurable study-timer durations (minutes per mode), persisted to
 * localStorage so they survive reloads. Kept separate from the active
 * timer session in the store: this is *defaults*, the session captures a
 * concrete duration at start-time so live changes don't mid-flight resize.
 */

import type { TimerMode } from "../store.js";

export type TimerDurations = Record<TimerMode, number>;

export const DEFAULT_TIMER_DURATIONS: TimerDurations = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

const STORAGE_KEY = "notegoat:timer-durations";
const MIN_MINUTES = 1;
const MAX_MINUTES = 180;

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(n)));
}

export function getTimerDurations(): TimerDurations {
  if (typeof window === "undefined") return { ...DEFAULT_TIMER_DURATIONS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TIMER_DURATIONS };
    const parsed = JSON.parse(raw) as Partial<TimerDurations>;
    return {
      focus: clamp(parsed.focus ?? DEFAULT_TIMER_DURATIONS.focus),
      shortBreak: clamp(parsed.shortBreak ?? DEFAULT_TIMER_DURATIONS.shortBreak),
      longBreak: clamp(parsed.longBreak ?? DEFAULT_TIMER_DURATIONS.longBreak),
    };
  } catch {
    return { ...DEFAULT_TIMER_DURATIONS };
  }
}

export function saveTimerDurations(d: TimerDurations): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        focus: clamp(d.focus),
        shortBreak: clamp(d.shortBreak),
        longBreak: clamp(d.longBreak),
      }),
    );
  } catch {
    /* private mode, ignore */
  }
}

export const TIMER_BOUNDS = { min: MIN_MINUTES, max: MAX_MINUTES };
