/**
 * Shared math + DOM helpers for the timed (week / day) calendar grid.
 *
 * The grid is a vertical stack of hour rows; each row is `HOUR_HEIGHT_*`
 * pixels tall. Times are converted between "minutes since the visible
 * `dayStartHour`" and pixel offsets. All user-driven time edits snap to
 * `SNAP_MINUTES` so the calendar always has the same 5-minute grid as
 * the time inputs in the composer.
 */
/** Hour-row height for the week view (matches `.cal-hour-slot`). */
export declare const HOUR_HEIGHT_WEEK = 56;
/** Hour-row height for the day view (matches `.cal-day-grid .cal-hour-slot`). */
export declare const HOUR_HEIGHT_DAY = 64;
/** Snap granularity for drag/resize and inline time editing. */
export declare const SNAP_MINUTES = 5;
/** Smallest event the user is allowed to create. */
export declare const MIN_EVENT_MINUTES = 15;
/**
 * Visual lead-in rendered above the first hour row. This is _not_ a
 * real time slot — it gives the first hour label ("8 AM") room to
 * breathe so it doesn't get clipped by the scroll edge, while keeping
 * the grid lines continuous from the top of the column.
 *
 * Concretely we pretend the visible window starts 15 minutes earlier
 * than the computed `dayStartHour`; the time-axis and each day column
 * each render a matching 15-min spacer row at the very top so the grid
 * stays a single, unbroken structure.
 */
export declare const HEAD_PAD_MINUTES = 15;
/** Height in pixels of the visual head-pad row for a given hour height. */
export declare function headerPadPx(hourHeight: number): number;
/** Minutes since midnight for an ISO timestamp, in local time. */
export declare function minutesOfDay(iso: string): number;
/** Convert minutes-since-midnight to a top offset within the visible grid.
 *  The result is shifted down by the head-pad spacer so events line up
 *  with the hour-slot rendered for their hour, not the spacer above it. */
export declare function minutesToTop(minutes: number, dayStartHour: number, hourHeight: number): number;
/** Convert a pixel y-offset (within the timed grid) back to minutes-since-midnight. */
export declare function topToMinutes(top: number, dayStartHour: number, hourHeight: number): number;
/** Round a minute value to the nearest `SNAP_MINUTES`. */
export declare function snapMinutes(minutes: number, snap?: number): number;
/** Clamp a minute value to `[0, 24*60]`. */
export declare function clampDayMinutes(minutes: number): number;
/**
 * Build a new ISO timestamp from a "day anchor" (a Date pinned to local
 * midnight) plus minutes-since-midnight. Preserves the calling locale's
 * timezone offset, which keeps drag interactions DST-safe.
 */
export declare function isoFromDayMinutes(dayAnchor: Date, minutes: number): string;
/** Local-midnight Date for the day containing `iso`. */
export declare function dayAnchor(iso: string): Date;
/** Format an HH:MM (24h) string into a friendly label, e.g. "9:35 AM". */
export declare function fmtMinutesOfDay(minutes: number): string;
//# sourceMappingURL=timedGrid.d.ts.map