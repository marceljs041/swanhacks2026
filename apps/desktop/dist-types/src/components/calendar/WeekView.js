import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useRef } from "react";
import { EventCard } from "./EventCard.js";
import { TimedColumn } from "./TimedColumn.js";
import { HOUR_HEIGHT_WEEK } from "./timedGrid.js";
export const WeekView = ({ weekStart, events, classesById, selectedEventId, onSelectEvent, onMutateEvent, onCreateRange, gridRange, }) => {
    const dayStartHour = gridRange.startHour;
    const dayEndExclusive = gridRange.endHourExclusive;
    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        d.setHours(0, 0, 0, 0);
        return d;
    }), [weekStart]);
    const timedHours = dayEndExclusive - dayStartHour;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toDateString();
    const eventsByDay = useMemo(() => groupByDay(events, days), [events, days]);
    // Each TimedColumn registers itself so move-drags can hop between days.
    const columnsRef = useRef(new Map());
    const registerColumn = useCallback((date, el) => {
        const key = date.toDateString();
        if (el)
            columnsRef.current.set(key, el);
        else
            columnsRef.current.delete(key);
    }, []);
    const findColumnAtClientX = useCallback((clientX) => {
        for (const d of days) {
            const el = columnsRef.current.get(d.toDateString());
            if (!el)
                continue;
            const r = el.getBoundingClientRect();
            if (clientX >= r.left && clientX <= r.right) {
                return { date: d, el };
            }
        }
        return null;
    }, [days]);
    return (_jsxs("div", { className: "cal-week", role: "grid", "aria-label": "Week view", children: [_jsxs("div", { className: "cal-week-head", children: [_jsx("div", { className: "cal-week-corner", "aria-hidden": true }), days.map((d) => {
                        const isToday = d.toDateString() === todayKey;
                        return (_jsxs("div", { className: `cal-week-day-head${isToday ? " is-today" : ""}`, role: "columnheader", children: [_jsx("span", { className: "cal-week-dow", children: d.toLocaleDateString(undefined, { weekday: "short" }) }), _jsx("span", { className: "cal-week-day-num", children: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) })] }, d.toISOString()));
                    })] }), _jsxs("div", { className: "cal-week-allday", children: [_jsx("div", { className: "cal-week-allday-label", children: "All-day" }), days.map((d, i) => {
                        const list = eventsByDay[i]?.allDay ?? [];
                        return (_jsx("div", { className: "cal-week-allday-cell", children: list.map((ev) => (_jsx(EventCard, { event: ev, cls: ev.class_id ? classesById.get(ev.class_id) ?? null : null, variant: "allDay", selected: ev.id === selectedEventId, onClick: () => onSelectEvent(ev.id) }, ev.id))) }, `ad-${d.toISOString()}`));
                    })] }), _jsxs("div", { className: "cal-week-grid cal-timed-grid-scroll", style: { ["--cal-hour-height"]: `${HOUR_HEIGHT_WEEK}px` }, children: [_jsxs("div", { className: "cal-time-axis", "aria-hidden": true, children: [_jsx("div", { className: "cal-time-row cal-time-row--head-pad" }), Array.from({ length: timedHours }, (_, i) => {
                                const h = dayStartHour + i;
                                const label = labelForHour(h);
                                return (_jsx("div", { className: "cal-time-row", children: _jsx("span", { className: "cal-time-label", children: label }) }, h));
                            })] }), days.map((d, i) => {
                        const isToday = d.toDateString() === todayKey;
                        const items = eventsByDay[i]?.timed ?? [];
                        return (_jsx(TimedColumn, { date: d, events: items, classesById: classesById, selectedEventId: selectedEventId, variant: "week", dayStartHour: dayStartHour, rowCount: timedHours, isToday: isToday, onSelectEvent: onSelectEvent, onMutateEvent: onMutateEvent, onCreateRange: onCreateRange, findColumnAtClientX: findColumnAtClientX, registerRef: registerColumn }, `col-${d.toISOString()}`));
                    })] })] }));
};
function labelForHour(h) {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric" });
}
function groupByDay(events, days) {
    const buckets = {};
    for (let i = 0; i < days.length; i++)
        buckets[i] = { allDay: [], timed: [] };
    for (const ev of events) {
        const start = new Date(ev.start_at);
        for (let i = 0; i < days.length; i++) {
            const d = days[i];
            if (start.getFullYear() === d.getFullYear() &&
                start.getMonth() === d.getMonth() &&
                start.getDate() === d.getDate()) {
                if (ev.all_day)
                    buckets[i].allDay.push(ev);
                else
                    buckets[i].timed.push(ev);
                break;
            }
        }
    }
    return buckets;
}
//# sourceMappingURL=WeekView.js.map