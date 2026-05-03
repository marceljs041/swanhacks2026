import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Card } from "./ui/Card.js";
import { ArrowRightIcon, CalendarIcon, CheckIcon, ChevLeftIcon, ChevRightIcon, ClassIcon, ClockIcon, FlameIcon, FlagIcon, FlashcardIcon, PlusIcon, SparklesIcon, TrophyIcon, } from "./icons.js";
import { useApp } from "../store.js";
import { DEFAULT_TIMER_DURATIONS, TIMER_BOUNDS, getTimerDurations, saveTimerDurations, } from "../lib/timerPrefs.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { currentStreak, listClasses, listDueFlashcards, listFlashcardSets, listNotes, listTasksForRange, recordXp, totalXp, upsertNote, upsertStudyTask, xpByDay, } from "../db/repositories.js";
import { ulid, XP_RULES } from "@studynest/shared";
import { ALL_WIDGETS, WIDGET_DESCRIPTIONS, WIDGET_LABELS, inactiveWidgets, } from "../lib/rightPanelLayout.js";
export const RightPanel = ({ classesSwap }) => {
    const activeIds = useApp((s) => s.rightPanelWidgets);
    const setActive = useApp((s) => s.setRightPanelWidgets);
    const valid = useMemo(() => activeIds.filter((id) => ALL_WIDGETS.includes(id)), [activeIds]);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(valid);
    // Keep the draft in sync if the persisted list changes while we're not editing.
    useEffect(() => {
        if (!editing)
            setDraft(valid);
    }, [valid, editing]);
    function enterEdit() {
        withViewTransition(() => {
            setDraft(valid);
            setEditing(true);
        });
    }
    function cancel() {
        withViewTransition(() => {
            setDraft(valid);
            setEditing(false);
        });
    }
    function save() {
        withViewTransition(() => {
            setActive(draft);
            setEditing(false);
        });
    }
    function reorder(from, to) {
        if (from === to || from < 0 || to < 0)
            return;
        const next = [...draft];
        const [item] = next.splice(from, 1);
        if (!item)
            return;
        next.splice(to, 0, item);
        setDraft(next);
    }
    function removeFromDraft(id) {
        setDraft(draft.filter((w) => w !== id));
    }
    function add(id) {
        if (valid.includes(id))
            return;
        setActive([...valid, id]);
    }
    return (_jsxs("aside", { className: `right-panel${classesSwap ? " right-panel--classes-swap" : ""}`, children: [_jsx(RightPanelHeader, { editing: editing, canSave: draft.length > 0 || valid.length === 0, onEdit: enterEdit, onCancel: cancel, onSave: save }), editing ? (_jsx(ReorderList, { ids: draft, onReorder: reorder, onRemove: removeFromDraft })) : (_jsxs(_Fragment, { children: [valid.map((id) => {
                        const Component = WIDGETS[id];
                        return _jsx(Component, {}, id);
                    }), _jsx(AddWidgetSkeleton, { inactive: inactiveWidgets(valid), onAdd: add })] }))] }));
};
/* ---- Widget registry --------------------------------------------- */
const WIDGETS = {
    level: LevelCard,
    deadlines: UpcomingDeadlinesCard,
    studyTimer: StudyTimerCard,
    dueFlashcards: DueFlashcardsCard,
    todaysPlan: TodaysPlanCard,
    quickCapture: QuickCaptureCard,
    aiQuickPrompts: AiQuickPromptsCard,
    streakHeatmap: StreakHeatmapCard,
    classFilter: ClassFilterCard,
    studyGoals: StudyGoalsCard,
    miniCalendar: MiniCalendarCard,
};
const WIDGET_ICONS = {
    level: TrophyIcon,
    deadlines: FlagIcon,
    studyTimer: ClockIcon,
    dueFlashcards: FlashcardIcon,
    todaysPlan: CheckIcon,
    quickCapture: PlusIcon,
    aiQuickPrompts: SparklesIcon,
    streakHeatmap: FlameIcon,
    classFilter: ClassIcon,
    studyGoals: FlagIcon,
    miniCalendar: CalendarIcon,
};
const RightPanelHeader = ({ editing, canSave, onEdit, onCancel, onSave }) => {
    if (!editing) {
        return (_jsx("div", { className: "right-panel-header", children: _jsx("button", { type: "button", className: "right-panel-edit", onClick: onEdit, children: "Edit" }) }));
    }
    return (_jsxs("div", { className: "right-panel-header editing", children: [_jsx("span", { className: "right-panel-edit-title", children: "Reorder modules" }), _jsxs("div", { className: "right-panel-edit-actions", children: [_jsx("button", { type: "button", className: "btn-ghost", onClick: onCancel, children: "Cancel" }), _jsx("button", { type: "button", className: "btn-primary", onClick: onSave, disabled: !canSave, children: "Save" })] })] }));
};
const ReorderList = ({ ids, onReorder, onRemove }) => {
    const [dragId, setDragId] = useState(null);
    const tileRefs = useRef(new Map());
    const prevTops = useRef(new Map());
    // Remember which target index we last decided on, so dragover frames
    // inside the same slot don't re-fire the same reorder.
    const lastTargetIdx = useRef(null);
    // FLIP: after each reorder, slide every *non-dragged* tile from its
    // previous Y to the new one so the rest of the list visibly opens up
    // for the dragged item.
    useLayoutEffect(() => {
        const next = new Map();
        tileRefs.current.forEach((el, id) => {
            if (el.isConnected)
                next.set(id, el.getBoundingClientRect().top);
        });
        next.forEach((top, id) => {
            if (id === dragId)
                return;
            const prev = prevTops.current.get(id);
            const el = tileRefs.current.get(id);
            if (!el || prev === undefined || prev === top)
                return;
            const delta = prev - top;
            el.style.transition = "none";
            el.style.transform = `translateY(${delta}px)`;
            void el.offsetHeight;
            el.style.transition = "transform 180ms cubic-bezier(0.2, 0.7, 0.3, 1)";
            el.style.transform = "";
        });
        prevTops.current = next;
    }, [ids, dragId]);
    if (ids.length === 0) {
        return (_jsx("p", { className: "right-empty", children: "No modules. Cancel and use \u201CAdd a module\u201D to choose one." }));
    }
    function handleDragOver(e, hoverIdx) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragId)
            return;
        const fromIdx = ids.indexOf(dragId);
        if (fromIdx < 0)
            return;
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const after = e.clientY > midY;
        let toIdx = after ? hoverIdx + 1 : hoverIdx;
        if (fromIdx < toIdx)
            toIdx -= 1;
        if (toIdx < 0)
            toIdx = 0;
        if (toIdx >= ids.length)
            toIdx = ids.length - 1;
        if (toIdx === fromIdx)
            return;
        if (lastTargetIdx.current === toIdx)
            return;
        lastTargetIdx.current = toIdx;
        onReorder(fromIdx, toIdx);
    }
    return (_jsx("ul", { className: "reorder-list", role: "listbox", "aria-label": "Drag to reorder", children: ids.map((id, i) => {
            const Icon = WIDGET_ICONS[id];
            const isDragging = dragId === id;
            return (_jsxs("li", { ref: (el) => {
                    if (el)
                        tileRefs.current.set(id, el);
                    else
                        tileRefs.current.delete(id);
                }, className: `reorder-tile${isDragging ? " is-dragging" : ""}`, draggable: true, onDragStart: (e) => {
                    setDragId(id);
                    lastTargetIdx.current = i;
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", id);
                }, onDragOver: (e) => handleDragOver(e, i), onDrop: (e) => {
                    e.preventDefault();
                    setDragId(null);
                    lastTargetIdx.current = null;
                }, onDragEnd: () => {
                    setDragId(null);
                    lastTargetIdx.current = null;
                }, children: [_jsx("span", { className: "reorder-grip", "aria-hidden": true, children: _jsx(GripIcon, {}) }), _jsx("span", { className: "reorder-icon", children: _jsx(Icon, { size: 16 }) }), _jsx("span", { className: "reorder-label", children: WIDGET_LABELS[id] }), _jsx("button", { type: "button", className: "reorder-remove", "aria-label": `Remove ${WIDGET_LABELS[id]}`, onClick: () => onRemove(id), children: _jsx(XIcon, {}) })] }, id));
        }) }));
};
const GripIcon = (props) => (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "currentColor", ...props, children: [_jsx("circle", { cx: "9", cy: "6", r: "1.4" }), _jsx("circle", { cx: "15", cy: "6", r: "1.4" }), _jsx("circle", { cx: "9", cy: "12", r: "1.4" }), _jsx("circle", { cx: "15", cy: "12", r: "1.4" }), _jsx("circle", { cx: "9", cy: "18", r: "1.4" }), _jsx("circle", { cx: "15", cy: "18", r: "1.4" })] }));
const XIcon = (props) => (_jsx("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", ...props, children: _jsx("path", { d: "M6 6l12 12M6 18 18 6" }) }));
/* ---- Shared task loading ---------------------------------------- */
const ACCENTS = [
    "var(--color-accentRose)",
    "var(--color-accentAmber)",
    "var(--color-accentSage)",
    "var(--color-primary)",
];
/**
 * Pulls scheduled tasks for the next `daysAhead` days. When the user has
 * picked a Focus Class we additionally load notes once and filter tasks
 * whose `note_id` belongs to that class. Notes are cached in component
 * state so toggling the filter is snappy.
 */
