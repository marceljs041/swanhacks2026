import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attachmentCountsByNote, listClasses, listNotes, noteIdsWithStudyTools, notesNeedingSummary, recordXp, softDeleteNote, unsyncedNoteIds, upsertAttachment, upsertNote, } from "../db/repositories.js";
import { useApp } from "../store.js";
import { XP_RULES } from "@studynest/shared";
import { BRAND_HERO_URL } from "../lib/brand.js";
import { NoteGlyph } from "../lib/noteIcons.js";
import { Card } from "./ui/Card.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import { MoreMenu } from "./ui/MoreMenu.js";
import { AudioRecorderModal } from "./AudioRecorderModal.js";
import { HeroSearch } from "./HeroSearch.js";
import { CalendarIcon, CameraIcon, CheckIcon, ChevDownIcon, ChevLeftIcon, ChevRightIcon, ClockIcon, CloudCheckIcon, CloudOffIcon, EyeIcon, FlameIcon, ImageIcon, MicIcon, MoreIcon, NoteIcon, PencilIcon, SparklesIcon, TrashIcon, UploadIcon, } from "./icons.js";
const PAGE_SIZE = 10;
export const AllNotes = () => {
    const setView = useApp((s) => s.setView);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const notes = useApp((s) => s.notes);
    const setNotes = useApp((s) => s.setNotes);
    const classes = useApp((s) => s.classes);
    const setClasses = useApp((s) => s.setClasses);
    const [attMap, setAttMap] = useState(new Map());
    const [unsynced, setUnsynced] = useState(new Set());
    const [studyTools, setStudyTools] = useState(new Set());
    const [needSummary, setNeedSummary] = useState(new Set());
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [classFilter, setClassFilter] = useState("all");
    const [tagFilter, setTagFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("all");
    const [sortKey, setSortKey] = useState("lastEdited");
    const [view, setLocalView] = useState("list");
    const [page, setPage] = useState(1);
    const reload = useCallback(async () => {
        const [ns, cls, atts, uns, tools, summary] = await Promise.all([
            listNotes(null),
            listClasses(),
            attachmentCountsByNote(),
            unsyncedNoteIds(),
            noteIdsWithStudyTools(),
            notesNeedingSummary(500),
        ]);
        setNotes(ns);
        setClasses(cls);
        setAttMap(atts);
        setUnsynced(uns);
        setStudyTools(tools);
        setNeedSummary(new Set(summary.map((n) => n.id)));
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
    const allTags = useMemo(() => {
        const set = new Set();
        for (const n of notes) {
            for (const t of parseTags(n.tags_json))
                set.add(t);
        }
        return Array.from(set).sort();
    }, [notes]);
    const filtered = useMemo(() => {
        const today = startOfToday();
        const weekAgo = addDays(today, -7);
        const monthAgo = addDays(today, -30);
        let out = notes.slice();
        if (classFilter !== "all") {
            out = out.filter((n) => n.class_id === classFilter);
        }
        if (tagFilter !== "all") {
            const want = tagFilter.toLowerCase();
            out = out.filter((n) => parseTags(n.tags_json).some((t) => t.toLowerCase() === want));
        }
        if (typeFilter !== "all") {
            out = out.filter((n) => {
                const a = attMap.get(n.id);
                if (typeFilter === "none")
                    return !a || a.total === 0;
                if (!a)
                    return false;
                return a[typeFilter] > 0;
            });
        }
        if (dateFilter !== "all") {
            const cutoff = dateFilter === "today"
                ? today
                : dateFilter === "week"
                    ? weekAgo
                    : monthAgo;
            out = out.filter((n) => new Date(n.updated_at) >= cutoff);
        }
        out.sort((a, b) => {
            switch (sortKey) {
                case "title":
                    return (a.title || "").localeCompare(b.title || "");
                case "created":
                    return b.created_at.localeCompare(a.created_at);
                case "favorite": {
                    const af = isFavorite(a) ? 1 : 0;
                    const bf = isFavorite(b) ? 1 : 0;
                    if (af !== bf)
                        return bf - af;
                    return b.updated_at.localeCompare(a.updated_at);
                }
                case "lastEdited":
                default:
                    return b.updated_at.localeCompare(a.updated_at);
            }
        });
        return out;
    }, [notes, classFilter, tagFilter, typeFilter, dateFilter, sortKey, attMap]);
    // Reset to page 1 whenever the filter/sort changes shape so the user
    // never lands on an empty page after narrowing the result set.
    useEffect(() => {
        setPage(1);
    }, [classFilter, tagFilter, typeFilter, dateFilter, sortKey, view]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);
    function open(n) {
        setSelectedNote(n);
        setView({ kind: "note", noteId: n.id });
    }
    async function handleDelete() {
        if (!confirmDelete)
            return;
        await softDeleteNote(confirmDelete.id);
        setConfirmDelete(null);
        await reload();
    }
    return (_jsxs("main", { className: "main", children: [_jsxs("div", { className: "main-inner", children: [_jsx(AllNotesHero, { onBack: () => setView({ kind: "notes" }) }), _jsx(FilterToolbar, { classes: classes, tags: allTags, classFilter: classFilter, tagFilter: tagFilter, typeFilter: typeFilter, dateFilter: dateFilter, sortKey: sortKey, view: view, onClass: setClassFilter, onTag: setTagFilter, onType: setTypeFilter, onDate: setDateFilter, onSort: setSortKey, onView: setLocalView }), _jsx(AllNotesQuickActions, { onCreated: () => void reload() }), _jsxs(Card, { className: "all-notes-card", title: `Showing ${filtered.length === 0 ? 0 : pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length} notes`, icon: _jsx(NoteIcon, { size: 18 }), children: [filtered.length === 0 ? (_jsx("div", { className: "all-notes-empty", children: "No notes match these filters yet. Try clearing a filter or creating a new note above." })) : view === "list" ? (_jsx(AllNotesTable, { rows: pageRows, classMap: classMap, attMap: attMap, studyTools: studyTools, needSummary: needSummary, unsynced: unsynced, onOpen: open, onDelete: (n) => setConfirmDelete(n), onToggleFavorite: async (n) => {
                                    await toggleFavorite(n);
                                    await reload();
                                } })) : (_jsx(AllNotesGrid, { rows: pageRows, classMap: classMap, attMap: attMap, studyTools: studyTools, needSummary: needSummary, unsynced: unsynced, onOpen: open })), filtered.length > 0 && (_jsx(Pagination, { page: safePage, totalPages: totalPages, total: filtered.length, onPick: setPage }))] })] }), confirmDelete && (_jsx(ConfirmDialog, { title: "Delete this note?", body: _jsxs(_Fragment, { children: [_jsx("strong", { children: confirmDelete.title || "Untitled" }), " will be moved to trash and removed from your study tools. You can't undo this from the app."] }), confirmLabel: "Delete note", cancelLabel: "Keep note", danger: true, onConfirm: () => void handleDelete(), onCancel: () => setConfirmDelete(null) }))] }));
};
/* ---- hero -------------------------------------------------------- */
const AllNotesHero = ({ onBack }) => (_jsxs("section", { className: "hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(HeroSearch, {}), _jsxs("div", { className: "hero-greeting all-notes-greeting", children: [_jsxs("nav", { className: "all-notes-breadcrumb", "aria-label": "Breadcrumb", children: [_jsx("button", { type: "button", className: "bc-link", onClick: onBack, children: "Notes" }), _jsx("span", { className: "bc-sep", "aria-hidden": true, children: "/" }), _jsx("span", { className: "bc-current", children: "All Notes" })] }), _jsx("h1", { className: "hero-headline", children: "All Notes" }), _jsx("p", { children: "Browse, filter, and organize every note in one place." })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_HERO_URL, alt: "", decoding: "async" }) })] }));
const FilterToolbar = ({ classes, tags, classFilter, tagFilter, typeFilter, dateFilter, sortKey, view, onClass, onTag, onType, onDate, onSort, onView, }) => {
    return (_jsxs("section", { className: "all-notes-toolbar", children: [_jsxs("div", { className: "toolbar-filters", children: [_jsx(FilterDropdown, { icon: _jsx(ClassIconShim, {}), label: "Class", value: classFilter, onChange: (v) => onClass(v), options: [
                            { value: "all", label: "All classes" },
                            ...classes.map((c) => ({ value: c.id, label: c.name })),
                        ] }), _jsx(FilterDropdown, { icon: _jsx(TagShim, {}), label: "Tag", value: tagFilter, onChange: (v) => onTag(v), options: [
                            { value: "all", label: "All tags" },
                            ...tags.map((t) => ({ value: t, label: t })),
                        ] }), _jsx(FilterDropdown, { icon: _jsx(NoteIcon, { size: 14 }), label: "Type", value: typeFilter, onChange: (v) => onType(v), options: [
                            { value: "all", label: "All types" },
                            { value: "audio", label: "Has audio" },
                            { value: "image", label: "Has images" },
                            { value: "pdf", label: "Has PDF" },
                            { value: "file", label: "Has file" },
                            { value: "none", label: "Text only" },
                        ] }), _jsx(FilterDropdown, { icon: _jsx(CalendarIcon, { size: 14 }), label: "Date", value: dateFilter, onChange: (v) => onDate(v), options: [
                            { value: "all", label: "Any time" },
                            { value: "today", label: "Today" },
                            { value: "week", label: "This week" },
                            { value: "month", label: "This month" },
                        ] }), _jsx(FilterDropdown, { icon: _jsx(ClockIcon, { size: 14 }), label: "Sort by", value: sortKey, onChange: (v) => onSort(v), options: [
                            { value: "lastEdited", label: "Last edited" },
                            { value: "created", label: "Date created" },
                            { value: "title", label: "Title (A–Z)" },
                            { value: "favorite", label: "Favorites first" },
                        ] })] }), _jsxs("div", { className: "toolbar-view-toggle", role: "tablist", "aria-label": "View mode", children: [_jsxs("button", { type: "button", className: `view-toggle ${view === "list" ? "active" : ""}`, onClick: () => onView("list"), "aria-pressed": view === "list", children: [_jsx(ListGlyph, {}), " ", _jsx("span", { children: "List" })] }), _jsxs("button", { type: "button", className: `view-toggle ${view === "grid" ? "active" : ""}`, onClick: () => onView("grid"), "aria-pressed": view === "grid", children: [_jsx(GridGlyph, {}), " ", _jsx("span", { children: "Grid" })] })] })] }));
};
const FilterDropdown = ({ icon, label, value, options, onChange }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const current = options.find((o) => o.value === value);
    useEffect(() => {
        if (!open)
            return;
        function onDoc(e) {
            if (!wrapRef.current?.contains(e.target))
                setOpen(false);
        }
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);
    const isActive = value !== "all" && value !== "lastEdited";
    return (_jsxs("div", { className: "filter-dropdown", ref: wrapRef, children: [_jsxs("button", { type: "button", className: `filter-trigger${isActive ? " active" : ""}`, onClick: () => setOpen((v) => !v), "aria-haspopup": "listbox", "aria-expanded": open, children: [_jsx("span", { className: "filter-icon", children: icon }), _jsx("span", { className: "filter-label", children: label }), current && current.value !== "all" && current.value !== "lastEdited" && (_jsxs(_Fragment, { children: [_jsx("span", { className: "filter-sep", "aria-hidden": true, children: "\u00B7" }), _jsx("span", { className: "filter-value", children: current.label })] })), _jsx(ChevDownIcon, { size: 14 })] }), open && (_jsx("div", { className: "filter-menu", role: "listbox", children: options.map((opt) => (_jsxs("button", { type: "button", role: "option", "aria-selected": opt.value === value, className: `filter-option${opt.value === value ? " active" : ""}`, onClick: () => {
                        onChange(opt.value);
                        setOpen(false);
                    }, children: [_jsx("span", { children: opt.label }), opt.value === value && _jsx(CheckIcon, { size: 12 })] }, opt.value))) }))] }));
};
const ListGlyph = () => (_jsx("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "M4 6h16M4 12h16M4 18h16" }) }));
const GridGlyph = () => (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("rect", { x: "4", y: "4", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "13", y: "4", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "4", y: "13", width: "7", height: "7", rx: "1.5" }), _jsx("rect", { x: "13", y: "13", width: "7", height: "7", rx: "1.5" })] }));
const ClassIconShim = () => (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M4 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4Z" }), _jsx("path", { d: "M4 5v14" })] }));
const TagShim = () => (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M3 12V4h8l10 10-8 8L3 12Z" }), _jsx("circle", { cx: "7.5", cy: "7.5", r: "1.2" })] }));
/* ---- quick actions ---------------------------------------------- */
const AllNotesQuickActions = ({ onCreated }) => {
    const setView = useApp((s) => s.setView);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const imageRef = useRef(null);
    const fileRef = useRef(null);
    const [recorderOpen, setRecorderOpen] = useState(false);
    const [error, setError] = useState(null);
    async function newNote() {
        const note = await upsertNote({ title: "Untitled", content_markdown: "" });
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
    async function handleAudio(blob) {
        try {
            const dataUri = await blobToDataUri(blob);
            const title = `Voice note · ${new Date().toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            })}`;
            const note = await upsertNote({
                title,
                content_markdown: "Recorded audio attached. Open the note to play it back or transcribe later.",
            });
            await upsertAttachment({
                note_id: note.id,
                type: "audio",
                local_uri: dataUri,
                file_name: "recording.webm",
                mime_type: blob.type || "audio/webm",
                size_bytes: blob.size,
            });
            await recordXp("createNote", XP_RULES.createNote);
            setSelectedNote(note);
            setView({ kind: "note", noteId: note.id });
            onCreated();
        }
        catch (err) {
            setError(err.message || "Failed to save recording.");
        }
    }
    return (_jsxs(_Fragment, { children: [_jsxs("section", { className: "quick-actions", children: [_jsxs("button", { type: "button", className: "quick-action quick-action--new-note", onClick: () => void newNote(), children: [_jsx("span", { className: "qa-icon", children: _jsx(PencilIcon, { size: 20 }) }), _jsxs("span", { className: "qa-text", children: [_jsx("span", { className: "qa-title", children: "New Note" }), _jsx("span", { className: "qa-sub", children: "Start writing" })] })] }), _jsxs("button", { type: "button", className: "quick-action quick-action--record-audio", onClick: () => {
                            setError(null);
                            setRecorderOpen(true);
                        }, children: [_jsx("span", { className: "qa-icon", children: _jsx(MicIcon, { size: 20 }) }), _jsxs("span", { className: "qa-text", children: [_jsx("span", { className: "qa-title", children: "Record Audio" }), _jsx("span", { className: "qa-sub", children: "Capture ideas" })] })] }), _jsxs("button", { type: "button", className: "quick-action quick-action--scan-board", onClick: () => imageRef.current?.click(), children: [_jsx("span", { className: "qa-icon", children: _jsx(CameraIcon, { size: 20 }) }), _jsxs("span", { className: "qa-text", children: [_jsx("span", { className: "qa-title", children: "Scan Board" }), _jsx("span", { className: "qa-sub", children: "Snap whiteboard" })] })] }), _jsxs("button", { type: "button", className: "quick-action quick-action--upload-file", onClick: () => fileRef.current?.click(), children: [_jsx("span", { className: "qa-icon", children: _jsx(UploadIcon, { size: 20 }) }), _jsxs("span", { className: "qa-text", children: [_jsx("span", { className: "qa-title", children: "Upload File" }), _jsx("span", { className: "qa-sub", children: "Add documents" })] })] })] }), _jsx("input", { ref: imageRef, type: "file", accept: "image/*", capture: "environment", style: { display: "none" }, onChange: (e) => void onScanPicked(e) }), _jsx("input", { ref: fileRef, type: "file", style: { display: "none" }, onChange: (e) => void onFilePicked(e) }), recorderOpen && (_jsx(AudioRecorderModal, { onClose: () => setRecorderOpen(false), onSave: async (b) => {
                    setRecorderOpen(false);
                    await handleAudio(b);
                } })), error && (_jsx("div", { className: "pill error", style: { alignSelf: "flex-start" }, children: error }))] }));
};
const AllNotesTable = ({ rows, classMap, attMap, studyTools, needSummary, unsynced, onOpen, onDelete, onToggleFavorite, }) => (_jsxs("div", { className: "all-notes-table", children: [_jsxs("div", { className: "ant-head", children: [_jsx("span", { children: "Note" }), _jsx("span", { children: "Class" }), _jsx("span", { children: "Tags" }), _jsx("span", { children: "Last edited" }), _jsx("span", { children: "Type / Attachments" }), _jsx("span", { children: "AI Status" }), _jsx("span", { children: "Sync Status" }), _jsx("span", { "aria-hidden": true })] }), rows.map((n) => {
            const cls = n.class_id ? classMap.get(n.class_id) : null;
            const tags = parseTags(n.tags_json);
            const att = attMap.get(n.id);
            const ai = aiStatusFor(n, studyTools, needSummary);
            const sync = syncStatusFor(n, unsynced);
            const fav = isFavorite(n);
            const items = [
                { label: "Open", icon: _jsx(NoteIcon, { size: 14 }), onClick: () => onOpen(n) },
                {
                    label: fav ? "Remove from favorites" : "Mark as favorite",
                    icon: _jsx(FlameIcon, { size: 14 }),
                    onClick: () => onToggleFavorite(n),
                },
                {
                    label: "Delete note…",
                    icon: _jsx(TrashIcon, { size: 14 }),
                    danger: true,
                    onClick: () => onDelete(n),
                },
            ];
            return (_jsxs("div", { className: "ant-row", role: "button", tabIndex: 0, onClick: () => onOpen(n), onKeyDown: (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(n);
                    }
                }, children: [_jsxs("span", { className: "ant-title-cell", children: [_jsx("button", { type: "button", className: `ant-fav${fav ? " active" : ""}`, "aria-label": fav ? "Remove from favorites" : "Mark as favorite", onClick: (e) => {
                                    e.stopPropagation();
                                    onToggleFavorite(n);
                                }, children: _jsx(Star, { filled: fav }) }), _jsx("span", { className: "ant-glyph", "aria-hidden": true, children: _jsx(NoteGlyph, { icon: n.icon, size: 16 }) }), _jsx("span", { className: "ant-title", children: n.title || "Untitled" })] }), _jsx("span", { className: "ant-class", children: cls ? _jsx("span", { className: "class-pill", children: cls.name }) : _jsx("span", { className: "muted", children: "\u2014" }) }), _jsxs("span", { className: "ant-tags", children: [tags.length === 0 ? (_jsx("span", { className: "muted", children: "\u2014" })) : (tags.slice(0, 2).map((t) => (_jsx("span", { className: `tag-pill tag-${tagPalette(t)}`, children: t }, t)))), tags.length > 2 && _jsxs("span", { className: "tag-pill tag-more", children: ["+", tags.length - 2] })] }), _jsx("span", { className: "ant-when", children: fmtShortDate(new Date(n.updated_at)) }), _jsx("span", { className: "ant-att", children: !att || att.total === 0 ? (_jsx("span", { className: "muted", children: "\u2014" })) : (_jsxs("span", { className: "att-stack", children: [att.audio > 0 && _jsx(AttBadge, { icon: _jsx(MicIcon, { size: 11 }), label: `${att.audio} audio` }), att.image > 0 && _jsx(AttBadge, { icon: _jsx(ImageIcon, { size: 11 }), label: `${att.image} image${att.image === 1 ? "" : "s"}` }), att.pdf > 0 && _jsx(AttBadge, { icon: _jsx(NoteIcon, { size: 11 }), label: `${att.pdf} PDF` }), att.file > 0 && _jsx(AttBadge, { icon: _jsx(UploadIcon, { size: 11 }), label: `${att.file} file${att.file === 1 ? "" : "s"}` })] })) }), _jsx("span", { className: "ant-ai", children: _jsx(AiStatusPill, { status: ai }) }), _jsx("span", { className: "ant-sync", children: _jsx(SyncStatusPill, { status: sync }) }), _jsx("span", { className: "ant-actions", onClick: (e) => e.stopPropagation(), children: _jsx(MoreMenu, { items: items, label: `More actions for ${n.title || "Untitled"}` }) })] }, n.id));
        })] }));
const AttBadge = ({ icon, label }) => (_jsxs("span", { className: "att-badge", children: [icon, _jsx("span", { children: label })] }));
const AiStatusPill = ({ status }) => {
    const meta = {
        summarized: { label: "Summarized", cls: "ai-summarized", icon: _jsx(SparklesIcon, { size: 11 }) },
        ready: { label: "Ready", cls: "ai-ready", icon: _jsx(CheckIcon, { size: 11 }) },
        needsReview: { label: "Needs Review", cls: "ai-review", icon: _jsx(EyeIcon, { size: 11 }) },
    };
    const m = meta[status];
    return (_jsxs("span", { className: `status-pill ${m.cls}`, children: [m.icon, _jsx("span", { children: m.label })] }));
};
const SyncStatusPill = ({ status }) => {
    const meta = {
        synced: { label: "Synced", cls: "sync-synced", icon: _jsx(CloudCheckIcon, { size: 11 }) },
        offline: { label: "Offline", cls: "sync-offline", icon: _jsx(CloudOffIcon, { size: 11 }) },
        needsReview: { label: "Needs Review", cls: "sync-review", icon: _jsx(EyeIcon, { size: 11 }) },
    };
    const m = meta[status];
    return (_jsxs("span", { className: `status-pill ${m.cls}`, children: [m.icon, _jsx("span", { children: m.label })] }));
};
/* ---- grid view -------------------------------------------------- */
const AllNotesGrid = ({ rows, classMap, attMap, studyTools, needSummary, unsynced, onOpen, }) => (_jsx("div", { className: "all-notes-grid", children: rows.map((n) => {
        const cls = n.class_id ? classMap.get(n.class_id) : null;
        const tags = parseTags(n.tags_json);
        const att = attMap.get(n.id);
        const ai = aiStatusFor(n, studyTools, needSummary);
        const sync = syncStatusFor(n, unsynced);
        return (_jsxs("button", { type: "button", className: "grid-card", onClick: () => onOpen(n), children: [_jsxs("span", { className: "grid-card-head", children: [_jsx("span", { className: "ant-glyph", "aria-hidden": true, children: _jsx(NoteGlyph, { icon: n.icon, size: 16 }) }), _jsx("span", { className: "grid-card-title", children: n.title || "Untitled" }), _jsx("span", { className: "grid-card-more", "aria-hidden": true, children: _jsx(MoreIcon, { size: 14 }) })] }), cls && _jsx("span", { className: "class-pill", children: cls.name }), _jsx("p", { className: "grid-card-snippet", children: snippetOf(n.content_markdown) || "No preview yet." }), _jsx("span", { className: "grid-card-tags", children: tags.slice(0, 3).map((t) => (_jsx("span", { className: `tag-pill tag-${tagPalette(t)}`, children: t }, t))) }), _jsxs("span", { className: "grid-card-foot", children: [_jsx(AiStatusPill, { status: ai }), _jsx(SyncStatusPill, { status: sync })] }), _jsxs("span", { className: "grid-card-meta", children: [_jsx(ClockIcon, { size: 11 }), _jsx("span", { children: fmtShortDate(new Date(n.updated_at)) }), att && att.total > 0 && (_jsxs("span", { className: "grid-card-att", children: ["\u00B7 ", att.total, " attachment", att.total === 1 ? "" : "s"] }))] })] }, n.id));
    }) }));
/* ---- pagination ------------------------------------------------- */
const Pagination = ({ page, totalPages, onPick }) => {
    const pages = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);
    return (_jsxs("div", { className: "all-notes-pagination", children: [_jsx("button", { type: "button", className: "page-btn", onClick: () => onPick(Math.max(1, page - 1)), disabled: page === 1, "aria-label": "Previous page", children: _jsx(ChevLeftIcon, { size: 14 }) }), pages.map((p, i) => p === "…" ? (_jsx("span", { className: "page-gap", children: "\u2026" }, `gap-${i}`)) : (_jsx("button", { type: "button", className: `page-btn${p === page ? " active" : ""}`, onClick: () => onPick(p), "aria-current": p === page ? "page" : undefined, children: p }, p))), _jsx("button", { type: "button", className: "page-btn", onClick: () => onPick(Math.min(totalPages, page + 1)), disabled: page === totalPages, "aria-label": "Next page", children: _jsx(ChevRightIcon, { size: 14 }) }), _jsxs("span", { className: "page-size-hint", children: [PAGE_SIZE, " per page"] })] }));
};
function buildPageList(page, total) {
    if (total <= 7)
        return Array.from({ length: total }, (_, i) => i + 1);
    const out = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(total - 1, page + 1);
    if (start > 2)
        out.push("…");
    for (let i = start; i <= end; i++)
        out.push(i);
    if (end < total - 1)
        out.push("…");
    out.push(total);
    return out;
}
/* ---- helpers ---------------------------------------------------- */
function parseTags(json) {
    if (!json)
        return [];
    try {
        const v = JSON.parse(json);
        if (Array.isArray(v))
            return v.map((x) => String(x)).filter(Boolean);
    }
    catch {
        /* tolerate stray non-JSON tag blobs from older rows */
    }
    return [];
}
function isFavorite(n) {
    return parseTags(n.tags_json).some((t) => t.toLowerCase() === "favorite");
}
async function toggleFavorite(n) {
    const tags = parseTags(n.tags_json);
    const has = tags.some((t) => t.toLowerCase() === "favorite");
    const next = has
        ? tags.filter((t) => t.toLowerCase() !== "favorite")
        : [...tags, "favorite"];
    await upsertNote({ ...n, tags_json: JSON.stringify(next) });
}
function aiStatusFor(n, studyTools, needSummary) {
    const summarized = !!n.summary && n.summary.trim().length > 0;
    if (summarized)
        return "summarized";
    if (studyTools.has(n.id))
        return "ready";
    if (needSummary.has(n.id))
        return "needsReview";
    return "ready";
}
function syncStatusFor(n, unsynced) {
    if (unsynced.has(n.id))
        return "offline";
    return "synced";
}
function tagPalette(tag) {
    const t = tag.toLowerCase();
    if (t.includes("exam"))
        return "rose";
    if (t.includes("important") || t.includes("favorite"))
        return "amber";
    if (t.includes("review"))
        return "sky";
    if (t.includes("lab"))
        return "sage";
    return "neutral";
}
function snippetOf(md) {
    if (!md)
        return "";
    return md.replace(/[#*`>_\-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 110);
}
function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}
function addDays(d, n) {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
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
        return `Yesterday, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    if (diff < 7)
        return d.toLocaleDateString(undefined, { weekday: "long" });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
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
function blobToDataUri(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(r.error ?? new Error("read failed"));
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(blob);
    });
}
const Star = ({ filled }) => (_jsx("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: filled ? "currentColor" : "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9L12 3Z" }) }));
//# sourceMappingURL=AllNotes.js.map