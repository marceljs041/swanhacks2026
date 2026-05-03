import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ai } from "../lib/ai.js";
import { archiveClass as archiveClassDb, classAggregates, listClasses, listDueFlashcards, listNotes, nextExamByClass, nextTaskByClass, softDeleteClass, upsertClass, upsertNote, weakTopicsForClass, } from "../db/repositories.js";
import { useApp } from "../store.js";
import { BRAND_HERO_URL } from "../lib/brand.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { HeroSearch } from "./HeroSearch.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import { MoreMenu } from "./ui/MoreMenu.js";
import { RightPanel } from "./RightPanel.js";
import { ArchiveIcon, ArrowLeftIcon, AtomIcon, BeakerIcon, BookIcon, CalendarIcon, CheckIcon, ChevRightIcon, ClassIcon, ClockIcon, CloudCheckIcon, CloudOffIcon, FileIcon, FlashcardIcon, GlobeIcon, GraduationCapIcon, LeafIcon, PencilIcon, PillarIcon, PlusIcon, QuizIcon, SparklesIcon, TrashIcon, WarningIcon, } from "./icons.js";
const ALL_TONES = ["sage", "sky", "lilac", "amber", "peach"];
/* ================================================================== */
/* Top-level screen                                                   */
/* ================================================================== */
export const Classes = () => {
    const setView = useApp((s) => s.setView);
    const setSelectedClass = useApp((s) => s.setSelectedClass);
    const setFocusedClass = useApp((s) => s.setFocusedClass);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const setClassesDetailPanelOpen = useApp((s) => s.setClassesDetailPanelOpen);
    const selectClassPreview = useCallback((id) => {
        withViewTransition(() => {
            setSelectedId(id);
        });
    }, []);
    const classes = useApp((s) => s.classes);
    const setClasses = useApp((s) => s.setClasses);
    const syncStatus = useApp((s) => s.syncStatus);
    const [summaries, setSummaries] = useState([]);
    const [dueFlashcards, setDueFlashcards] = useState(0);
    const [loaded, setLoaded] = useState(false);
    // `selectedId` is the class whose detail panel is shown to the right.
    // `null` means "nothing previewed" — in that case we render the global
    // RightPanel so the user gets gamification/deadlines/etc. while still
    // browsing classes. We only auto-pick the first class on the very
    // first load, so the user's "Back" click sticks until they pick again.
    const [selectedId, setSelectedId] = useState(null);
    const [hasAutoSelected, setHasAutoSelected] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [renaming, setRenaming] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [aiBusy, setAiBusy] = useState(null);
    const [toast, setToast] = useState(null);
    const reload = useCallback(async () => {
        const cls = await listClasses();
        setClasses(cls);
        const [aggs, nextTasks, exams, due] = await Promise.all([
            classAggregates(),
            nextTaskByClass(),
            nextExamByClass(),
            listDueFlashcards(500),
        ]);
        setDueFlashcards(due.length);
        const today = Date.now();
        const builtBase = await Promise.all(cls.map(async (c) => {
            const agg = aggs.get(c.id) ?? EMPTY_AGG;
            const recent = (await listNotes(c.id)).slice(0, 3);
            const weak = await weakTopicsForClass(c.id, 3);
            const next = nextTasks.get(c.id) ?? null;
            const exam = exams.get(c.id) ?? null;
            return summariseClass(c, agg, recent, weak, next, exam, today);
        }));
        setSummaries(builtBase);
        setLoaded(true);
        setSelectedId((prev) => {
            // Keep the existing preview if it still matches a real class.
            if (prev && builtBase.some((s) => s.cls.id === prev))
                return prev;
            // First-ever load: highlight the first class to match the design.
            // After that, respect the user's "Back" click and stay unselected.
            if (!hasAutoSelected) {
                setHasAutoSelected(true);
                return builtBase[0]?.cls.id ?? null;
            }
            return null;
        });
    }, [hasAutoSelected, setClasses]);
    useEffect(() => {
        void reload();
    }, [reload]);
    // Auto-dismiss toast.
    useEffect(() => {
        if (!toast)
            return;
        const t = window.setTimeout(() => setToast(null), 3200);
        return () => window.clearTimeout(t);
    }, [toast]);
    /** Only non-null when the user (or first-load auto-select) has a class
     *  previewed. When `selectedId` is null after Back, this must stay null
     *  so the global RightPanel renders — do not fall back to summaries[0]. */
    const selected = useMemo(() => {
        if (!selectedId)
            return null;
        return summaries.find((s) => s.cls.id === selectedId) ?? null;
    }, [summaries, selectedId]);
    // Wider app grid (360px) only while the class detail column is shown;
    // global RightPanel uses the same 304px track as Home/Notes.
    useEffect(() => {
        setClassesDetailPanelOpen(!!selected);
        return () => setClassesDetailPanelOpen(false);
    }, [selected, setClassesDetailPanelOpen]);
    /* ---- Card actions ---------------------------------------------- */
    const openClass = useCallback((id) => {
        setSelectedClass(id);
        setFocusedClass(id);
        setView({ kind: "classView", classId: id });
    }, [setFocusedClass, setSelectedClass, setView]);
    const askClass = useCallback((id) => {
        setSelectedClass(id);
        setFocusedClass(id);
        setView({ kind: "classAsk", classId: id });
    }, [setFocusedClass, setSelectedClass, setView]);
    const openNote = useCallback((note) => {
        setSelectedNote(note);
        setView({ kind: "note", noteId: note.id });
    }, [setSelectedNote, setView]);
    /* ---- Class management ------------------------------------------ */
    const createClass = useCallback(async (name, code, color) => {
        await upsertClass({ name, code, color });
        await reload();
        setToast(`Added “${name}”`);
    }, [reload]);
    const renameClass = useCallback(async (cls, name, code, color) => {
        await upsertClass({ ...cls, name, code, color });
        await reload();
        setToast(`Updated “${name}”`);
    }, [reload]);
    const deleteClass = useCallback(async (cls) => {
        await softDeleteClass(cls.id);
        await reload();
        setToast(`Removed “${cls.name}”`);
    }, [reload]);
    const archiveClass = useCallback(async (cls) => {
        const id = cls.id;
        if (selectedId === id)
            selectClassPreview(null);
        await archiveClassDb(id);
        await reload();
        setToast(`Archived “${cls.name}”`);
    }, [reload, selectClassPreview, selectedId]);
    /* ---- AI tools -------------------------------------------------- */
    const runSummarize = useCallback(async (summary) => {
        // Prefer a note that doesn't yet have a summary so repeat clicks
        // gradually fill out the class instead of re-summarising the same
        // note over and over.
        const target = summary.recentNotes.find((n) => !n.summary || n.summary.trim() === "") ??
            summary.recentNotes[0];
        if (!target) {
            setToast(`Add a note to ${summary.cls.name} first.`);
            return;
        }
        setAiBusy(`summarize-${summary.cls.id}`);
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
    }, [reload]);
    const runStudyPlan = useCallback(async (summary) => {
        if (summary.recentNotes.length === 0) {
            setToast(`Add notes to ${summary.cls.name} first.`);
            return;
        }
        // The full study plan flow lives in Calendar — focus the class
        // and jump there so the existing planner picks it up.
        setFocusedClass(summary.cls.id);
        setView({ kind: "calendar" });
    }, [setFocusedClass, setView]);
    /* ---- Render ---------------------------------------------------- */
    return (_jsxs(_Fragment, { children: [_jsxs("main", { className: "main", children: [_jsxs("div", { className: "main-inner", children: [_jsx(ClassesHero, {}), _jsx(SummaryStatsRow, { summaries: summaries, dueFlashcards: dueFlashcards }), !loaded ? (_jsx(ClassGridSkeleton, {})) : summaries.length === 0 ? (_jsx(EmptyState, { onAdd: () => setShowCreate(true) })) : (_jsxs("section", { className: "classes-grid", "aria-label": "Your classes", children: [summaries.map((s) => (_jsx(ClassCard, { data: s, selected: s.cls.id === selected?.cls.id, onSelect: () => selectClassPreview(s.cls.id), onOpen: () => openClass(s.cls.id), onAsk: () => askClass(s.cls.id), onRename: () => setRenaming(s.cls), onArchive: () => void archiveClass(s.cls) }, s.cls.id))), _jsx(NewClassSkeletonCard, { onClick: () => setShowCreate(true) })] }))] }), toast && (_jsx("div", { className: "classes-toast", role: "status", "aria-live": "polite", children: toast }))] }), selected ? (_jsx(ClassDetailPanel, { data: selected, syncStatus: syncStatus, aiBusy: aiBusy, onBack: () => selectClassPreview(null), onOpenNote: openNote, onViewAll: () => openClass(selected.cls.id), onSummarize: () => void runSummarize(selected), onStudyPlan: () => void runStudyPlan(selected), onMakeQuiz: () => {
                    setFocusedClass(selected.cls.id);
                    setView({ kind: "quizzes" });
                }, onAsk: () => askClass(selected.cls.id), onRename: () => setRenaming(selected.cls), onArchive: () => void archiveClass(selected.cls), onDelete: () => setDeleting(selected.cls) })) : (
            // No class previewed — fall back to the same global right panel
            // the rest of the app uses (gamification, deadlines, AI shortcuts…).
            _jsx(RightPanel, { classesSwap: true })), showCreate && (_jsx(ClassEditDialog, { title: "Add a class", confirmLabel: "Add class", existing: classes, onCancel: () => setShowCreate(false), onSave: async (vals) => {
                    await createClass(vals.name, vals.code, vals.color);
                    setShowCreate(false);
                } })), renaming && (_jsx(ClassEditDialog, { title: "Edit class", confirmLabel: "Save", existing: classes, initial: renaming, onCancel: () => setRenaming(null), onSave: async (vals) => {
                    await renameClass(renaming, vals.name, vals.code, vals.color);
                    setRenaming(null);
                } })), deleting && (_jsx(ConfirmDialog, { title: `Remove ${deleting.name}?`, body: _jsx("p", { className: "modal-subtle", children: "Notes and study tools created under this class will stay in your library \u2014 you can move them to another class anytime. This action syncs to your other devices." }), confirmLabel: "Remove class", danger: true, onCancel: () => setDeleting(null), onConfirm: () => {
                    const cls = deleting;
                    setDeleting(null);
                    void deleteClass(cls);
                } }))] }));
};
/* ================================================================== */
/* Hero + toolbar (matches Home / Notes layout)                     */
/* ================================================================== */
const ClassesHero = () => (_jsxs("section", { className: "hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(HeroSearch, {}), _jsxs("div", { className: "hero-greeting", children: [_jsx("h1", { className: "hero-headline", children: "Classes" }), _jsx("p", { children: "Your courses, progress, and study tools all in one place." })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_HERO_URL, alt: "", decoding: "async" }) })] }));
/* ================================================================== */
/* Summary stats                                                      */
/* ================================================================== */
const SummaryStatsRow = ({ summaries, dueFlashcards }) => {
    const totals = useMemo(() => {
        let notes = 0;
        let exams = 0;
        for (const s of summaries) {
            notes += s.notes;
            if (s.examInDays !== null && s.examInDays <= 7)
                exams += 1;
        }
        return {
            classes: summaries.length,
            notes,
            exams,
        };
    }, [summaries]);
    return (_jsxs("section", { className: "stat-row", "aria-label": "Class summary", children: [_jsx(SummaryStatCard, { icon: _jsx(GraduationCapIcon, { size: 18 }), tone: "peach", number: totals.classes.toString(), label: "Active Classes" }), _jsx(SummaryStatCard, { icon: _jsx(FileIcon, { size: 18 }), tone: "sky", number: totals.notes.toString(), label: "Notes" }), _jsx(SummaryStatCard, { icon: _jsx(FlashcardIcon, { size: 18 }), tone: "sage", number: dueFlashcards.toString(), label: "Flashcards Due" }), _jsx(SummaryStatCard, { icon: _jsx(CalendarIcon, { size: 18 }), tone: "lilac", number: totals.exams.toString(), label: "Exams This Week" })] }));
};
const SummaryStatCard = ({ icon, tone, number, label }) => (_jsxs("div", { className: "stat-card", children: [_jsx("span", { className: `stat-icon tone-${tone}`, "aria-hidden": true, children: icon }), _jsxs("div", { className: "stat-text", children: [_jsx("span", { className: "stat-number", children: number }), _jsx("span", { className: "stat-label", children: label })] })] }));
/* ================================================================== */
/* Class card                                                         */
/* ================================================================== */
const ClassCard = ({ data, selected, onSelect, onOpen, onAsk, onRename, onArchive }) => {
    const menu = [
        { label: "Open class notes", icon: _jsx(FileIcon, { size: 14 }), onClick: onOpen },
        { label: "Ask AI about this class", icon: _jsx(SparklesIcon, { size: 14 }), onClick: onAsk },
        { label: "Edit class", icon: _jsx(PencilIcon, { size: 14 }), onClick: onRename },
        { label: "Archive class", icon: _jsx(ArchiveIcon, { size: 14 }), onClick: onArchive },
    ];
    return (_jsxs("article", { className: `class-card${selected ? " is-selected" : ""}`, onClick: onSelect, role: "button", tabIndex: 0, onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
            }
        }, children: [_jsxs("header", { className: "class-card-head", children: [_jsx("span", { className: `class-card-icon tone-${data.tone}`, "aria-hidden": true, children: data.icon }), _jsxs("div", { className: "class-card-title", children: [_jsx("span", { className: "class-card-course", children: data.cls.name }), data.subtitle && (_jsx("span", { className: "class-card-subtitle", children: data.subtitle })), _jsx("span", { className: "class-card-prof", children: data.cls.code && data.subtitle !== data.cls.code
                                    ? data.cls.code
                                    : "Course" })] }), _jsx("div", { className: "class-card-more-wrap", onClick: (e) => e.stopPropagation(), onPointerDown: (e) => e.stopPropagation(), children: _jsx(MoreMenu, { items: menu, label: `Options for ${data.cls.name}` }) })] }), _jsxs("div", { className: "class-card-stats", children: [_jsx(CardStat, { icon: _jsx(FileIcon, { size: 14 }), tone: "sky", value: data.notes, label: "Notes" }), _jsx(CardStat, { icon: _jsx(FlashcardIcon, { size: 14 }), tone: "sage", value: data.flashcards, label: "Flashcards" }), _jsx(CardStat, { icon: _jsx(QuizIcon, { size: 14 }), tone: "amber", value: data.quizzes, label: "Quizzes" })] }), _jsxs("div", { className: "class-card-progress", children: [_jsxs("div", { className: "class-card-progress-row", children: [_jsx("span", { className: `progress-label tone-${data.progressTone}`, children: data.progressLabel }), _jsxs("span", { className: "progress-value", children: [data.progress, "%"] })] }), _jsx(ProgressBar, { value: data.progress, tone: data.tone })] }), _jsxs("div", { className: "class-card-next", children: [_jsx(CalendarIcon, { size: 14 }), _jsx("span", { children: data.nextDeadline
                            ? `Next: ${data.nextDeadline.title}`
                            : "No upcoming deadlines" })] }), _jsxs("div", { className: "class-card-actions", children: [_jsxs("button", { type: "button", className: "class-action class-action-primary", onClick: (e) => {
                            e.stopPropagation();
                            onOpen();
                        }, children: ["Open Class ", _jsx(ChevRightIcon, { size: 14 })] }), _jsxs("button", { type: "button", className: "class-action class-action-ai", onClick: (e) => {
                            e.stopPropagation();
                            onAsk();
                        }, children: [_jsx(SparklesIcon, { size: 14 }), " Ask AI"] })] })] }));
};
const CardStat = ({ icon, tone, value, label }) => (_jsxs("div", { className: "card-stat", children: [_jsx("span", { className: `card-stat-icon tone-${tone}`, "aria-hidden": true, children: icon }), _jsx("span", { className: "card-stat-value", children: value }), _jsx("span", { className: "card-stat-label", children: label })] }));
const ProgressBar = ({ value, tone }) => (_jsx("div", { className: "progress-bar", children: _jsx("span", { className: `progress-fill tone-${tone}`, style: { width: `${Math.max(0, Math.min(100, value))}%` } }) }));
const ClassDetailPanel = ({ data, syncStatus, aiBusy, onBack, onOpenNote, onViewAll, onSummarize, onMakeQuiz, onStudyPlan, onAsk, onRename, onArchive, onDelete, }) => {
    const detailMenu = [
        { label: "Edit class", icon: _jsx(PencilIcon, { size: 14 }), onClick: onRename },
        { label: "Archive class", icon: _jsx(ArchiveIcon, { size: 14 }), onClick: onArchive },
        { label: "Remove class", icon: _jsx(TrashIcon, { size: 14 }), onClick: onDelete, danger: true },
    ];
    // Prefer an AI-generated summary of the most recent note; falls back
    // to a static blurb so the detail card never looks empty.
    const recentSummary = data.recentNotes.find((n) => n.summary && n.summary.trim().length > 0)?.summary;
    const description = recentSummary ??
        (data.cls.code && data.cls.code !== data.subtitle
            ? data.cls.code
            : data.subtitle ??
                "Track your notes, flashcards and quizzes for this course in one place. Open it to focus your study session here.");
    const chips = [];
    chips.push({ label: data.notes > 0 ? "Active" : "New", tone: "info" });
    if (data.examInDays !== null && data.examInDays <= 14) {
        chips.push({
            label: data.examInDays <= 0 ? "Exam today" : `Exam in ${data.examInDays}d`,
            tone: data.examInDays <= 3 ? "danger" : "warning",
        });
    }
    chips.push({
        label: data.progressTone === "warning" ? "Catching up" : "On Track",
        tone: data.progressTone === "warning" ? "warning" : "success",
    });
    return (_jsxs("aside", { className: "right-panel class-detail-panel right-panel--classes-swap", children: [_jsxs("header", { className: "detail-toolbar", children: [_jsx("button", { type: "button", className: "detail-icon-btn", "aria-label": "Back to home", onClick: onBack, children: _jsx(ArrowLeftIcon, { size: 16 }) }), _jsx("div", { className: "detail-toolbar-more", children: _jsx(MoreMenu, { items: detailMenu, label: "Class options" }) })] }), _jsxs("section", { className: "detail-hero", children: [_jsx("span", { className: `class-card-icon tone-${data.tone} detail-hero-icon`, "aria-hidden": true, children: data.icon }), _jsxs("div", { className: "detail-hero-text", children: [_jsx("h2", { children: data.cls.name }), _jsx("p", { children: data.subtitle ?? "Course" })] })] }), _jsx("div", { className: "detail-chips", children: chips.map((c) => (_jsx("span", { className: `detail-chip tone-${c.tone}`, children: c.label }, c.label))) }), _jsx("p", { className: "detail-description", children: description }), _jsx("hr", { className: "detail-divider" }), _jsxs("section", { className: "detail-section", children: [_jsxs("div", { className: "detail-section-head", children: [_jsxs("span", { className: "detail-section-title", children: [_jsx(FileIcon, { size: 14 }), " Recent Notes"] }), _jsx("button", { type: "button", className: "detail-link", onClick: onViewAll, children: "View all" })] }), data.recentNotes.length === 0 ? (_jsx("p", { className: "detail-empty", children: "No notes yet. Open this class to create your first note." })) : (_jsx("ul", { className: "detail-note-list", children: data.recentNotes.map((n) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "detail-note-row", onClick: () => onOpenNote(n), children: [_jsx("span", { className: "detail-note-icon", "aria-hidden": true, children: _jsx(FileIcon, { size: 14 }) }), _jsx("span", { className: "detail-note-title", children: n.title }), _jsx("span", { className: "detail-note-date", children: shortDate(n.updated_at) })] }) }, n.id))) }))] }), _jsx("hr", { className: "detail-divider" }), _jsxs("section", { className: "detail-section", children: [_jsx("div", { className: "detail-section-head", children: _jsxs("span", { className: "detail-section-title", children: [_jsx(BookIcon, { size: 14 }), " Study Progress"] }) }), _jsxs("div", { className: "detail-tile-grid", children: [_jsx(DetailTile, { tone: "sky", icon: _jsx(FileIcon, { size: 14 }), number: data.notes.toString(), label: "Notes" }), _jsx(DetailTile, { tone: "sage", icon: _jsx(FlashcardIcon, { size: 14 }), number: data.flashcards.toString(), label: "Flashcards" }), _jsx(DetailTile, { tone: "amber", icon: _jsx(QuizIcon, { size: 14 }), number: data.quizzes.toString(), label: "Quizzes" }), _jsx(DetailTile, { tone: "lilac", icon: _jsx(ClockIcon, { size: 14 }), number: data.examInDays === null ? "—" : `${data.examInDays}d`, label: data.examInDays === null ? "No exam" : "Exam in", stacked: true })] })] }), _jsx("hr", { className: "detail-divider" }), _jsxs("section", { className: "detail-section", children: [_jsx("div", { className: "detail-section-head", children: _jsx("span", { className: "detail-section-title", children: "Weak Topics" }) }), data.weakTopics.length === 0 ? (_jsx("p", { className: "detail-empty", children: "No weak topics yet \u2014 rate flashcards as \u201Chard\u201D to surface them here." })) : (_jsx("div", { className: "weak-topic-row", children: data.weakTopics.map((t) => (_jsx("span", { className: "weak-topic", children: t }, t))) }))] }), _jsx("hr", { className: "detail-divider" }), _jsxs("section", { className: "detail-section", children: [_jsx("div", { className: "detail-section-head", children: _jsxs("span", { className: "detail-section-title", children: [_jsx(SparklesIcon, { size: 14 }), " AI Tools"] }) }), _jsxs("div", { className: "ai-tools", children: [_jsx(AIActionButton, { tone: "sky", icon: _jsx(SparklesIcon, { size: 14 }), label: "Summarize Class", busy: aiBusy === `summarize-${data.cls.id}`, onClick: onSummarize }), _jsx(AIActionButton, { tone: "sage", icon: _jsx(CheckIcon, { size: 14 }), label: "Make Exam Review", onClick: onMakeQuiz }), _jsx(AIActionButton, { tone: "lilac", icon: _jsx(CalendarIcon, { size: 14 }), label: "Generate Study Plan", onClick: onStudyPlan }), _jsx(AIActionButton, { tone: "peach", icon: _jsx(FileIcon, { size: 14 }), label: "Ask This Class", onClick: onAsk })] })] }), _jsx(SyncStatusCard, { status: syncStatus })] }));
};
const DetailTile = ({ tone, icon, number, label, stacked }) => (_jsxs("div", { className: `detail-tile tone-${tone}${stacked ? " stacked" : ""}`, children: [_jsx("span", { className: "detail-tile-icon", "aria-hidden": true, children: icon }), _jsx("span", { className: "detail-tile-number", children: number }), _jsx("span", { className: "detail-tile-label", children: label })] }));
const AIActionButton = ({ tone, icon, label, busy, onClick }) => (_jsxs("button", { type: "button", className: `ai-action tone-${tone}`, onClick: onClick, disabled: busy, "aria-busy": busy ? true : undefined, children: [_jsx("span", { className: "ai-action-icon", "aria-hidden": true, children: icon }), _jsx("span", { className: "ai-action-label", children: busy ? "Working…" : label }), _jsx("span", { className: "ai-action-chev", "aria-hidden": true, children: _jsx(ChevRightIcon, { size: 14 }) })] }));
const SYNC_PRESENTATION = {
    synced: {
        title: "All changes synced",
        sub: "Last synced just now",
        icon: _jsx(CloudCheckIcon, { size: 14 }),
        tone: "success",
    },
    syncing: {
        title: "Syncing changes…",
        sub: "Working in the background",
        icon: _jsx(GlobeIcon, { size: 14 }),
        tone: "warning",
    },
    saving: {
        title: "Saving locally…",
        sub: "Will sync once changes settle",
        icon: _jsx(CheckIcon, { size: 14 }),
        tone: "warning",
    },
    conflict: {
        title: "Conflict detected",
        sub: "Open Settings to resolve",
        icon: _jsx(WarningIcon, { size: 14 }),
        tone: "warning",
    },
    error: {
        title: "Sync error",
        sub: "We'll retry automatically",
        icon: _jsx(WarningIcon, { size: 14 }),
        tone: "danger",
    },
    offline: {
        title: "You're offline",
        sub: "Changes save locally and resume on reconnect",
        icon: _jsx(CloudOffIcon, { size: 14 }),
        tone: "muted",
    },
};
const SyncStatusCard = ({ status }) => {
    const view = SYNC_PRESENTATION[status] ?? SYNC_PRESENTATION.synced;
    return (_jsxs("div", { className: `sync-card sync-${view.tone}`, children: [_jsx("span", { className: "sync-card-icon", "aria-hidden": true, children: _jsx(CheckIcon, { size: 14 }) }), _jsxs("div", { className: "sync-card-text", children: [_jsx("span", { className: "sync-card-title", children: view.title }), _jsx("span", { className: "sync-card-sub", children: view.sub })] }), _jsx("span", { className: "sync-card-badge", "aria-hidden": true, children: view.icon })] }));
};
/* ================================================================== */
/* Empty / loading / no-match states                                  */
/* ================================================================== */
const EmptyState = ({ onAdd }) => (_jsxs("section", { className: "classes-empty", children: [_jsx("span", { className: "classes-empty-icon", "aria-hidden": true, children: _jsx(GraduationCapIcon, { size: 28 }) }), _jsx("h2", { children: "Add your first class" }), _jsx("p", { children: "Group your notes, flashcards, and quizzes by subject. You can rename or remove classes at any time." }), _jsx("div", { className: "classes-empty-add-wrap", children: _jsx(NewClassSkeletonCard, { onClick: onAdd }) })] }));
/** Skeleton tile with “Add a module”–style hints; opens create-class on click. */
const NewClassSkeletonCard = ({ onClick }) => {
    const hintId = useId();
    const titleId = `${hintId}-title`;
    const subId = `${hintId}-sub`;
    return (_jsxs("button", { type: "button", className: "class-card skeleton class-card--new", onClick: onClick, "aria-labelledby": titleId, "aria-describedby": subId, children: [_jsxs("div", { className: "class-card-new-hint", children: [_jsx("span", { className: "add-widget-icon", "aria-hidden": true, children: _jsx(PlusIcon, { size: 18 }) }), _jsxs("span", { className: "add-widget-text", children: [_jsx("span", { className: "add-widget-title", id: titleId, children: "Add a new class" }), _jsx("span", { className: "add-widget-sub", id: subId, children: "Click here to name your course and start organizing notes and study tools." })] })] }), _jsxs("div", { className: "class-card-stats", children: [_jsx("span", { className: "card-stat skeleton-bar" }), _jsx("span", { className: "card-stat skeleton-bar" }), _jsx("span", { className: "card-stat skeleton-bar" })] }), _jsx("div", { className: "progress-bar skeleton-bar" })] }));
};
const ClassGridSkeleton = () => (_jsx("section", { className: "classes-grid", "aria-hidden": true, children: Array.from({ length: 6 }).map((_, i) => (_jsxs("div", { className: "class-card skeleton", children: [_jsxs("div", { className: "class-card-head", children: [_jsx("span", { className: "class-card-icon" }), _jsxs("div", { className: "class-card-title", children: [_jsx("span", { className: "class-card-course skeleton-bar" }), _jsx("span", { className: "class-card-subtitle skeleton-bar" })] })] }), _jsxs("div", { className: "class-card-stats", children: [_jsx("span", { className: "card-stat skeleton-bar" }), _jsx("span", { className: "card-stat skeleton-bar" }), _jsx("span", { className: "card-stat skeleton-bar" })] }), _jsx("div", { className: "progress-bar skeleton-bar" })] }, i))) }));
const COLOR_CHOICES = [
    { id: "sage", value: "var(--color-accentSage)", label: "Sage", tone: "sage" },
    { id: "sky", value: "var(--color-accentSky)", label: "Sky", tone: "sky" },
    { id: "lilac", value: "var(--color-accentLilac)", label: "Lilac", tone: "lilac" },
    { id: "amber", value: "var(--color-accentAmber)", label: "Amber", tone: "amber" },
    { id: "peach", value: "var(--color-accentPeach)", label: "Peach", tone: "peach" },
];
const ClassEditDialog = ({ title, confirmLabel, initial, existing, onCancel, onSave }) => {
    const [name, setName] = useState(initial?.name ?? "");
    const [code, setCode] = useState(initial?.code ?? "");
    const [color, setColor] = useState(initial?.color ?? COLOR_CHOICES[0].value);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    // Esc to close.
    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape")
                onCancel();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onCancel]);
    const trimmedName = name.trim();
    const duplicate = existing.some((c) => c.id !== initial?.id &&
        c.name.trim().toLowerCase() === trimmedName.toLowerCase());
    async function handleSave() {
        if (!trimmedName) {
            setError("Add a class name to continue.");
            return;
        }
        if (duplicate) {
            setError("You already have a class with that name.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await onSave({
                name: trimmedName,
                code: code.trim() ? code.trim() : null,
                color,
            });
        }
        catch (e) {
            setError(e.message ?? "Couldn't save the class.");
            setBusy(false);
        }
    }
    return (_jsx("div", { className: "modal-backdrop", role: "dialog", "aria-modal": "true", onClick: onCancel, children: _jsxs("div", { className: "modal-card class-edit-dialog", onClick: (e) => e.stopPropagation(), children: [_jsx("div", { className: "modal-head", children: _jsx("span", { className: "modal-title", children: title }) }), _jsxs("label", { className: "class-edit-field", children: [_jsx("span", { children: "Class name" }), _jsx("input", { className: "field", type: "text", autoFocus: true, value: name, onChange: (e) => setName(e.target.value), placeholder: "e.g. Biology 201", maxLength: 80 })] }), _jsxs("label", { className: "class-edit-field", children: [_jsx("span", { children: "Subtitle (optional)" }), _jsx("input", { className: "field", type: "text", value: code, onChange: (e) => setCode(e.target.value), placeholder: "e.g. Cell Biology with Dr. Miller", maxLength: 120 })] }), _jsxs("div", { className: "class-edit-field", children: [_jsx("span", { children: "Accent" }), _jsx("div", { className: "class-color-row", children: COLOR_CHOICES.map((c) => (_jsx("button", { type: "button", "aria-label": c.label, "aria-pressed": color === c.value, className: `class-color-swatch tone-${c.tone}${color === c.value ? " is-active" : ""}`, onClick: () => setColor(c.value), children: _jsx("span", { className: "class-color-dot" }) }, c.id))) })] }), error && _jsx("p", { className: "class-edit-error", children: error }), _jsxs("div", { className: "confirm-actions", children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: onCancel, children: "Cancel" }), _jsx("button", { type: "button", className: "btn-primary", onClick: () => void handleSave(), disabled: busy || !trimmedName, children: busy ? "Saving…" : confirmLabel })] })] }) }));
};
/* ================================================================== */
/* Helpers                                                            */
/* ================================================================== */
const EMPTY_AGG = {
    notes: 0,
    flashcards: 0,
    quizzes: 0,
    totalTasks: 0,
    completedTasks: 0,
};
/** Builds a `ClassSummary` from a raw class row + its derived metrics. */
function summariseClass(cls, agg, recentNotes, weakTopics, nextTask, exam, todayMs) {
    const tone = toneFor(cls);
    const icon = iconFor(cls, tone);
    const subtitle = deriveSubtitle(cls);
    const progress = computeProgress(agg);
    const progressTone = progress >= 60 || agg.totalTasks === 0 ? "success" : "warning";
    const progressLabel = labelForProgress(progress, agg);
    let nextDeadline = null;
    if (nextTask) {
        const d = new Date(nextTask.scheduled_for);
        nextDeadline = {
            title: nextTask.title,
            date: d,
            daysLeft: Math.max(0, Math.round((d.getTime() - todayMs) / 86_400_000)),
        };
    }
    return {
        cls,
        tone,
        icon,
        subtitle,
        notes: agg.notes,
        flashcards: agg.flashcards,
        quizzes: agg.quizzes,
        progress,
        progressTone,
        progressLabel,
        nextDeadline,
        examInDays: exam ? exam.days : null,
        recentNotes,
        weakTopics,
    };
}
/**
 * Resolve a tone from a ClassRow:
 *  1. If `color` is one of our CSS accent tokens, map directly.
 *  2. Otherwise pick a deterministic tone from the class name hash so
 *     the same class always renders the same colour.
 */
