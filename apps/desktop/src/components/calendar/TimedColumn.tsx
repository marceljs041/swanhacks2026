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
import type { CSSProperties, FC } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarEventRow, ClassRow } from "@studynest/shared";
import { EventCard } from "./EventCard.js";
import { fmtTimeRange } from "./eventVisuals.js";
import {
  HOUR_HEIGHT_DAY,
  HOUR_HEIGHT_WEEK,
  MIN_EVENT_MINUTES,
  clampDayMinutes,
  dayAnchor,
  fmtMinutesOfDay,
  isoFromDayMinutes,
  minutesOfDay,
  minutesToTop,
  snapMinutes,
  topToMinutes,
} from "./timedGrid.js";
import { useNowMinutes } from "./useNowMinutes.js";

export type ColumnVariant = "week" | "day";

/** Pixels of cursor movement before a mousedown turns into a real drag. */
const DRAG_THRESHOLD_PX = 3;

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

/* ---------------- Drag state ---------------- */

interface CreateDrag {
  kind: "create";
  startMin: number;
  currentMin: number;
}

interface MoveDrag {
  kind: "move";
  eventId: string;
  /** Original event start/end in minutes for the *original day*. */
  origStartMin: number;
  origEndMin: number;
  origDayMs: number;
  /** Mouse anchor offset (minutes from event start). */
  anchorOffsetMin: number;
  /** Tracked position so we can render a ghost & commit on mouseup. */
  currentStartMin: number;
  currentEndMin: number;
  currentDayMs: number;
  /** Pixel translateX from the origin column's left edge to the target column's. */
  offsetX: number;
}

interface ResizeDrag {
  kind: "resize";
  eventId: string;
  origStartMin: number;
  currentEndMin: number;
  origDayMs: number;
}

type Drag = CreateDrag | MoveDrag | ResizeDrag | null;

/* ---------------- Pending (pre-drag) state ---------------- */

interface PendingMove {
  kind: "move";
  ev: CalendarEventRow;
  startMin: number;
  endMin: number;
  origDayMs: number;
  anchorOffsetMin: number;
  mouseStart: { x: number; y: number };
}
interface PendingResize {
  kind: "resize";
  ev: CalendarEventRow;
  startMin: number;
  endMin: number;
  origDayMs: number;
  mouseStart: { x: number; y: number };
}
interface PendingCreate {
  kind: "create";
  startMin: number;
  mouseStart: { x: number; y: number };
}

type Pending = PendingMove | PendingResize | PendingCreate | null;

/* ---------------- Component ---------------- */

