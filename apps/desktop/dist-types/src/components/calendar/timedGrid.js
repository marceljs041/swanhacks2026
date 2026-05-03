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
export const HOUR_HEIGHT_WEEK = 56;
/** Hour-row height for the day view (matches `.cal-day-grid .cal-hour-slot`). */
export const HOUR_HEIGHT_DAY = 64;
/** Snap granularity for drag/resize and inline time editing. */
export const SNAP_MINUTES = 5;
/** Smallest event the user is allowed to create. */
export const MIN_EVENT_MINUTES = 15;
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
export const HEAD_PAD_MINUTES = 15;
/** Height in pixels of the visual head-pad row for a given hour height. */
export function headerPadPx(hourHeight) {
    return (HEAD_PAD_MINUTES / 60) * hourHeight;
}
/** Minutes since midnight for an ISO timestamp, in local time. */
export function minutesOfDay(iso) {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
}
/** Convert minutes-since-midnight to a top offset within the visible grid.
 *  The result is shifted down by the head-pad spacer so events line up
 *  with the hour-slot rendered for their hour, not the spacer above it. */
export function minutesToTop(minutes, dayStartHour, hourHeight) {
    return (((minutes - dayStartHour * 60) / 60) * hourHeight + headerPadPx(hourHeight));
}
/** Convert a pixel y-offset (within the timed grid) back to minutes-since-midnight. */
export function topToMinutes(top, dayStartHour, hourHeight) {
    return (Math.round(((top - headerPadPx(hourHeight)) / hourHeight) * 60) +
        dayStartHour * 60);
}
/** Round a minute value to the nearest `SNAP_MINUTES`. */
export function snapMinutes(minutes, snap = SNAP_MINUTES) {
    return Math.round(minutes / snap) * snap;
}
/** Clamp a minute value to `[0, 24*60]`. */
export function clampDayMinutes(minutes) {
    return Math.max(0, Math.min(24 * 60, minutes));
}
/**
 * Build a new ISO timestamp from a "day anchor" (a Date pinned to local
 * midnight) plus minutes-since-midnight. Preserves the calling locale's
 * timezone offset, which keeps drag interactions DST-safe.
 */
export function isoFromDayMinutes(dayAnchor, minutes) {
    const d = new Date(dayAnchor);
    d.setHours(0, 0, 0, 0);
    d.setMinutes(minutes);
    return d.toISOString();
}
/** Local-midnight Date for the day containing `iso`. */
export function dayAnchor(iso) {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return d;
}
/** Format an HH:MM (24h) string into a friendly label, e.g. "9:35 AM". */
export function fmtMinutesOfDay(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = ((minutes % 60) + 60) % 60;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
//# sourceMappingURL=timedGrid.js.map