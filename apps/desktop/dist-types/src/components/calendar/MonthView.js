import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { EventCard } from "./EventCard.js";
import { startOfMonth } from "./eventVisuals.js";
const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_PER_CELL = 3;
export const MonthView = ({ monthStart, events, classesById, selectedEventId, onSelectEvent, onSelectDay, }) => {
    const cells = useMemo(() => buildMonthCells(monthStart), [monthStart]);
    const eventsByDay = useMemo(() => {
        const m = new Map();
        for (const ev of events) {
            const k = new Date(ev.start_at).toDateString();
            const cur = m.get(k);
            if (cur)
                cur.push(ev);
            else
                m.set(k, [ev]);
        }
        return m;
    }, [events]);
    const todayKey = new Date().toDateString();
    return (_jsxs("div", { className: "cal-month", role: "grid", "aria-label": "Month view", children: [_jsx("div", { className: "cal-month-head", children: DOWS.map((d) => (_jsx("span", { className: "cal-month-dow", children: d }, d))) }), _jsx("div", { className: "cal-month-grid", children: cells.map(({ date, inMonth }) => {
                    const key = date.toDateString();
                    const items = eventsByDay.get(key) ?? [];
                    const isToday = key === todayKey;
                    const visible = items.slice(0, MAX_PER_CELL);
                    const overflow = items.length - visible.length;
                    return (_jsxs("div", { className: `cal-month-cell${inMonth ? "" : " is-outside"}${isToday ? " is-today" : ""}`, role: "gridcell", onClick: () => onSelectDay(date), onKeyDown: (e) => {
                            if (e.key === "Enter")
                                onSelectDay(date);
                        }, tabIndex: 0, children: [_jsx("span", { className: "cal-month-num", children: date.getDate() }), _jsxs("div", { className: "cal-month-events", children: [visible.map((ev) => (_jsx(EventCard, { event: ev, cls: ev.class_id ? classesById.get(ev.class_id) ?? null : null, variant: "month", selected: ev.id === selectedEventId, onClick: () => {
                                            // Stop the cell click that would otherwise jump to Day view.
                                            onSelectEvent(ev.id);
                                        } }, ev.id))), overflow > 0 && (_jsxs("button", { type: "button", className: "cal-month-more", onClick: (e) => {
                                            e.stopPropagation();
                                            onSelectDay(date);
                                        }, children: ["+", overflow, " more"] }))] })] }, date.toISOString()));
                }) })] }));
};
function buildMonthCells(monthStart) {
    const start = startOfMonth(monthStart);
    // Anchor on Monday like our WeekView.
    const dow = (start.getDay() + 6) % 7;
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - dow);
    const out = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        out.push({ date: d, inMonth: d.getMonth() === start.getMonth() });
    }
    return out;
}
//# sourceMappingURL=MonthView.js.map