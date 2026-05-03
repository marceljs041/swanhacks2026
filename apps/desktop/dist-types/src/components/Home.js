import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { currentStreak, listClasses, listDueFlashcards, listNotes, listTasksForRange, quizStats, recordRewardPoints, recordXp, totalXpToday, upsertAttachment, upsertNote, upsertStudyTask, } from "../db/repositories.js";
import { useApp } from "../store.js";
import { Card } from "./ui/Card.js";
import { Donut, ProgressRing } from "./ui/ProgressRing.js";
import { AudioRecorderModal } from "./AudioRecorderModal.js";
import { HeroSearch } from "./HeroSearch.js";
import { BRAND_HERO_URL } from "../lib/brand.js";
import { firstName } from "../lib/profile.js";
import { refreshUserBadges } from "../lib/badgesSync.js";
import { getGreeting } from "../lib/greeting.js";
import { POINTS_RULES, XP_RULES } from "@studynest/shared";
import { ArrowRightIcon, CheckIcon, ClockIcon, FlameIcon, FlashcardIcon, ImageIcon, MicIcon, NoteIcon, PencilIcon, QuizIcon, SparklesIcon, } from "./icons.js";
/* ================================================================== */
/* Home — primary dashboard                                            */
/* ================================================================== */
export const Home = () => {
    const setXp = useApp((s) => s.setXp);
    const setDueCards = useApp((s) => s.setDueCards);
    const setWeekTasks = useApp((s) => s.setWeekTasks);
    const setNotes = useApp((s) => s.setNotes);
    const setClasses = useApp((s) => s.setClasses);
    const xpToday = useApp((s) => s.xpToday);
    const streak = useApp((s) => s.streak);
    const dueCards = useApp((s) => s.dueCards);
    const weekTasks = useApp((s) => s.weekTasks);
    const notes = useApp((s) => s.notes);
    // Quiz stats are home-only state — kept here so refreshing this view
    // (e.g. after a new attempt) doesn't require a global store slot.
    const [stats, setStats] = useState({
        taken: 0,
        avgPct: 0,
        best: 0,
    });
    const reloadAll = useCallback(async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const inAWeek = new Date(today);
        inAWeek.setDate(today.getDate() + 7);
        const [xp, str, due, ns, cls, tasks, qs] = await Promise.all([
            totalXpToday(),
            currentStreak(),
            listDueFlashcards(50),
            listNotes(null),
            listClasses(),
            listTasksForRange(today.toISOString(), inAWeek.toISOString()),
            quizStats(),
        ]);
        setXp(xp, str);
        setDueCards(due);
        setNotes(ns);
        setClasses(cls);
        setWeekTasks(tasks);
        setStats(qs);
        await refreshUserBadges();
    }, [setXp, setDueCards, setNotes, setClasses, setWeekTasks]);
    useEffect(() => {
        void reloadAll();
    }, [reloadAll]);
    return (_jsx("main", { className: "main", children: _jsxs("div", { className: "main-inner", children: [_jsx(Hero, {}), _jsx(QuickActions, { onCreated: () => void reloadAll() }), _jsxs("div", { className: "dash-row", children: [_jsx(StreakCard, { streak: streak }), _jsx(ContinueLastNoteCard, {}), _jsx(TodaysPlanCard, { tasks: weekTasks, onChange: () => void reloadAll() })] }), _jsxs("div", { className: "dash-row", children: [_jsx(RecentNotesCard, {}), _jsx(FlashcardsDueCard, { dueCount: dueCards.length }), _jsx(QuizProgressCard, { stats: stats })] }), _jsxs("span", { style: { display: "none" }, children: [xpToday, weekTasks.length, notes.length] })] }) }));
};
/* ---- hero -------------------------------------------------------- */
const Hero = () => {
    const profileName = useApp((s) => s.profile.name);
    const name = useMemo(() => firstName(profileName), [profileName]);
    // Recompute the greeting on a low-frequency cadence so a long-open
    // window crosses bucket boundaries (e.g. afternoon → evening) without
    // a refresh. We also key the headline on the bucket so the text fades
    // in when the bucket changes.
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);
    const greeting = useMemo(() => getGreeting(name, now), [name, now]);
    return (_jsxs("section", { className: "hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(HeroSearch, {}), _jsxs("div", { className: "hero-greeting", children: [_jsxs("h1", { className: "hero-headline", children: [greeting.headline, " ", _jsx("span", { "aria-hidden": true, style: { display: "inline-block", transform: "translateY(-2px)" }, children: greeting.emoji })] }, greeting.bucket), _jsx("p", { children: greeting.subline })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_HERO_URL, alt: "", decoding: "async" }) })] }));
};
const QuickActionTile = ({ title, sub, icon, bg, fg, onClick }) => (_jsxs("button", { type: "button", className: "quick-action", onClick: onClick, children: [_jsx("span", { className: "qa-icon", style: { background: bg, color: fg }, children: icon }), _jsxs("span", { className: "qa-text", children: [_jsx("span", { className: "qa-title", children: title }), _jsx("span", { className: "qa-sub", children: sub })] })] }));
const QuickActions = ({ onCreated }) => {
    const setView = useApp((s) => s.setView);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
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
    async function onImagePicked(e) {
        const file = e.target.files?.[0];
        e.target.value = ""; // allow re-picking the same file
        if (!file)
            return;
        try {
            const dataUri = await fileToDataUri(file);
            const title = stripExt(file.name) || "Image note";
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
            setError(err.message || "Failed to upload image.");
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
    return (_jsxs(_Fragment, { children: [_jsxs("section", { className: "quick-actions", children: [_jsx(QuickActionTile, { title: "New Note", sub: "Start writing", icon: _jsx(PencilIcon, { size: 20 }), bg: "var(--color-accentRoseSoft)", fg: "var(--color-accentRose)", onClick: () => void newNote() }), _jsx(QuickActionTile, { title: "Record Audio", sub: "Capture ideas", icon: _jsx(MicIcon, { size: 20 }), bg: "var(--color-accentAmberSoft)", fg: "var(--color-accentAmber)", onClick: () => {
                            setError(null);
                            setRecorderOpen(true);
                        } }), _jsx(QuickActionTile, { title: "Upload Image", sub: "Add from device", icon: _jsx(ImageIcon, { size: 20 }), bg: "var(--color-accentSkySoft)", fg: "var(--color-accentSky)", onClick: () => fileRef.current?.click() }), _jsx(QuickActionTile, { title: "Generate Flashcards", sub: "From your notes", icon: _jsx(SparklesIcon, { size: 20 }), bg: "var(--color-accentPeachSoft)", fg: "var(--color-accentPeach)", onClick: () => setView({ kind: "flashcards" }) })] }), _jsx("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: (e) => void onImagePicked(e) }), recorderOpen && (_jsx(AudioRecorderModal, { onClose: () => setRecorderOpen(false), onSave: async (b) => {
                    setRecorderOpen(false);
                    await handleAudio(b);
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
function blobToDataUri(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(r.error ?? new Error("read failed"));
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(blob);
    });
}
/* ---- streak card ------------------------------------------------- */
const StreakCard = ({ streak }) => {
    const setView = useApp((s) => s.setView);
    // 7-day window: today plus the previous six. `streak` collapses
    // them all from the right (today) — purely visual feedback so the
    // number on the ring matches the dot count.
    const filled = Math.min(streak, 7);
    return (_jsx(Card, { title: "Today's Study Streak", icon: _jsx(FlameIcon, { size: 18 }), action: [
            { label: "View calendar", onClick: () => setView({ kind: "calendar" }) },
            { label: "Open settings", onClick: () => setView({ kind: "settings" }) },
        ], children: _jsxs("div", { className: "streak", children: [_jsxs(ProgressRing, { value: filled / 7, size: 96, thickness: 9, color: "var(--color-primary)", children: [_jsx("span", { className: "ring-num", children: streak }), _jsx("span", { className: "ring-unit", children: "days" })] }), _jsxs("div", { className: "copy", children: [_jsx("span", { className: "lead", children: streak > 0 ? "Keep it up!" : "Start a streak today" }), _jsx("span", { className: "sub", children: "You're building a great habit." })] }), _jsx("div", { className: "week-dots", children: Array.from({ length: 7 }).map((_, i) => {
                        const done = i < filled;
                        return (_jsx("span", { className: `week-dot ${done ? "done" : ""}`, children: done ? _jsx(CheckIcon, { size: 11 }) : null }, i));
                    }) })] }) }));
};
/* ---- continue last note card ------------------------------------- */
const ContinueLastNoteCard = () => {
    const notes = useApp((s) => s.notes);
    const classes = useApp((s) => s.classes);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const setView = useApp((s) => s.setView);
    const last = notes[0];
    const className = useMemo(() => {
        if (!last?.class_id)
            return null;
        return classes.find((c) => c.id === last.class_id)?.name ?? null;
    }, [last, classes]);
    return (_jsx(Card, { title: "Continue Last Note", icon: _jsx(NoteIcon, { size: 18 }), action: [
            {
                label: "Open note",
                onClick: () => {
                    if (!last)
                        return;
                    setSelectedNote(last);
                    setView({ kind: "note", noteId: last.id });
                },
            },
            { label: "View all notes", onClick: () => setView({ kind: "notes" }) },
        ], children: last ? (_jsxs("div", { className: "continue-note", children: [_jsxs("div", { className: "note-pill", children: [_jsx("span", { className: "note-glyph", children: _jsx(NoteIcon, { size: 20 }) }), _jsxs("div", { className: "meta", children: [_jsx("span", { className: "title", children: last.title || "Untitled" }), _jsx("span", { className: "sub", children: className ?? "Unfiled" }), _jsxs("span", { className: "when", children: ["Edited ", fmtRelative(new Date(last.updated_at))] })] })] }), _jsx("button", { type: "button", className: "review-button", onClick: () => {
                        setSelectedNote(last);
                        setView({ kind: "note", noteId: last.id });
                    }, children: "Open Note" })] })) : (_jsx("div", { style: { color: "var(--color-textMuted)", fontSize: 13 }, children: "You haven't created a note yet. Tap \u201CNew Note\u201D above to get started." })) }));
};
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
/* ---- today's plan card ------------------------------------------- */
const TodaysPlanCard = ({ tasks, onChange, }) => {
    const setView = useApp((s) => s.setView);
    // The home query loads a 7-day window so the calendar/right-panel
    // share state. Filter to *today* for this card so the list stays focused.
    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);
    const tomorrow = useMemo(() => {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        return d;
    }, [today]);
    const todayTasks = useMemo(() => tasks
        .filter((t) => {
        const ts = new Date(t.scheduled_for).getTime();
        return ts >= today.getTime() && ts < tomorrow.getTime();
    })
        .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)), [tasks, today, tomorrow]);
    async function toggle(t) {
        const wasComplete = !!t.completed_at;
        await upsertStudyTask({
            ...t,
            completed_at: wasComplete ? null : new Date().toISOString(),
        });
        if (!wasComplete) {
            await recordXp("studyTaskComplete", XP_RULES.studyTaskComplete);
            await recordRewardPoints("finishStudyTask", POINTS_RULES.finishStudyTask);
        }
        onChange();
    }
    return (_jsxs(Card, { title: "Today's Plan", icon: _jsx(ClockIcon, { size: 18 }), action: [
            { label: "Open calendar", onClick: () => setView({ kind: "calendar" }) },
            {
                label: "Plan with AI",
                onClick: () => setView({ kind: "calendar" }),
            },
        ], children: [todayTasks.length === 0 ? (_jsx("div", { style: { color: "var(--color-textMuted)", fontSize: 13, padding: "8px 0" }, children: "Nothing scheduled for today. Generate a plan from the calendar." })) : (_jsx("div", { className: "plan-list", children: todayTasks.map((t) => {
                    const done = !!t.completed_at;
                    return (_jsxs("div", { className: `plan-row ${done ? "done" : ""}`, children: [_jsx("button", { type: "button", className: `plan-check ${done ? "done" : ""}`, "aria-label": done ? "Mark task incomplete" : "Mark task complete", onClick: () => void toggle(t), children: done && _jsx(CheckIcon, { size: 12 }) }), _jsx("span", { className: "plan-title", children: t.title }), _jsx("span", { className: "plan-time", children: fmtTimeOfDay(t.scheduled_for) })] }, t.id));
                }) })), _jsx("button", { type: "button", className: "plan-link", onClick: () => setView({ kind: "calendar" }), children: "View full schedule \u2192" })] }));
};
function fmtTimeOfDay(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
/* ---- recent notes card ------------------------------------------- */
const RecentNotesCard = () => {
    const notes = useApp((s) => s.notes);
    const classes = useApp((s) => s.classes);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const setView = useApp((s) => s.setView);
    const recent = notes.slice(0, 5);
    const classMap = useMemo(() => {
        const m = new Map();
        for (const c of classes)
            m.set(c.id, c);
        return m;
    }, [classes]);
    return (_jsxs(Card, { title: "Recent Notes", icon: _jsx(NoteIcon, { size: 18 }), action: [
            { label: "View all notes", onClick: () => setView({ kind: "notes" }) },
            { label: "View classes", onClick: () => setView({ kind: "classes" }) },
        ], children: [_jsxs("div", { className: "recent-notes", children: [recent.length === 0 && (_jsx("div", { style: { color: "var(--color-textMuted)", fontSize: 13, padding: "8px 0" }, children: "No notes yet \u2014 your recents will appear here." })), recent.map((n) => {
                        const cls = n.class_id ? classMap.get(n.class_id) : null;
                        return (_jsxs("div", { className: "recent-row", onClick: () => {
                                setSelectedNote(n);
                                setView({ kind: "note", noteId: n.id });
                            }, children: [_jsx(NoteIcon, { size: 14 }), _jsx("span", { className: "recent-title", children: n.title || "Untitled" }), _jsx("span", { className: "recent-class", children: cls?.name ?? "—" }), _jsx("span", { className: "recent-when", children: fmtShortDate(new Date(n.updated_at)) })] }, n.id));
                    })] }), _jsx("button", { type: "button", className: "plan-link", onClick: () => setView({ kind: "notes" }), children: "View all notes \u2192" })] }));
};
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
/* ---- flashcards due card ----------------------------------------- */
const FlashcardsDueCard = ({ dueCount }) => {
    const setView = useApp((s) => s.setView);
    const dueCards = useApp((s) => s.dueCards);
    // Categorize the real due cards by spaced-repetition state so the
    // legend reflects what we'd actually show in review.
    const { newCount, learning, review } = useMemo(() => {
        let n = 0;
        let l = 0;
        let r = 0;
        for (const c of dueCards) {
            if (c.review_count === 0 || c.difficulty === "new")
                n += 1;
            else if (c.interval_days < 7)
                l += 1;
            else
                r += 1;
        }
        return { newCount: n, learning: l, review: r };
    }, [dueCards]);
    const segments = useMemo(() => {
        if (dueCount === 0) {
            // Empty state ring stays muted instead of inventing fake data.
            return [{ value: 1, color: "var(--color-surfaceMuted)" }];
        }
        return [
            { value: newCount, color: "var(--color-accentSky)" },
            { value: learning, color: "var(--color-primary)" },
            { value: review, color: "var(--color-accentSage)" },
        ];
    }, [dueCount, newCount, learning, review]);
    return (_jsxs(Card, { title: "Flashcards Due", icon: _jsx(FlashcardIcon, { size: 18 }), action: [
            { label: "Open flashcards", onClick: () => setView({ kind: "flashcards" }) },
        ], children: [_jsxs("div", { className: "donut-card", children: [_jsxs(Donut, { segments: segments, size: 104, thickness: 12, children: [_jsx("span", { className: "donut-num", children: dueCount }), _jsx("span", { className: "donut-unit", children: "cards due" })] }), _jsxs("div", { className: "legend", children: [_jsxs("div", { className: "legend-row", children: [_jsx("span", { className: "swatch", style: { background: "var(--color-accentSky)" } }), _jsx("span", { className: "lbl", children: "New" }), _jsx("span", { className: "val", children: newCount })] }), _jsxs("div", { className: "legend-row", children: [_jsx("span", { className: "swatch", style: { background: "var(--color-primary)" } }), _jsx("span", { className: "lbl", children: "Learning" }), _jsx("span", { className: "val", children: learning })] }), _jsxs("div", { className: "legend-row", children: [_jsx("span", { className: "swatch", style: { background: "var(--color-accentSage)" } }), _jsx("span", { className: "lbl", children: "Review" }), _jsx("span", { className: "val", children: review })] })] })] }), _jsx("button", { type: "button", className: "review-button", disabled: dueCount === 0, onClick: () => setView({ kind: "flashcards" }), children: "Review Flashcards" })] }));
};
/* ---- quiz progress card ------------------------------------------ */
const QuizProgressCard = ({ stats, }) => {
    const setView = useApp((s) => s.setView);
    const { taken, avgPct, best } = stats;
    return (_jsxs(Card, { title: "Quiz Progress", icon: _jsx(QuizIcon, { size: 18 }), action: [
            { label: "View all quizzes", onClick: () => setView({ kind: "quizzes" }) },
        ], children: [_jsxs("div", { className: "donut-card", children: [_jsxs(Donut, { segments: [
                            { value: avgPct || 0, color: "var(--color-accentSky)" },
                            { value: 100 - (avgPct || 0), color: "var(--color-surfaceMuted)" },
                        ], size: 104, thickness: 12, children: [_jsx("span", { className: "donut-num", children: taken === 0 ? "—" : `${avgPct}%` }), _jsx("span", { className: "donut-unit", children: "average score" })] }), _jsxs("div", { className: "legend", children: [_jsxs("div", { className: "legend-row", children: [_jsx("span", { className: "lbl", children: "Quizzes Taken" }), _jsx("span", { className: "val", children: taken })] }), _jsxs("div", { className: "legend-row", children: [_jsx("span", { className: "lbl", children: "Average Score" }), _jsx("span", { className: "val", children: taken === 0 ? "—" : `${avgPct}%` })] }), _jsxs("div", { className: "legend-row", children: [_jsx("span", { className: "lbl", children: "Best Score" }), _jsx("span", { className: "val", children: taken === 0 ? "—" : `${best}%` })] })] })] }), _jsxs("button", { type: "button", className: "plan-link", onClick: () => setView({ kind: "quizzes" }), children: ["View all quizzes ", _jsx(ArrowRightIcon, { size: 12 })] })] }));
};
//# sourceMappingURL=Home.js.map