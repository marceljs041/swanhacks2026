/**
 * User-configurable study-timer durations (minutes per mode), persisted to
 * localStorage so they survive reloads. Kept separate from the active
 * timer session in the store: this is *defaults*, the session captures a
 * concrete duration at start-time so live changes don't mid-flight resize.
 */
import type { TimerMode } from "../store.js";
export type TimerDurations = Record<TimerMode, number>;
export declare const DEFAULT_TIMER_DURATIONS: TimerDurations;
export declare function getTimerDurations(): TimerDurations;
export declare function saveTimerDurations(d: TimerDurations): void;
export declare const TIMER_BOUNDS: {
    min: number;
    max: number;
};
//# sourceMappingURL=timerPrefs.d.ts.map