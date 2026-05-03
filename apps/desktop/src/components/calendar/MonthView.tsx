/**
 * Six-week month view. Each cell shows up to 3 events with a "+N
 * more" tail; clicking a day drills into Day view focused on that
 * date. Today's cell gets the primary accent ring.
 */
import type { FC } from "react";
import { useMemo } from "react";
import type { CalendarEventRow, ClassRow } from "@studynest/shared";
import { EventCard } from "./EventCard.js";
import { startOfMonth } from "./eventVisuals.js";

interface Props {
  monthStart: Date;
  events: CalendarEventRow[];
  classesById: Map<string, ClassRow>;
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  onSelectDay: (d: Date) => void;
}

const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_PER_CELL = 3;

export const MonthView: FC<Props> = ({
  monthStart,
  events,
  classesById,
  selectedEventId,
  onSelectEvent,
  onSelectDay,
}) => {
  const cells = useMemo(() => buildMonthCells(monthStart), [monthStart]);
  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEventRow[]>();
    for (const ev of events) {
      const k = new Date(ev.start_at).toDateString();
      const cur = m.get(k);
      if (cur) cur.push(ev);
      else m.set(k, [ev]);
    }
    return m;
  }, [events]);

  const todayKey = new Date().toDateString();

  return (
    <div className="cal-month" role="grid" aria-label="Month view">
      <div className="cal-month-head">
        {DOWS.map((d) => (
          <span className="cal-month-dow" key={d}>
            {d}
          </span>
        ))}
      </div>
      <div className="cal-month-grid">
        {cells.map(({ date, inMonth }) => {
          const key = date.toDateString();
          const items = eventsByDay.get(key) ?? [];
          const isToday = key === todayKey;
          const visible = items.slice(0, MAX_PER_CELL);
          const overflow = items.length - visible.length;
          return (
            <div
              key={date.toISOString()}
              className={`cal-month-cell${inMonth ? "" : " is-outside"}${
                isToday ? " is-today" : ""
              }`}
              role="gridcell"
              onClick={() => onSelectDay(date)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelectDay(date);
              }}
              tabIndex={0}
            >
              <span className="cal-month-num">{date.getDate()}</span>
              <div className="cal-month-events">
                {visible.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    cls={ev.class_id ? classesById.get(ev.class_id) ?? null : null}
                    variant="month"
                    selected={ev.id === selectedEventId}
                    onClick={() => {
                      // Stop the cell click that would otherwise jump to Day view.
                      onSelectEvent(ev.id);
                    }}
                  />
                ))}
                {overflow > 0 && (
                  <button
                    type="button"
                    className="cal-month-more"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDay(date);
                    }}
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function buildMonthCells(monthStart: Date): { date: Date; inMonth: boolean }[] {
  const start = startOfMonth(monthStart);
  // Anchor on Monday like our WeekView.
  const dow = (start.getDay() + 6) % 7;
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - dow);
  const out: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    out.push({ date: d, inMonth: d.getMonth() === start.getMonth() });
  }
  return out;
}
