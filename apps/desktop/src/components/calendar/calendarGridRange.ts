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
export const DEFAULT_TIMED_GRID_START_HOUR = 8;
/** Rows span startHour … endHourExclusive − 1 (e.g. 8→21 covers 8 AM … 8 PM). */
export const DEFAULT_TIMED_GRID_END_EXCLUSIVE = 21;

const PAD_MINUTES = 120;

export interface TimedGridRange {
  /** First hour label row (0–23). */
  startHour: number;
  /** One past the last hour row (1–24). Rows rendered: startHour … endHourExclusive − 1. */
  endHourExclusive: number;
}

function minutesFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function computeTimedGridRange(events: CalendarEventRow[]): TimedGridRange {
  const timed = events.filter((e) => !e.all_day);
  if (timed.length === 0) {
    return {
      startHour: DEFAULT_TIMED_GRID_START_HOUR,
      endHourExclusive: DEFAULT_TIMED_GRID_END_EXCLUSIVE,
    };
  }

  let minStartMin = Infinity;
  let maxEndMin = -Infinity;

  for (const ev of timed) {
    const s = minutesFromMidnight(ev.start_at);
    let e = minutesFromMidnight(ev.end_at);
    if (e <= s) {
      // Cross-midnight or zero-duration — treat end as same calendar day cap.
      e = Math.min(s + 60, 24 * 60);
    }
    minStartMin = Math.min(minStartMin, s);
    maxEndMin = Math.max(maxEndMin, e);
  }

  let startHour = Math.floor((minStartMin - PAD_MINUTES) / 60);
  startHour = Math.max(0, Math.min(23, startHour));

  let endExclusive = Math.ceil((maxEndMin + PAD_MINUTES) / 60);
  endExclusive = Math.min(24, Math.max(endExclusive, startHour + 1));

  return { startHour, endHourExclusive: endExclusive };
}
