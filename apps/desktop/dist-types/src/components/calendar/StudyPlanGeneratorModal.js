import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../store.js";
import { ai } from "../../lib/ai.js";
import { upsertEvent } from "../../db/calendar.js";
import { listClasses, listFlashcardSets, listNotes, listQuizzes, upsertStudyPlan, } from "../../db/repositories.js";
import { ArrowLeftIcon, ArrowRightIcon, SparklesIcon, TrashIcon, XIcon, } from "../icons.js";
import { labelForType } from "./eventVisuals.js";
const STRATEGY_LABELS = {
    balanced: "Balanced",
    weak_topics_first: "Weak topics first",
    cram_prep: "Cram prep",
    review_first: "Review first",
};
const STRATEGY_GOALS = {
    balanced: "Spread review evenly across notes, flashcards, and a practice quiz.",
    weak_topics_first: "Strategy: prioritize weak topics first, then layer review.",
    cram_prep: "Strategy: cram prep — pack the last days before the exam with high-density review and a final practice quiz.",
    review_first: "Strategy: review notes first, then introduce flashcards, finishing with a practice quiz.",
};
export const StudyPlanGeneratorModal = () => {
    const open = useApp((s) => s.calendarPlanGeneratorOpen);
    const setOpen = useApp((s) => s.setCalendarPlanGeneratorOpen);
    const setSelected = useApp((s) => s.setCalendarSelectedEvent);
    const sidecarLoaded = useApp((s) => s.sidecarLoaded);
    const [step, setStep] = useState("configure");
    const [classes, setClasses] = useState([]);
    const [notes, setNotes] = useState([]);
    const [decks, setDecks] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [classId, setClassId] = useState("");
    const [examDate, setExamDate] = useState("");
    const [startDate, setStartDate] = useState(todayIso());
    const [endDate, setEndDate] = useState(plusDaysIso(7));
    const [dailyMinutes, setDailyMinutes] = useState(60);
    const [strategy, setStrategy] = useState("balanced");
    const [selectedNoteIds, setSelectedNoteIds] = useState([]);
    const [selectedDeckIds, setSelectedDeckIds] = useState([]);
    const [selectedQuizIds, setSelectedQuizIds] = useState([]);
    const [includeReview, setIncludeReview] = useState(true);
    const [includeFlashcards, setIncludeFlashcards] = useState(true);
    const [includeQuiz, setIncludeQuiz] = useState(true);
    const [includeCram, setIncludeCram] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        void Promise.all([
            listClasses(),
            listNotes(null),
            listFlashcardSets(null),
            listQuizzes(null),
        ]).then(([cs, ns, ds, qs]) => {
            if (cancelled)
                return;
            setClasses(cs);
            setNotes(ns);
            setDecks(ds);
            setQuizzes(qs);
        });
        return () => {
            cancelled = true;
        };
    }, [open]);
    // Reset between opens.
    useEffect(() => {
        if (!open) {
            setStep("configure");
            setTasks([]);
            setError(null);
            setBusy(false);
        }
    }, [open]);
    const filteredNotes = useMemo(() => {
        if (!classId)
            return notes;
        return notes.filter((n) => n.class_id === classId);
    }, [notes, classId]);
    const filteredDecks = useMemo(() => {
        if (!classId)
            return decks;
        const noteIdsInClass = new Set(notes.filter((n) => n.class_id === classId).map((n) => n.id));
        return decks.filter((d) => !d.note_id || noteIdsInClass.has(d.note_id));
    }, [decks, classId, notes]);
    const filteredQuizzes = useMemo(() => {
        if (!classId)
            return quizzes;
        return quizzes.filter((q) => {
            if (q.class_id === classId)
                return true;
            const note = q.note_id ? notes.find((n) => n.id === q.note_id) : null;
            return note?.class_id === classId;
        });
    }, [quizzes, classId, notes]);
    function close() {
        if (busy)
            return;
        setOpen(false);
    }
    async function generate() {
        setBusy(true);
        setError(null);
        try {
            const cls = classes.find((c) => c.id === classId);
            const goalParts = [];
            goalParts.push(cls
                ? `Build a study plan for ${cls.name}.`
                : `Build a balanced study plan.`);
            goalParts.push(STRATEGY_GOALS[strategy]);
            const includes = [];
            if (includeReview)
                includes.push("review notes");
            if (includeFlashcards)
                includes.push("flashcards");
            if (includeQuiz)
                includes.push("practice quiz");
            if (includeCram)
                includes.push("final cram session");
            if (includes.length > 0)
                goalParts.push(`Include: ${includes.join(", ")}.`);
            goalParts.push(`Daily availability: ${dailyMinutes} minutes. Date range ${startDate} to ${endDate}.`);
            if (examDate)
                goalParts.push(`Exam date: ${examDate}.`);
            const sourceNotes = selectedNoteIds.length > 0
                ? notes.filter((n) => selectedNoteIds.includes(n.id))
                : filteredNotes.slice(0, 8);
            const days = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) /
                86_400_000 +
                1));
            const res = await ai.studyPlan({
                goal: goalParts.join(" "),
                exam_date: examDate || null,
                notes: sourceNotes.map((n) => ({
                    id: n.id,
                    title: n.title,
                    summary: n.summary,
                })),
                days_available: days,
            });
            const drafts = res.tasks.map((t, i) => ({
                id: `draft_${i}_${Date.now()}`,
                title: t.title,
                date: clampDate(t.scheduled_for, startDate, endDate),
                durationMinutes: t.duration_minutes,
                type: mapStudyType(t.type),
                note_id: t.note_id ?? null,
            }));
            setTasks(drafts);
            setStep("preview");
        }
        catch (e) {
            setError(sidecarLoaded
                ? e.message
                : "The learning assistant is still warming up. Try again in a moment.");
        }
        finally {
            setBusy(false);
        }
    }
    async function accept() {
        if (tasks.length === 0) {
            setOpen(false);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const cls = classes.find((c) => c.id === classId);
            const plan = await upsertStudyPlan({
                title: cls ? `${cls.name} study plan` : "AI study plan",
                class_id: classId || null,
                exam_date: examDate ? new Date(examDate).toISOString() : null,
            });
            let firstId = null;
            for (const t of tasks) {
                const startIso = composeIso(t.date, "09:00");
                const endIso = new Date(new Date(startIso).getTime() + t.durationMinutes * 60_000).toISOString();
                const ev = await upsertEvent({
                    title: t.title,
                    type: t.type,
                    class_id: classId || null,
                    note_id: t.note_id,
                    quiz_id: t.type === "quiz" && selectedQuizIds[0]
                        ? selectedQuizIds[0]
                        : null,
                    flashcard_set_id: t.type === "flashcards" && selectedDeckIds[0]
                        ? selectedDeckIds[0]
                        : null,
                    study_plan_id: plan.id,
                    start_at: startIso,
                    end_at: endIso,
                    source_type: "ai_generated",
                    color: "accentLilac",
                });
                if (!firstId)
                    firstId = ev.id;
            }
            if (firstId)
                setSelected(firstId);
            setOpen(false);
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    if (!open)
        return null;
    return (_jsx("div", { className: "plan-modal-scrim", role: "presentation", onClick: (e) => {
            if (e.target === e.currentTarget)
                close();
        }, children: _jsxs("div", { className: "plan-modal", role: "dialog", "aria-modal": "true", "aria-label": "Build study plan", children: [_jsxs("header", { className: "plan-modal-head", children: [_jsxs("div", { className: "plan-modal-head-title", children: [_jsx("span", { className: "plan-modal-icon", "aria-hidden": true, children: _jsx(SparklesIcon, { size: 16 }) }), _jsx("h2", { children: "Build study plan" })] }), _jsx("button", { type: "button", className: "event-drawer-close", "aria-label": "Close", onClick: close, children: _jsx(XIcon, { size: 16 }) })] }), _jsxs("div", { className: "plan-modal-stepper", children: [_jsx("span", { className: `plan-step${step === "configure" ? " active" : ""}`, children: "1. Configure" }), _jsx("span", { className: "plan-step-sep" }), _jsx("span", { className: `plan-step${step === "preview" ? " active" : ""}`, children: "2. Preview" })] }), step === "configure" ? (_jsx(ConfigureStep, { classes: classes, classId: classId, setClassId: setClassId, examDate: examDate, setExamDate: setExamDate, startDate: startDate, setStartDate: setStartDate, endDate: endDate, setEndDate: setEndDate, dailyMinutes: dailyMinutes, setDailyMinutes: setDailyMinutes, strategy: strategy, setStrategy: setStrategy, filteredNotes: filteredNotes, filteredDecks: filteredDecks, filteredQuizzes: filteredQuizzes, selectedNoteIds: selectedNoteIds, setSelectedNoteIds: setSelectedNoteIds, selectedDeckIds: selectedDeckIds, setSelectedDeckIds: setSelectedDeckIds, selectedQuizIds: selectedQuizIds, setSelectedQuizIds: setSelectedQuizIds, includeReview: includeReview, setIncludeReview: setIncludeReview, includeFlashcards: includeFlashcards, setIncludeFlashcards: setIncludeFlashcards, includeQuiz: includeQuiz, setIncludeQuiz: setIncludeQuiz, includeCram: includeCram, setIncludeCram: setIncludeCram, sidecarLoaded: sidecarLoaded, error: error })) : (_jsx(PreviewStep, { tasks: tasks, setTasks: setTasks })), _jsx("footer", { className: "plan-modal-foot", children: step === "configure" ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "btn-ghost", onClick: close, disabled: busy, children: "Cancel" }), _jsxs("button", { type: "button", className: "btn-primary", onClick: () => void generate(), disabled: busy || !sidecarLoaded, children: [_jsx(SparklesIcon, { size: 14 }), busy ? "Generating…" : "Generate plan"] })] })) : (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "btn-secondary", onClick: () => setStep("configure"), disabled: busy, children: [_jsx(ArrowLeftIcon, { size: 12 }), " Back"] }), _jsxs("button", { type: "button", className: "btn-primary", onClick: () => void accept(), disabled: busy || tasks.length === 0, children: [busy ? "Adding…" : "Add to calendar", _jsx(ArrowRightIcon, { size: 12 })] })] })) })] }) }));
};
const ConfigureStep = (p) => (_jsxs("div", { className: "plan-modal-body", children: [!p.sidecarLoaded && (_jsx("p", { className: "pill warning", children: "The local AI assistant is still warming up. Generation will be enabled in a moment." })), _jsxs("div", { className: "plan-grid", children: [_jsx(Field, { label: "Class", children: _jsxs("select", { className: "field", value: p.classId, onChange: (e) => p.setClassId(e.target.value), children: [_jsx("option", { value: "", children: "Any class" }), p.classes.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))] }) }), _jsx(Field, { label: "Exam date", children: _jsx("input", { type: "date", className: "field", value: p.examDate, onChange: (e) => p.setExamDate(e.target.value) }) }), _jsx(Field, { label: "Start date", children: _jsx("input", { type: "date", className: "field", value: p.startDate, onChange: (e) => p.setStartDate(e.target.value) }) }), _jsx(Field, { label: "End date", children: _jsx("input", { type: "date", className: "field", value: p.endDate, onChange: (e) => p.setEndDate(e.target.value) }) })] }), _jsx(Field, { label: `Daily availability (${p.dailyMinutes} minutes)`, children: _jsx("input", { type: "range", min: 15, max: 180, step: 15, value: p.dailyMinutes, onChange: (e) => p.setDailyMinutes(parseInt(e.target.value, 10)) }) }), _jsx(Field, { label: "Strategy", children: _jsx("div", { className: "event-drawer-segments", children: Object.keys(STRATEGY_LABELS).map((s) => (_jsx("button", { type: "button", className: `event-drawer-segment${p.strategy === s ? " active" : ""}`, onClick: () => p.setStrategy(s), children: STRATEGY_LABELS[s] }, s))) }) }), _jsx(Field, { label: "Include", children: _jsxs("div", { className: "plan-includes", children: [_jsxs("label", { className: "event-drawer-toggle", children: [_jsx("input", { type: "checkbox", checked: p.includeReview, onChange: (e) => p.setIncludeReview(e.target.checked) }), "Review notes"] }), _jsxs("label", { className: "event-drawer-toggle", children: [_jsx("input", { type: "checkbox", checked: p.includeFlashcards, onChange: (e) => p.setIncludeFlashcards(e.target.checked) }), "Flashcards"] }), _jsxs("label", { className: "event-drawer-toggle", children: [_jsx("input", { type: "checkbox", checked: p.includeQuiz, onChange: (e) => p.setIncludeQuiz(e.target.checked) }), "Practice quiz"] }), _jsxs("label", { className: "event-drawer-toggle", children: [_jsx("input", { type: "checkbox", checked: p.includeCram, onChange: (e) => p.setIncludeCram(e.target.checked) }), "Cram session"] })] }) }), _jsxs("div", { className: "plan-source-grid", children: [_jsx(SourcePicker, { title: "Notes", items: p.filteredNotes.map((n) => ({ id: n.id, label: n.title })), selected: p.selectedNoteIds, onToggle: (id) => p.setSelectedNoteIds(toggle(p.selectedNoteIds, id)) }), _jsx(SourcePicker, { title: "Flashcard decks", items: p.filteredDecks.map((d) => ({ id: d.id, label: d.title })), selected: p.selectedDeckIds, onToggle: (id) => p.setSelectedDeckIds(toggle(p.selectedDeckIds, id)) }), _jsx(SourcePicker, { title: "Quizzes", items: p.filteredQuizzes.map((q) => ({ id: q.id, label: q.title })), selected: p.selectedQuizIds, onToggle: (id) => p.setSelectedQuizIds(toggle(p.selectedQuizIds, id)) })] }), p.error && _jsx("p", { className: "pill error", children: p.error })] }));
const PreviewStep = ({ tasks, setTasks }) => {
    const groups = useMemo(() => groupByDate(tasks), [tasks]);
    if (tasks.length === 0) {
        return (_jsx("div", { className: "plan-modal-body", children: _jsx("p", { className: "pill warning", children: "The assistant didn't return any tasks. Tweak the configuration and try again." }) }));
    }
    function patch(id, next) {
        setTasks(tasks.map((t) => (t.id === id ? { ...t, ...next } : t)));
    }
    function remove(id) {
        setTasks(tasks.filter((t) => t.id !== id));
    }
    return (_jsxs("div", { className: "plan-modal-body", children: [_jsx("p", { className: "plan-modal-help", children: "Tweak titles or remove tasks before adding them to your calendar." }), groups.map(({ date, items }) => (_jsxs("div", { className: "plan-day-group", children: [_jsxs("header", { className: "plan-day-head", children: [new Date(`${date}T09:00`).toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                            }), _jsxs("span", { className: "plan-day-count", children: [items.length, " task", items.length === 1 ? "" : "s"] })] }), _jsx("div", { className: "plan-day-list", children: items.map((t) => (_jsxs("div", { className: "plan-task-row", children: [_jsx("span", { className: "plan-task-tone", "data-tone": "lilac", "aria-hidden": true }), _jsx("input", { className: "field plan-task-title", value: t.title, onChange: (e) => patch(t.id, { title: e.target.value }) }), _jsx("input", { type: "number", min: 10, max: 240, step: 5, className: "field plan-task-duration", value: t.durationMinutes, onChange: (e) => patch(t.id, {
                                        durationMinutes: Math.max(5, parseInt(e.target.value, 10) || 30),
                                    }) }), _jsx("span", { className: "plan-task-type", children: labelForType(t.type) }), _jsx("button", { type: "button", className: "event-rail-task-remove", "aria-label": "Remove", onClick: () => remove(t.id), children: _jsx(TrashIcon, { size: 12 }) })] }, t.id))) })] }, date)))] }));
};
const SourcePicker = ({ title, items, selected, onToggle }) => (_jsxs("div", { className: "plan-source-card", children: [_jsx("header", { className: "plan-source-head", children: title }), items.length === 0 ? (_jsx("p", { className: "plan-source-empty", children: "None available." })) : (_jsx("ul", { className: "plan-source-list", children: items.slice(0, 12).map((it) => {
                const on = selected.includes(it.id);
                return (_jsx("li", { children: _jsxs("button", { type: "button", className: `plan-source-item${on ? " active" : ""}`, onClick: () => onToggle(it.id), children: [_jsx("span", { className: "plan-source-check", "aria-hidden": true, children: on ? "✓" : "" }), _jsx("span", { className: "plan-source-label", children: it.label })] }) }, it.id));
            }) }))] }));
