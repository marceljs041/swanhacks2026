/**
 * Single-column day view. Hour span follows the same dynamic range as week
 * view, and the column shares all of week view's drag-create / drag-move /
 * drag-resize gestures via `TimedColumn`.
 */
import type { FC } from "react";
import type { CalendarEventRow, ClassRow } from "@studynest/shared";
import type { TimedGridRange } from "./calendarGridRange.js";
import { EventCard } from "./EventCard.js";
import { TimedColumn } from "./TimedColumn.js";
import { HOUR_HEIGHT_DAY } from "./timedGrid.js";

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

export const DayView: FC<Props> = ({
  date,
  events,
  classesById,
  selectedEventId,
  onSelectEvent,
  onMutateEvent,
  onCreateRange,
  gridRange,
}) => {
  const todayKey = new Date().toDateString();
  const isToday = date.toDateString() === todayKey;
  const dayStartHour = gridRange.startHour;
  const dayEndExclusive = gridRange.endHourExclusive;
  const timedHours = dayEndExclusive - dayStartHour;

  const allDay = events.filter((e) => e.all_day);
  const timed = events.filter((e) => !e.all_day);

  return (
    <div className="cal-day-view" role="grid" aria-label="Day view">
      <div className="cal-day-head">
        <div className={`cal-day-head-card${isToday ? " is-today" : ""}`}>
          <span className="cal-day-head-dow">
            {date.toLocaleDateString(undefined, { weekday: "long" })}
          </span>
          <span className="cal-day-head-date">
            {date.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {allDay.length > 0 && (
        <div className="cal-day-allday">
          <span className="cal-week-allday-label">All-day</span>
          <div className="cal-day-allday-list">
            {allDay.map((ev) => (
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
        </div>
      )}

      <div
        className="cal-day-grid cal-timed-grid-scroll"
        style={{ ["--cal-hour-height" as string]: `${HOUR_HEIGHT_DAY}px` }}
      >
        <div className="cal-time-axis" aria-hidden>
          <div className="cal-time-row cal-time-row--head-pad" />
          {Array.from({ length: timedHours }, (_, i) => {
            const h = dayStartHour + i;
            const d = new Date();
            d.setHours(h, 0, 0, 0);
            return (
              <div className="cal-time-row" key={h}>
                <span className="cal-time-label">
                  {d.toLocaleTimeString([], { hour: "numeric" })}
                </span>
              </div>
            );
          })}
        </div>
        <TimedColumn
          date={date}
          events={timed}
          classesById={classesById}
          selectedEventId={selectedEventId}
          variant="day"
          dayStartHour={dayStartHour}
          rowCount={timedHours}
          isToday={isToday}
          onSelectEvent={onSelectEvent}
          onMutateEvent={onMutateEvent}
          onCreateRange={onCreateRange}
        />
      </div>
    </div>
  );
};
