import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audioAttachmentsMissingTranscript, listClasses, listNotes, noteHasFlashcards, noteHasQuiz, notesByTagLike, notesMissingStudyTools, notesNeedingSummary, notesNotOpenedSince, notesUpdatedSince, notesWithAttachmentType, recordXp, softDeleteNote, unsyncedNotesCount, upsertAttachment, upsertNote, } from "../db/repositories.js";
import { useApp } from "../store.js";
import { XP_RULES } from "@studynest/shared";
import { BRAND_ATTENTION_URL, BRAND_HERO_URL } from "../lib/brand.js";
import { NoteGlyph } from "../lib/noteIcons.js";
import { Card } from "./ui/Card.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import { MoreMenu } from "./ui/MoreMenu.js";
import { AudioRecorderModal } from "./AudioRecorderModal.js";
import { captureAudioToNote } from "../lib/audioCapture.js";
import { HeroSearch } from "./HeroSearch.js";
import { ArrowRightIcon, BoltIcon, CalendarIcon, CameraIcon, ClockIcon, CloudOffIcon, EyeIcon, FlashcardIcon, MicIcon, NoteIcon, PencilIcon, QuizIcon, SparklesIcon, TrashIcon, UploadIcon, WarningIcon, } from "./icons.js";
export const NotesList = () => {
    const notes = useApp((s) => s.notes);
    const setNotes = useApp((s) => s.setNotes);
    const classes = useApp((s) => s.classes);
    const setClasses = useApp((s) => s.setClasses);
    const selectedClassId = useApp((s) => s.selectedClassId);
    const setSelectedClassFilter = useApp((s) => s.setSelectedClass);
    const [collectionFilter, setCollectionFilter] = useState(null);
    const [counts, setCounts] = useState({
        thisWeek: 0,
        examPrep: 0,
        audio: 0,
        scans: 0,
        needsReview: 0,
    });
    const [attention, setAttention] = useState({
        needsTools: 0,
        audioPending: 0,
        unsynced: 0,
    });
    const [audioNoteIds, setAudioNoteIds] = useState(new Set());
    const [scanNoteIds, setScanNoteIds] = useState(new Set());
    const [pendingTranscriptIds, setPendingTranscriptIds] = useState(new Set());
    const [needsToolsIds, setNeedsToolsIds] = useState(new Set());
    const [aiQueue, setAiQueue] = useState([]);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const reload = useCallback(async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoIso = weekAgo.toISOString();
        const [ns, cls, cThisWeek, cExam, cAudio, cScans, cNeedsReview, audioPending, unsynced, missingTools, needSummary, audioNotes, scanNotes, pendingTranscript,] = await Promise.all([
            listNotes(null),
            listClasses(),
            notesUpdatedSince(weekAgoIso),
            notesByTagLike("exam"),
            notesWithAttachmentType("audio"),
            notesWithAttachmentType("image"),
            notesNotOpenedSince(weekAgoIso),
            audioAttachmentsMissingTranscript(),
            unsyncedNotesCount(),
            notesMissingStudyTools(20),
            notesNeedingSummary(20),
            noteIdsWithAttachmentType("audio"),
            noteIdsWithAttachmentType("image"),
            noteIdsWithPendingAudioTranscript(),
        ]);
        setNotes(ns);
        setClasses(cls);
        setCounts({
            thisWeek: cThisWeek,
            examPrep: cExam,
            audio: cAudio,
            scans: cScans,
            needsReview: cNeedsReview,
        });
        setAttention({
            needsTools: missingTools.length,
            audioPending,
            unsynced,
        });
        setAudioNoteIds(audioNotes);
        setScanNoteIds(scanNotes);
        setPendingTranscriptIds(pendingTranscript);
        setNeedsToolsIds(new Set(missingTools.map((n) => n.id)));
        setAiQueue(await buildAiQueue(needSummary, missingTools));
    }, [setNotes, setClasses]);
    useEffect(() => {
        void reload();
    }, [reload]);
    const classMap = useMemo(() => {
        const m = new Map();
        for (const c of classes)
            m.set(c.id, c);
        return m;
    }, [classes]);
    const filteredNotes = useMemo(() => {
        // Class focus is set when the user clicks "Open Class" from the
        // Classes screen — narrow the list before the smart-collection
        // filter runs so e.g. "Exam Prep" intersects with the class focus.
        const classScoped = selectedClassId
            ? notes.filter((n) => n.class_id === selectedClassId)
            : notes;
        if (!collectionFilter)
            return classScoped;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        switch (collectionFilter) {
            case "thisWeek":
                return classScoped.filter((n) => new Date(n.updated_at) >= weekAgo);
            case "examPrep":
                return classScoped.filter((n) => /exam/i.test(n.tags_json));
            case "audio":
                return classScoped.filter((n) => audioNoteIds.has(n.id));
            case "scans":
                return classScoped.filter((n) => scanNoteIds.has(n.id));
            case "needsReview":
                return classScoped.filter((n) => new Date(n.updated_at) < weekAgo);
            case "needsTools":
                return classScoped.filter((n) => needsToolsIds.has(n.id));
            case "audioPending":
                return classScoped.filter((n) => pendingTranscriptIds.has(n.id));
            default:
                return classScoped;
        }
    }, [
        notes,
        selectedClassId,
        collectionFilter,
        audioNoteIds,
        scanNoteIds,
        needsToolsIds,
        pendingTranscriptIds,
    ]);
    const activeClass = useMemo(() => (selectedClassId ? classMap.get(selectedClassId) ?? null : null), [selectedClassId, classMap]);
    async function handleDelete() {
        if (!confirmDelete)
            return;
        await softDeleteNote(confirmDelete.id);
        setConfirmDelete(null);
        await reload();
    }
    const isEmpty = notes.length === 0;
    return (_jsxs("main", { className: "main", children: [_jsxs("div", { className: "main-inner", children: [_jsx(NotesHero, {}), _jsx(NotesQuickActions, { onCreated: () => void reload() }), activeClass && (_jsxs("div", { className: "notes-class-scope", role: "status", children: [_jsxs("span", { className: "notes-class-scope-label", children: ["Filtered to ", _jsx("strong", { children: activeClass.name })] }), _jsx("button", { type: "button", className: "btn-ghost", onClick: () => setSelectedClassFilter(null), children: "Clear filter" })] })), isEmpty ? (_jsx(NotesEmptyState, { onCreated: () => void reload() })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "notes-row notes-row-1-2", children: [_jsx(ContinueWritingCard, {}), _jsx(SmartCollectionsCard, { counts: counts, active: collectionFilter, onPick: (key) => {
                                            setCollectionFilter((curr) => (curr === key ? null : key));
                                        } })] }), _jsxs("div", { className: "notes-row notes-row-2-1", children: [_jsx(RecentNotesCard, { notes: filteredNotes, classMap: classMap, filterLabel: filterLabel(collectionFilter), onClearFilter: () => setCollectionFilter(null), onDelete: (n) => setConfirmDelete(n) }), _jsx(AiReadyQueueCard, { queue: aiQueue })] }), _jsx(NeedsAttentionStrip, { counts: attention, onPick: (key) => {
                                    setCollectionFilter((curr) => (curr === key ? null : key));
                                } })] }))] }), confirmDelete && (_jsx(ConfirmDialog, { title: "Delete this note?", body: _jsxs(_Fragment, { children: [_jsx("strong", { children: confirmDelete.title || "Untitled" }), " will be moved to trash and removed from your study tools. You can't undo this from the app."] }), confirmLabel: "Delete note", cancelLabel: "Keep note", danger: true, onConfirm: () => void handleDelete(), onCancel: () => setConfirmDelete(null) }))] }));
};
/* ---- helpers ----------------------------------------------------- */
async function noteIdsWithAttachmentType(type) {
    const { getDb } = await import("../db/client.js");
    const db = await getDb();
    const rows = db
        .prepare(`select distinct note_id as id from attachments
       where deleted_at is null and type = ?`)
        .all(type);
    return new Set(rows.map((r) => r.id));
}
async function noteIdsWithPendingAudioTranscript() {
    const { getDb } = await import("../db/client.js");
    const db = await getDb();
    const rows = db
        .prepare(`select distinct note_id as id from attachments
       where deleted_at is null and type = 'audio'
         and (transcript is null or transcript = '')`)
        .all();
    return new Set(rows.map((r) => r.id));
}
async function buildAiQueue(needSummary, missingTools) {
    const out = [];
    const seen = new Set();
    // Summarisation is the cheapest action, so it heads the queue.
    for (const n of needSummary) {
        if (out.length >= 3)
            break;
        if (seen.has(n.id))
            continue;
        out.push({ note: n, action: "summarize" });
        seen.add(n.id);
    }
    // Then suggest the next-best study tool. We probe per-note instead of
    // joining so the queue stays accurate as tools get generated.
    for (const n of missingTools) {
        if (out.length >= 3)
            break;
        if (seen.has(n.id))
            continue;
        const [hasFc, hasQz] = await Promise.all([
            noteHasFlashcards(n.id),
            noteHasQuiz(n.id),
        ]);
        if (!hasFc)
            out.push({ note: n, action: "flashcards" });
        else if (!hasQz)
            out.push({ note: n, action: "quiz" });
        else
            continue;
        seen.add(n.id);
    }
    return out;
}
function filterLabel(filter) {
    switch (filter) {
        case "thisWeek": return "This Week";
        case "examPrep": return "Exam Prep";
        case "audio": return "Audio Notes";
        case "scans": return "Board Scans";
        case "needsReview": return "Needs Review";
        case "needsTools": return "Needs study tools";
        case "audioPending": return "Audio pending transcription";
        default: return null;
    }
}
/* ---- hero -------------------------------------------------------- */
/**
 * Mirrors the Home dashboard hero (`.hero` / `.hero-main` / `.hero-illustration`)
 * so the two screens feel like the same product. The shared `<HeroSearch />`
 * lives at the top of the left column and the page title sits below it,
 * matching the greeting block used on Home.
 */
