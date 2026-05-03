import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../../store.js";
import { withViewTransition } from "../../lib/viewTransition.js";
import { duplicateEvent, getEvent, listChecklist, setEventStatus, softDeleteChecklistItem, softDeleteEvent, toggleChecklistItem, upsertChecklistItem, upsertEvent, } from "../../db/calendar.js";
import { getNote, listClasses, listFlashcardSets, listQuizzes, } from "../../db/repositories.js";
import { MoreMenu } from "../ui/MoreMenu.js";
import { ArrowLeftIcon, BellIcon, CalendarIcon, CheckIcon, ClockIcon, CloudCheckIcon, CloudOffIcon, FlashcardIcon, LinkIcon, NoteIcon, PencilIcon, PinIcon, PlusIcon, QuizIcon, RepeatIcon, TrashIcon, XIcon, } from "../icons.js";
import { fmtTime, iconForEvent, labelForType, toneForEvent, } from "./eventVisuals.js";
export const EventDetailRail = ({ eventId }) => {
    const setSelected = useApp((s) => s.setCalendarSelectedEvent);
    const setView = useApp((s) => s.setView);
    const setComposer = useApp((s) => s.setCalendarComposer);
    const syncStatus = useApp((s) => s.syncStatus);
    const [event, setEvent] = useState(null);
    const [checklist, setChecklist] = useState([]);
    const [classes, setClasses] = useState([]);
    const [note, setNote] = useState(null);
    const [decks, setDecks] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [reload, setReload] = useState(0);
    const [newItem, setNewItem] = useState("");
    // Load the event and any related rows the rail needs to render.
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const ev = await getEvent(eventId);
            if (cancelled)
                return;
            setEvent(ev);
            if (!ev) {
                setChecklist([]);
                setNote(null);
                return;
            }
            const [list, cls, allDecks, allQuizzes] = await Promise.all([
                listChecklist(eventId),
                listClasses(),
                listFlashcardSets(null),
                listQuizzes(null),
            ]);
            if (cancelled)
                return;
            setChecklist(list);
            setClasses(cls);
            setDecks(allDecks);
            setQuizzes(allQuizzes);
            if (ev.note_id) {
                const n = await getNote(ev.note_id);
                if (!cancelled)
                    setNote(n);
            }
            else {
                setNote(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [eventId, reload]);
    const cls = useMemo(() => {
        if (!event?.class_id)
            return null;
        return classes.find((c) => c.id === event.class_id) ?? null;
    }, [event, classes]);
    const deck = useMemo(() => {
        if (!event?.flashcard_set_id)
            return null;
        return decks.find((d) => d.id === event.flashcard_set_id) ?? null;
    }, [event, decks]);
    const quiz = useMemo(() => {
        if (!event?.quiz_id)
            return null;
        return quizzes.find((q) => q.id === event.quiz_id) ?? null;
    }, [event, quizzes]);
    const tags = useMemo(() => {
        if (!event)
            return [];
        try {
            const arr = JSON.parse(event.tags_json);
            if (Array.isArray(arr))
                return arr.filter((t) => typeof t === "string");
        }
        catch {
            /* drop */
        }
        return [];
    }, [event]);
    const close = useCallback(() => {
        withViewTransition(() => setSelected(null));
    }, [setSelected]);
    if (!event) {
        return (_jsxs("aside", { className: "right-panel calendar-rail empty right-panel--calendar-swap", "aria-label": "Event details", children: [_jsx("div", { className: "event-rail-head", children: _jsx("button", { type: "button", className: "event-rail-back", "aria-label": "Close event", onClick: close, children: _jsx(ArrowLeftIcon, { size: 16 }) }) }), _jsx("p", { className: "event-rail-empty-msg", children: "Loading event\u2026" })] }));
    }
    const tone = toneForEvent(event, cls);
    async function refresh() {
        setReload((n) => n + 1);
    }
    async function toggleItem(id) {
        await toggleChecklistItem(id);
        await refresh();
    }
    async function addItem() {
        const label = newItem.trim();
        if (!label)
            return;
        await upsertChecklistItem({ event_id: event.id, label });
        setNewItem("");
        await refresh();
    }
    async function removeItem(id) {
        await softDeleteChecklistItem(id);
        await refresh();
    }
    async function markComplete() {
        const next = event.status === "completed" ? "scheduled" : "completed";
        await setEventStatus(event.id, next);
        await refresh();
    }
    async function deleteEvent() {
        await softDeleteEvent(event.id);
        withViewTransition(() => setSelected(null));
    }
    async function duplicate() {
        const copy = await duplicateEvent(event.id);
        if (copy)
            setSelected(copy.id);
    }
    function edit() {
        setComposer({ mode: "edit", eventId: event.id });
    }
    const moreItems = [
        { label: "Edit event", icon: _jsx(PencilIcon, { size: 14 }), onClick: edit },
        {
            label: event.status === "completed" ? "Mark incomplete" : "Mark complete",
            icon: _jsx(CheckIcon, { size: 14 }),
            onClick: () => void markComplete(),
        },
        {
            label: "Duplicate",
            icon: _jsx(PlusIcon, { size: 14 }),
            onClick: () => void duplicate(),
        },
        {
            label: "Delete",
            icon: _jsx(TrashIcon, { size: 14 }),
            onClick: () => void deleteEvent(),
            danger: true,
        },
    ];
    const dateLabel = new Date(event.start_at).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
    async function saveTimes(startIso, endIso) {
        if (new Date(endIso).getTime() <= new Date(startIso).getTime())
            return;
        await upsertEvent({ ...event, start_at: startIso, end_at: endIso });
        await refresh();
    }
    const description = event.description?.trim() ||
        autoDescription(event, cls);
    const recurrenceLabel = recurrenceToLabel(event.recurrence_json);
    return (_jsxs("aside", { className: "right-panel calendar-rail right-panel--calendar-swap", "aria-label": "Event details", children: [_jsxs("header", { className: "event-rail-head", children: [_jsx("button", { type: "button", className: "event-rail-back", "aria-label": "Close event", onClick: close, children: _jsx(ArrowLeftIcon, { size: 16 }) }), _jsx("span", { className: "event-rail-spacer" }), _jsx(MoreMenu, { items: moreItems, label: "Event actions" })] }), _jsxs("div", { className: "event-rail-title", children: [_jsx("span", { className: `event-rail-icon tone-${tone}`, "aria-hidden": true, children: iconForEvent(event, 22) }), _jsxs("div", { className: "event-rail-title-text", children: [_jsx("h2", { children: event.title }), _jsx("span", { className: "event-rail-subtitle", children: cls ? cls.name : labelForType(event.type) })] })] }), _jsxs("div", { className: "event-rail-chips", children: [_jsx("span", { className: `rail-chip rail-chip-${tone}`, children: labelForType(event.type) }), tags.map((t) => (_jsx("span", { className: `rail-chip rail-chip-${chipTone(t)}`, children: t }, t))), event.source_type === "ai_generated" && (_jsx("span", { className: "rail-chip rail-chip-lilac", children: "AI Plan" })), recurrenceLabel && (_jsx("span", { className: "rail-chip rail-chip-sky", children: recurrenceLabel }))] }), _jsxs("div", { className: "event-rail-meta", children: [_jsx(MetaRow, { icon: _jsx(CalendarIcon, { size: 14 }), label: dateLabel }), _jsx(EditableTimeRow, { startIso: event.start_at, endIso: event.end_at, allDay: !!event.all_day, onSave: (s, e) => void saveTimes(s, e) }), event.location && (_jsx(MetaRow, { icon: _jsx(PinIcon, { size: 14 }), label: event.location })), event.reminder_at && (_jsx(MetaRow, { icon: _jsx(BellIcon, { size: 14 }), label: `Reminder ${fmtTime(event.reminder_at)}` })), recurrenceLabel && !event.location && !event.reminder_at && (_jsx(MetaRow, { icon: _jsx(RepeatIcon, { size: 14 }), label: recurrenceLabel }))] }), _jsxs("section", { className: "event-rail-block", children: [_jsx("header", { className: "event-rail-block-head", children: "Description" }), _jsx("p", { className: "event-rail-description", children: description })] }), _jsxs("section", { className: "event-rail-block", children: [_jsx("header", { className: "event-rail-block-head", children: "Tasks & Reminders" }), _jsxs("div", { className: "event-rail-checklist", children: [checklist.length === 0 && (_jsx("p", { className: "event-rail-empty", children: "No tasks yet \u2014 add one below." })), checklist.map((it) => (_jsxs("div", { className: `event-rail-task${it.completed ? " done" : ""}`, children: [_jsx("button", { type: "button", className: `event-rail-check${it.completed ? " done" : ""}`, "aria-label": it.completed ? "Mark incomplete" : "Mark complete", onClick: () => void toggleItem(it.id), children: it.completed ? _jsx(CheckIcon, { size: 12 }) : null }), _jsx("span", { className: "event-rail-task-label", children: it.label }), _jsx("button", { type: "button", className: "event-rail-task-remove", "aria-label": "Remove task", onClick: () => void removeItem(it.id), children: _jsx(XIcon, { size: 12 }) })] }, it.id))), _jsxs("div", { className: "event-rail-add", children: [_jsx("input", { className: "field", placeholder: "Add a task or reminder\u2026", value: newItem, onChange: (e) => setNewItem(e.target.value), onKeyDown: (e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                void addItem();
                                            }
                                        } }), _jsx("button", { type: "button", className: "btn-secondary", onClick: () => void addItem(), disabled: !newItem.trim(), children: "Add" })] })] })] }), _jsxs("section", { className: "event-rail-block", children: [_jsx("header", { className: "event-rail-block-head", children: "Related" }), _jsxs("div", { className: "event-rail-related", children: [note && (_jsx(RelatedRow, { icon: _jsx(NoteIcon, { size: 14 }), label: note.title, tone: "sage", onClick: () => setView({ kind: "note", noteId: note.id }) })), deck && (_jsx(RelatedRow, { icon: _jsx(FlashcardIcon, { size: 14 }), label: deck.title, tone: "sky", onClick: () => setView({ kind: "flashcardSet", setId: deck.id }) })), quiz && (_jsx(RelatedRow, { icon: _jsx(QuizIcon, { size: 14 }), label: quiz.title, tone: "lilac", onClick: () => setView({ kind: "quiz", quizId: quiz.id }) })), cls && (_jsx(RelatedRow, { icon: _jsx(LinkIcon, { size: 14 }), label: cls.name, tone: "peach", onClick: () => setView({ kind: "classView", classId: cls.id }) })), !note && !deck && !quiz && !cls && (_jsx("p", { className: "event-rail-empty", children: "Link this event to a note, deck, quiz, or class from Edit." }))] })] }), _jsxs("footer", { className: `event-rail-sync sync-${syncStatus}`, children: [_jsx("span", { className: "event-rail-sync-icon", "aria-hidden": true, children: syncStatus === "offline" ? (_jsx(CloudOffIcon, { size: 14 })) : (_jsx(CloudCheckIcon, { size: 14 })) }), _jsxs("div", { className: "event-rail-sync-text", children: [_jsx("span", { className: "lead", children: syncStatus === "offline" ? "Working offline" : "All changes synced" }), _jsx("span", { className: "sub", children: syncStatus === "syncing"
                                    ? "Syncing…"
                                    : syncStatus === "offline"
                                        ? "We'll sync when you're back online"
                                        : "Last synced just now" })] })] })] }));
};
const MetaRow = ({ icon, label }) => (_jsxs("div", { className: "event-rail-meta-row", children: [_jsx("span", { className: "event-rail-meta-icon", "aria-hidden": true, children: icon }), _jsx("span", { children: label })] }));
/**
 * Click-to-edit time row. Renders the formatted range until the user
 * clicks it; then exposes two `<input type="time" step="300">` so the
 * user can type new times in 5-minute increments. Commits on blur or
 * Enter; reverts on Escape.
 */
