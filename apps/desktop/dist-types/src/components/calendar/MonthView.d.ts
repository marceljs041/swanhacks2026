/**
 * Six-week month view. Each cell shows up to 3 events with a "+N
 * more" tail; clicking a day drills into Day view focused on that
 * date. Today's cell gets the primary accent ring.
 */
import type { FC } from "react";
import type { CalendarEventRow, ClassRow } from "@studynest/shared";
interface Props {
    monthStart: Date;
    events: CalendarEventRow[];
    classesById: Map<string, ClassRow>;
    selectedEventId: string | null;
    onSelectEvent: (id: string) => void;
    onSelectDay: (d: Date) => void;
}
export declare const MonthView: FC<Props>;
export {};
//# sourceMappingURL=MonthView.d.ts.map