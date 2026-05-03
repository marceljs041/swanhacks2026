/**
 * Lightweight `localStorage`-backed persistence for the Calendar's
 * client-side preferences (which view is active, which day is in
 * focus). Kept tiny on purpose — anything that needs to survive a
 * process restart and isn't already part of the SQLite store lives
 * here. Persistence failures are non-fatal (private mode, etc).
 */
const VIEW_KEY = "notegoat:calendar:view";
const CURSOR_KEY = "notegoat:calendar:cursor";
export const DEFAULT_CALENDAR_VIEW = "week";
export function getStoredCalendarView() {
    if (typeof window === "undefined")
        return DEFAULT_CALENDAR_VIEW;
    const v = window.localStorage.getItem(VIEW_KEY);
    if (v === "day" || v === "week" || v === "month")
        return v;
    return DEFAULT_CALENDAR_VIEW;
}
export function saveCalendarView(view) {
    try {
        window.localStorage.setItem(VIEW_KEY, view);
    }
    catch {
        /* private mode, ignore */
    }
}
/** Stored as `YYYY-MM-DD` so we round-trip cleanly across timezones. */
export function getStoredCalendarCursor() {
    if (typeof window === "undefined")
        return todayLocalIso();
    const v = window.localStorage.getItem(CURSOR_KEY);
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v))
        return v;
    return todayLocalIso();
}
export function saveCalendarCursor(iso) {
    try {
        window.localStorage.setItem(CURSOR_KEY, iso);
    }
    catch {
        /* ignore */
    }
}
function todayLocalIso() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}
//# sourceMappingURL=calendarPrefs.js.map