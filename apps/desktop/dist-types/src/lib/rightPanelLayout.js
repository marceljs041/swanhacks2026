/**
 * Persisted, ordered list of right-panel widgets.
 *
 * Stored as a JSON blob in `localStorage` under `notegoat:right-panel-widgets`
 * so the user's customisation survives reloads without waiting for SQLite to
 * spin up. Unknown / removed IDs from older versions are filtered on load,
 * which lets us add or rename widgets without forcing a migration.
 */
export const ALL_WIDGETS = [
    "level",
    "deadlines",
    "studyTimer",
    "dueFlashcards",
    "todaysPlan",
    "quickCapture",
    "aiQuickPrompts",
    "streakHeatmap",
    "classFilter",
    "studyGoals",
    "miniCalendar",
];
export const WIDGET_LABELS = {
    level: "Level & XP",
    deadlines: "Upcoming Deadlines",
    studyGoals: "Study Goals",
    miniCalendar: "Mini Calendar",
    studyTimer: "Study Timer",
    dueFlashcards: "Flashcards Due",
    todaysPlan: "Today's Plan",
    quickCapture: "Quick Capture",
    aiQuickPrompts: "AI Shortcuts",
    streakHeatmap: "Activity Heatmap",
    classFilter: "Focus Class",
};
export const WIDGET_DESCRIPTIONS = {
    level: "Your XP, current level, and progress to the next one.",
    deadlines: "Tasks due in the next two weeks at a glance.",
    studyGoals: "Weekly study streak goal and progress.",
    miniCalendar: "Compact month view with markers for scheduled work.",
    studyTimer: "Pomodoro timer with task linking and XP rewards.",
    dueFlashcards: "How many cards are due plus a quick Review button.",
    todaysPlan: "Just today's tasks with one-click completion.",
    quickCapture: "Add a task or note in one keystroke.",
    aiQuickPrompts: "Shortcuts to common study helpers using the learning assistant.",
    streakHeatmap: "Twelve-week activity heatmap of XP earned per day.",
    classFilter: "Scope deadlines and the calendar to a single class.",
};
const STORAGE_KEY = "notegoat:right-panel-widgets";
const DEFAULT_ACTIVE = ["level", "deadlines"];
function isWidgetId(v) {
    return typeof v === "string" && ALL_WIDGETS.includes(v);
}
export function getRightPanelLayout() {
    if (typeof window === "undefined")
        return { activeIds: [...DEFAULT_ACTIVE] };
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return { activeIds: [...DEFAULT_ACTIVE] };
        const parsed = JSON.parse(raw);
        const ids = Array.isArray(parsed.activeIds)
            ? parsed.activeIds.filter(isWidgetId)
            : [];
        // De-dup while preserving order.
        const seen = new Set();
        const activeIds = ids.filter((id) => (seen.has(id) ? false : seen.add(id)));
        return { activeIds };
    }
    catch {
        return { activeIds: [...DEFAULT_ACTIVE] };
    }
}
export function saveRightPanelLayout(layout) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    }
    catch {
        /* private mode, ignore */
    }
}
export function inactiveWidgets(active) {
    const set = new Set(active);
    return ALL_WIDGETS.filter((id) => !set.has(id));
}
//# sourceMappingURL=rightPanelLayout.js.map