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
import { useCallback, useMemo, useRef } from "react";
import type { CalendarEventRow, ClassRow } from "@studynest/shared";
import type { TimedGridRange } from "./calendarGridRange.js";
import { EventCard } from "./EventCard.js";
import { TimedColumn, type DayColumnRef } from "./TimedColumn.js";
import { HOUR_HEIGHT_WEEK } from "./timedGrid.js";

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

export const WeekView: FC<Props> = ({
  weekStart,
  events,
  classesById,
  selectedEventId,
  onSelectEvent,
  onMutateEvent,
  onCreateRange,
  gridRange,
}) => {
  const dayStartHour = gridRange.startHour;
  const dayEndExclusive = gridRange.endHourExclusive;
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        d.setHours(0, 0, 0, 0);
        return d;
      }),
    [weekStart],
  );

  const timedHours = dayEndExclusive - dayStartHour;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toDateString();

  const eventsByDay = useMemo(() => groupByDay(events, days), [events, days]);

  // Each TimedColumn registers itself so move-drags can hop between days.
  const columnsRef = useRef<Map<string, HTMLElement>>(new Map());
  const registerColumn = useCallback(
    (date: Date, el: HTMLElement | null): void => {
      const key = date.toDateString();
      if (el) columnsRef.current.set(key, el);
      else columnsRef.current.delete(key);
    },
    [],
  );
  const findColumnAtClientX = useCallback(
    (clientX: number): DayColumnRef | null => {
      for (const d of days) {
        const el = columnsRef.current.get(d.toDateString());
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right) {
          return { date: d, el };
        }
      }
      return null;
    },
    [days],
  );

  return (
    <div className="cal-week" role="grid" aria-label="Week view">
      <div className="cal-week-head">
        <div className="cal-week-corner" aria-hidden />
        {days.map((d) => {
          const isToday = d.toDateString() === todayKey;
          return (
            <div
              key={d.toISOString()}
              className={`cal-week-day-head${isToday ? " is-today" : ""}`}
              role="columnheader"
            >
              <span className="cal-week-dow">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className="cal-week-day-num">
                {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
          );
        })}
      </div>

      <div className="cal-week-allday">
        <div className="cal-week-allday-label">All-day</div>
        {days.map((d, i) => {
          const list = eventsByDay[i]?.allDay ?? [];
          return (
            <div className="cal-week-allday-cell" key={`ad-${d.toISOString()}`}>
              {list.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  cls={ev.class_id ? classesById.get(ev.class_id) ?? null : null}
                  variant="allDay"
                  selected={ev.id === selectedEventId}
                  onClick={() => onSelectEvent(ev.id)}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div
        className="cal-week-grid cal-timed-grid-scroll"
        style={{ ["--cal-hour-height" as string]: `${HOUR_HEIGHT_WEEK}px` }}
      >
        <div className="cal-time-axis" aria-hidden>
          {/* Head-pad spacer keeps the grid lines continuous to the top. */}
          <div className="cal-time-row cal-time-row--head-pad" />
          {Array.from({ length: timedHours }, (_, i) => {
            const h = dayStartHour + i;
            const label = labelForHour(h);
            return (
              <div className="cal-time-row" key={h}>
                <span className="cal-time-label">{label}</span>
              </div>
            );
          })}
        </div>

        {days.map((d, i) => {
          const isToday = d.toDateString() === todayKey;
          const items = eventsByDay[i]?.timed ?? [];
          return (
            <TimedColumn
              key={`col-${d.toISOString()}`}
              date={d}
              events={items}
              classesById={classesById}
              selectedEventId={selectedEventId}
              variant="week"
              dayStartHour={dayStartHour}
              rowCount={timedHours}
              isToday={isToday}
              onSelectEvent={onSelectEvent}
              onMutateEvent={onMutateEvent}
              onCreateRange={onCreateRange}
              findColumnAtClientX={findColumnAtClientX}
              registerRef={registerColumn}
            />
          );
        })}
      </div>
    </div>
  );
};

function labelForHour(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric" });
}

interface DayBucket {
  allDay: CalendarEventRow[];
  timed: CalendarEventRow[];
}

function groupByDay(
  events: CalendarEventRow[],
  days: Date[],
): Record<number, DayBucket> {
  const buckets: Record<number, DayBucket> = {};
  for (let i = 0; i < days.length; i++) buckets[i] = { allDay: [], timed: [] };
  for (const ev of events) {
    const start = new Date(ev.start_at);
    for (let i = 0; i < days.length; i++) {
      const d = days[i]!;
      if (
        start.getFullYear() === d.getFullYear() &&
        start.getMonth() === d.getMonth() &&
        start.getDate() === d.getDate()
      ) {
        if (ev.all_day) buckets[i]!.allDay.push(ev);
        else buckets[i]!.timed.push(ev);
        break;
      }
    }
  }
  return buckets;
}
