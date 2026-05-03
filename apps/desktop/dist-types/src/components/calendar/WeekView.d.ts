/**
 * Seven-column week grid with an all-day strip on top and a timed grid whose
 * visible hours shrink/expand from events (±2h padding), up to a full day.
 *
 * The day columns are real `TimedColumn` instances, so each cell supports:
 *   - drag-to-create new events
 *   - drag-to-move events (across columns within the same week)
 *   - drag-to-resize events
 *   - a live "now" indicator on today's column
 */
import type { FC } from "react";
import type { CalendarEventRow, ClassRow } from "@studynest/shared";
import type { TimedGridRange } from "./calendarGridRange.js";
interface Props {
    weekStart: Date;
    events: CalendarEventRow[];
    classesById: Map<string, ClassRow>;
    selectedEventId: string | null;
    onSelectEvent: (id: string) => void;
    /** Persist a moved/resized event's new start/end. */
    onMutateEvent: (id: string, startIso: string, endIso: string) => void;
    /** Open the composer with prefilled times after a drag-create. */
    onCreateRange: (startIso: string, endIso: string) => void;
    /** Shared time axis for all columns (derived from events in the visible range). */
    gridRange: TimedGridRange;
}
export declare const WeekView: FC<Props>;
export {};
//# sourceMappingURL=WeekView.d.ts.map