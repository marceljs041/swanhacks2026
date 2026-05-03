/**
 * Single-column day view. Hour span follows the same dynamic range as week
 * view, and the column shares all of week view's drag-create / drag-move /
 * drag-resize gestures via `TimedColumn`.
 */
import type { FC } from "react";
import type { CalendarEventRow, ClassRow } from "@studynest/shared";
import type { TimedGridRange } from "./calendarGridRange.js";
interface Props {
    date: Date;
    events: CalendarEventRow[];
    classesById: Map<string, ClassRow>;
    selectedEventId: string | null;
    onSelectEvent: (id: string) => void;
    onMutateEvent: (id: string, startIso: string, endIso: string) => void;
    onCreateRange: (startIso: string, endIso: string) => void;
    gridRange: TimedGridRange;
}
export declare const DayView: FC<Props>;
export {};
//# sourceMappingURL=DayView.d.ts.map