const NotesHero = () => (_jsxs("section", { className: "hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(HeroSearch, {}), _jsxs("div", { className: "hero-greeting", children: [_jsx("h1", { className: "hero-headline", children: "Notes" }), _jsx("p", { children: "Your class brain, organized and ready to study." })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_HERO_URL, alt: "", decoding: "async" }) })] }));
const QuickActionTile = ({ variant, title, sub, icon, onClick }) => (_jsxs("button", { type: "button", className: `quick-action quick-action--${variant}`, onClick: onClick, children: [_jsx("span", { className: "qa-icon", children: icon }), _jsxs("span", { className: "qa-text", children: [_jsx("span", { className: "qa-title", children: title }), _jsx("span", { className: "qa-sub", children: sub })] })] }));
const NotesQuickActions = ({ onCreated }) => {
    const setView = useApp((s) => s.setView);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const selectedClassId = useApp((s) => s.selectedClassId);
    const imageRef = useRef(null);
    const fileRef = useRef(null);
    const [recorderOpen, setRecorderOpen] = useState(false);
    const [error, setError] = useState(null);
    async function newNote() {
        const note = await upsertNote({
            title: "Untitled",
            class_id: selectedClassId ?? null,
            content_markdown: "",
        });
        await recordXp("createNote", XP_RULES.createNote);
        setSelectedNote(note);
        setView({ kind: "note", noteId: note.id });
        onCreated();
    }
    async function onScanPicked(e) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file)
            return;
        try {
            const dataUri = await fileToDataUri(file);
            const title = stripExt(file.name) || "Whiteboard scan";
            const note = await upsertNote({
                title,
                class_id: selectedClassId ?? null,
                content_markdown: `![${title}](${dataUri})\n`,
            });
            await upsertAttachment({
                note_id: note.id,
                type: "image",
                local_uri: dataUri,
                file_name: file.name,
                mime_type: file.type,
                size_bytes: file.size,
            });
            await recordXp("createNote", XP_RULES.createNote);
            setSelectedNote(note);
            setView({ kind: "note", noteId: note.id });
            onCreated();
        }
        catch (err) {
            setError(err.message || "Failed to save scan.");
        }
    }
    async function onFilePicked(e) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file)
            return;
        try {
            const dataUri = await fileToDataUri(file);
            const title = stripExt(file.name) || "Uploaded file";
            const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
            const note = await upsertNote({
                title,
                class_id: selectedClassId ?? null,
                content_markdown: `Attached file: **${file.name}**\n`,
            });
            await upsertAttachment({
                note_id: note.id,
                type: isPdf ? "pdf" : "file",
                local_uri: dataUri,
                file_name: file.name,
                mime_type: file.type,
                size_bytes: file.size,
            });
            await recordXp("createNote", XP_RULES.createNote);
            setSelectedNote(note);
            setView({ kind: "note", noteId: note.id });
            onCreated();
        }
        catch (err) {
            setError(err.message || "Failed to attach file.");
        }
    }
    async function handleAudio(blob, fileName) {
        try {
            const note = await captureAudioToNote({
                blob,
                fileName,
                classId: selectedClassId ?? null,
            });
            setSelectedNote(note);
            setView({ kind: "note", noteId: note.id });
            onCreated();
        }
        catch (err) {
            setError(err.message || "Failed to save recording.");
        }
    }
    return (_jsxs(_Fragment, { children: [_jsxs("section", { className: "quick-actions", children: [_jsx(QuickActionTile, { variant: "new-note", title: "New Note", sub: "Start writing", icon: _jsx(PencilIcon, { size: 20 }), onClick: () => void newNote() }), _jsx(QuickActionTile, { variant: "record-audio", title: "Record Audio", sub: "Capture ideas", icon: _jsx(MicIcon, { size: 20 }), onClick: () => {
                            setError(null);
                            setRecorderOpen(true);
                        } }), _jsx(QuickActionTile, { variant: "scan-board", title: "Scan Board", sub: "Snap whiteboard", icon: _jsx(CameraIcon, { size: 20 }), onClick: () => imageRef.current?.click() }), _jsx(QuickActionTile, { variant: "upload-file", title: "Upload File", sub: "Add documents", icon: _jsx(UploadIcon, { size: 20 }), onClick: () => fileRef.current?.click() })] }), _jsx("input", { ref: imageRef, type: "file", accept: "image/*", capture: "environment", style: { display: "none" }, onChange: (e) => void onScanPicked(e) }), _jsx("input", { ref: fileRef, type: "file", style: { display: "none" }, onChange: (e) => void onFilePicked(e) }), recorderOpen && (_jsx(AudioRecorderModal, { onClose: () => setRecorderOpen(false), onSave: async (b, fileName) => {
                    setRecorderOpen(false);
                    await handleAudio(b, fileName ?? null);
                } })), error && (_jsx("div", { className: "pill error", style: { alignSelf: "flex-start" }, children: error }))] }));
};
function stripExt(name) {
    const i = name.lastIndexOf(".");
    return i > 0 ? name.slice(0, i) : name;
}
function fileToDataUri(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(r.error ?? new Error("read failed"));
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(file);
    });
}
/* ---- continue writing ------------------------------------------- */
/** Stacked papers illustration (matches dashboard mock — outline stack + ruled top sheet). */
const ContinueWritingPapersArt = () => (_jsxs("svg", { className: "cw-papers-svg", viewBox: "0 0 52 56", width: 52, height: 56, "aria-hidden": true, children: [_jsx("rect", { x: "9", y: "13", width: "36", height: "40", rx: "3", fill: "var(--color-surfaceMuted)", stroke: "var(--color-border)", strokeWidth: "1.5" }), _jsx("rect", { x: "5", y: "7", width: "38", height: "42", rx: "3", fill: "var(--color-surface)", stroke: "var(--color-borderStrong)", strokeWidth: "1.5" }), _jsx("rect", { x: "1", y: "1", width: "40", height: "46", rx: "4", fill: "var(--color-surfaceRaised)", stroke: "var(--color-primary)", strokeWidth: "1.75" }), _jsx("line", { x1: "9", y1: "14", x2: "33", y2: "14", stroke: "var(--color-textSubtle)", strokeWidth: "1.15", strokeLinecap: "round" }), _jsx("line", { x1: "9", y1: "20", x2: "31", y2: "20", stroke: "var(--color-textSubtle)", strokeWidth: "1.15", strokeLinecap: "round" }), _jsx("line", { x1: "9", y1: "26", x2: "29", y2: "26", stroke: "var(--color-textSubtle)", strokeWidth: "1.15", strokeLinecap: "round" }), _jsx("line", { x1: "9", y1: "32", x2: "27", y2: "32", stroke: "var(--color-textSubtle)", strokeWidth: "1.15", strokeLinecap: "round" })] }));
const ContinueWritingCard = () => {
    const notes = useApp((s) => s.notes);
    const classes = useApp((s) => s.classes);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const setView = useApp((s) => s.setView);
    const last = notes[0];
    const classLabel = useMemo(() => {
        if (!last?.class_id)
            return "Unfiled";
        return classes.find((c) => c.id === last.class_id)?.name ?? "Unfiled";
    }, [last, classes]);
    return (_jsx(Card, { className: "continue-writing-card", title: "Continue Writing", icon: _jsx(ClockIcon, { size: 18 }), children: last ? (_jsxs("div", { className: "continue-writing", children: [_jsxs("div", { className: "cw-main", children: [_jsx("span", { className: "cw-papers", "aria-hidden": true, children: _jsx(ContinueWritingPapersArt, {}) }), _jsxs("div", { className: "cw-meta", children: [_jsx("span", { className: "cw-title", children: last.title || "Untitled" }), _jsx("span", { className: "cw-sub", children: classLabel }), _jsxs("span", { className: "cw-when", children: [_jsx(ClockIcon, { size: 12 }), "Edited ", fmtRelative(new Date(last.updated_at))] })] })] }), _jsx("div", { className: "cw-footer", children: _jsxs("button", { type: "button", className: "cw-open", onClick: () => {
                            setSelectedNote(last);
                            setView({ kind: "note", noteId: last.id });
                        }, children: ["Open Note ", _jsx(ArrowRightIcon, { size: 14 })] }) })] })) : (_jsx("div", { style: { color: "var(--color-textMuted)", fontSize: 13 }, children: "No notes yet \u2014 your most recent draft will live here." })) }));
};
const COLLECTION_CHIPS = [
    {
        key: "thisWeek",
        label: "This Week",
        icon: _jsx(CalendarIcon, { size: 24 }),
        fg: "var(--color-accentSky)",
        bg: "var(--color-accentSkySoft)",
    },
    {
        key: "examPrep",
        label: "Exam Prep",
        icon: _jsx(SparklesIcon, { size: 24 }),
        fg: "var(--color-accentRose)",
        bg: "var(--color-accentRoseSoft)",
    },
    {
        key: "audio",
        label: "Audio Notes",
        icon: _jsx(MicIcon, { size: 24 }),
        fg: "var(--color-accentAmber)",
        bg: "var(--color-accentAmberSoft)",
    },
    {
        key: "scans",
        label: "Board Scans",
        icon: _jsx(CameraIcon, { size: 24 }),
        fg: "var(--color-accentSage)",
        bg: "var(--color-accentSageSoft, var(--color-accentSkySoft))",
    },
    {
        key: "needsReview",
        label: "Needs Review",
        icon: _jsx(EyeIcon, { size: 24 }),
        fg: "var(--color-accentPeach)",
        bg: "var(--color-accentPeachSoft)",
    },
];
const SmartCollectionsCard = ({ counts, active, onPick }) => (_jsx(Card, { title: "Smart Collections", icon: _jsx(BoltIcon, { size: 18 }), children: _jsx("div", { className: "collection-chips", children: COLLECTION_CHIPS.map((c) => {
            const value = counts[c.key];
            const isActive = active === c.key;
            return (_jsxs("button", { type: "button", className: `collection-chip${isActive ? " active" : ""}`, style: { background: c.bg }, onClick: () => onPick(c.key), children: [_jsx("span", { className: "chip-icon", style: { color: c.fg }, children: c.icon }), _jsx("span", { className: "chip-label", children: c.label }), _jsx("span", { className: "chip-count", children: value })] }, c.key));
        }) }) }));