const Field = ({ label, children, }) => (_jsxs("label", { className: "plan-field", children: [_jsx("span", { className: "plan-field-label", children: label }), children] }));
function todayIso() {
    return new Date().toISOString().slice(0, 10);
}
function plusDaysIso(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}
function clampDate(input, start, end) {
    let day = input.slice(0, 10);
    // The sidecar sometimes emits ISO timestamps; ensure we keep just the date.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        try {
            day = new Date(input).toISOString().slice(0, 10);
        }
        catch {
            day = start;
        }
    }
    if (day < start)
        return start;
    if (day > end)
        return end;
    return day;
}
function composeIso(date, time) {
    const [yy, mm, dd] = date.split("-").map((s) => parseInt(s, 10));
    const [h, m] = time.split(":").map((s) => parseInt(s, 10));
    const d = new Date(yy, (mm ?? 1) - 1, dd ?? 1, h ?? 9, m ?? 0, 0, 0);
    return d.toISOString();
}
function mapStudyType(t) {
    switch (t) {
        case "flashcards":
            return "flashcards";
        case "quiz":
            return "quiz";
        case "read":
            return "reading";
        case "write":
        case "practice":
            return "assignment";
        case "review":
        default:
            return "study_block";
    }
}
function toggle(arr, id) {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}
function groupByDate(tasks) {
    const m = new Map();
    for (const t of tasks) {
        const cur = m.get(t.date);
        if (cur)
            cur.push(t);
        else
            m.set(t.date, [t]);
    }
    return Array.from(m.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, items]) => ({ date, items }));
}
//# sourceMappingURL=StudyPlanGeneratorModal.js.map