export const TimedColumn: FC<Props> = ({
  date,
  events,
  classesById,
  selectedEventId,
  variant,
  dayStartHour,
  rowCount,
  isToday,
  onMutateEvent,
  onCreateRange,
  onSelectEvent,
  findColumnAtClientX,
  registerRef,
}) => {
  const hourHeight = variant === "week" ? HOUR_HEIGHT_WEEK : HOUR_HEIGHT_DAY;
  const colRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const dragRef = useRef<Drag>(null);
  dragRef.current = drag;
  // Pending lives in a ref because we deliberately want zero re-renders
  // during the click-vs-drag detection window — the column should look
  // unchanged while the user holds the button still.
  const pendingRef = useRef<Pending>(null);

  /** Snapped minute under the cursor while hovering empty space — drives
   *  the "click here to add" skeleton block. Null when over an event,
   *  outside the column, or while a drag is in progress. */
  const [hoverMin, setHoverMin] = useState<number | null>(null);

  useEffect(() => {
    registerRef?.(date, colRef.current);
    return () => registerRef?.(date, null);
  }, [date, registerRef]);

  const myAnchor = useMemo(() => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [date]);

  /* ---------------- Stable refs for window listeners ---------------- */

  // Listeners are attached imperatively on each gesture (so they fire
  // even before any React state has changed). They capture the latest
  // logic via these refs.
  const findColumnRef = useRef(findColumnAtClientX);
  findColumnRef.current = findColumnAtClientX;
  const onMutateRef = useRef(onMutateEvent);
  onMutateRef.current = onMutateEvent;
  const onCreateRef = useRef(onCreateRange);
  onCreateRef.current = onCreateRange;
  const myAnchorRef = useRef(myAnchor);
  myAnchorRef.current = myAnchor;

  /* ---------------- Window listener attachment ---------------- */

  const detachRef = useRef<(() => void) | null>(null);
  const attachWindowListeners = useCallback((): void => {
    if (detachRef.current) return;

    function tryPromotePending(ev: MouseEvent): boolean {
      const pending = pendingRef.current;
      if (!pending || dragRef.current) return false;
      const dx = ev.clientX - pending.mouseStart.x;
      const dy = ev.clientY - pending.mouseStart.y;
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return false;

      // Promote to visible drag. We don't process the current movement
      // here — the next mousemove will pick up the active drag.
      if (pending.kind === "move") {
        setHoverMin(null);
        setDrag({
          kind: "move",
          eventId: pending.ev.id,
          origStartMin: pending.startMin,
          origEndMin: pending.endMin,
          origDayMs: pending.origDayMs,
          anchorOffsetMin: pending.anchorOffsetMin,
          currentStartMin: pending.startMin,
          currentEndMin: pending.endMin,
          currentDayMs: pending.origDayMs,
          offsetX: 0,
        });
      } else if (pending.kind === "resize") {
        setHoverMin(null);
        setDrag({
          kind: "resize",
          eventId: pending.ev.id,
          origStartMin: pending.startMin,
          currentEndMin: pending.endMin,
          origDayMs: pending.origDayMs,
        });
      } else {
        setDrag({
          kind: "create",
          startMin: pending.startMin,
          currentMin: pending.startMin,
        });
        setHoverMin(null);
      }
      pendingRef.current = null;
      return true;
    }

    function onMove(ev: MouseEvent): void {
      // First check if a pending intent should become a real drag now.
      if (tryPromotePending(ev)) return;

      const cur = dragRef.current;
      if (!cur) return;

      // For move drags we can hop columns. For create/resize we stay
      // anchored to the origin column — that matches every native calendar.
      let column: DayColumnRef | null = null;
      if (cur.kind === "move" && findColumnRef.current) {
        column = findColumnRef.current(ev.clientX);
      }
      const measureEl =
        (column?.el as HTMLElement | null) ?? colRef.current ?? null;
      const rect = measureEl?.getBoundingClientRect();
      if (!rect) return;
      const y = ev.clientY - rect.top;
      const mouseMin = topToMinutes(y, dayStartHour, hourHeight);

      if (cur.kind === "create") {
        const next = clampDayMinutes(snapMinutes(mouseMin));
        setDrag({ ...cur, currentMin: next });
        return;
      }
      if (cur.kind === "resize") {
        const minEnd = cur.origStartMin + MIN_EVENT_MINUTES;
        const next = clampDayMinutes(
          snapMinutes(Math.max(minEnd, mouseMin)),
        );
        setDrag({ ...cur, currentEndMin: next });
        return;
      }
      if (cur.kind === "move") {
        const duration = cur.origEndMin - cur.origStartMin;
        const newStart = clampDayMinutes(
          snapMinutes(mouseMin - cur.anchorOffsetMin),
        );
        const newEnd = clampDayMinutes(newStart + duration);
        const newDayMs = column ? column.date.getTime() : cur.origDayMs;
        // Ghost lives in the origin column's DOM, so we need a pixel
        // offset that translates it horizontally onto the target column.
        let offsetX = 0;
        if (column?.el && colRef.current) {
          const targetRect = column.el.getBoundingClientRect();
          const originRect = colRef.current.getBoundingClientRect();
          offsetX = targetRect.left - originRect.left;
        }
        setDrag({
          ...cur,
          currentStartMin: newStart,
          currentEndMin: newEnd,
          currentDayMs: newDayMs,
          offsetX,
        });
      }
    }

    function onUp(): void {
      const pending = pendingRef.current;
      const cur = dragRef.current;
      pendingRef.current = null;
      setDrag(null);
      detach();

      // Active drag committed normally.
      if (cur) {
        if (cur.kind === "create") {
          const a = Math.min(cur.startMin, cur.currentMin);
          const b = Math.max(cur.startMin, cur.currentMin);
          if (b - a < MIN_EVENT_MINUTES) {
            const start = a;
            const end = clampDayMinutes(start + 60);
            onCreateRef.current(
              isoFromDayMinutes(myAnchorRef.current, start),
              isoFromDayMinutes(myAnchorRef.current, end),
            );
            return;
          }
          onCreateRef.current(
            isoFromDayMinutes(myAnchorRef.current, a),
            isoFromDayMinutes(myAnchorRef.current, b),
          );
          return;
        }
        if (cur.kind === "resize") {
          const newDay = new Date(cur.origDayMs);
          onMutateRef.current(
            cur.eventId,
            isoFromDayMinutes(newDay, cur.origStartMin),
            isoFromDayMinutes(newDay, cur.currentEndMin),
          );
          return;
        }
        if (cur.kind === "move") {
          const dayDate = new Date(cur.currentDayMs);
          if (
            cur.currentDayMs === cur.origDayMs &&
            cur.currentStartMin === cur.origStartMin
          ) {
            return;
          }
          onMutateRef.current(
            cur.eventId,
            isoFromDayMinutes(dayDate, cur.currentStartMin),
            isoFromDayMinutes(dayDate, cur.currentEndMin),
          );
        }
        return;
      }

      // No active drag — handle "tap" actions for pending intents that
      // never crossed the movement threshold.
      if (pending?.kind === "create") {
        const start = pending.startMin;
        const end = clampDayMinutes(start + 60);
        onCreateRef.current(
          isoFromDayMinutes(myAnchorRef.current, start),
          isoFromDayMinutes(myAnchorRef.current, end),
        );
      }
      // For move/resize taps we deliberately do nothing here — the
      // browser will fire a click on the EventCard, which calls
      // `onSelectEvent` and selects the event.
    }

    function detach(): void {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      detachRef.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    detachRef.current = detach;
  }, [dayStartHour, hourHeight]);

  // Tear down listeners if the column unmounts mid-drag.
  useEffect(() => {
    return () => {
      detachRef.current?.();
    };
  }, []);

  /* ---------------- Empty-area mousedown → pending create ---------------- */

  const onColumnMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      // Never react to clicks inside an event card — those are handled
      // by the card's own mousedown handler (move / resize / select).
      if ((e.target as HTMLElement).closest(".cal-event")) return;
      const rect = colRef.current?.getBoundingClientRect();
      if (!rect) return;
      const y = e.clientY - rect.top;
      const startMin = clampDayMinutes(
        snapMinutes(topToMinutes(y, dayStartHour, hourHeight)),
      );
      pendingRef.current = {
        kind: "create",
        startMin,
        mouseStart: { x: e.clientX, y: e.clientY },
      };
      setHoverMin(null);
      attachWindowListeners();
      e.preventDefault();
    },
    [dayStartHour, hourHeight, attachWindowListeners],
  );

  /* ---------------- Hover skeleton tracking ---------------- */

  const onColumnMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragRef.current || pendingRef.current) return;
      if ((e.target as HTMLElement).closest(".cal-event")) {
        setHoverMin(null);
        return;
      }
      const rect = colRef.current?.getBoundingClientRect();
      if (!rect) return;
      const y = e.clientY - rect.top;
      const min = clampDayMinutes(
        snapMinutes(topToMinutes(y, dayStartHour, hourHeight)),
      );
      setHoverMin((prev) => (prev === min ? prev : min));
    },
    [dayStartHour, hourHeight],
  );

  const onColumnMouseLeave = useCallback(() => {
    setHoverMin(null);
  }, []);

  /* ---------------- Move / resize starters (called by EventCard) ---------------- */

  const startMove = useCallback(
    (ev: CalendarEventRow, e: React.MouseEvent<HTMLDivElement>) => {
      const rect = colRef.current?.getBoundingClientRect();
      if (!rect) return;
      const y = e.clientY - rect.top;
      const mouseMin = topToMinutes(y, dayStartHour, hourHeight);
      const startMin = minutesOfDay(ev.start_at);
      const endMin = minutesOfDay(ev.end_at);
      const origDay = dayAnchor(ev.start_at).getTime();
      pendingRef.current = {
        kind: "move",
        ev,
        startMin,
        endMin,
        origDayMs: origDay,
        anchorOffsetMin: mouseMin - startMin,
        mouseStart: { x: e.clientX, y: e.clientY },
      };
      setHoverMin(null);
      attachWindowListeners();
      // Don't preventDefault — we still want the click to bubble to
      // EventCard if the user releases without moving.
    },
    [dayStartHour, hourHeight, attachWindowListeners],
  );

  const startResize = useCallback(
    (ev: CalendarEventRow, e: React.MouseEvent<HTMLDivElement>) => {
      pendingRef.current = {
        kind: "resize",
        ev,
        startMin: minutesOfDay(ev.start_at),
        endMin: minutesOfDay(ev.end_at),
        origDayMs: dayAnchor(ev.start_at).getTime(),
        mouseStart: { x: e.clientX, y: e.clientY },
      };
      setHoverMin(null);
      attachWindowListeners();
      e.preventDefault();
      e.stopPropagation();
    },
    [attachWindowListeners],
  );

  /* ---------------- Layout ---------------- */

  const dayKey = date.toDateString();
  const ownEvents = useMemo(
    () =>
      events.filter((e) => {
        const start = new Date(e.start_at);
        return start.toDateString() === dayKey;
      }),
    [events, dayKey],
  );

  // Origin column flag — the move ghost always renders here even when
  // the cursor has crossed onto a different day, so the user always
  // sees the block they're dragging.
  const moveGhost =
    drag?.kind === "move" &&
    ownEvents.some((e) => e.id === drag.eventId)
      ? drag
      : null;
  const resizeGhost =
    drag?.kind === "resize" &&
    ownEvents.some((e) => e.id === drag.eventId)
      ? drag
      : null;

  const positioned = useMemo(
    () =>
      placeTimedEvents(
        ownEvents,
        dayStartHour,
        hourHeight,
        drag,
      ),
    [ownEvents, dayStartHour, hourHeight, drag],
  );

  const nowMin = useNowMinutes();
  const showNowLine =
    isToday &&
    nowMin >= dayStartHour * 60 &&
    nowMin <= (dayStartHour + rowCount) * 60;
  const nowTop = minutesToTop(nowMin, dayStartHour, hourHeight);

  return (
    <div
      ref={colRef}
      className={[
        "cal-day-column",
        isToday ? "is-today" : "",
        drag ? "is-dragging" : "",
        drag?.kind === "move" ? "is-dragging-move" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="gridcell"
      onMouseDown={onColumnMouseDown}
      onMouseMove={onColumnMouseMove}
      onMouseLeave={onColumnMouseLeave}
    >
      {/* Head-pad spacer mirrors the time-axis so the grid stays
          visually continuous all the way to the top edge. */}
      <div className="cal-hour-slot cal-hour-slot--head-pad" />
      {Array.from({ length: rowCount }, (_, h) => (
        <div className="cal-hour-slot" key={h} />
      ))}

      {positioned.cards.map((entry) => (
        <EventCard
          key={entry.event.id}
          event={entry.event}
          cls={
            entry.event.class_id
              ? classesById.get(entry.event.class_id) ?? null
              : null
          }
          variant="timed"
          selected={entry.event.id === selectedEventId}
          onClick={() => onSelectEvent(entry.event.id)}
          onMoveStart={(e) => startMove(entry.event, e)}
          onResizeStart={(e) => startResize(entry.event, e)}
          style={entry.style}
        />
      ))}

      {drag === null && hoverMin !== null && (
        <HoverSkeleton
          startMin={hoverMin}
          dayStartHour={dayStartHour}
          hourHeight={hourHeight}
        />
      )}
      {drag?.kind === "create" && (
        (() => {
          const lo = Math.min(drag.startMin, drag.currentMin);
          const hi = Math.max(drag.startMin, drag.currentMin);
          const ghostHi = Math.max(hi, lo + MIN_EVENT_MINUTES);
          return (
            <DragGhost
              startMin={lo}
              endMin={ghostHi}
              dayStartHour={dayStartHour}
              hourHeight={hourHeight}
              label="New event"
            />
          );
        })()
      )}
      {moveGhost && (
        <DragGhost
          startMin={moveGhost.currentStartMin}
          endMin={moveGhost.currentEndMin}
          dayStartHour={dayStartHour}
          hourHeight={hourHeight}
          transform={`translateX(${moveGhost.offsetX}px)`}
          label={fmtTimeRange(
            isoFromDayMinutes(new Date(moveGhost.currentDayMs), moveGhost.currentStartMin),
            isoFromDayMinutes(new Date(moveGhost.currentDayMs), moveGhost.currentEndMin),
          )}
        />
      )}
      {resizeGhost && (
        <DragGhost
          startMin={resizeGhost.origStartMin}
          endMin={resizeGhost.currentEndMin}
          dayStartHour={dayStartHour}
          hourHeight={hourHeight}
          label={fmtTimeRange(
            isoFromDayMinutes(new Date(resizeGhost.origDayMs), resizeGhost.origStartMin),
            isoFromDayMinutes(new Date(resizeGhost.origDayMs), resizeGhost.currentEndMin),
          )}
        />
      )}

      {showNowLine && (
        <div className="cal-now-line" style={{ top: nowTop }} aria-hidden>
          <span className="cal-now-line-dot" />
          <span className="cal-now-line-bar" />
        </div>
      )}
    </div>
  );
};

/* ---------------- Hover skeleton ---------------- */

const HOVER_BLOCK_MINUTES = 60;

const HoverSkeleton: FC<{
  startMin: number;
  dayStartHour: number;
  hourHeight: number;
}> = ({ startMin, dayStartHour, hourHeight }) => {
  const top = minutesToTop(startMin, dayStartHour, hourHeight);
  const endMin = startMin + HOVER_BLOCK_MINUTES;
  const height = Math.max(
    (MIN_EVENT_MINUTES / 60) * hourHeight,
    (HOVER_BLOCK_MINUTES / 60) * hourHeight,
  );
  return (
    <div
      className="cal-hover-ghost"
      style={{ top, height }}
      aria-hidden
    >
      <span className="cal-hover-ghost-label">
        + {fmtMinutesOfDay(startMin)} – {fmtMinutesOfDay(endMin)}
      </span>
    </div>
  );
};

/* ---------------- Drag preview ---------------- */

const DragGhost: FC<{
  startMin: number;
  endMin: number;
  dayStartHour: number;
  hourHeight: number;
  label: string;
  /** Optional CSS transform applied to slide the ghost across columns. */
  transform?: string;
}> = ({ startMin, endMin, dayStartHour, hourHeight, label, transform }) => {
  const top = minutesToTop(startMin, dayStartHour, hourHeight);
  const height = Math.max(
    (MIN_EVENT_MINUTES / 60) * hourHeight,
    minutesToTop(endMin, dayStartHour, hourHeight) - top,
  );
  return (
    <div
      className="cal-drag-ghost"
      style={{ top, height, transform }}
      aria-hidden
    >
      <span className="cal-drag-ghost-time">
        {fmtMinutesOfDay(startMin)} – {fmtMinutesOfDay(endMin)}
      </span>
      <span className="cal-drag-ghost-label">{label}</span>
    </div>
  );
};

/* ---------------- Cluster placement ---------------- */

interface PositionedEvent {
  event: CalendarEventRow;
  style: CSSProperties;
}

interface PlaceResult {
  cards: PositionedEvent[];
}

function placeTimedEvents(
  items: CalendarEventRow[],
  dayStartHour: number,
  hourHeight: number,
  drag: Drag,
): PlaceResult {
  const sorted = [...items].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  );
  const clusters: CalendarEventRow[][] = [];
  for (const ev of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last || lastEnd(last) <= new Date(ev.start_at).getTime()) {
      clusters.push([ev]);
    } else {
      last.push(ev);
    }
  }

  const cards: PositionedEvent[] = [];
  for (const cluster of clusters) {
    const width = 100 / cluster.length;
    cluster.forEach((ev, idx) => {
      // Hide the original card while a *real* move drag is active —
      // the ghost replaces it. Pending move (no drag yet) leaves the
      // card visible so a click is still possible.
      const beingMoved = drag?.kind === "move" && drag.eventId === ev.id;
      const beingResized = drag?.kind === "resize" && drag.eventId === ev.id;
      const top = minutesToTop(
        minutesOfDay(ev.start_at),
        dayStartHour,
        hourHeight,
      );
      let height = Math.max(
        (MIN_EVENT_MINUTES / 60) * hourHeight,
        minutesToTop(minutesOfDay(ev.end_at), dayStartHour, hourHeight) - top,
      );
      if (beingResized && drag?.kind === "resize") {
        height = Math.max(
          (MIN_EVENT_MINUTES / 60) * hourHeight,
          minutesToTop(drag.currentEndMin, dayStartHour, hourHeight) - top,
        );
      }
      cards.push({
        event: ev,
        style: {
          position: "absolute",
          left: `calc(${width * idx}% + 4px)`,
          width: `calc(${width}% - 8px)`,
          top,
          height,
          opacity: beingMoved ? 0 : 1,
          pointerEvents: beingMoved ? "none" : undefined,
          zIndex: beingResized ? 5 : undefined,
        },
      });
    });
  }
  return { cards };
}

function lastEnd(cluster: CalendarEventRow[]): number {
  let end = 0;
  for (const ev of cluster) end = Math.max(end, new Date(ev.end_at).getTime());
  return end;
}
