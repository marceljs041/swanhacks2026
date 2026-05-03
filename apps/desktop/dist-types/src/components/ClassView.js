import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { POINTS_RULES, XP_RULES } from "@studynest/shared";
import { ai } from "../lib/ai.js";
import { BRAND_CLASS_HERO_URL } from "../lib/brand.js";
import { enqueueQuizGeneration } from "../lib/quizGenerationQueue.js";
import { computeProgress, deriveSubtitle, progressLabel, progressTone, shortDate, toneFor, } from "../lib/classDisplay.js";
import { classActivityWeek, classAggregates, flashcardSetsForClass, listClasses, listFlashcards, listNotes, nextExamByClass, nextTaskByClass, quizStatsForClass, quizzesForClass, recordRewardPoints, recordXp, tasksForClass, upsertFlashcard, upsertFlashcardSet, upsertNote, upsertClass, upsertQuiz, upsertQuizQuestion, upsertStudyTask, weakTopicsForClass, } from "../db/repositories.js";
import { useApp } from "../store.js";
import { HeroSearch } from "./HeroSearch.js";
import { ArrowLeftIcon, CalendarIcon, CheckIcon, ChevRightIcon, ClockIcon, FileIcon, FlashcardIcon, GraduationCapIcon, PlusIcon, QuizIcon, SparklesIcon, } from "./icons.js";
const TABS = [
    { id: "overview", label: "Overview" },
    { id: "notes", label: "Notes" },
    { id: "flashcards", label: "Flashcards" },
    { id: "quizzes", label: "Quizzes" },
    { id: "studyPlan", label: "Study Plan" },
];
const MAX_OVERVIEW_NOTES = 48;
const MAX_OVERVIEW_CHARS_PER_NOTE = 1400;
function truncateForClassOverviewBody(text, max) {
    const t = text.trim();
    if (t.length <= max)
        return t;
    return `${t.slice(0, max)}\n\n[truncated]`;
}
function notesPayloadForOverview(notes) {
    return notes.slice(0, MAX_OVERVIEW_NOTES).map((n) => ({
        note_id: n.id,
        title: n.title,
        summary: n.summary,
        content: truncateForClassOverviewBody(n.content_markdown, MAX_OVERVIEW_CHARS_PER_NOTE),
    }));
}
/* ================================================================== */
/* Top-level                                                          */
/* ================================================================== */
export const ClassView = ({ classId }) => {
    const setView = useApp((s) => s.setView);
    const setSelectedClass = useApp((s) => s.setSelectedClass);
    const setFocusedClass = useApp((s) => s.setFocusedClass);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const [tab, setTab] = useState("overview");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [missing, setMissing] = useState(false);
    const [aiBusy, setAiBusy] = useState(null);
    const [toast, setToast] = useState(null);
    const reload = useCallback(async () => {
        const all = await listClasses();
        const cls = all.find((c) => c.id === classId);
        if (!cls) {
            setMissing(true);
            setLoading(false);
            return;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const inAWeek = new Date(today);
        inAWeek.setDate(today.getDate() + 7);
        const inAMonth = new Date(today);
        inAMonth.setDate(today.getDate() + 30);
        const [aggMap, notes, sets, quizzes, weak, weekTasks, upcoming, nextTaskMap, examMap, qStats, activity,] = await Promise.all([
            classAggregates(),
            listNotes(classId),
            flashcardSetsForClass(classId),
            quizzesForClass(classId),
            weakTopicsForClass(classId, 6),
            tasksForClass(classId, today.toISOString(), inAWeek.toISOString()),
            tasksForClass(classId, today.toISOString(), inAMonth.toISOString()),
            nextTaskByClass(),
            nextExamByClass(),
            quizStatsForClass(classId),
            classActivityWeek(classId),
        ]);
        setData({
            cls,
            agg: aggMap.get(classId) ?? {
                notes: 0,
                flashcards: 0,
                quizzes: 0,
                totalTasks: 0,
                completedTasks: 0,
            },
            notes,
            flashcardSets: sets,
            quizzes,
            weakTopics: weak,
            weekTasks,
            upcoming,
            nextTask: nextTaskMap.get(classId) ?? null,
            examInDays: examMap.get(classId)?.days ?? null,
            quizStats: qStats,
            activity,
        });
        setLoading(false);
    }, [classId]);
    useEffect(() => {
        setLoading(true);
        setMissing(false);
        void reload();
    }, [reload]);
    // Toast auto-dismiss.
    useEffect(() => {
        if (!toast)
            return;
        const t = window.setTimeout(() => setToast(null), 3200);
        return () => window.clearTimeout(t);
    }, [toast]);
    // ---- nav helpers -------------------------------------------------
    const goBack = useCallback(() => {
        setView({ kind: "classes" });
    }, [setView]);
    const goAsk = useCallback(() => {
        setView({ kind: "classAsk", classId });
    }, [classId, setView]);
    const openNote = useCallback((n) => {
        setSelectedNote(n);
        setView({ kind: "note", noteId: n.id });
    }, [setSelectedNote, setView]);
    const newNote = useCallback(async () => {
        setSelectedClass(classId);
        setFocusedClass(classId);
        const note = await upsertNote({
            title: "Untitled",
            content_markdown: "",
            class_id: classId,
        });
        await recordXp("createNote", XP_RULES.createNote);
        setSelectedNote(note);
        setView({ kind: "note", noteId: note.id });
    }, [classId, setFocusedClass, setSelectedClass, setSelectedNote, setView]);
    // ---- AI tools ----------------------------------------------------
    const runSummarize = useCallback(async () => {
        if (!data)
            return;
        const target = data.notes.find((n) => !n.summary || n.summary.trim() === "") ??
            data.notes[0];
        if (!target) {
            setToast(`Add a note to ${data.cls.name} first.`);
            return;
        }
        setAiBusy("summarize");
        try {
            const res = await ai.summarize({
                note_id: target.id,
                title: target.title,
                content: target.content_markdown,
            });
            await upsertNote({ ...target, summary: res.summary });
            setToast(`Summary saved for “${target.title}”.`);
            await reload();
        }
        catch {
            setToast("The assistant isn’t responding right now. Try again in a moment.");
        }
        finally {
            setAiBusy(null);
        }
    }, [data, reload]);
    const runMakeQuiz = useCallback(async () => {
        if (!data)
            return;
        const target = data.notes[0];
        if (!target) {
            setToast(`Add a note to ${data.cls.name} first.`);
            return;
        }
        setAiBusy("quiz");
        try {
            await enqueueQuizGeneration(`Class quiz: ${data.cls.name}`, async () => {
                const res = await ai.quiz({
                    note_id: target.id,
                    title: target.title,
                    content: target.content_markdown,
                });
                const quiz = await upsertQuiz({
                    title: `${data.cls.name} review`,
                    note_id: target.id,
                    class_id: data.cls.id,
                    description: `Exam review generated from “${target.title}”.`,
                    source_type: "class",
                    source_ids_json: JSON.stringify(data.notes.map((n) => n.id)),
                    tags_json: JSON.stringify(["Exam Review", "Class"]),
                });
                let position = 0;
                for (const q of res.questions) {
                    await upsertQuizQuestion({
                        quiz_id: quiz.id,
                        type: q.type,
                        question: q.question,
                        options_json: q.type === "multiple_choice" ? JSON.stringify(q.options) : null,
                        correct_answer: String(q.answer),
                        explanation: q.explanation ?? null,
                        source_note_id: target.id,
                        position: position++,
                    });
                }
            });
            setToast(`Exam review created from “${target.title}”.`);
            await reload();
        }
        catch {
            setToast("The assistant isn’t responding right now. Try again in a moment.");
        }
        finally {
            setAiBusy(null);
        }
    }, [data, reload]);
    const runStudyPlan = useCallback(() => {
        if (!data)
            return;
        // Anchor the focus filter so the resulting study plan and the
        // existing right-panel widgets (Today's Plan, Upcoming Deadlines)
        // are scoped to this class.
        setFocusedClass(classId);
        setView({ kind: "calendar" });
        // Defer opening the generator until after the calendar mounts
        // so the modal renders on top of the new view rather than the
        // current ClassView.
        queueMicrotask(() => {
            useApp.getState().setCalendarPlanGeneratorOpen(true);
        });
    }, [classId, data, setFocusedClass, setView]);
    const runRegenerateOverview = useCallback(async () => {
        if (!data)
            return;
        if (!data.notes.length) {
            setToast(`Add at least one note to ${data.cls.name} first.`);
            return;
        }
        setAiBusy("overview");
        try {
            const res = await ai.classOverview({
                class_name: data.cls.name,
                class_subtitle: deriveSubtitle(data.cls),
                notes: notesPayloadForOverview(data.notes),
            });
            const overview = res.overview.trim();
            if (!overview) {
                setToast("Couldn't generate an overview. Try again.");
                return;
            }
            await upsertClass({ ...data.cls, overview_text: overview });
            setToast("Class overview updated.");
            await reload();
        }
        catch {
            setToast("The assistant isn’t responding right now. Try again in a moment.");
        }
        finally {
            setAiBusy(null);
        }
    }, [data, reload]);
    const runMakeFlashcards = useCallback(async () => {
        if (!data)
            return;
        const target = data.notes[0];
        if (!target) {
            setToast(`Add a note to ${data.cls.name} first.`);
            return;
        }
        setAiBusy("flashcards");
        try {
            const res = await ai.flashcards({
                note_id: target.id,
                title: target.title,
                content: target.content_markdown,
            });
            const set = await upsertFlashcardSet({
                title: `${data.cls.name} cards`,
                note_id: target.id,
            });
            for (const c of res.cards) {
                await upsertFlashcard({ set_id: set.id, front: c.front, back: c.back });
            }
            await recordXp("generateFlashcards", XP_RULES.generateFlashcards);
            setToast(`${res.cards.length} flashcards added to ${data.cls.name}.`);
            await reload();
        }
        catch {
            setToast("The assistant isn’t responding right now. Try again in a moment.");
        }
        finally {
            setAiBusy(null);
        }
    }, [data, reload]);
    // ---- render ------------------------------------------------------
    if (missing) {
        return (_jsx("main", { className: "main", children: _jsxs("div", { className: "main-inner", children: [_jsxs("button", { type: "button", className: "crumb-back", onClick: goBack, children: [_jsx(ArrowLeftIcon, { size: 14 }), " Back to Classes"] }), _jsxs("section", { className: "classes-empty", children: [_jsx("span", { className: "classes-empty-icon", "aria-hidden": true, children: _jsx(GraduationCapIcon, { size: 28 }) }), _jsx("h2", { children: "Class not found" }), _jsx("p", { children: "It may have been removed or hasn't synced to this device yet." })] })] }) }));
    }
    if (loading || !data) {
        return (_jsx("main", { className: "main", children: _jsxs("div", { className: "main-inner", children: [_jsx(ClassViewHeroSkeleton, {}), _jsx("section", { className: "stat-row", "aria-hidden": true, children: [0, 1, 2, 3].map((i) => (_jsx("div", { className: "stat-card skeleton" }, i))) })] }) }));
    }
    const tone = toneFor(data.cls);
    const subtitle = deriveSubtitle(data.cls);
    const progress = computeProgress(data.agg);
    const pTone = progressTone(progress, data.agg);
    const pLabel = progressLabel(progress, data.agg);
    return (_jsxs("main", { className: "main", children: [_jsxs("div", { className: "main-inner", children: [_jsx(ClassHero, { cls: data.cls, tone: tone, subtitle: subtitle, examInDays: data.examInDays, progressLabel: pLabel, progressTone: pTone, onBack: goBack }), _jsx(ClassKpiRow, { notes: data.agg.notes, flashcards: data.agg.flashcards, quizzes: data.agg.quizzes, examInDays: data.examInDays }), _jsx(ClassTabs, { current: tab, onChange: setTab }), tab === "overview" && (_jsx(OverviewTab, { data: data, tone: tone, progress: progress, progressLabel: pLabel, progressTone: pTone, aiBusy: aiBusy, onOpenNote: openNote, onViewAllNotes: () => setTab("notes"), onSummarize: () => void runSummarize(), onMakeQuiz: () => void runMakeQuiz(), onMakeFlashcards: () => void runMakeFlashcards(), onStudyPlan: runStudyPlan, onAsk: goAsk, onRegenerateOverview: () => void runRegenerateOverview(), onCheckTask: async (t) => {
                            await upsertStudyTask({
                                ...t,
                                completed_at: t.completed_at
                                    ? null
                                    : new Date().toISOString(),
                            });
                            if (!t.completed_at) {
                                await recordXp("studyTaskComplete", XP_RULES.studyTaskComplete);
                                await recordRewardPoints("finishStudyTask", POINTS_RULES.finishStudyTask);
                            }
                            await reload();
                        } })), tab === "notes" && (_jsx(NotesTab, { cls: data.cls, notes: data.notes, onOpen: openNote, onNew: () => void newNote() })), tab === "flashcards" && (_jsx(FlashcardsTab, { cls: data.cls, sets: data.flashcardSets, onOpen: (setId) => setView({ kind: "flashcardSet", setId }), onMake: () => void runMakeFlashcards(), busy: aiBusy === "flashcards" })), tab === "quizzes" && (_jsx(QuizzesTab, { cls: data.cls, quizzes: data.quizzes, stats: data.quizStats, onOpen: (quizId) => setView({ kind: "quiz", quizId }), onMake: () => void runMakeQuiz(), busy: aiBusy === "quiz" })), tab === "studyPlan" && (_jsx(StudyPlanTab, { cls: data.cls, tasks: data.upcoming, onCheck: async (t) => {
                            await upsertStudyTask({
                                ...t,
                                completed_at: t.completed_at ? null : new Date().toISOString(),
                            });
                            if (!t.completed_at) {
                                await recordXp("studyTaskComplete", XP_RULES.studyTaskComplete);
                                await recordRewardPoints("finishStudyTask", POINTS_RULES.finishStudyTask);
                            }
                            await reload();
                        }, onPlan: runStudyPlan }))] }), toast && (_jsx("div", { className: "classes-toast", role: "status", "aria-live": "polite", children: toast }))] }));
};
/* ================================================================== */
/* Hero (search + breadcrumbs + headline + pills + illustration)      */
/* ================================================================== */
const ClassHero = ({ cls, tone, subtitle, examInDays, progressLabel, progressTone, onBack }) => {
    return (_jsxs("section", { className: "hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(HeroSearch, {}), _jsx(Breadcrumbs, { trail: [
                            { label: "Classes", onClick: onBack },
                            { label: cls.name },
                        ] }), _jsxs("div", { className: "hero-greeting classview-hero-text", children: [_jsx("h1", { className: "hero-headline", children: cls.name }), _jsx("p", { children: subtitle ?? "Course" }), _jsxs("div", { className: "classview-pill-row", children: [_jsx("span", { className: `classview-pill tone-${tone}`, children: "Lecture" }), examInDays !== null && (_jsx("span", { className: `classview-pill tone-${examInDays <= 3 ? "danger" : "amber"}`, children: examInDays <= 0 ? "Exam today" : `Exam in ${examInDays}d` })), _jsx("span", { className: `classview-pill tone-${progressTone === "warning" ? "warning" : "success"}`, children: progressLabel })] })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_CLASS_HERO_URL, alt: "", decoding: "async" }) })] }));
};
const ClassViewHeroSkeleton = () => (_jsx("section", { className: "hero", "aria-hidden": true, children: _jsxs("div", { className: "hero-main", children: [_jsx("div", { className: "search skeleton-bar", style: { height: 36 } }), _jsxs("div", { className: "hero-greeting", children: [_jsx("div", { className: "skeleton-bar", style: { width: 220, height: 32 } }), _jsx("div", { className: "skeleton-bar", style: { width: 280, height: 14 } })] })] }) }));
export const Breadcrumbs = ({ trail }) => (_jsx("nav", { className: "crumbs", "aria-label": "Breadcrumb", children: trail.map((c, i) => {
        const isLast = i === trail.length - 1;
        return (_jsxs("span", { className: "crumb-item", children: [!isLast && c.onClick ? (_jsx("button", { type: "button", className: "crumb crumb-link", onClick: c.onClick, children: c.label })) : (_jsx("span", { className: `crumb${isLast ? " crumb-current" : ""}`, children: c.label })), !isLast && (_jsx("span", { className: "crumb-sep", "aria-hidden": true, children: "/" }))] }, `${c.label}-${i}`));
    }) }));