const EditableTimeRow = ({ startIso, endIso, allDay, onSave }) => {
    const [editing, setEditing] = useState(false);
    const [start, setStart] = useState(() => hhmmFromIso(startIso));
    const [end, setEnd] = useState(() => hhmmFromIso(endIso));
    // Keep local input state in sync if the underlying event changes from
    // a different surface (e.g. the user drags the card on the grid).
    useEffect(() => {
        setStart(hhmmFromIso(startIso));
        setEnd(hhmmFromIso(endIso));
    }, [startIso, endIso]);
    if (allDay) {
        return _jsx(MetaRow, { icon: _jsx(ClockIcon, { size: 14 }), label: "All day" });
    }
    function commit() {
        setEditing(false);
        const startTime = snapHHMM(start);
        const endTime = snapHHMM(end);
        const baseStart = new Date(startIso);
        const baseEnd = new Date(endIso);
        const newStart = setHHMM(baseStart, startTime);
        const newEnd = setHHMM(baseEnd, endTime);
        if (newStart.toISOString() === startIso && newEnd.toISOString() === endIso) {
            return;
        }
        onSave(newStart.toISOString(), newEnd.toISOString());
    }
    function cancel() {
        setEditing(false);
        setStart(hhmmFromIso(startIso));
        setEnd(hhmmFromIso(endIso));
    }
    if (!editing) {
        const label = `${fmtTime(startIso)} – ${fmtTime(endIso)}`;
        return (_jsxs("button", { type: "button", className: "event-rail-meta-row event-rail-time-trigger", onClick: () => setEditing(true), "aria-label": `Edit time, currently ${label}`, children: [_jsx("span", { className: "event-rail-meta-icon", "aria-hidden": true, children: _jsx(ClockIcon, { size: 14 }) }), _jsx("span", { children: label })] }));
    }
    return (_jsxs("div", { className: "event-rail-meta-row event-rail-time-edit", children: [_jsx("span", { className: "event-rail-meta-icon", "aria-hidden": true, children: _jsx(ClockIcon, { size: 14 }) }), _jsx("input", { type: "time", step: 300, className: "field event-rail-time-input", value: start, autoFocus: true, onChange: (e) => setStart(e.target.value), onBlur: (e) => {
                    const next = e.relatedTarget;
                    if (!next?.closest(".event-rail-time-edit"))
                        commit();
                }, onKeyDown: (e) => {
                    if (e.key === "Enter")
                        commit();
                    else if (e.key === "Escape")
                        cancel();
                } }), _jsx("span", { className: "event-rail-time-sep", children: "\u2013" }), _jsx("input", { type: "time", step: 300, className: "field event-rail-time-input", value: end, onChange: (e) => setEnd(e.target.value), onBlur: (e) => {
                    const next = e.relatedTarget;
                    if (!next?.closest(".event-rail-time-edit"))
                        commit();
                }, onKeyDown: (e) => {
                    if (e.key === "Enter")
                        commit();
                    else if (e.key === "Escape")
                        cancel();
                } })] }));
};
function hhmmFromIso(iso) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function setHHMM(base, hhmm) {
    const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
    const d = new Date(base);
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    return d;
}
function snapHHMM(hhmm) {
    const [h, m] = hhmm.split(":").map((s) => parseInt(s, 10));
    if (Number.isNaN(h) || Number.isNaN(m))
        return hhmm;
    const snapped = Math.round(m / 5) * 5;
    const carry = snapped >= 60 ? 1 : 0;
    const mm = snapped % 60;
    const hh = (h + carry) % 24;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
const RelatedRow = ({ icon, label, tone, onClick }) => (_jsxs("button", { type: "button", className: `event-rail-related-row tone-${tone}`, onClick: onClick, children: [_jsx("span", { className: "event-rail-related-icon", children: icon }), _jsx("span", { className: "event-rail-related-label", children: label })] }));
function chipTone(tag) {
    const lc = tag.toLowerCase();
    if (lc.includes("important") || lc.includes("exam") || lc.includes("urgent"))
        return "rose";
    if (lc.includes("weekly") || lc.includes("recurring"))
        return "sky";
    if (lc.includes("review") || lc.includes("study"))
        return "lilac";
    if (lc.includes("reading"))
        return "amber";
    if (lc.includes("class") || lc.includes("lecture"))
        return "peach";
    return "sage";
}
function autoDescription(event, cls) {
    const subject = cls ? cls.name : "your studies";
    switch (event.type) {
        case "exam":
            return `Stay calm and bring everything you need. Review key concepts for ${subject} ahead of time.`;
        case "study_block":
            return `Use this block to make focused progress on ${subject}.`;
        case "quiz":
            return `Take this quiz to reinforce what you've learned in ${subject}.`;
        case "flashcards":
            return `A quick deck pass to lock in vocabulary and key facts.`;
        case "reading":
            return `Quiet reading time — bring your highlighter and take light notes.`;
        case "assignment":
            return `Make consistent progress on this assignment so it doesn't pile up.`;
        case "reminder":
            return `Don't forget — gentle nudge so this doesn't slip.`;
        case "class":
        default:
            return `Class session for ${subject}. Bring your notes and lab materials.`;
    }
}
function recurrenceToLabel(json) {
    if (!json)
        return null;
    try {
        const v = JSON.parse(json);
        if (v.freq === "weekly")
            return "Weekly";
        if (v.freq === "daily")
            return "Daily";
        if (v.freq === "monthly")
            return "Monthly";
    }
    catch {
        /* drop */
    }
    return null;
}
//# sourceMappingURL=EventDetailRail.js.map