function toneFor(cls) {
    const color = (cls.color ?? "").toLowerCase();
    if (color.includes("sage") || color.includes("green"))
        return "sage";
    if (color.includes("sky") || color.includes("blue"))
        return "sky";
    if (color.includes("lilac") || color.includes("purple") || color.includes("violet"))
        return "lilac";
    if (color.includes("amber") || color.includes("yellow") || color.includes("gold"))
        return "amber";
    if (color.includes("peach") || color.includes("rose") || color.includes("orange"))
        return "peach";
    // Deterministic fallback by id so colours are stable across reloads.
    let h = 0;
    for (let i = 0; i < cls.id.length; i++)
        h = (h * 31 + cls.id.charCodeAt(i)) >>> 0;
    return ALL_TONES[h % ALL_TONES.length] ?? "sky";
}
/** Pick a subject-aware glyph based on the class name (when possible). */
function iconFor(cls, tone) {
    const n = cls.name.toLowerCase();
    if (/(bio|cell|genetic|anatom)/.test(n))
        return _jsx(LeafIcon, { size: 20 });
    if (/(chem|lab|reaction)/.test(n))
        return _jsx(BeakerIcon, { size: 20 });
    if (/(history|civics|world|europe)/.test(n))
        return _jsx(PillarIcon, { size: 20 });
    if (/(physics|mechanic|astro)/.test(n))
        return _jsx(AtomIcon, { size: 20 });
    if (/(english|writing|literature|comp)/.test(n))
        return _jsx(PencilIcon, { size: 20 });
    if (/(geo|earth|map)/.test(n))
        return _jsx(GlobeIcon, { size: 20 });
    if (/(book|reading)/.test(n))
        return _jsx(BookIcon, { size: 20 });
    // Generic class icon, coloured via tone.
    void tone;
    return _jsx(ClassIcon, { size: 20 });
}
/** Subtitle is derived from `code` when present (matches our seed convention). */
function deriveSubtitle(cls) {
    if (!cls.code || !cls.code.trim())
        return null;
    return cls.code.trim();
}
/**
 * Progress percentage. Prefers task completion when a study plan exists;
 * otherwise falls back to a coarse "study tools coverage" heuristic so a
 * brand-new class doesn't render at 0% forever.
 */
function computeProgress(agg) {
    if (agg.totalTasks > 0) {
        return Math.round((agg.completedTasks / agg.totalTasks) * 100);
    }
    // Heuristic: 30% per study tool category, capped at 90% so the user
    // still sees room to grow even on well-stocked classes without plans.
    const score = (agg.notes > 0 ? 30 : 0) +
        (agg.flashcards > 0 ? 30 : 0) +
        (agg.quizzes > 0 ? 30 : 0);
    return Math.min(score, 90);
}
function labelForProgress(progress, agg) {
    if (agg.totalTasks === 0 && agg.notes === 0)
        return "Just Starting";
    if (progress >= 60)
        return "On Track";
    if (progress >= 30)
        return "Catching Up";
    return "Behind";
}
function shortDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
    if (days === 0)
        return "Today";
    if (days === 1)
        return "Yesterday";
    if (days >= 2 && days < 7)
        return d.toLocaleDateString(undefined, { weekday: "short" });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
//# sourceMappingURL=Classes.js.map