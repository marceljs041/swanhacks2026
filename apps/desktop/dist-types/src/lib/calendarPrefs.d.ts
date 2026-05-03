/**
 * Lightweight `localStorage`-backed persistence for the Calendar's
 * client-side preferences (which view is active, which day is in
 * focus). Kept tiny on purpose — anything that needs to survive a
 * process restart and isn't already part of the SQLite store lives
 * here. Persistence failures are non-fatal (private mode, etc).
 */
export type CalendarView = "day" | "week" | "month";
export declare const DEFAULT_CALENDAR_VIEW: CalendarView;
export declare function getStoredCalendarView(): CalendarView;
export declare function saveCalendarView(view: CalendarView): void;
/** Stored as `YYYY-MM-DD` so we round-trip cleanly across timezones. */
export declare function getStoredCalendarCursor(): string;
export declare function saveCalendarCursor(iso: string): void;
//# sourceMappingURL=calendarPrefs.d.ts.map