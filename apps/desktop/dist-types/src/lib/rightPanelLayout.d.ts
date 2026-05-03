/**
 * Persisted, ordered list of right-panel widgets.
 *
 * Stored as a JSON blob in `localStorage` under `notegoat:right-panel-widgets`
 * so the user's customisation survives reloads without waiting for SQLite to
 * spin up. Unknown / removed IDs from older versions are filtered on load,
 * which lets us add or rename widgets without forcing a migration.
 */
export type WidgetId = "level" | "deadlines" | "studyGoals" | "miniCalendar" | "studyTimer" | "dueFlashcards" | "todaysPlan" | "quickCapture" | "aiQuickPrompts" | "streakHeatmap" | "classFilter";
export declare const ALL_WIDGETS: WidgetId[];
export declare const WIDGET_LABELS: Record<WidgetId, string>;
export declare const WIDGET_DESCRIPTIONS: Record<WidgetId, string>;
export interface RightPanelLayout {
    activeIds: WidgetId[];
}
export declare function getRightPanelLayout(): RightPanelLayout;
export declare function saveRightPanelLayout(layout: RightPanelLayout): void;
export declare function inactiveWidgets(active: WidgetId[]): WidgetId[];
//# sourceMappingURL=rightPanelLayout.d.ts.map