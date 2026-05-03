/** Default visible window when there are no timed blocks (“shows less” than full day). */
export const DEFAULT_TIMED_GRID_START_HOUR = 8;
/** Rows span startHour … endHourExclusive − 1 (e.g. 8→21 covers 8 AM … 8 PM). */
export const DEFAULT_TIMED_GRID_END_EXCLUSIVE = 21;
const PAD_MINUTES = 120;
function minutesFromMidnight(iso) {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
}
export function computeTimedGridRange(events) {
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
//# sourceMappingURL=calendarGridRange.js.map