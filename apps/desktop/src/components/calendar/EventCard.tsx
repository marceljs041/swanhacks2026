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
import { fmtTimeRange, iconForEvent, toneForEvent } from "./eventVisuals.js";

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

export const EventCard: FC<Props> = ({
  event,
  cls,
  variant = "timed",
  selected,
  onClick,
  style,
  onMoveStart,
  onResizeStart,
}) => {
  const tone = toneForEvent(event, cls);
  const isCompleted = event.status === "completed";
  const isAi = event.source_type === "ai_generated";
  const subtitle = subtitleFor(event, cls);
  const timeLine = fmtTimeRange(event.start_at, event.end_at, !!event.all_day);
  const ariaLabel = [event.title, timeLine, subtitle].filter(Boolean).join(". ");

  const className = [
    "cal-event",
    `tone-${tone}`,
    `cal-event--${variant}`,
    selected ? "is-selected" : "",
    isCompleted ? "is-completed" : "",
    isAi ? "is-ai" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Forward mousedown to the parent so it can register the drag intent
  // (move). The parent uses a movement threshold before promoting the
  // intent to a real drag; if the user releases without moving, this
  // element receives a normal `click` and selection works as expected.
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!onMoveStart || e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".cal-event-resize")) return;
    onMoveStart(e);
  };
  const handleClick = (): void => {
    onClick?.();
  };
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={className}
      style={style}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? handleClick : undefined}
      onMouseDown={handleMouseDown}
      onKeyDown={onClick ? handleKey : undefined}
      aria-label={ariaLabel}
    >
      <div className="cal-event-tooltip" aria-hidden="true">
        <span className="cal-event-tooltip-title">{event.title}</span>
        <span className="cal-event-tooltip-meta">{timeLine}</span>
        {subtitle ? (
          <span className="cal-event-tooltip-detail">{subtitle}</span>
        ) : null}
      </div>
      {variant !== "month" && (
        <span className="cal-event-icon" aria-hidden>
          {iconForEvent(event, 12)}
        </span>
      )}
      <span className="cal-event-body">
        <span className="cal-event-title">{event.title}</span>
        {variant === "month" ? null : (
          <span className="cal-event-meta">{timeLine}</span>
        )}
      </span>
      {variant === "timed" && onResizeStart && (
        <div
          className="cal-event-resize"
          aria-hidden
          onMouseDown={(e) => {
            onResizeStart(e);
          }}
        />
      )}
    </div>
  );
};

function subtitleFor(
  event: CalendarEventRow,
  cls?: ClassRow | null,
): string | null {
  if (cls) return cls.code ?? cls.name;
  if (event.location) return event.location;
  return null;
}
