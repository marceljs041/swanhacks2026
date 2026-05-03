/**
 * Computes which hour rows to show in week/day timed grids.
 *
 * - **No timed events:** compact default window (8 AM → 6 PM).
 * - **With timed events:** span from (earliest start − 2h) through
 *   (latest end + 2h), clamped to `[0, 24)` so the grid can cover a full
 *   day when needed.
 */
import type { CalendarEventRow } from "@studynest/shared";
/** Default visible window when there are no timed blocks (“shows less” than full day). */
export declare const DEFAULT_TIMED_GRID_START_HOUR = 8;
/** Rows span startHour … endHourExclusive − 1 (e.g. 8→21 covers 8 AM … 8 PM). */
export declare const DEFAULT_TIMED_GRID_END_EXCLUSIVE = 21;
export interface TimedGridRange {
    /** First hour label row (0–23). */
    startHour: number;
    /** One past the last hour row (1–24). Rows rendered: startHour … endHourExclusive − 1. */
    endHourExclusive: number;
}
export declare function computeTimedGridRange(events: CalendarEventRow[]): TimedGridRange;
//# sourceMappingURL=calendarGridRange.d.ts.map