/* ================================================================== */
/* KPI stat row                                                       */
/* ================================================================== */
const ClassKpiRow = ({ notes, flashcards, quizzes, examInDays }) => (_jsxs("section", { className: "stat-row", "aria-label": "Class metrics", children: [_jsx(KpiCard, { icon: _jsx(FileIcon, { size: 18 }), tone: "sky", number: notes.toString(), label: "Notes" }), _jsx(KpiCard, { icon: _jsx(FlashcardIcon, { size: 18 }), tone: "sage", number: flashcards.toString(), label: "Flashcards" }), _jsx(KpiCard, { icon: _jsx(QuizIcon, { size: 18 }), tone: "lilac", number: quizzes.toString(), label: "Quizzes" }), _jsx(KpiCard, { icon: _jsx(CalendarIcon, { size: 18 }), tone: "peach", number: examInDays === null ? "—" : `${examInDays}d`, label: examInDays === null ? "No exam set" : "Exam in" })] }));
const KpiCard = ({ icon, tone, number, label }) => (_jsxs("div", { className: "stat-card", children: [_jsx("span", { className: `stat-icon tone-${tone}`, "aria-hidden": true, children: icon }), _jsxs("div", { className: "stat-text", children: [_jsx("span", { className: "stat-number", children: number }), _jsx("span", { className: "stat-label", children: label })] })] }));
/* ================================================================== */
/* Tabs                                                               */
/* ================================================================== */
const ClassTabs = ({ current, onChange, }) => (_jsx("div", { className: "classview-tabs", role: "tablist", "aria-label": "Class sections", children: TABS.map((t) => (_jsx("button", { type: "button", role: "tab", "aria-selected": current === t.id, className: `classview-tab${current === t.id ? " is-active" : ""}`, onClick: () => onChange(t.id), children: t.label }, t.id))) }));
const OverviewTab = ({ data, tone, progress, progressLabel, progressTone, aiBusy, onOpenNote, onViewAllNotes, onSummarize, onMakeQuiz, onMakeFlashcards, onStudyPlan, onAsk, onRegenerateOverview, onCheckTask, }) => {
    const description = useMemo(() => {
        const saved = data.cls.overview_text?.trim();
        if (saved)
            return saved;
        const summary = data.notes.find((n) => n.summary && n.summary.trim().length > 0)?.summary;
        return (summary ??
            deriveSubtitle(data.cls) ??
            "Track every note, flashcard, and quiz you create for this course in one workspace. Open notes to add new study material or generate AI study tools below.");
    }, [data]);
    const upcoming = useMemo(() => data.weekTasks.filter((t) => !t.completed_at).slice(0, 4), [data.weekTasks]);
    const recentNotes = data.notes.slice(0, 4);
    return (_jsxs("div", { className: "classview-overview", children: [_jsxs("section", { className: "classview-row classview-row--two", children: [_jsxs("article", { className: "classview-card", children: [_jsxs("div", { className: "classview-card-head", children: [_jsx("span", { className: `classview-head-icon tone-${tone}`, "aria-hidden": true, children: _jsx(BookIconAlt, {}) }), _jsx("h3", { children: "Class Overview" }), _jsxs("button", { type: "button", className: "classview-overview-regenerate", onClick: onRegenerateOverview, disabled: !!aiBusy || data.notes.length === 0, title: "Regenerate a short AI overview from all notes in this class", children: [_jsx(SparklesIcon, { size: 14, "aria-hidden": true }), aiBusy === "overview" ? "Generating…" : "Regenerate"] })] }), _jsx("p", { className: "classview-card-body", children: description }), _jsxs("div", { className: "classview-progress", children: [_jsxs("div", { className: "classview-progress-row", children: [_jsx("span", { className: `progress-label tone-${progressTone}`, children: "Study Progress" }), _jsxs("span", { className: "progress-value", children: [progress, "%"] })] }), _jsx("div", { className: "progress-bar", children: _jsx("span", { className: `progress-fill tone-${tone}`, style: { width: `${Math.max(0, Math.min(100, progress))}%` } }) }), _jsxs("div", { className: "classview-progress-foot", children: [_jsx(CalendarIcon, { size: 13 }), _jsx("span", { children: data.nextTask
                                                    ? `Next milestone: ${data.nextTask.title}`
                                                    : `Status: ${progressLabel}` })] })] })] }), _jsxs("article", { className: "classview-card", children: [_jsxs("div", { className: "classview-card-head", children: [_jsx("span", { className: "classview-head-icon tone-sky", "aria-hidden": true, children: _jsx(FileIcon, { size: 16 }) }), _jsx("h3", { children: "Recent Notes" }), _jsx("button", { type: "button", className: "classview-card-link", onClick: onViewAllNotes, children: "View all" })] }), recentNotes.length === 0 ? (_jsx("p", { className: "classview-empty", children: "No notes yet \u2014 open the Notes tab to create your first one." })) : (_jsx("ul", { className: "classview-note-list", children: recentNotes.map((n) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "classview-note-row", onClick: () => onOpenNote(n), children: [_jsx("span", { className: "classview-note-icon", "aria-hidden": true, children: _jsx(FileIcon, { size: 14 }) }), _jsx("span", { className: "classview-note-title", children: n.title || "Untitled" }), _jsx("span", { className: "classview-note-date", children: shortDate(n.updated_at) })] }) }, n.id))) }))] })] }), _jsxs("section", { className: "classview-row classview-row--three", children: [_jsxs("article", { className: "classview-card", children: [_jsxs("div", { className: "classview-card-head", children: [_jsx("span", { className: "classview-head-icon tone-amber", "aria-hidden": true, children: _jsx(ClockIcon, { size: 16 }) }), _jsx("h3", { children: "Upcoming Work" })] }), upcoming.length === 0 ? (_jsx("p", { className: "classview-empty", children: "Nothing scheduled this week. Generate a plan with AI below." })) : (_jsx("ul", { className: "classview-task-list", children: upcoming.map((t) => (_jsxs("li", { className: "classview-task-row", children: [_jsx("button", { type: "button", className: `plan-check${t.completed_at ? " done" : ""}`, "aria-label": t.completed_at
                                                ? "Mark task incomplete"
                                                : "Mark task complete", onClick: () => void onCheckTask(t), children: t.completed_at && _jsx(CheckIcon, { size: 11 }) }), _jsx("span", { className: "classview-task-title", children: t.title }), _jsx("span", { className: "classview-task-when", children: dueDayLabel(t.scheduled_for) })] }, t.id))) }))] }), _jsxs("article", { className: "classview-card", children: [_jsxs("div", { className: "classview-card-head", children: [_jsx("span", { className: "classview-head-icon tone-peach", "aria-hidden": true, children: _jsx(SparklesIcon, { size: 16 }) }), _jsx("h3", { children: "Weak Topics" })] }), data.weakTopics.length === 0 ? (_jsx("p", { className: "classview-empty", children: "Rate flashcards as \u201Chard\u201D to surface them as weak topics here." })) : (_jsx("div", { className: "weak-topic-row classview-weak-row", children: data.weakTopics.map((t) => (_jsx("span", { className: "weak-topic", children: t }, t))) }))] }), _jsxs("article", { className: "classview-card", children: [_jsxs("div", { className: "classview-card-head", children: [_jsx("span", { className: "classview-head-icon tone-lilac", "aria-hidden": true, children: _jsx(SparklesIcon, { size: 16 }) }), _jsx("h3", { children: "Study Tools" })] }), _jsxs("div", { className: "classview-tools-grid", children: [_jsx(ToolButton, { tone: "sky", icon: _jsx(SparklesIcon, { size: 14 }), label: "Summarize Class", busy: aiBusy === "summarize", onClick: onSummarize }), _jsx(ToolButton, { tone: "sage", icon: _jsx(CheckIcon, { size: 14 }), label: "Make Exam Review", busy: aiBusy === "quiz", onClick: onMakeQuiz }), _jsx(ToolButton, { tone: "amber", icon: _jsx(FlashcardIcon, { size: 14 }), label: "Generate Flashcards", busy: aiBusy === "flashcards", onClick: onMakeFlashcards }), _jsx(ToolButton, { tone: "lilac", icon: _jsx(CalendarIcon, { size: 14 }), label: "Generate Study Plan", onClick: onStudyPlan }), _jsx(ToolButton, { tone: "peach", icon: _jsx(SparklesIcon, { size: 14 }), label: "Ask This Class", onClick: onAsk, wide: true })] })] })] }), _jsxs("section", { className: "classview-card classview-activity-card", children: [_jsxs("div", { className: "classview-card-head", children: [_jsx("span", { className: "classview-head-icon tone-sage", "aria-hidden": true, children: _jsx(ClockIcon, { size: 16 }) }), _jsx("h3", { children: "Class Activity" }), _jsx("span", { className: "classview-card-sub", children: "Study Progress This Week" })] }), _jsxs("div", { className: "classview-activity-grid", children: [_jsx(ActivityChart, { days: data.activity }), _jsxs("div", { className: "classview-activity-stats", children: [_jsx(ActivityStat, { icon: _jsx(FileIcon, { size: 14 }), tone: "sky", number: sumKey(data.activity, "notesUpdated").toString(), label: "Notes Reviewed", trend: trendPct(data.activity, "notesUpdated") }), _jsx(ActivityStat, { icon: _jsx(FlashcardIcon, { size: 14 }), tone: "sage", number: sumKey(data.activity, "flashcardsReviewed").toString(), label: "Flashcards Done", trend: trendPct(data.activity, "flashcardsReviewed") }), _jsx(ActivityStat, { icon: _jsx(QuizIcon, { size: 14 }), tone: "amber", number: data.quizStats.taken === 0 ? "—" : `${data.quizStats.avgPct}%`, label: "Quiz Accuracy", trend: data.quizStats.taken === 0 ? null : data.quizStats.best - data.quizStats.avgPct })] })] })] })] }));
};
/* ---- activity chart ---------------------------------------------- */
const ActivityChart = ({ days }) => {
    const max = Math.max(1, ...days.map((d) => d.total));
    return (_jsx("div", { className: "classview-bar-chart", role: "img", "aria-label": "Activity per day", children: days.map((d, i) => {
            const h = Math.round((d.total / max) * 100);
            const tone = i % 2 === 0 ? "sage" : "lilac";
            return (_jsxs("div", { className: "classview-bar-col", children: [_jsx("span", { className: `classview-bar tone-${tone}`, style: { height: `${Math.max(6, h)}%` }, title: `${d.date}: ${d.total} actions` }), _jsx("span", { className: "classview-bar-label", children: dayLetter(d.date) })] }, d.date));
        }) }));
};
const ActivityStat = ({ icon, tone, number, label, trend }) => (_jsxs("div", { className: "stat-card classview-activity-stat", children: [_jsx("span", { className: `stat-icon tone-${tone}`, "aria-hidden": true, children: icon }), _jsxs("div", { className: "stat-text", children: [_jsx("span", { className: "stat-number", children: number }), _jsx("span", { className: "stat-label", children: label })] }), trend !== null && (_jsxs("span", { className: `classview-trend ${trend >= 0 ? "trend-up" : "trend-down"}`, children: [trend >= 0 ? "↑" : "↓", " ", Math.abs(Math.round(trend)), "%"] }))] }));
/* ---- tool button ------------------------------------------------- */
const ToolButton = ({ tone, icon, label, busy, wide, onClick }) => (_jsxs("button", { type: "button", className: `ai-action tone-${tone}${wide ? " classview-tool--wide" : ""}`, onClick: onClick, disabled: busy, "aria-busy": busy ? true : undefined, children: [_jsx("span", { className: "ai-action-icon", "aria-hidden": true, children: icon }), _jsx("span", { className: "ai-action-label", children: busy ? "Working…" : label }), _jsx("span", { className: "ai-action-chev", "aria-hidden": true, children: _jsx(ChevRightIcon, { size: 14 }) })] }));
/* ================================================================== */
/* Notes tab                                                          */
/* ================================================================== */
const NotesTab = ({ cls, notes, onOpen, onNew }) => (_jsxs("section", { className: "classview-tab-panel", children: [_jsxs("div", { className: "classview-tab-toolbar", children: [_jsxs("div", { children: [_jsxs("h2", { className: "classview-section-title", children: ["Notes for ", cls.name] }), _jsxs("p", { className: "classview-section-sub", children: [notes.length, " note", notes.length === 1 ? "" : "s", " in this class"] })] }), _jsxs("button", { type: "button", className: "btn-primary", onClick: onNew, children: [_jsx(PlusIcon, { size: 14 }), " New Note"] })] }), notes.length === 0 ? (_jsx(EmptyTabState, { icon: _jsx(FileIcon, { size: 22 }), title: "No notes yet", body: "Create your first note to start building your library for this class.", cta: "New Note", onCta: onNew })) : (_jsx("ul", { className: "classview-note-grid", children: notes.map((n) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "classview-note-card", onClick: () => onOpen(n), children: [_jsx("span", { className: "classview-note-card-icon", children: _jsx(FileIcon, { size: 16 }) }), _jsxs("div", { className: "classview-note-card-body", children: [_jsx("span", { className: "classview-note-card-title", children: n.title || "Untitled" }), n.summary && (_jsx("span", { className: "classview-note-card-summary", children: n.summary.slice(0, 140) })), _jsxs("span", { className: "classview-note-card-meta", children: ["Edited ", shortDate(n.updated_at)] })] }), _jsx(ChevRightIcon, { size: 14 })] }) }, n.id))) }))] }));
/* ================================================================== */
/* Flashcards tab                                                     */
/* ================================================================== */
const FlashcardsTab = ({ cls, sets, onOpen, onMake, busy }) => {
    const [counts, setCounts] = useState({});
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const map = {};
            await Promise.all(sets.map(async (s) => {
                const cards = await listFlashcards(s.id);
                map[s.id] = cards.length;
            }));
            if (!cancelled)
                setCounts(map);
        })();
        return () => {
            cancelled = true;
        };
    }, [sets]);
    return (_jsxs("section", { className: "classview-tab-panel", children: [_jsxs("div", { className: "classview-tab-toolbar", children: [_jsxs("div", { children: [_jsxs("h2", { className: "classview-section-title", children: ["Flashcards for ", cls.name] }), _jsxs("p", { className: "classview-section-sub", children: [sets.length, " deck", sets.length === 1 ? "" : "s", " from your notes"] })] }), _jsxs("button", { type: "button", className: "btn-primary", onClick: onMake, disabled: busy, children: [_jsx(SparklesIcon, { size: 14 }), " ", busy ? "Working…" : "Generate with AI"] })] }), sets.length === 0 ? (_jsx(EmptyTabState, { icon: _jsx(FlashcardIcon, { size: 22 }), title: "No flashcard decks yet", body: "Generate a deck from any note in this class \u2014 we'll spaced-repeat them for you.", cta: "Generate with AI", onCta: onMake, ctaDisabled: busy })) : (_jsx("ul", { className: "classview-deck-grid", children: sets.map((s) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "classview-deck-card", onClick: () => onOpen(s.id), children: [_jsx("span", { className: "classview-deck-icon tone-sage", children: _jsx(FlashcardIcon, { size: 16 }) }), _jsxs("div", { className: "classview-deck-body", children: [_jsx("span", { className: "classview-deck-title", children: s.title }), _jsxs("span", { className: "classview-deck-meta", children: [(counts[s.id] ?? 0), " card", counts[s.id] === 1 ? "" : "s", " \u00B7 created", " ", shortDate(s.created_at)] })] }), _jsxs("span", { className: "classview-deck-cta", children: ["Review ", _jsx(ChevRightIcon, { size: 14 })] })] }) }, s.id))) }))] }));
};
/* ================================================================== */
/* Quizzes tab                                                        */
/* ================================================================== */
const QuizzesTab = ({ cls, quizzes, stats, onOpen, onMake, busy }) => (_jsxs("section", { className: "classview-tab-panel", children: [_jsxs("div", { className: "classview-tab-toolbar", children: [_jsxs("div", { children: [_jsxs("h2", { className: "classview-section-title", children: ["Quizzes for ", cls.name] }), _jsx("p", { className: "classview-section-sub", children: stats.taken === 0
                                ? "No attempts yet"
                                : `Average ${stats.avgPct}% across ${stats.taken} attempts` })] }), _jsxs("button", { type: "button", className: "btn-primary", onClick: onMake, disabled: busy, children: [_jsx(SparklesIcon, { size: 14 }), " ", busy ? "Working…" : "Make Exam Review"] })] }), quizzes.length === 0 ? (_jsx(EmptyTabState, { icon: _jsx(QuizIcon, { size: 22 }), title: "No quizzes yet", body: "Generate a quick quiz from any note in this class to test your knowledge.", cta: "Make Exam Review", onCta: onMake, ctaDisabled: busy })) : (_jsx("ul", { className: "classview-quiz-grid", children: quizzes.map((q) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "classview-quiz-card", onClick: () => onOpen(q.id), children: [_jsx("span", { className: "classview-deck-icon tone-amber", children: _jsx(QuizIcon, { size: 16 }) }), _jsxs("div", { className: "classview-deck-body", children: [_jsx("span", { className: "classview-deck-title", children: q.title }), _jsxs("span", { className: "classview-deck-meta", children: ["Created ", shortDate(q.created_at)] })] }), _jsxs("span", { className: "classview-deck-cta", children: ["Take quiz ", _jsx(ChevRightIcon, { size: 14 })] })] }) }, q.id))) }))] }));