function useUpcomingTasks(daysAhead) {
    const focusedClassId = useApp((s) => s.focusedClassId);
    const [tasks, setTasks] = useState([]);
    const [noteToClass, setNoteToClass] = useState(new Map());
    useEffect(() => {
        let cancelled = false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setDate(end.getDate() + daysAhead);
        void Promise.all([
            listTasksForRange(today.toISOString(), end.toISOString()),
            focusedClassId ? listNotes(null) : Promise.resolve([]),
        ]).then(([rows, notes]) => {
            if (cancelled)
                return;
            const upcoming = rows
                .filter((r) => !r.completed_at)
                .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
            setTasks(upcoming);
            if (focusedClassId) {
                const m = new Map();
                for (const n of notes)
                    m.set(n.id, n.class_id);
                setNoteToClass(m);
            }
            else {
                setNoteToClass(new Map());
            }
        });
        return () => {
            cancelled = true;
        };
    }, [daysAhead, focusedClassId]);
    if (!focusedClassId)
        return tasks;
    return tasks.filter((t) => t.note_id && noteToClass.get(t.note_id) === focusedClassId);
}
function fmtDeadline(d) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function daysUntil(d) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    return Math.round((t.getTime() - now.getTime()) / 86_400_000);
}
function describeDaysLeft(n) {
    if (n <= 0)
        return "Today";
    if (n === 1)
        return "Tomorrow";
    return `${n} days left`;
}
function fmtTimeOfDay(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
/* ---- Study Goals ------------------------------------------------- */
function StudyGoalsCard() {
    const streak = useApp((s) => s.streak);
    const target = 6;
    const progress = Math.min(streak, target);
    return (_jsxs(Card, { title: "Study Goals", icon: _jsx(FlagIcon, { size: 18 }), className: "goal-card", children: [_jsxs("div", { className: "goal-row", children: [_jsx("span", { className: "goal-name", children: "Weekly Goal" }), _jsxs("span", { className: "goal-progress", children: [progress, " of ", target, " days"] })] }), _jsx("div", { className: "goal-bar", children: _jsx("span", { style: { width: `${(progress / target) * 100}%` } }) }), _jsx("p", { className: "goal-encourage", children: "Keep going! You've got this." }), _jsx("button", { type: "button", className: "goal-button", children: "View Goals" })] }));
}
/* ---- Level / XP -------------------------------------------------- */
const XP_PER_LEVEL = 250;
function levelFromXp(xp) {
    const level = Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
    const floor = (level - 1) * XP_PER_LEVEL;
    const ceiling = level * XP_PER_LEVEL;
    return { level, floor, ceiling };
}
function LevelCard() {
    const xpToday = useApp((s) => s.xpToday);
    const [lifetime, setLifetime] = useState(0);
    useEffect(() => {
        let cancelled = false;
        void totalXp().then((t) => {
            if (!cancelled)
                setLifetime(t);
        });
        return () => {
            cancelled = true;
        };
    }, [xpToday]);
    const { level, floor, ceiling } = levelFromXp(lifetime);
    const intoLevel = lifetime - floor;
    const span = ceiling - floor;
    const pct = Math.max(0, Math.min(1, intoLevel / span));
    return (_jsxs(Card, { className: "level-card", children: [_jsxs("div", { className: "level-top", children: [_jsx("span", { className: "badge", children: _jsx(TrophyIcon, { size: 14 }) }), _jsxs("div", { className: "level-text", children: [_jsxs("span", { className: "l1", children: ["Level ", level] }), _jsx("span", { className: "l2", children: "Study Goat" })] })] }), _jsxs("div", { className: "xp-row", children: [_jsx("span", { className: "label", children: "XP" }), _jsxs("span", { className: "val", children: [lifetime.toLocaleString(), " / ", ceiling.toLocaleString()] })] }), _jsx("div", { className: "level-bar", children: _jsx("span", { style: { width: `${pct * 100}%` } }) }), _jsxs("div", { className: "level-foot", children: [span - intoLevel, " XP to level ", level + 1] })] }));
}
/* ---- Upcoming Deadlines ------------------------------------------ */
function UpcomingDeadlinesCard() {
    const tasks = useUpcomingTasks(14);
    const setView = useApp((s) => s.setView);
    const focusedClassId = useApp((s) => s.focusedClassId);
    const subtitle = focusedClassId ? "Filtered to focus class" : undefined;
    return (_jsxs(Card, { title: "Upcoming Deadlines", children: [subtitle && _jsx("span", { className: "card-subtitle", children: subtitle }), tasks.length === 0 ? (_jsx("p", { className: "right-empty", children: focusedClassId
                    ? "No deadlines for the focused class."
                    : "No deadlines in the next two weeks." })) : (_jsx("div", { className: "deadlines", children: tasks.slice(0, 4).map((t, i) => {
                    const d = new Date(t.scheduled_for);
                    const left = daysUntil(d);
                    const color = ACCENTS[i % ACCENTS.length];
                    return (_jsxs("div", { className: "deadline-row", children: [_jsx("span", { className: "bar", style: { background: color } }), _jsxs("div", { className: "who", children: [_jsx("span", { className: "title", children: t.title }), _jsx("span", { className: "when", children: fmtDeadline(d) })] }), _jsx("span", { className: "days", children: describeDaysLeft(left) })] }, t.id));
                }) })), _jsx("button", { type: "button", className: "deadline-link", onClick: () => setView({ kind: "calendar" }), children: "View all deadlines \u2192" })] }));
}
/* ---- Mini calendar ----------------------------------------------- */
function MiniCalendarCard() {
    const today = new Date();
    const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const tasks = useUpcomingTasks(60);
    const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
    const eventDays = useMemo(() => new Set(tasks.map((t) => new Date(t.scheduled_for).toDateString())), [tasks]);
    function shift(delta) {
        const next = new Date(cursor);
        next.setMonth(next.getMonth() + delta);
        setCursor(next);
    }
    return (_jsxs(Card, { icon: _jsx(CalendarIcon, { size: 16 }), title: "Calendar", className: "mini-cal-card", children: [_jsxs("div", { className: "mini-cal-head", children: [_jsx("span", { className: "mini-month", children: cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }) }), _jsxs("div", { className: "mini-nav", children: [_jsx("button", { type: "button", "aria-label": "Previous month", onClick: () => shift(-1), children: _jsx(ChevLeftIcon, { size: 14 }) }), _jsx("button", { type: "button", "aria-label": "Next month", onClick: () => shift(1), children: _jsx(ChevRightIcon, { size: 14 }) })] })] }), _jsxs("div", { className: "mini-cal-grid", children: [["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (_jsx("span", { className: "dow", children: d }, i))), grid.map(({ date, inMonth }) => {
                        const isToday = date.toDateString() === today.toDateString();
                        const hasEvt = eventDays.has(date.toDateString());
                        const cls = ["day"];
                        if (!inMonth)
                            cls.push("outside");
                        if (isToday)
                            cls.push("today");
                        if (hasEvt)
                            cls.push("has-event");
                        return (_jsx("span", { className: cls.join(" "), children: date.getDate() }, date.toISOString()));
                    })] })] }));
}
function buildMonthGrid(monthStart) {
    const m = monthStart.getMonth();
    const y = monthStart.getFullYear();
    const first = new Date(y, m, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const out = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        out.push({ date: d, inMonth: d.getMonth() === m });
    }
    return out;
}
/* ---- Study Timer ------------------------------------------------- */
const MODE_LABELS = {
    focus: "Focus",
    shortBreak: "Short break",
    longBreak: "Long break",
};
const SettingsIcon = (props) => (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", ...props, children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" })] }));
/** Now-ms hook that re-renders every `intervalMs` while active. */
function useNow(active, intervalMs = 1000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active)
            return;
        const id = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(id);
    }, [active, intervalMs]);
    return now;
}
function fmtMinSec(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
function StudyTimerCard() {
    const timer = useApp((s) => s.activeTimer);
    const setTimer = useApp((s) => s.setActiveTimer);
    const [mode, setMode] = useState(timer?.mode ?? "focus");
    const [durations, setDurationsState] = useState(() => getTimerDurations());
    const [settingsOpen, setSettingsOpen] = useState(false);
    // While idle, let the user pre-select a task so the new session starts
    // already linked instead of needing two clicks.
    const [pendingTaskId, setPendingTaskId] = useState(null);
    const running = !!timer && timer.pausedRemainingMs === null;
    const isPaused = !!timer && timer.pausedRemainingMs !== null;
    const now = useNow(running, 250);
    // Mirror the active timer's mode into the local UI mode.
    useEffect(() => {
        if (timer)
            setMode(timer.mode);
    }, [timer]);
    function persistDurations(next) {
        setDurationsState(next);
        saveTimerDurations(next);
    }
    const previewMs = durations[mode] * 60_000;
    const remainingMs = (() => {
        if (!timer)
            return previewMs;
        if (timer.pausedRemainingMs !== null)
            return timer.pausedRemainingMs;
        return Math.max(0, timer.endsAt - now);
    })();
    const pct = (() => {
        const dur = timer?.durationMs ?? previewMs;
        if (dur <= 0)
            return 0;
        if (!timer)
            return 0; // idle ring stays empty for a clean look
        return 1 - Math.max(0, Math.min(1, remainingMs / dur));
    })();
    // Award XP once when a focus session naturally finishes.
    const completedRef = useRef(false);
    useEffect(() => {
        if (!timer || timer.pausedRemainingMs !== null) {
            completedRef.current = false;
            return;
        }
        if (now >= timer.endsAt && !completedRef.current) {
            completedRef.current = true;
            const wasFocus = timer.mode === "focus";
            setTimer(null);
            if (wasFocus)
                void recordXp("studyTimerComplete", XP_RULES.studyTaskComplete);
        }
    }, [now, timer, setTimer]);
    function start() {
        const dur = durations[mode] * 60_000;
        setTimer({
            mode,
            endsAt: Date.now() + dur,
            durationMs: dur,
            pausedRemainingMs: null,
            taskId: pendingTaskId,
        });
    }
    function pause() {
        if (!timer || timer.pausedRemainingMs !== null)
            return;
        setTimer({
            ...timer,
            pausedRemainingMs: Math.max(0, timer.endsAt - Date.now()),
        });
    }
    function resume() {
        if (!timer || timer.pausedRemainingMs === null)
            return;
        setTimer({
            ...timer,
            endsAt: Date.now() + timer.pausedRemainingMs,
            pausedRemainingMs: null,
        });
    }
    function stop() {
        setTimer(null);
    }
    function reset() {
        if (!timer)
            return;
        const dur = timer.durationMs;
        setTimer({
            ...timer,
            endsAt: Date.now() + dur,
            pausedRemainingMs: null,
        });
    }
    const subLabel = isPaused
        ? "Paused"
        : timer
            ? MODE_LABELS[timer.mode]
            : MODE_LABELS[mode];
    return (_jsx(Card, { className: "timer-card", icon: _jsx(ClockIcon, { size: 16 }), title: "Study Timer", action: _jsx("button", { type: "button", className: "header-action", "aria-label": "Timer settings", "aria-expanded": settingsOpen, onClick: () => setSettingsOpen((v) => !v), children: _jsx(SettingsIcon, {}) }), children: settingsOpen ? (_jsx(TimerSettings, { durations: durations, onChange: persistDurations, onClose: () => setSettingsOpen(false) })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "timer-modes", role: "tablist", "aria-label": "Timer mode", children: Object.keys(MODE_LABELS).map((m) => (_jsxs("button", { type: "button", role: "tab", "aria-selected": mode === m, className: `timer-mode${mode === m ? " active" : ""}`, onClick: () => {
                            if (running)
                                return;
                            setMode(m);
                        }, disabled: running, title: `${MODE_LABELS[m]} — ${durations[m]} min`, children: [_jsx("span", { className: "timer-mode-label", children: MODE_LABELS[m] }), _jsxs("span", { className: "timer-mode-mins", children: [durations[m], "m"] })] }, m))) }), _jsx(TimerRing, { pct: pct, label: fmtMinSec(remainingMs), sub: subLabel, state: running ? "running" : isPaused ? "paused" : "idle" }), _jsxs("div", { className: "timer-actions", children: [!timer && (_jsxs("button", { type: "button", className: "btn-primary timer-start", onClick: start, children: ["Start ", durations[mode], "-min ", MODE_LABELS[mode].toLowerCase()] })), timer && !isPaused && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: pause, children: "Pause" }), _jsx("button", { type: "button", className: "btn-ghost", onClick: reset, title: "Restart from full duration", children: "Reset" }), _jsx("button", { type: "button", className: "btn-ghost", onClick: stop, children: "Stop" })] })), timer && isPaused && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "btn-primary timer-start", onClick: resume, children: "Resume" }), _jsx("button", { type: "button", className: "btn-ghost", onClick: stop, children: "Stop" })] }))] }), _jsx(TaskBinder, { pendingTaskId: pendingTaskId, setPendingTaskId: setPendingTaskId })] })) }));
}
/** Inline ring rendered with two circles (track + progress). */
const TimerRing = ({ pct, label, sub, state }) => {
    const r = 44;
    const c = 2 * Math.PI * r;
    return (_jsxs("div", { className: `timer-ring is-${state}`, children: [_jsxs("svg", { viewBox: "0 0 110 110", width: 128, height: 128, "aria-hidden": true, children: [_jsx("circle", { cx: "55", cy: "55", r: r, fill: "none", stroke: "var(--color-surfaceMuted)", strokeWidth: "8" }), _jsx("circle", { cx: "55", cy: "55", r: r, fill: "none", stroke: "var(--color-primary)", strokeWidth: "8", strokeLinecap: "round", strokeDasharray: c, strokeDashoffset: c * (1 - pct), transform: "rotate(-90 55 55)", style: { transition: "stroke-dashoffset 240ms linear" } })] }), _jsxs("div", { className: "timer-center", children: [_jsx("span", { className: "timer-time", children: label }), _jsx("span", { className: "timer-sub", children: sub })] })] }));
};
/** Settings popover for editing the per-mode durations. */
const TimerSettings = ({ durations, onChange, onClose }) => {
    const [draft, setDraft] = useState(durations);
    function set(field, value) {
        const n = parseInt(value, 10);
        if (Number.isNaN(n))
            return;
        setDraft((d) => ({ ...d, [field]: Math.min(TIMER_BOUNDS.max, Math.max(TIMER_BOUNDS.min, n)) }));
    }
    function save() {
        onChange(draft);
        onClose();
    }
    function reset() {
        setDraft({ ...DEFAULT_TIMER_DURATIONS });
    }
    return (_jsxs("div", { className: "timer-settings", children: [_jsx("p", { className: "card-subtitle muted", style: { margin: 0 }, children: "Custom durations (minutes)" }), Object.keys(MODE_LABELS).map((m) => (_jsxs("label", { className: "timer-settings-row", children: [_jsx("span", { className: "timer-settings-label", children: MODE_LABELS[m] }), _jsx("input", { type: "number", className: "field", min: TIMER_BOUNDS.min, max: TIMER_BOUNDS.max, value: draft[m], onChange: (e) => set(m, e.target.value) })] }, m))), _jsxs("div", { className: "timer-settings-actions", children: [_jsx("button", { type: "button", className: "btn-ghost", onClick: reset, children: "Reset" }), _jsx("button", { type: "button", className: "btn-secondary", onClick: onClose, children: "Cancel" }), _jsx("button", { type: "button", className: "btn-primary", onClick: save, children: "Save" })] })] }));
};
/** Optional task picker. Pre-Start, edits a local pending id; mid-session,
 *  edits the live timer's `taskId` so re-binding works without restart. */
