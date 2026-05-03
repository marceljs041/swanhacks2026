import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { listNotes, listTasksForRange, upsertStudyPlan, upsertStudyTask, } from "../db/repositories.js";
import { ai } from "../lib/ai.js";
import { useApp } from "../store.js";
import { Card } from "./ui/Card.js";
import { Placeholder } from "./ui/Placeholder.js";
import { CalendarIcon, ChevLeftIcon, ChevRightIcon, SparklesIcon, } from "./icons.js";
function startOfWeek(d) {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    out.setDate(d.getDate() - d.getDay());
    return out;
}
export const Calendar = () => {
    const [tasks, setTasks] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const setWeekTasks = useApp((s) => s.setWeekTasks);
    const baseWeek = startOfWeek(new Date());
    const weekStart = new Date(baseWeek);
    weekStart.setDate(baseWeek.getDate() + weekOffset * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    async function refresh() {
        const t = await listTasksForRange(weekStart.toISOString(), weekEnd.toISOString());
        setTasks(t);
        setWeekTasks(t);
    }
    useEffect(() => {
        void refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekOffset]);
    async function generatePlan() {
        setBusy(true);
        setError(null);
        try {
            const notes = (await listNotes(null)).slice(0, 8);
            const res = await ai.studyPlan({
                goal: "Review my recent notes and prep for the week.",
                exam_date: null,
                notes: notes.map((n) => ({ id: n.id, title: n.title, summary: n.summary })),
                days_available: 7,
            });
            const plan = await upsertStudyPlan({ title: "Weekly study plan" });
            for (const t of res.tasks) {
                await upsertStudyTask({
                    plan_id: plan.id,
                    note_id: t.note_id ?? null,
                    title: t.title,
                    type: t.type,
                    scheduled_for: new Date(t.scheduled_for).toISOString(),
                    duration_minutes: t.duration_minutes,
                });
            }
            await refresh();
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });
    const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${new Date(weekEnd.getTime() - 1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    return (_jsx("main", { className: "main", children: _jsxs("div", { className: "main-inner", children: [_jsxs("div", { className: "page-header", children: [_jsx(CalendarIcon, { size: 22 }), _jsx("h1", { children: "Calendar" }), _jsx("div", { className: "spacer" }), _jsx("button", { className: "btn-secondary", onClick: () => setWeekOffset((w) => w - 1), children: _jsx(ChevLeftIcon, { size: 14 }) }), _jsx("span", { style: { color: "var(--color-textMuted)", minWidth: 130, textAlign: "center" }, children: weekLabel }), _jsx("button", { className: "btn-secondary", onClick: () => setWeekOffset((w) => w + 1), children: _jsx(ChevRightIcon, { size: 14 }) }), _jsxs("button", { className: "btn-primary", onClick: () => void generatePlan(), disabled: busy, children: [_jsx(SparklesIcon, { size: 14 }), busy ? "Generating…" : "Generate study plan"] })] }), error && (_jsx("div", { className: "pill error", style: { alignSelf: "flex-start" }, children: error })), _jsx(Card, { children: _jsx("div", { className: "calendar-grid", children: days.map((d) => {
                            const ds = d.toISOString().slice(0, 10);
                            const dayTasks = tasks.filter((t) => t.scheduled_for.slice(0, 10) === ds);
                            const isToday = d.toDateString() === new Date().toDateString();
                            return (_jsxs("div", { className: "calendar-day", children: [_jsx("div", { className: "calendar-day-num", style: { color: isToday ? "var(--color-primary)" : undefined }, children: d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }) }), dayTasks.map((t) => (_jsx("div", { className: `calendar-task ${t.completed_at ? "completed" : ""}`, title: t.title, onClick: async () => {
                                            await upsertStudyTask({
                                                ...t,
                                                completed_at: t.completed_at ? null : new Date().toISOString(),
                                            });
                                            await refresh();
                                        }, children: t.title }, t.id)))] }, ds));
                        }) }) }), _jsx(Card, { title: "Month view", icon: _jsx(CalendarIcon, { size: 18 }), children: _jsx(Placeholder, { title: "Month view not yet implemented", description: "The week grid above is fully wired. A drag-and-drop month view is coming soon." }) })] }) }));
};
//# sourceMappingURL=Calendar.js.map