/* ================================================================== */
/* Study Plan tab                                                     */
/* ================================================================== */
const StudyPlanTab = ({ cls, tasks, onCheck, onPlan }) => {
    const grouped = useMemo(() => groupByDay(tasks), [tasks]);
    return (_jsxs("section", { className: "classview-tab-panel", children: [_jsxs("div", { className: "classview-tab-toolbar", children: [_jsxs("div", { children: [_jsxs("h2", { className: "classview-section-title", children: ["Study Plan for ", cls.name] }), _jsx("p", { className: "classview-section-sub", children: tasks.length === 0
                                    ? "Nothing scheduled in the next 30 days"
                                    : `${tasks.length} task${tasks.length === 1 ? "" : "s"} ahead` })] }), _jsxs("button", { type: "button", className: "btn-primary", onClick: onPlan, children: [_jsx(CalendarIcon, { size: 14 }), " Plan with AI"] })] }), grouped.length === 0 ? (_jsx(EmptyTabState, { icon: _jsx(CalendarIcon, { size: 22 }), title: "No tasks scheduled", body: "Generate a daily plan that builds toward your next exam.", cta: "Plan with AI", onCta: onPlan })) : (_jsx("div", { className: "classview-plan-list", children: grouped.map(([day, items]) => (_jsxs("article", { className: "classview-plan-day", children: [_jsxs("header", { className: "classview-plan-day-head", children: [_jsx("span", { className: "classview-plan-day-name", children: dayHeading(day) }), _jsxs("span", { className: "classview-plan-day-count", children: [items.length, " task", items.length === 1 ? "" : "s"] })] }), _jsx("ul", { className: "classview-task-list", children: items.map((t) => (_jsxs("li", { className: "classview-task-row", children: [_jsx("button", { type: "button", className: `plan-check${t.completed_at ? " done" : ""}`, "aria-label": t.completed_at
                                            ? "Mark task incomplete"
                                            : "Mark task complete", onClick: () => void onCheck(t), children: t.completed_at && _jsx(CheckIcon, { size: 11 }) }), _jsx("span", { className: "classview-task-title", children: t.title }), _jsx("span", { className: "classview-task-when", children: timeOfDay(t.scheduled_for) })] }, t.id))) })] }, day))) }))] }));
};
/* ================================================================== */
/* Empty state                                                        */
/* ================================================================== */
const EmptyTabState = ({ icon, title, body, cta, onCta, ctaDisabled }) => (_jsxs("section", { className: "classview-empty-tab", children: [_jsx("span", { className: "classview-empty-icon", "aria-hidden": true, children: icon }), _jsx("h3", { children: title }), _jsx("p", { children: body }), _jsx("button", { type: "button", className: "btn-primary", onClick: onCta, disabled: ctaDisabled, children: cta })] }));
/* ================================================================== */
/* Helpers                                                            */
/* ================================================================== */
function dueDayLabel(iso) {
    const d = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    if (diff <= 0)
        return "Today";
    if (diff === 1)
        return "Tomorrow";
    if (diff < 7)
        return d.toLocaleDateString(undefined, { weekday: "long" });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function timeOfDay(iso) {
    return new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}
function dayLetter(iso) {
    const d = new Date(`${iso}T00:00:00`);
    return d
        .toLocaleDateString(undefined, { weekday: "short" })
        .slice(0, 1)
        .toUpperCase();
}
function dayHeading(iso) {
    const d = new Date(`${iso}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    if (diff === 0)
        return "Today";
    if (diff === 1)
        return "Tomorrow";
    if (diff > 1 && diff < 7)
        return d.toLocaleDateString(undefined, { weekday: "long" });
    return d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
}
function groupByDay(tasks) {
    const map = new Map();
    for (const t of tasks) {
        const key = t.scheduled_for.slice(0, 10);
        let arr = map.get(key);
        if (!arr) {
            arr = [];
            map.set(key, arr);
        }
        arr.push(t);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}
function sumKey(days, key) {
    let total = 0;
    for (const d of days)
        total += Number(d[key] ?? 0);
    return total;
}
function trendPct(days, key) {
    if (days.length < 2)
        return 0;
    const half = Math.floor(days.length / 2);
    let early = 0;
    let late = 0;
    for (let i = 0; i < half; i++)
        early += Number(days[i][key] ?? 0);
    for (let i = half; i < days.length; i++)
        late += Number(days[i][key] ?? 0);
    if (early === 0)
        return late > 0 ? 100 : 0;
    return Math.round(((late - early) / early) * 100);
}
/* Tiny inline glyph used as a tone-aware Overview header icon (book). */
const BookIconAlt = () => (_jsxs("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z" }), _jsx("path", { d: "M8 7h7M8 11h7M8 15h5" })] }));
//# sourceMappingURL=ClassView.js.map