const TaskBinder = ({ pendingTaskId, setPendingTaskId }) => {
    const timer = useApp((s) => s.activeTimer);
    const setTimer = useApp((s) => s.setActiveTimer);
    const tasks = useUpcomingTasks(7);
    if (tasks.length === 0)
        return null;
    const value = timer ? timer.taskId ?? "" : pendingTaskId ?? "";
    return (_jsxs("label", { className: "timer-task", children: [_jsx("span", { className: "timer-task-label", children: "For task" }), _jsxs("select", { className: "field", value: value, onChange: (e) => {
                    const id = e.target.value || null;
                    if (timer)
                        setTimer({ ...timer, taskId: id });
                    else
                        setPendingTaskId(id);
                }, children: [_jsx("option", { value: "", children: "\u2014 none \u2014" }), tasks.map((t) => (_jsx("option", { value: t.id, children: t.title }, t.id)))] })] }));
};
/* ---- Due Flashcards --------------------------------------------- */
function DueFlashcardsCard() {
    const setView = useApp((s) => s.setView);
    const [count, setCount] = useState(0);
    const [decks, setDecks] = useState([]);
    useEffect(() => {
        let cancelled = false;
        void Promise.all([listDueFlashcards(200), listFlashcardSets(null)]).then(([due, sets]) => {
            if (cancelled)
                return;
            setCount(due.length);
            const bySet = new Map();
            for (const c of due)
                bySet.set(c.set_id, (bySet.get(c.set_id) ?? 0) + 1);
            const ranked = sets
                .map((s) => ({ id: s.id, title: s.title, due: bySet.get(s.id) ?? 0 }))
                .filter((s) => s.due > 0)
                .sort((a, b) => b.due - a.due)
                .slice(0, 3);
            setDecks(ranked);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return (_jsxs(Card, { title: "Flashcards Due", icon: _jsx(FlashcardIcon, { size: 16 }), className: "flashdue-card", children: [_jsxs("div", { className: "flashdue-top", children: [_jsx("span", { className: "flashdue-count", children: count }), _jsx("span", { className: "flashdue-unit", children: "cards due" })] }), decks.length > 0 ? (_jsx("div", { className: "flashdue-decks", children: decks.map((d) => (_jsxs("button", { type: "button", className: "flashdue-deck", onClick: () => setView({ kind: "flashcardSet", setId: d.id }), children: [_jsx("span", { className: "flashdue-deck-title", children: d.title }), _jsx("span", { className: "flashdue-deck-count", children: d.due })] }, d.id))) })) : (_jsx("p", { className: "right-empty", children: "No decks have due cards. Create some flashcards from a note." })), _jsx("button", { type: "button", className: "btn-primary", disabled: count === 0, onClick: () => setView({ kind: "flashcards" }), children: "Review now" })] }));
}
/* ---- Today's Plan ----------------------------------------------- */
function TodaysPlanCard() {
    const setView = useApp((s) => s.setView);
    const focusedClassId = useApp((s) => s.focusedClassId);
    const [tasks, setTasks] = useState([]);
    const [reloadTick, setReloadTick] = useState(0);
    const [classMap, setClassMap] = useState(new Map());
    useEffect(() => {
        let cancelled = false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        void Promise.all([
            listTasksForRange(today.toISOString(), tomorrow.toISOString()),
            focusedClassId ? listNotes(null) : Promise.resolve([]),
        ]).then(([rows, notes]) => {
            if (cancelled)
                return;
            setTasks(rows.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
            const m = new Map();
            for (const n of notes)
                m.set(n.id, n.class_id);
            setClassMap(m);
        });
        return () => {
            cancelled = true;
        };
    }, [reloadTick, focusedClassId]);
    const visible = focusedClassId
        ? tasks.filter((t) => t.note_id && classMap.get(t.note_id) === focusedClassId)
        : tasks;
    async function toggle(t) {
        const wasComplete = !!t.completed_at;
        await upsertStudyTask({
            ...t,
            completed_at: wasComplete ? null : new Date().toISOString(),
        });
        if (!wasComplete)
            await recordXp("studyTaskComplete", XP_RULES.studyTaskComplete);
        setReloadTick((n) => n + 1);
    }
    return (_jsxs(Card, { title: "Today's Plan", icon: _jsx(CheckIcon, { size: 16 }), className: "today-plan-card", children: [visible.length === 0 ? (_jsx("p", { className: "right-empty", children: "Nothing scheduled today." })) : (_jsx("div", { className: "plan-list compact", children: visible.map((t) => {
                    const done = !!t.completed_at;
                    return (_jsxs("div", { className: `plan-row ${done ? "done" : ""}`, children: [_jsx("button", { type: "button", className: `plan-check ${done ? "done" : ""}`, "aria-label": done ? "Mark task incomplete" : "Mark task complete", onClick: () => void toggle(t), children: done && _jsx(CheckIcon, { size: 12 }) }), _jsx("span", { className: "plan-title", children: t.title }), _jsx("span", { className: "plan-time", children: fmtTimeOfDay(t.scheduled_for) })] }, t.id));
                }) })), _jsxs("button", { type: "button", className: "plan-link", onClick: () => setView({ kind: "calendar" }), children: ["Full schedule ", _jsx(ArrowRightIcon, { size: 12 })] })] }));
}
/* ---- Quick Capture ---------------------------------------------- */
function QuickCaptureCard() {
    const setView = useApp((s) => s.setView);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(null);
    async function addTask() {
        const title = text.trim();
        if (!title)
            return;
        setBusy("task");
        try {
            const today = new Date();
            today.setHours(9, 0, 0, 0);
            await upsertStudyTask({
                id: ulid("tsk"),
                type: "review",
                title,
                scheduled_for: today.toISOString(),
                duration_minutes: 25,
            });
            await recordXp("createNote", 1);
            setText("");
        }
        finally {
            setBusy(null);
        }
    }
    async function addNote() {
        const title = text.trim();
        if (!title)
            return;
        setBusy("note");
        try {
            const note = await upsertNote({ title, content_markdown: "" });
            setSelectedNote(note);
            setView({ kind: "note", noteId: note.id });
            await recordXp("createNote", XP_RULES.createNote);
            setText("");
        }
        finally {
            setBusy(null);
        }
    }
    return (_jsxs(Card, { title: "Quick Capture", icon: _jsx(PlusIcon, { size: 16 }), className: "capture-card", children: [_jsx("input", { className: "field", placeholder: "What's on your mind?", value: text, onChange: (e) => setText(e.target.value), onKeyDown: (e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void addTask();
                    }
                }, disabled: busy !== null }), _jsxs("div", { className: "capture-actions", children: [_jsx("button", { type: "button", className: "btn-secondary", disabled: !text.trim() || busy !== null, onClick: () => void addTask(), children: busy === "task" ? "Adding…" : "Add task" }), _jsx("button", { type: "button", className: "btn-primary", disabled: !text.trim() || busy !== null, onClick: () => void addNote(), children: busy === "note" ? "Opening…" : "New note" })] })] }));
}
/* ---- AI Quick Prompts ------------------------------------------- */
function AiQuickPromptsCard() {
    const sidecarLoaded = useApp((s) => s.sidecarLoaded);
    const setView = useApp((s) => s.setView);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const [recent, setRecent] = useState(null);
    useEffect(() => {
        let cancelled = false;
        void listNotes(null).then((ns) => {
            if (!cancelled)
                setRecent(ns[0] ?? null);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    function openLastNote() {
        if (!recent)
            return;
        setSelectedNote(recent);
        setView({ kind: "note", noteId: recent.id });
    }
    return (_jsxs(Card, { title: "AI Shortcuts", icon: _jsx(SparklesIcon, { size: 16 }), className: "ai-card", children: [!sidecarLoaded && (_jsx("p", { className: "card-subtitle muted", children: "The learning assistant is still starting. Try again in a moment." })), _jsxs("div", { className: "ai-actions", children: [_jsx("button", { type: "button", className: "btn-secondary", disabled: !recent, onClick: openLastNote, children: "Summarize last note" }), _jsx("button", { type: "button", className: "btn-secondary", onClick: () => setView({ kind: "calendar" }), children: "Plan with AI" }), _jsx("button", { type: "button", className: "btn-secondary", onClick: () => setView({ kind: "quizzes" }), children: "Quiz me" })] })] }));
}
/* ---- Streak Heatmap --------------------------------------------- */
const HEATMAP_WEEKS = 12;
function StreakHeatmapCard() {
    const xpToday = useApp((s) => s.xpToday);
    const [byDay, setByDay] = useState(new Map());
    const [streak, setStreak] = useState(0);
    useEffect(() => {
        let cancelled = false;
        void Promise.all([xpByDay(HEATMAP_WEEKS * 7), currentStreak()]).then(([rows, s]) => {
            if (cancelled)
                return;
            const m = new Map();
            for (const r of rows)
                m.set(r.date, r.points);
            setByDay(m);
            setStreak(s);
        });
        return () => {
            cancelled = true;
        };
    }, [xpToday]);
    const cells = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // End on Saturday of this week so the grid lines up neatly.
        const end = new Date(today);
        end.setDate(end.getDate() + (6 - end.getDay()));
        const out = [];
        for (let i = HEATMAP_WEEKS * 7 - 1; i >= 0; i--) {
            const d = new Date(end);
            d.setDate(end.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const pts = byDay.get(key) ?? 0;
            const level = pts === 0 ? 0 : pts < 10 ? 1 : pts < 25 ? 2 : pts < 50 ? 3 : 4;
            out.push({ date: d, level, points: pts });
        }
        return out;
    }, [byDay]);
    const total = useMemo(() => Array.from(byDay.values()).reduce((a, b) => a + b, 0), [byDay]);
    return (_jsxs(Card, { title: "Activity Heatmap", icon: _jsx(FlameIcon, { size: 16 }), className: "heatmap-card", children: [_jsxs("div", { className: "heatmap-stats", children: [_jsxs("div", { children: [_jsx("span", { className: "hm-num", children: streak }), _jsx("span", { className: "hm-lbl", children: "day streak" })] }), _jsxs("div", { children: [_jsx("span", { className: "hm-num", children: total.toLocaleString() }), _jsx("span", { className: "hm-lbl", children: "XP last 12w" })] })] }), _jsx("div", { className: "heatmap-grid", role: "img", "aria-label": `Activity heatmap, ${streak} day streak`, children: cells.map((c) => (_jsx("span", { className: `hm-cell hm-l${c.level}`, title: `${c.date.toLocaleDateString()} — ${c.points} XP` }, c.date.toISOString()))) }), _jsxs("div", { className: "heatmap-legend", children: [_jsx("span", { children: "Less" }), [0, 1, 2, 3, 4].map((l) => (_jsx("span", { className: `hm-cell hm-l${l}` }, l))), _jsx("span", { children: "More" })] })] }));
}
/* ---- Class Filter ----------------------------------------------- */
function ClassFilterCard() {
    const focusedClassId = useApp((s) => s.focusedClassId);
    const setFocusedClass = useApp((s) => s.setFocusedClass);
    const classesInStore = useApp((s) => s.classes);
    const [classes, setClasses] = useState(classesInStore);
    useEffect(() => {
        if (classesInStore.length > 0) {
            setClasses(classesInStore);
            return;
        }
        let cancelled = false;
        void listClasses().then((rows) => {
            if (!cancelled)
                setClasses(rows);
        });
        return () => {
            cancelled = true;
        };
    }, [classesInStore]);
    return (_jsxs(Card, { title: "Focus Class", icon: _jsx(ClassIcon, { size: 16 }), className: "class-filter-card", children: [classes.length === 0 ? (_jsx("p", { className: "right-empty", children: "No classes yet. Add one from the Classes page." })) : (_jsxs("div", { className: "class-chip-row", children: [_jsx("button", { type: "button", className: `class-chip${focusedClassId === null ? " active" : ""}`, onClick: () => setFocusedClass(null), children: "All" }), classes.map((c) => (_jsx("button", { type: "button", className: `class-chip${focusedClassId === c.id ? " active" : ""}`, style: focusedClassId === c.id && c.color
                            ? { background: c.color, borderColor: c.color, color: "var(--color-onPrimary)" }
                            : undefined, onClick: () => setFocusedClass(c.id), children: c.name }, c.id)))] })), focusedClassId && (_jsx("p", { className: "card-subtitle muted", children: "Deadlines, calendar and Today's Plan are filtered." }))] }));
}
const AddWidgetSkeleton = ({ inactive, onAdd }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const menuRef = useRef(null);
    // Remember the panel's scrollTop at the moment we open the menu so we
    // can smoothly slide back up after the user closes it.
    const restoreScroll = useRef(null);
    /** Walk up to find the `.right-panel` aside, which is the scroll container. */
    function getScroller() {
        return wrapRef.current?.closest(".right-panel");
    }
    // When the menu opens, scroll the panel just enough to show the full
    // popover. When it closes, slide back to where the user was.
    useEffect(() => {
        const scroller = getScroller();
        if (!scroller)
            return;
        if (open) {
            restoreScroll.current = scroller.scrollTop;
            // Wait a frame so the menu has actually been rendered and has a
            // measurable height before we compute the scroll target.
            const id = requestAnimationFrame(() => {
                const menu = menuRef.current;
                if (!menu)
                    return;
                const menuBottom = menu.getBoundingClientRect().bottom;
                const scrollerBottom = scroller.getBoundingClientRect().bottom;
                const overflow = menuBottom - scrollerBottom;
                if (overflow > 0) {
                    scroller.scrollTo({
                        top: scroller.scrollTop + overflow + 12, // 12px breathing room
                        behavior: "smooth",
                    });
                }
            });
            return () => cancelAnimationFrame(id);
        }
        // Closing — restore prior scroll position if we have one.
        if (restoreScroll.current !== null) {
            scroller.scrollTo({ top: restoreScroll.current, behavior: "smooth" });
            restoreScroll.current = null;
        }
        return undefined;
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        function onDoc(e) {
            if (!wrapRef.current?.contains(e.target))
                setOpen(false);
        }
        function onKey(e) {
            if (e.key === "Escape")
                setOpen(false);
        }
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);
    const empty = inactive.length === 0;
    return (_jsxs("div", { className: "add-widget", ref: wrapRef, children: [_jsxs("button", { type: "button", className: "add-widget-card", onClick: () => !empty && setOpen((v) => !v), "aria-haspopup": "menu", "aria-expanded": open, disabled: empty, children: [_jsx("span", { className: "add-widget-icon", children: _jsx(PlusIcon, { size: 18 }) }), _jsxs("span", { className: "add-widget-text", children: [_jsx("span", { className: "add-widget-title", children: empty ? "All modules added" : "Add a module" }), _jsx("span", { className: "add-widget-sub", children: empty
                                    ? "Use Edit to remove or reorder modules."
                                    : "Customize what shows in this panel." })] })] }), open && !empty && (_jsx("div", { className: "add-widget-menu", role: "menu", ref: menuRef, children: inactive.map((id) => {
                    const Icon = WIDGET_ICONS[id];
                    return (_jsxs("button", { type: "button", role: "menuitem", className: "add-widget-item", onClick: () => {
                            setOpen(false);
                            onAdd(id);
                        }, children: [_jsxs("span", { className: "add-widget-item-row", children: [_jsx("span", { className: "add-widget-item-icon", children: _jsx(Icon, { size: 14 }) }), _jsx("span", { className: "add-widget-item-title", children: WIDGET_LABELS[id] })] }), _jsx("span", { className: "add-widget-item-sub", children: WIDGET_DESCRIPTIONS[id] })] }, id));
                }) }))] }));
};
//# sourceMappingURL=RightPanel.js.map