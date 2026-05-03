import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../store.js";
import { calendarStats as loadCalendarStats, ensureCalendarBackfill, getEvent, listEventsForRange, searchEvents as searchCalendarEvents, upsertEvent, } from "../db/calendar.js";
import { listClasses, listNotes, listQuizzes, } from "../db/repositories.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { RightPanel } from "./RightPanel.js";
import { AddEditEventDrawer } from "./calendar/AddEditEventDrawer.js";
import { DayView } from "./calendar/DayView.js";
import { EventDetailRail } from "./calendar/EventDetailRail.js";
import { MonthView } from "./calendar/MonthView.js";
import { StudyPlanGeneratorModal } from "./calendar/StudyPlanGeneratorModal.js";
import { computeTimedGridRange } from "./calendar/calendarGridRange.js";
import { WeekView } from "./calendar/WeekView.js";
import { fmtRangeLabel, fromIsoDate, isoDate, startOfMonth, startOfWeek, } from "./calendar/eventVisuals.js";
import { CalendarIcon, CheckIcon, ChevLeftIcon, ChevRightIcon, FlameIcon, NoteIcon, PlusIcon, QuizIcon, SearchIcon, SparklesIcon, TrophyIcon, } from "./icons.js";
import { BRAND_HERO_URL } from "../lib/brand.js";
export const Calendar = () => {
    const view = useApp((s) => s.calendarView);
    const setView = useApp((s) => s.setCalendarView);
    const cursorIso = useApp((s) => s.calendarCursor);
    const setCursor = useApp((s) => s.setCalendarCursor);
    const selectedEventId = useApp((s) => s.calendarSelectedEventId);
    const setSelectedEvent = useApp((s) => s.setCalendarSelectedEvent);
    const setComposer = useApp((s) => s.setCalendarComposer);
    const setPlanGeneratorOpen = useApp((s) => s.setCalendarPlanGeneratorOpen);
    const cursor = useMemo(() => fromIsoDate(cursorIso), [cursorIso]);
    // Compute the visible window based on the current view; the grid
    // queries the DB for any event overlapping this window.
    const { rangeStart, rangeEnd } = useMemo(() => visibleRange(view, cursor), [view, cursor]);
    const [events, setEvents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [stats, setStats] = useState({
        todaysTasks: 0,
        upcomingExams: 0,
        studyStreak: 0,
        tasksCompletedThisWeek: 0,
    });
    const [reloadTick, setReloadTick] = useState(0);
    const refresh = useCallback(() => {
        setReloadTick((n) => n + 1);
    }, []);
    // Load events for the visible window + the supporting class list.
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            // Backfill is idempotent — safe to call on every mount; it
            // short-circuits if the flag is already set.
            await ensureCalendarBackfill();
            const [evs, cls, st] = await Promise.all([
                listEventsForRange(rangeStart.toISOString(), rangeEnd.toISOString()),
                listClasses(),
                loadCalendarStats(),
            ]);
            if (cancelled)
                return;
            setEvents(evs);
            setClasses(cls);
            setStats(st);
        })();
        return () => {
            cancelled = true;
        };
    }, [rangeStart, rangeEnd, reloadTick]);
    // When the user creates/edits/deletes an event the rail closes the
    // composer and bumps `reloadTick` so the grid catches up.
    const composer = useApp((s) => s.calendarComposer);
    useEffect(() => {
        if (composer === null)
            refresh();
    }, [composer, refresh]);
    // Same trick for plan generator modal (closes after accept).
    const planOpen = useApp((s) => s.calendarPlanGeneratorOpen);
    useEffect(() => {
        if (!planOpen)
            refresh();
    }, [planOpen, refresh]);
    const classesById = useMemo(() => {
        const m = new Map();
        for (const c of classes)
            m.set(c.id, c);
        return m;
    }, [classes]);
    const timedGridRange = useMemo(() => computeTimedGridRange(events), [events]);
    function shift(delta) {
        const next = new Date(cursor);
        if (view === "day")
            next.setDate(next.getDate() + delta);
        else if (view === "week")
            next.setDate(next.getDate() + delta * 7);
        else
            next.setMonth(next.getMonth() + delta);
        setCursor(isoDate(next));
    }
    function goToday() {
        setCursor(isoDate(new Date()));
    }
    function selectDay(d) {
        setCursor(isoDate(d));
        setView("day");
    }
    function openCompose() {
        const start = new Date();
        start.setHours(9, 0, 0, 0);
        const end = new Date(start);
        end.setHours(10, 0, 0, 0);
        setComposer({
            mode: "create",
            prefill: {
                type: "study_block",
                start_at: start.toISOString(),
                end_at: end.toISOString(),
            },
        });
    }
    // Drag-create from any timed cell — opens the composer prefilled with
    // the user's gesture so they can confirm metadata before saving.
    const onCreateRange = useCallback((startIso, endIso) => {
        setComposer({
            mode: "create",
            prefill: {
                type: "study_block",
                start_at: startIso,
                end_at: endIso,
            },
        });
    }, [setComposer]);
    // Drag-move / drag-resize commits — write the new times directly so
    // the change feels instantaneous, then reload events.
    const onMutateEvent = useCallback(async (id, startIso, endIso) => {
        const existing = await getEvent(id);
        if (!existing)
            return;
        // Optimistic update so the card snaps to its new spot before sync.
        setEvents((prev) => prev.map((e) => e.id === id ? { ...e, start_at: startIso, end_at: endIso } : e));
        await upsertEvent({
            ...existing,
            start_at: startIso,
            end_at: endIso,
        });
        refresh();
    }, [refresh]);
    function openPlanGenerator() {
        setPlanGeneratorOpen(true);
    }
    return (_jsxs(_Fragment, { children: [_jsx("main", { className: "main", children: _jsxs("div", { className: "main-inner cal-page", children: [_jsx(CalendarHeader, {}), _jsx(CalendarStatsRow, { stats: stats }), _jsx(CalendarToolbar, { view: view, rangeStart: rangeStart, rangeEnd: rangeEnd, onShift: shift, onToday: goToday, onChangeView: setView, onAdd: openCompose, onBuildPlan: openPlanGenerator }), _jsxs("div", { className: "cal-grid-wrap", children: [view === "week" && (_jsx(WeekView, { weekStart: rangeStart, events: events, classesById: classesById, selectedEventId: selectedEventId, gridRange: timedGridRange, onSelectEvent: (id) => withViewTransition(() => setSelectedEvent(id)), onMutateEvent: (id, startIso, endIso) => void onMutateEvent(id, startIso, endIso), onCreateRange: onCreateRange })), view === "day" && (_jsx(DayView, { date: cursor, events: events, classesById: classesById, selectedEventId: selectedEventId, gridRange: timedGridRange, onSelectEvent: (id) => withViewTransition(() => setSelectedEvent(id)), onMutateEvent: (id, startIso, endIso) => void onMutateEvent(id, startIso, endIso), onCreateRange: onCreateRange })), view === "month" && (_jsx(MonthView, { monthStart: rangeStart, events: events, classesById: classesById, selectedEventId: selectedEventId, onSelectEvent: (id) => withViewTransition(() => setSelectedEvent(id)), onSelectDay: selectDay }))] })] }) }), selectedEventId ? (_jsx(EventDetailRail, { eventId: selectedEventId })) : (_jsx(RightPanel, { calendarSwap: true })), _jsx(AddEditEventDrawer, {}), _jsx(StudyPlanGeneratorModal, {})] }));
};
/* ---------- Header ---------- */
const CalendarHeader = () => {
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [extraNotes, setExtraNotes] = useState([]);
    const [extraQuizzes, setExtraQuizzes] = useState([]);
    const [extraClasses, setExtraClasses] = useState([]);
    const setSelectedEvent = useApp((s) => s.setCalendarSelectedEvent);
    const setCursor = useApp((s) => s.setCalendarCursor);
    const setView = useApp((s) => s.setView);
    const searchWrapRef = useRef(null);
    useEffect(() => {
        const t = setTimeout(async () => {
            const trimmed = q.trim();
            if (!trimmed) {
                setResults([]);
                setExtraNotes([]);
                setExtraQuizzes([]);
                setExtraClasses([]);
                return;
            }
            const [evs, cls, ns, qs] = await Promise.all([
                searchCalendarEvents(trimmed, 6),
                listClasses(),
                listNotes(null),
                listQuizzes(null),
            ]);
            const lc = trimmed.toLowerCase();
            setResults(evs);
            setExtraClasses(cls
                .filter((c) => c.name.toLowerCase().includes(lc) ||
                (c.code ?? "").toLowerCase().includes(lc))
                .slice(0, 4));
            setExtraNotes(ns.filter((n) => n.title.toLowerCase().includes(lc)).slice(0, 4));
            setExtraQuizzes(qs.filter((qz) => qz.title.toLowerCase().includes(lc)).slice(0, 4));
        }, 120);
        return () => clearTimeout(t);
    }, [q]);
    useEffect(() => {
        if (!open)
            return;
        function onDoc(e) {
            if (!searchWrapRef.current?.contains(e.target))
                setOpen(false);
        }
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);
    const hasResults = results.length > 0 ||
        extraClasses.length > 0 ||
        extraNotes.length > 0 ||
        extraQuizzes.length > 0;
    const showDropdown = open && q.trim().length > 0;
    return (_jsxs("section", { className: "hero", "aria-labelledby": "calendar-hero-title", children: [_jsxs("div", { className: "hero-main", children: [_jsxs("div", { className: "search-wrap", ref: searchWrapRef, children: [_jsxs("label", { className: "search", children: [_jsx("span", { className: "search-icon", "aria-hidden": true, children: _jsx(SearchIcon, { size: 16 }) }), _jsx("input", { id: "calendar-hero-search", type: "search", placeholder: "Search events, tasks, classes, or topics...", "aria-label": "Search calendar and related items", value: q, onChange: (e) => {
                                            setQ(e.target.value);
                                            setOpen(true);
                                        }, onFocus: () => setOpen(true) })] }), showDropdown && (_jsx("div", { className: "search-results", role: "listbox", children: !hasResults ? (_jsx("div", { className: "search-empty", children: "No matches yet." })) : (_jsxs(_Fragment, { children: [results.length > 0 && (_jsxs("div", { className: "search-group", children: [_jsx("div", { className: "search-group-label", children: "Events" }), results.map((ev) => (_jsxs("button", { type: "button", role: "option", className: "search-item", onMouseDown: (e) => e.preventDefault(), onClick: () => {
                                                        withViewTransition(() => {
                                                            const d = new Date(ev.start_at);
                                                            setCursor(isoDate(d));
                                                            setSelectedEvent(ev.id);
                                                            setOpen(false);
                                                            setQ("");
                                                        });
                                                    }, children: [_jsx(CalendarIcon, { size: 14 }), _jsx("span", { className: "search-item-title", children: ev.title }), _jsx("span", { className: "search-item-sub", children: new Date(ev.start_at).toLocaleDateString(undefined, {
                                                                month: "short",
                                                                day: "numeric",
                                                            }) })] }, ev.id)))] })), extraClasses.length > 0 && (_jsxs("div", { className: "search-group", children: [_jsx("div", { className: "search-group-label", children: "Classes" }), extraClasses.map((c) => (_jsxs("button", { type: "button", role: "option", className: "search-item", onMouseDown: (e) => e.preventDefault(), onClick: () => {
                                                        setView({ kind: "classView", classId: c.id });
                                                        setOpen(false);
                                                        setQ("");
                                                    }, children: [_jsx("span", { className: "search-item-swatch", style: {
                                                                background: c.color ?? "var(--color-primary)",
                                                            }, "aria-hidden": true }), _jsx("span", { className: "search-item-title", children: c.name }), _jsx("span", { className: "search-item-sub", children: c.code ?? "" })] }, c.id)))] })), extraNotes.length > 0 && (_jsxs("div", { className: "search-group", children: [_jsx("div", { className: "search-group-label", children: "Notes" }), extraNotes.map((n) => (_jsxs("button", { type: "button", role: "option", className: "search-item", onMouseDown: (e) => e.preventDefault(), onClick: () => {
                                                        setView({ kind: "note", noteId: n.id });
                                                        setOpen(false);
                                                        setQ("");
                                                    }, children: [_jsx(NoteIcon, { size: 14 }), _jsx("span", { className: "search-item-title", children: n.title }), _jsx("span", { className: "search-item-sub", children: "Note" })] }, n.id)))] })), extraQuizzes.length > 0 && (_jsxs("div", { className: "search-group", children: [_jsx("div", { className: "search-group-label", children: "Quizzes" }), extraQuizzes.map((qz) => (_jsxs("button", { type: "button", role: "option", className: "search-item", onMouseDown: (e) => e.preventDefault(), onClick: () => {
                                                        setView({ kind: "quiz", quizId: qz.id });
                                                        setOpen(false);
                                                        setQ("");
                                                    }, children: [_jsx(QuizIcon, { size: 14 }), _jsx("span", { className: "search-item-title", children: qz.title }), _jsx("span", { className: "search-item-sub", children: "Quiz" })] }, qz.id)))] }))] })) }))] }), _jsxs("div", { className: "hero-greeting", children: [_jsx("h1", { id: "calendar-hero-title", className: "hero-headline", children: "Calendar" }), _jsx("p", { children: "Plan your study, track deadlines, and stay on top of your goals." })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_HERO_URL, alt: "", decoding: "async", onError: (e) => {
                        e.currentTarget.style.display = "none";
                    } }) })] }));
};
/* ---------- Stats ---------- */
const CalendarStatsRow = ({ stats }) => (_jsxs("div", { className: "cal-stats", children: [_jsx(StatTile, { tone: "lilac", icon: _jsx(CalendarIcon, { size: 16 }), label: "Today's Tasks", value: stats.todaysTasks, sub: "due today" }), _jsx(StatTile, { tone: "sage", icon: _jsx(TrophyIcon, { size: 16 }), label: "Upcoming Exams", value: stats.upcomingExams, sub: "in next 7 days" }), _jsx(StatTile, { tone: "sky", icon: _jsx(FlameIcon, { size: 16 }), label: "Study Streak", value: stats.studyStreak, sub: "days" }), _jsx(StatTile, { tone: "peach", icon: _jsx(CheckIcon, { size: 16 }), label: "Tasks Completed", value: stats.tasksCompletedThisWeek, sub: "this week" })] }));
const StatTile = ({ tone, icon, label, value, sub }) => (_jsxs("div", { className: `cal-stat-card tone-${tone}`, children: [_jsx("span", { className: "cal-stat-icon", "aria-hidden": true, children: icon }), _jsxs("div", { className: "cal-stat-text", children: [_jsx("span", { className: "cal-stat-label", children: label }), _jsx("span", { className: "cal-stat-value", children: value }), _jsx("span", { className: "cal-stat-sub", children: sub })] })] }));
const CalendarToolbar = ({ view, rangeStart, rangeEnd, onShift, onToday, onChangeView, onAdd, onBuildPlan, }) => {
    const label = useMemo(() => {
        if (view === "day") {
            return rangeStart.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
            });
        }
        if (view === "month") {
            return rangeStart.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
            });
        }
        // For week view, end is exclusive — display the inclusive last day.
        const inclusiveEnd = new Date(rangeEnd);
        inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
        return fmtRangeLabel(rangeStart, inclusiveEnd);
    }, [view, rangeStart, rangeEnd]);
    return (_jsxs("div", { className: "cal-toolbar", children: [_jsxs("div", { className: "cal-toolbar-left", children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: onToday, "aria-label": "Jump to today", children: "Today" }), _jsxs("div", { className: "cal-toolbar-arrows", children: [_jsx("button", { type: "button", className: "cal-toolbar-arrow", "aria-label": "Previous", onClick: () => onShift(-1), children: _jsx(ChevLeftIcon, { size: 14 }) }), _jsx("button", { type: "button", className: "cal-toolbar-arrow", "aria-label": "Next", onClick: () => onShift(1), children: _jsx(ChevRightIcon, { size: 14 }) })] }), _jsx("h2", { className: "cal-toolbar-range", children: label })] }), _jsxs("div", { className: "cal-toolbar-right", children: [_jsx("div", { className: "cal-view-switch", role: "tablist", "aria-label": "Calendar view", children: ["day", "week", "month"].map((v) => (_jsxs("button", { type: "button", role: "tab", "aria-selected": view === v, className: `cal-view-switch-btn${view === v ? " active" : ""}`, onClick: () => onChangeView(v), children: [v[0].toUpperCase(), v.slice(1)] }, v))) }), _jsxs("button", { type: "button", className: "btn-secondary", onClick: onBuildPlan, children: [_jsx(SparklesIcon, { size: 14 }), " Build Study Plan"] }), _jsxs("button", { type: "button", className: "btn-primary", onClick: onAdd, children: [_jsx(PlusIcon, { size: 14 }), " Add"] })] })] }));
};
/* ---------- helpers ---------- */
function visibleRange(view, cursor) {
    if (view === "day") {
        const start = new Date(cursor);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { rangeStart: start, rangeEnd: end };
    }
    if (view === "week") {
        const start = startOfWeek(cursor);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return { rangeStart: start, rangeEnd: end };
    }
    const start = startOfMonth(cursor);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { rangeStart: start, rangeEnd: end };
}
//# sourceMappingURL=Calendar.js.map