/* ---- recent notes ----------------------------------------------- */
const RecentNotesCard = ({ notes, classMap, filterLabel, onClearFilter, onDelete }) => {
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const setView = useApp((s) => s.setView);
    // The home Notes screen always shows the 5 most recent — the full
    // browseable list lives on the dedicated All Notes view.
    const visible = notes.slice(0, 5);
    function open(n) {
        setSelectedNote(n);
        setView({ kind: "note", noteId: n.id });
    }
    return (_jsxs(Card, { className: "recent-notes-card", title: "Recent Notes", icon: _jsx(NoteIcon, { size: 18 }), action: notes.length > 0 ? (_jsxs("button", { type: "button", className: "recent-notes-header-action", onClick: () => setView({ kind: "allNotes" }), children: ["View all notes", _jsx(ArrowRightIcon, { size: 12 })] })) : undefined, children: [filterLabel && (_jsxs("div", { className: "recent-filter-bar", children: [_jsxs("span", { className: "pill", children: [filterLabel, " \u00B7 ", notes.length] }), _jsx("button", { type: "button", className: "btn-ghost", onClick: onClearFilter, children: "Clear filter" })] })), notes.length === 0 ? (_jsx("div", { style: { color: "var(--color-textMuted)", fontSize: 13, padding: "8px 0" }, children: "No notes match this view yet." })) : (_jsx("div", { className: "recent-table", children: visible.map((n) => {
                    const cls = n.class_id ? classMap.get(n.class_id) : null;
                    const items = [
                        { label: "Open", icon: _jsx(NoteIcon, { size: 14 }), onClick: () => open(n) },
                        {
                            label: "Delete note…",
                            icon: _jsx(TrashIcon, { size: 14 }),
                            danger: true,
                            onClick: () => onDelete(n),
                        },
                    ];
                    return (_jsxs("div", { className: "recent-table-row", role: "button", tabIndex: 0, onClick: () => open(n), onKeyDown: (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                open(n);
                            }
                        }, children: [_jsx("span", { className: "row-glyph", "aria-hidden": true, children: _jsx(NoteGlyph, { icon: n.icon, size: 16 }) }), _jsx("span", { className: "row-title", children: n.title || "Untitled" }), _jsx("span", { className: "row-class", children: cls?.name ?? "Unfiled" }), _jsx("span", { className: "row-when", children: fmtShortDate(new Date(n.updated_at)) }), _jsx("span", { className: "row-actions", onClick: (e) => e.stopPropagation(), children: _jsx(MoreMenu, { items: items, label: `More actions for ${n.title || "Untitled"}` }) })] }, n.id));
                }) }))] }));
};
/* ---- ai ready queue --------------------------------------------- */
const AI_ACTION_META = {
    summarize: {
        label: "Summarize",
        sub: "Ready to summarize",
        icon: _jsx(SparklesIcon, { size: 14 }),
        bg: "var(--color-accentSkySoft)",
        fg: "var(--color-accentSky)",
    },
    flashcards: {
        label: "Flashcards",
        sub: "Ready to create flashcards",
        icon: _jsx(FlashcardIcon, { size: 14 }),
        bg: "var(--color-accentRoseSoft)",
        fg: "var(--color-accentRose)",
    },
    quiz: {
        label: "Quiz",
        sub: "Ready to create quiz",
        icon: _jsx(QuizIcon, { size: 14 }),
        bg: "var(--color-accentAmberSoft)",
        fg: "var(--color-accentAmber)",
    },
};
const AiReadyQueueCard = ({ queue }) => {
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const setView = useApp((s) => s.setView);
    return (_jsx(Card, { title: "AI Ready Queue", icon: _jsx(SparklesIcon, { size: 18 }), children: queue.length === 0 ? (_jsx("div", { style: { color: "var(--color-textMuted)", fontSize: 13, padding: "8px 0" }, children: "You're all caught up \u2014 every note has its study tools and summary." })) : (_jsx("div", { className: "ai-queue", children: queue.map(({ note, action }) => {
                const meta = AI_ACTION_META[action];
                return (_jsxs("div", { className: "ai-queue-row", children: [_jsx("span", { className: "aiq-glyph", "aria-hidden": true, children: _jsx(NoteGlyph, { icon: note.icon, size: 16 }) }), _jsxs("div", { className: "aiq-meta", children: [_jsx("span", { className: "aiq-title", children: note.title || "Untitled" }), _jsx("span", { className: "aiq-sub", children: meta.sub })] }), _jsxs("button", { type: "button", className: "aiq-action", style: { background: meta.bg, color: meta.fg }, onClick: () => {
                                setSelectedNote(note);
                                setView({ kind: "note", noteId: note.id });
                            }, children: [meta.icon, _jsx("span", { children: meta.label })] })] }, `${note.id}-${action}`));
            }) })) }));
};
/* ---- needs attention -------------------------------------------- */
const NeedsAttentionStrip = ({ counts, onPick }) => {
    const setView = useApp((s) => s.setView);
    const [artBroken, setArtBroken] = useState(false);
    return (_jsx("section", { className: "attention-strip", children: _jsxs(Card, { title: "Needs Attention", icon: _jsx(WarningIcon, { size: 18 }), children: [_jsxs("div", { className: "attention-grid", children: [_jsxs("button", { type: "button", className: "attention-tile", onClick: () => onPick("needsTools"), children: [_jsx("span", { className: "att-icon", style: {
                                        background: "var(--color-accentRoseSoft)",
                                        color: "var(--color-accentRose)",
                                    }, children: _jsx(NoteIcon, { size: 18 }) }), _jsxs("span", { className: "att-text", children: [_jsxs("span", { className: "att-title", children: [counts.needsTools, " ", pluralize(counts.needsTools, "note", "notes"), " need study tools"] }), _jsx("span", { className: "att-sub", children: "Add flashcards, quizzes, or summaries" })] })] }), _jsxs("button", { type: "button", className: "attention-tile", onClick: () => onPick("audioPending"), children: [_jsx("span", { className: "att-icon", style: {
                                        background: "var(--color-accentAmberSoft)",
                                        color: "var(--color-accentAmber)",
                                    }, children: _jsx(MicIcon, { size: 18 }) }), _jsxs("span", { className: "att-text", children: [_jsxs("span", { className: "att-title", children: [counts.audioPending, " audio ", pluralize(counts.audioPending, "recording", "recordings")] }), _jsx("span", { className: "att-sub", children: counts.audioPending === 1 ? "Needs transcription" : "Need transcription" })] })] }), _jsxs("button", { type: "button", className: "attention-tile", onClick: () => setView({ kind: "settings" }), children: [_jsx("span", { className: "att-icon", style: {
                                        background: "var(--color-accentSkySoft)",
                                        color: "var(--color-accentSky)",
                                    }, children: _jsx(CloudOffIcon, { size: 18 }) }), _jsxs("span", { className: "att-text", children: [_jsxs("span", { className: "att-title", children: [counts.unsynced, " ", pluralize(counts.unsynced, "note has", "notes have")] }), _jsx("span", { className: "att-sub", children: counts.unsynced > 0 ? "Unsynced changes" : "Synced changes" })] })] })] }), !artBroken && (_jsx("img", { src: BRAND_ATTENTION_URL, alt: "", className: "attention-art", decoding: "async", onError: () => setArtBroken(true) }))] }) }));
};
/* ---- empty state ------------------------------------------------ */
const NotesEmptyState = ({ onCreated }) => {
    const setView = useApp((s) => s.setView);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    async function go() {
        const note = await upsertNote({ title: "Untitled" });
        await recordXp("createNote", XP_RULES.createNote);
        setSelectedNote(note);
        setView({ kind: "note", noteId: note.id });
        onCreated();
    }
    return (_jsx(Card, { children: _jsxs("div", { className: "empty", children: [_jsx("span", { style: { fontSize: 16, fontWeight: 600 }, children: "No notes yet" }), _jsx("span", { children: "Create your first note or capture audio with the actions above." }), _jsxs("button", { className: "btn-primary", style: { marginTop: 12 }, onClick: () => void go(), children: [_jsx(PencilIcon, { size: 14 }), " New note"] })] }) }));
};
/* ---- formatting helpers ----------------------------------------- */
function pluralize(n, singular, plural) {
    return n === 1 ? singular : plural;
}
function fmtRelative(d) {
    const diff = Date.now() - d.getTime();
    const m = Math.round(diff / 60_000);
    if (m < 1)
        return "just now";
    if (m < 60)
        return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24)
        return `${h}h ago`;
    const days = Math.round(h / 24);
    return `${days}d ago`;
}
function fmtShortDate(d) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - dt.getTime()) / 86_400_000);
    if (diff === 0)
        return `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    if (diff === 1)
        return "Yesterday";
    if (diff < 7)
        return d.toLocaleDateString(undefined, { weekday: "long" });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
//# sourceMappingURL=NotesList.js.map