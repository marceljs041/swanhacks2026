/**
 * One day's column of timed events for the week / day grids.
 *
 * Handles three direct-manipulation gestures, all snapped to
 * `SNAP_MINUTES` so they line up with the composer's 5-min time inputs:
 *
 *   1. **Drag-create** — mousedown on empty space, drag down, release.
 *      Calls `onCreateRange(startIso, endIso)` (≥ 15 min).
 *   2. **Drag-move** — grab the body of an event and translate it.
 *      Cross-day moves are honoured when the parent provides
 *      `findColumnAtClientX` (week view).
 *   3. **Drag-resize** — drag the bottom 6 px of an event.
 *
 * To preserve "click to select / click to add" semantics we use a
 * **pending** state on mousedown that doesn't render anything — only
 * after the cursor moves more than `DRAG_THRESHOLD_PX` does the pending
 * gesture get promoted to a visible drag. A click that never moves
 * therefore never hides the original card or adds a ghost; the natural
 * click event reaches `EventCard.onClick` and selects the event.
 *
 * Cross-day move ghosts are rendered in the **origin** column with a
 * `translateX` offset, so they remain visible no matter which column
 * the cursor is currently over (each column owns its own state).
 */
import type { FC } from "react";
import type { CalendarEventRow, ClassRow } from "@studynest/shared";
export type ColumnVariant = "week" | "day";
export interface DayColumnRef {
    /** Local-midnight Date for the column. */
    date: Date;
    /** DOM element of the column itself; used for hit-testing across days. */
    el: HTMLElement | null;
}
export interface TimedColumnHandlers {
    /** Persist a moved/resized event. The dates already have the new times. */
    onMutateEvent: (id: string, startIso: string, endIso: string) => void;
    /** Open the composer with prefilled times after a drag-create. */
    onCreateRange: (startIso: string, endIso: string) => void;
    /** Selection — same semantics as before. */
    onSelectEvent: (id: string) => void;
    /**
     * Optional cross-day mover used by the week view. Returns the day
     * column under the given client X, or null if outside the grid.
     */
    findColumnAtClientX?: (clientX: number) => DayColumnRef | null;
}
interface Props extends TimedColumnHandlers {
    /** Local-midnight Date for the day this column represents. */
    date: Date;
    /** All events for the day (timed only — caller filters all-day out). */
    events: CalendarEventRow[];
    classesById: Map<string, ClassRow>;
    selectedEventId: string | null;
    variant: ColumnVariant;
    /** First hour rendered by the parent (e.g. 8 = 8 AM). */
    dayStartHour: number;
    /** Number of hour rows rendered. */
    rowCount: number;
    /** Highlight row when this is "today". */
    isToday: boolean;
    /** Allows the parent to register this column for cross-day hit-testing. */
    registerRef?: (date: Date, el: HTMLElement | null) => void;
}
export declare const TimedColumn: FC<Props>;
export {};
//# sourceMappingURL=TimedColumn.d.ts.map