import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { EventCard } from "./EventCard.js";
import { TimedColumn } from "./TimedColumn.js";
import { HOUR_HEIGHT_DAY } from "./timedGrid.js";
export const DayView = ({ date, events, classesById, selectedEventId, onSelectEvent, onMutateEvent, onCreateRange, gridRange, }) => {
    const todayKey = new Date().toDateString();
    const isToday = date.toDateString() === todayKey;
    const dayStartHour = gridRange.startHour;
    const dayEndExclusive = gridRange.endHourExclusive;
    const timedHours = dayEndExclusive - dayStartHour;
    const allDay = events.filter((e) => e.all_day);
    const timed = events.filter((e) => !e.all_day);
    return (_jsxs("div", { className: "cal-day-view", role: "grid", "aria-label": "Day view", children: [_jsx("div", { className: "cal-day-head", children: _jsxs("div", { className: `cal-day-head-card${isToday ? " is-today" : ""}`, children: [_jsx("span", { className: "cal-day-head-dow", children: date.toLocaleDateString(undefined, { weekday: "long" }) }), _jsx("span", { className: "cal-day-head-date", children: date.toLocaleDateString(undefined, {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                            }) })] }) }), allDay.length > 0 && (_jsxs("div", { className: "cal-day-allday", children: [_jsx("span", { className: "cal-week-allday-label", children: "All-day" }), _jsx("div", { className: "cal-day-allday-list", children: allDay.map((ev) => (_jsx(EventCard, { event: ev, cls: ev.class_id ? classesById.get(ev.class_id) ?? null : null, variant: "allDay", selected: ev.id === selectedEventId, onClick: () => onSelectEvent(ev.id) }, ev.id))) })] })), _jsxs("div", { className: "cal-day-grid cal-timed-grid-scroll", style: { ["--cal-hour-height"]: `${HOUR_HEIGHT_DAY}px` }, children: [_jsxs("div", { className: "cal-time-axis", "aria-hidden": true, children: [_jsx("div", { className: "cal-time-row cal-time-row--head-pad" }), Array.from({ length: timedHours }, (_, i) => {
                                const h = dayStartHour + i;
                                const d = new Date();
                                d.setHours(h, 0, 0, 0);
                                return (_jsx("div", { className: "cal-time-row", children: _jsx("span", { className: "cal-time-label", children: d.toLocaleTimeString([], { hour: "numeric" }) }) }, h));
                            })] }), _jsx(TimedColumn, { date: date, events: timed, classesById: classesById, selectedEventId: selectedEventId, variant: "day", dayStartHour: dayStartHour, rowCount: timedHours, isToday: isToday, onSelectEvent: onSelectEvent, onMutateEvent: onMutateEvent, onCreateRange: onCreateRange })] })] }));
};
//# sourceMappingURL=DayView.js.map