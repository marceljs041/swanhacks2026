/**
 * Renders a single calendar event chip. Two variants:
 *
 *  - `timed` (default) — absolute-positioned inside a day column;
 *    `top` and `height` are computed by the parent. Shows title +
 *    time range; large enough cards also show class/topic.
 *  - `allDay` — full-width chip used in the all-day strip above the
 *    timed grid; renders one line.
 *
 * The card itself is purely presentational. `EventTone` resolves to
 * a `--accent-*` block in styles.css; `is-completed` and `is-ai`
 * modifiers tweak background / icon respectively.
 */
import type { FC } from "react";
import type { CalendarEventRow, ClassRow } from "@studynest/shared";
interface Props {
    event: CalendarEventRow;
    cls?: ClassRow | null;
    variant?: "timed" | "allDay" | "month";
    selected?: boolean;
    onClick?: () => void;
    /** When set, the parent positions the card absolutely (week/day grids). */
    style?: React.CSSProperties;
    /**
     * Optional drag-to-move handler. The parent attaches it on
     * `mousedown` for `timed` cards in the week / day columns. The card
     * still calls `onClick` on a mouse-up that didn't move.
     */
    onMoveStart?: (e: React.MouseEvent<HTMLDivElement>) => void;
    /** Drag handle for the bottom edge — used to resize timed events. */
    onResizeStart?: (e: React.MouseEvent<HTMLDivElement>) => void;
}
export declare const EventCard: FC<Props>;
export {};
//# sourceMappingURL=EventCard.d.ts.map