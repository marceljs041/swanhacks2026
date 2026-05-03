import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { XP_RULES } from "@studynest/shared";
import { ai } from "../lib/ai.js";
import { BRAND_ASKAI_HERO_URL } from "../lib/brand.js";
import { enqueueQuizGeneration } from "../lib/quizGenerationQueue.js";
import { deriveSubtitle, progressLabel, progressTone, computeProgress, toneFor, } from "../lib/classDisplay.js";
import { classAggregates, getNote, listClasses, listNotes, nextExamByClass, recordXp, upsertAttachment, upsertFlashcard, upsertFlashcardSet, upsertNote, upsertQuiz, upsertQuizQuestion, upsertStudyTask, weakTopicsForClass, } from "../db/repositories.js";
import { useApp } from "../store.js";
import { AudioRecorderModal } from "./AudioRecorderModal.js";
import { Breadcrumbs } from "./ClassView.js";
import { HeroSearch } from "./HeroSearch.js";
import { ArrowLeftIcon, ArrowRightIcon, CalendarIcon, CheckIcon, ChevRightIcon, FileIcon, FlashcardIcon, GraduationCapIcon, ImageIcon, MicIcon, QuizIcon, SparklesIcon, } from "./icons.js";
const SUGGESTED_PROMPTS = [
    {
        id: "explain",
        label: "Explain simply",
        tone: "lilac",
        icon: _jsx(SparklesIcon, { size: 14 }),
        prompt: ({ className }) => `Pick the most important concept I should understand about ${className} right now and explain it simply, like I'm new to it.`,
    },
    {
        id: "quiz_weak",
        label: "Quiz me",
        tone: "sage",
        icon: _jsx(QuizIcon, { size: 14 }),
        prompt: ({ weakTopics }) => weakTopics.length > 0
            ? `Quiz me on these weak topics one at a time and grade my answers: ${weakTopics.join(", ")}.`
            : `I haven't flagged any weak topics yet — pick the trickiest concept from my notes and quiz me.`,
    },
    {
        id: "summarize_weak",
        label: "Summarize gaps",
        tone: "sky",
        icon: _jsx(FileIcon, { size: 14 }),
        prompt: ({ weakTopics, className }) => weakTopics.length > 0
            ? `Give me a short, plain-English review of these weak topics in ${className}: ${weakTopics.join(", ")}.`
            : `Summarize the most likely-to-be-tested ideas from my ${className} notes.`,
    },
    {
        id: "exam_review",
        label: "Exam review",
        tone: "peach",
        icon: _jsx(CheckIcon, { size: 14 }),
        prompt: ({ className }) => `Build me a tight, exam-ready review of ${className} — bullet the top 6 concepts I need cold, with one-line definitions.`,
    },
];
/* ================================================================== */
/* Top-level                                                          */
/* ================================================================== */
export const ClassAsk = ({ classId }) => {
    const setView = useApp((s) => s.setView);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const [cls, setCls] = useState(null);
    const [notes, setNotes] = useState([]);
    const [weakTopics, setWeakTopics] = useState([]);
    const [examInDays, setExamInDays] = useState(null);
    const [progress, setProgress] = useState(0);
    const [pTone, setPTone] = useState("success");
    const [pLabel, setPLabel] = useState("");
    const [missing, setMissing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState("");
    const [pending, setPending] = useState(false);
    const [recorderOpen, setRecorderOpen] = useState(false);
    const [actionBusy, setActionBusy] = useState(null);
    const [toast, setToast] = useState(null);
    const fileRef = useRef(null);
    const threadRef = useRef(null);
    const composerRef = useRef(null);
    // ---- load class context -----------------------------------------
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const all = await listClasses();
            const c = all.find((x) => x.id === classId);
            if (cancelled)
                return;
            if (!c) {
                setMissing(true);
                setLoading(false);
                return;
            }
            setCls(c);
            const [ns, weak, aggMap, examMap] = await Promise.all([
                listNotes(classId),
                weakTopicsForClass(classId, 6),
                classAggregates(),
                nextExamByClass(),
            ]);
            if (cancelled)
                return;
            setNotes(ns);
            setWeakTopics(weak);
            const agg = aggMap.get(classId) ?? {
                notes: 0,
                flashcards: 0,
                quizzes: 0,
                totalTasks: 0,
                completedTasks: 0,
            };
            const p = computeProgress(agg);
            setProgress(p);
            setPTone(progressTone(p, agg));
            setPLabel(progressLabel(p, agg));
            setExamInDays(examMap.get(classId)?.days ?? null);
            setLoading(false);
            // Greet on first paint so the thread isn't empty.
            setMessages([
                {
                    id: "greet",
                    role: "assistant",
                    content: `Hey! I'm tuned into ${c.name}. I have ${ns.length} note${ns.length === 1 ? "" : "s"} and ${weak.length} weak topic${weak.length === 1 ? "" : "s"} on hand. ` +
                        `Ask anything — pick a suggestion above or type your own question below.`,
                    memoryTrick: weak.length > 0
                        ? `Tip: try “Quiz me on ${weak[0]}” to drill the weakest spot first.`
                        : null,
                },
            ]);
        })();
        return () => {
            cancelled = true;
        };
    }, [classId]);
    // Keep the chat scrolled to the latest message.
    useEffect(() => {
        const el = threadRef.current;
        if (!el)
            return;
        el.scrollTop = el.scrollHeight;
    }, [messages]);
    // Auto-dismiss toast.
    useEffect(() => {
        if (!toast)
            return;
        const t = window.setTimeout(() => setToast(null), 3200);
        return () => window.clearTimeout(t);
    }, [toast]);
    // ---- nav --------------------------------------------------------
    const goBack = useCallback(() => {
        setView({ kind: "classView", classId });
    }, [classId, setView]);
    const openClassesIndex = useCallback(() => {
        setView({ kind: "classes" });
    }, [setView]);
    const openNote = useCallback((n) => {
        setSelectedNote(n);
        setView({ kind: "note", noteId: n.id });
    }, [setSelectedNote, setView]);
    const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
    const openNoteById = useCallback(async (id) => {
        const local = notes.find((n) => n.id === id);
        if (local) {
            openNote(local);
            return;
        }
        const row = await getNote(id);
        if (row)
            openNote(row);
        else
            setToast("That note could not be found.");
    }, [notes, openNote]);
    // ---- chat -------------------------------------------------------
    // Send each note's title + summary AND a truncated body. The prompt
    // is strict about grounding answers in the user's own words, so the
    // model needs the actual content — summaries are often missing or
    // out-of-date, and shipping only those let the model fall back to its
    // own training data and hallucinate generic answers.
    const noteContext = useMemo(() => notes.slice(0, 6).map((n) => ({
        note_id: n.id,
        title: n.title,
        summary: n.summary,
        content: truncateForPrompt(n.content_markdown, 3000),
    })), [notes]);
    const sendQuestion = useCallback(async (text) => {
        const trimmed = text.trim();
        if (!trimmed || !cls || pending)
            return;
        const userMsg = {
            id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: "user",
            content: trimmed,
        };
        const placeholderId = `a-${Date.now()}`;
        const placeholder = {
            id: placeholderId,
            role: "assistant",
            content: "Thinking…",
            pending: true,
        };
        setMessages((prev) => [...prev, userMsg, placeholder]);
        setDraft("");
        setPending(true);
        try {
            const history = messages
                .filter((m) => !m.pending && !m.error)
                .map((m) => ({ role: m.role, content: m.content }));
            history.push({ role: "user", content: trimmed });
            const res = await ai.ask({
                class_name: cls.name,
                class_subtitle: deriveSubtitle(cls),
                recent_notes: noteContext,
                weak_topics: weakTopics,
                history,
                question: trimmed,
            });
            const related = (res.related_note_ids ?? [])
                .map((id) => notes.find((n) => n.id === id))
                .filter((n) => !!n) ?? [];
            setMessages((prev) => prev.map((m) => m.id === placeholderId
                ? {
                    ...m,
                    content: res.answer,
                    memoryTrick: res.memory_trick ?? null,
                    relatedNotes: related,
                    pending: false,
                }
                : m));
        }
        catch {
            setMessages((prev) => prev.map((m) => m.id === placeholderId
                ? {
                    ...m,
                    content: "The assistant isn’t responding right now. Try again in a moment.",
                    pending: false,
                    error: true,
                }
                : m));
        }
        finally {
            setPending(false);
            // Re-focus composer for fast follow-ups.
            composerRef.current?.focus();
        }
    }, [cls, messages, noteContext, notes, pending, weakTopics]);
    // ---- composer ---------------------------------------------------
    const onComposerKey = useCallback((e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void sendQuestion(draft);
        }
    }, [draft, sendQuestion]);
    const onAudioSaved = useCallback(async (blob) => {
        setRecorderOpen(false);
        try {
            const dataUri = await blobToDataUri(blob);
            const noteTitle = `Voice note · ${cls?.name ?? "class"}`;
            const note = await upsertNote({
                title: noteTitle,
                content_markdown: "Recorded for the Ask AI conversation. Open to play it back later.",
                class_id: classId,
            });
            await upsertAttachment({
                note_id: note.id,
                type: "audio",
                local_uri: dataUri,
                file_name: "recording.webm",
                mime_type: blob.type || "audio/webm",
                size_bytes: blob.size,
            });
            setNotes((prev) => [note, ...prev]);
            setToast(`Recording attached as “${noteTitle}”.`);
        }
        catch {
            setToast("Couldn't save recording. Try again.");
        }
    }, [classId, cls]);
    const onFilePicked = useCallback(async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !cls)
            return;
        try {
            const dataUri = await fileToDataUri(file);
            const title = stripExt(file.name) || `${cls.name} reference`;
            const note = await upsertNote({
                title,
                content_markdown: `![${title}](${dataUri})\n`,
                class_id: classId,
            });
            await upsertAttachment({
                note_id: note.id,
                type: "image",
                local_uri: dataUri,
                file_name: file.name,
                mime_type: file.type,
                size_bytes: file.size,
            });
            setNotes((prev) => [note, ...prev]);
            setToast(`Attached “${title}” as a class note.`);
        }
        catch {
            setToast("Couldn't attach that file.");
        }
    }, [classId, cls]);
    // ---- assistant message actions ----------------------------------
    const saveAssistantAsNote = useCallback(async (msg) => {
        if (!cls)
            return;
        setActionBusy(`note-${msg.id}`);
        try {
            const note = await upsertNote({
                title: `${cls.name} · AI answer`,
                content_markdown: msg.content,
                class_id: classId,
                summary: msg.memoryTrick ?? null,
            });
            await recordXp("createNote", XP_RULES.createNote);
            setNotes((prev) => [note, ...prev]);
            setToast(`Saved to your ${cls.name} notes.`);
        }
        catch {
            setToast("Couldn't save the answer as a note.");
        }
        finally {
            setActionBusy(null);
        }
    }, [classId, cls]);
    const makeFlashcardsFromAnswer = useCallback(async (msg) => {
        if (!cls)
            return;
        setActionBusy(`fc-${msg.id}`);
        try {
            const note = await upsertNote({
                title: `${cls.name} · AI answer`,
                content_markdown: msg.content,
                class_id: classId,
            });
            const res = await ai.flashcards({
                note_id: note.id,
                title: note.title,
                content: msg.content,
                count: 6,
            });
            const set = await upsertFlashcardSet({
                title: `${cls.name} · from chat`,
                note_id: note.id,
            });
            for (const c of res.cards) {
                await upsertFlashcard({ set_id: set.id, front: c.front, back: c.back });
            }
            await recordXp("generateFlashcards", XP_RULES.generateFlashcards);
            setToast(`${res.cards.length} flashcards added.`);
        }
        catch {
            setToast("Couldn't generate flashcards from this answer.");
        }
        finally {
            setActionBusy(null);
        }
    }, [classId, cls]);
    const makeQuizFromAnswer = useCallback(async (msg) => {
        if (!cls)
            return;
        setActionBusy(`qz-${msg.id}`);
        try {
            await enqueueQuizGeneration(`Ask AI quiz: ${cls.name}`, async () => {
                const note = await upsertNote({
                    title: `${cls.name} · AI answer`,
                    content_markdown: msg.content,
                    class_id: classId,
                });
                const res = await ai.quiz({
                    note_id: note.id,
                    title: note.title,
                    content: msg.content,
                    count: 5,
                });
                const quiz = await upsertQuiz({
                    title: `${cls.name} · chat quiz`,
                    note_id: note.id,
                });
                for (const q of res.questions) {
                    await upsertQuizQuestion({
                        quiz_id: quiz.id,
                        type: q.type,
                        question: q.question,
                        options_json: q.type === "multiple_choice" ? JSON.stringify(q.options) : null,
                        correct_answer: String(q.answer),
                        explanation: q.explanation ?? null,
                    });
                }
            });
            setToast(`Quiz ready in ${cls.name}.`);
        }
        catch {
            setToast("Couldn't build a quiz from this answer.");
        }
        finally {
            setActionBusy(null);
        }
    }, [classId, cls]);
    const addAnswerToStudyPlan = useCallback(async (msg) => {
        if (!cls)
            return;
        setActionBusy(`plan-${msg.id}`);
        try {
            const tomorrow = new Date();
            tomorrow.setHours(9, 0, 0, 0);
            tomorrow.setDate(tomorrow.getDate() + 1);
            await upsertStudyTask({
                title: `Review: ${preview(msg.content)}`,
                type: "review",
                scheduled_for: tomorrow.toISOString(),
                duration_minutes: 25,
            });
            setToast("Added to tomorrow's study plan.");
        }
        catch {
            setToast("Couldn't add the task. Try again.");
        }
        finally {
            setActionBusy(null);
        }
    }, [cls]);
    // ---- render -----------------------------------------------------
    if (missing) {
        return (_jsx("main", { className: "main", children: _jsxs("div", { className: "main-inner", children: [_jsxs("button", { type: "button", className: "crumb-back", onClick: openClassesIndex, children: [_jsx(ArrowLeftIcon, { size: 14 }), " Back to Classes"] }), _jsxs("section", { className: "classes-empty", children: [_jsx("span", { className: "classes-empty-icon", "aria-hidden": true, children: _jsx(GraduationCapIcon, { size: 28 }) }), _jsx("h2", { children: "Class not found" }), _jsx("p", { children: "It may have been removed or hasn't synced yet." })] })] }) }));
    }
    if (loading || !cls) {
        return (_jsx("main", { className: "main", children: _jsx("div", { className: "main-inner", children: _jsx("section", { className: "hero", "aria-hidden": true, children: _jsxs("div", { className: "hero-main", children: [_jsx("div", { className: "search skeleton-bar", style: { height: 36 } }), _jsxs("div", { className: "hero-greeting", children: [_jsx("div", { className: "skeleton-bar", style: { width: 220, height: 32 } }), _jsx("div", { className: "skeleton-bar", style: { width: 280, height: 14 } })] })] }) }) }) }));
    }
    const tone = toneFor(cls);
    const subtitle = deriveSubtitle(cls);
    return (_jsxs("main", { className: "main", children: [_jsxs("div", { className: "main-inner askai-main-inner", children: [_jsxs("section", { className: "hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(HeroSearch, {}), _jsx(Breadcrumbs, { trail: [
                                            { label: "Classes", onClick: openClassesIndex },
                                            { label: cls.name, onClick: goBack },
                                            { label: "Ask AI" },
                                        ] }), _jsxs("div", { className: "hero-greeting classview-hero-text", children: [_jsxs("h1", { className: "hero-headline", children: ["Ask ", cls.name] }), _jsx("p", { children: "Get help understanding concepts, reviewing weak topics, and building study tools from your class materials." }), _jsxs("div", { className: "classview-pill-row", children: [_jsx("span", { className: `classview-pill tone-${tone}`, children: "Lecture" }), examInDays !== null && (_jsx("span", { className: `classview-pill tone-${examInDays <= 3 ? "danger" : "amber"}`, children: examInDays <= 0 ? "Exam today" : `Exam in ${examInDays}d` })), _jsx("span", { className: `classview-pill tone-${pTone === "warning" ? "warning" : "success"}`, children: pLabel || "On Track" }), _jsxs("span", { className: "askai-subtle", "aria-hidden": true, children: [subtitle && `${subtitle} · `, progress, "%"] })] })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_ASKAI_HERO_URL, alt: "", decoding: "async" }) })] }), _jsx("section", { className: "askai-suggestions", "aria-label": "Suggested prompts", children: SUGGESTED_PROMPTS.map((p) => {
                            const fullPrompt = p.prompt({
                                className: cls.name,
                                weakTopics,
                            });
                            return (_jsxs("button", { type: "button", className: `askai-suggestion tone-${p.tone}`, title: fullPrompt, onClick: () => void sendQuestion(fullPrompt), disabled: pending, children: [_jsx("span", { className: "askai-suggestion-icon", "aria-hidden": true, children: p.icon }), _jsx("span", { className: "askai-suggestion-label", children: p.label }), _jsx(ArrowRightIcon, { size: 14 })] }, p.id));
                        }) }), _jsxs("section", { className: "askai-grid", children: [_jsxs("div", { className: "askai-chat", children: [_jsx("div", { className: "askai-thread", ref: threadRef, children: messages.map((m) => (_jsx(ChatBubble, { msg: m, busyAction: actionBusy, notesById: notesById, onOpenNoteById: openNoteById, onOpenNote: openNote, onSaveNote: () => void saveAssistantAsNote(m), onMakeFlashcards: () => void makeFlashcardsFromAnswer(m), onMakeQuiz: () => void makeQuizFromAnswer(m), onAddToPlan: () => void addAnswerToStudyPlan(m), onRetry: () => void sendQuestion(lastUserBefore(messages, m.id) ?? "") }, m.id))) }), _jsxs("div", { className: "askai-composer", children: [_jsx("button", { type: "button", className: "askai-composer-icon", "aria-label": "Record audio", onClick: () => setRecorderOpen(true), disabled: pending, children: _jsx(MicIcon, { size: 16 }) }), _jsx("button", { type: "button", className: "askai-composer-icon", "aria-label": "Attach image", onClick: () => fileRef.current?.click(), disabled: pending, children: _jsx(ImageIcon, { size: 16 }) }), _jsx("textarea", { ref: composerRef, className: "askai-composer-input", placeholder: `Ask anything about ${cls.name}…`, rows: 1, value: draft, onChange: (e) => setDraft(e.target.value), onKeyDown: onComposerKey, disabled: pending }), _jsx("button", { type: "button", className: "askai-composer-send", "aria-label": "Send message", onClick: () => void sendQuestion(draft), disabled: pending || !draft.trim(), children: _jsx(ArrowRightIcon, { size: 14 }) }), _jsx("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: (e) => void onFilePicked(e) })] })] }), _jsxs("aside", { className: "askai-context", "aria-label": "Study tools and weak topics", children: [_jsx(ContextCard, { title: "Weak Topics Focus", icon: _jsx(CheckIcon, { size: 14 }), tone: "peach", children: weakTopics.length === 0 ? (_jsx("p", { className: "askai-context-empty", children: "Rate flashcards as \u201Chard\u201D to surface weak topics here." })) : (_jsx("div", { className: "weak-topic-row", children: weakTopics.map((t) => (_jsx("button", { type: "button", className: "weak-topic askai-weak-chip", onClick: () => setDraft((d) => d.trim()
                                                    ? `${d}\nFocus on: ${t}`
                                                    : `Help me understand ${t} — keep it short.`), children: t }, t))) })) }), _jsx(ContextCard, { title: "Suggested Study Tools", icon: _jsx(SparklesIcon, { size: 14 }), tone: "sky", children: _jsxs("div", { className: "askai-tools", children: [_jsx(SuggestedTool, { icon: _jsx(FileIcon, { size: 14 }), tone: "sky", title: "Summary ready", body: notes.find((n) => n.summary && n.summary.trim().length > 0)
                                                        ? "Key points already extracted from your latest note."
                                                        : "Tap to summarize the most recent note for this class.", onClick: () => void sendQuestion(`Summarize my latest ${cls.name} note in 4 bullet points.`) }), _jsx(SuggestedTool, { icon: _jsx(FlashcardIcon, { size: 14 }), tone: "sage", title: `${Math.max(6, notes.length * 2)} flashcards possible`, body: "From your notes \u2014 drill spaced-repetition style.", onClick: () => void sendQuestion(`Suggest 6 flashcards I should add to ${cls.name} based on my notes.`) }), _jsx(SuggestedTool, { icon: _jsx(QuizIcon, { size: 14 }), tone: "amber", title: "5-question quiz", body: "Test your understanding right in the chat.", onClick: () => void sendQuestion(`Give me a 5-question quiz about ${cls.name}, one question at a time. Wait for my answer before showing the next.`) }), _jsx(SuggestedTool, { icon: _jsx(CalendarIcon, { size: 14 }), tone: "lilac", title: "Plan a study session", body: "Schedule a 30-minute focus block.", onClick: () => void sendQuestion(`Plan a 30-minute study session for ${cls.name} — what should I do minute-by-minute?`) })] }) })] })] })] }), recorderOpen && (_jsx(AudioRecorderModal, { onClose: () => setRecorderOpen(false), onSave: onAudioSaved })), toast && (_jsx("div", { className: "classes-toast", role: "status", "aria-live": "polite", children: toast }))] }));
};
const ChatBubble = ({ msg, busyAction, notesById, onOpenNoteById, onOpenNote, onSaveNote, onMakeFlashcards, onMakeQuiz, onAddToPlan, onRetry, }) => {
    if (msg.role === "user") {
        return (_jsx("div", { className: "askai-message askai-message--user", children: _jsx("div", { className: "askai-bubble askai-bubble--user", children: msg.content }) }));
    }
    return (_jsxs("div", { className: "askai-message askai-message--assistant", children: [_jsx("span", { className: "askai-avatar", "aria-hidden": true, children: _jsx(SparklesIcon, { size: 14 }) }), _jsx("div", { className: "askai-bubble askai-bubble--assistant", children: msg.pending ? (_jsxs("span", { className: "askai-thinking", "aria-live": "polite", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "askai-answer", children: renderAnswer(msg.content, notesById, onOpenNoteById) }), msg.memoryTrick && (_jsxs("div", { className: "askai-callout", children: [_jsx("span", { className: "askai-callout-icon", "aria-hidden": true, children: _jsx(SparklesIcon, { size: 12 }) }), _jsxs("div", { children: [_jsx("span", { className: "askai-callout-title", children: "Memory trick" }), _jsx("span", { className: "askai-callout-body", children: renderInline(msg.memoryTrick, notesById, onOpenNoteById) })] })] })), !msg.error && (_jsxs("div", { className: "askai-action-chips", children: [_jsx(ChipButton, { icon: _jsx(FileIcon, { size: 12 }), label: "Save to Notes", busy: busyAction === `note-${msg.id}`, onClick: onSaveNote }), _jsx(ChipButton, { icon: _jsx(FlashcardIcon, { size: 12 }), label: "Make Flashcards", busy: busyAction === `fc-${msg.id}`, onClick: onMakeFlashcards }), _jsx(ChipButton, { icon: _jsx(QuizIcon, { size: 12 }), label: "Create Quiz", busy: busyAction === `qz-${msg.id}`, onClick: onMakeQuiz }), _jsx(ChipButton, { icon: _jsx(CalendarIcon, { size: 12 }), label: "Add to Study Plan", busy: busyAction === `plan-${msg.id}`, onClick: onAddToPlan })] })), msg.error && (_jsxs("button", { type: "button", className: "askai-retry", onClick: onRetry, children: ["Try again ", _jsx(ChevRightIcon, { size: 12 })] })), msg.relatedNotes && msg.relatedNotes.length > 0 && (_jsxs("div", { className: "askai-related", children: [_jsx("span", { className: "askai-related-label", children: "Related notes" }), _jsx("ul", { children: msg.relatedNotes.map((n) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "askai-related-row", onClick: () => onOpenNote(n), children: [_jsx(FileIcon, { size: 12 }), _jsx("span", { children: n.title || "Untitled" })] }) }, n.id))) })] }))] })) })] }));
};
const ChipButton = ({ icon, label, busy, onClick }) => (_jsxs("button", { type: "button", className: "askai-chip", onClick: onClick, disabled: busy, "aria-busy": busy ? true : undefined, children: [_jsx("span", { "aria-hidden": true, children: icon }), _jsx("span", { children: busy ? "Working…" : label })] }));
/* ================================================================== */
/* Context cards                                                      */
/* ================================================================== */
const ContextCard = ({ title, icon, tone, children }) => (_jsxs("article", { className: "askai-context-card", children: [_jsxs("header", { className: "askai-context-head", children: [_jsx("span", { className: `askai-context-icon tone-${tone}`, "aria-hidden": true, children: icon }), _jsx("h3", { children: title })] }), _jsx("div", { className: "askai-context-body", children: children })] }));
const SuggestedTool = ({ icon, tone, title, body, onClick }) => (_jsxs("button", { type: "button", className: "askai-tool", onClick: onClick, children: [_jsx("span", { className: `askai-tool-icon tone-${tone}`, "aria-hidden": true, children: icon }), _jsxs("span", { className: "askai-tool-text", children: [_jsx("span", { className: "askai-tool-title", children: title }), _jsx("span", { className: "askai-tool-body", children: body })] }), _jsx(ChevRightIcon, { size: 14 })] }));
/* ================================================================== */
/* Helpers                                                            */
/* ================================================================== */
/**
 * Turn parenthesised note ids (e.g. `(nt_01KQNB2QM544FN7SA1B1Y2GJZH)`) into
 * compact "open note" controls so the raw id string does not clutter the flow.
 * Prefix is two letters + underscore + 26-char Crockford base32 (ULID body).
 */
function renderInline(text, notesById, onOpenNoteById) {
    const out = [];
    let last = 0;
    let k = 0;
    const re = /\(([a-z]{2}_[0-9A-Z]{26})\)/g;
    for (const m of text.matchAll(re)) {
        const id = m[1];
        const full = m[0];
        const start = m.index ?? 0;
        if (start > last) {
            out.push(_jsx("span", { children: text.slice(last, start) }, `t${k++}`));
        }
        const note = notesById.get(id);
        const label = note?.title && note.title.trim() ? note.title.trim() : "Open note";
        out.push(_jsxs("button", { type: "button", className: "askai-note-ref", title: id, onClick: () => void onOpenNoteById(id), "aria-label": `Open note: ${label}`, children: [_jsx(FileIcon, { size: 11, "aria-hidden": true }), _jsx("span", { className: "askai-note-ref-text", children: label })] }, `r${k++}`));
        last = start + full.length;
    }
    if (last < text.length) {
        out.push(_jsx("span", { children: text.slice(last) }, `t${k++}`));
    }
    if (out.length === 0)
        return text;
    return _jsx("span", { className: "askai-inline", children: out });
}
/** Light markdown-ish rendering: paragraphs + bullet lines + note links. */
function renderAnswer(text, notesById, onOpenNoteById) {
    const lines = text.split(/\r?\n/);
    const blocks = [];
    let buffer = [];
    let bullets = [];
    const flushParagraph = () => {
        if (buffer.length === 0)
            return;
        const joined = buffer.join(" ");
        blocks.push(_jsx("p", { children: renderInline(joined, notesById, onOpenNoteById) }, `p-${blocks.length}`));
        buffer = [];
    };
    const flushBullets = () => {
        if (bullets.length === 0)
            return;
        blocks.push(_jsx("ul", { className: "askai-bullets", children: bullets.map((b, i) => (_jsx("li", { children: renderInline(b, notesById, onOpenNoteById) }, i))) }, `u-${blocks.length}`));
        bullets = [];
    };
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) {
            flushBullets();
            flushParagraph();
            continue;
        }
        if (/^[-*•]\s+/.test(line)) {
            flushParagraph();
            bullets.push(line.replace(/^[-*•]\s+/, ""));
        }
        else {
            flushBullets();
            buffer.push(line);
        }
    }
    flushBullets();
    flushParagraph();
    return blocks;
}
function lastUserBefore(messages, id) {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx <= 0)
        return null;
    for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === "user")
            return messages[i].content;
    }
    return null;
}
function preview(text, n = 60) {
    const t = text.replace(/\s+/g, " ").trim();
    return t.length <= n ? t : `${t.slice(0, n)}…`;
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
function stripExt(name) {
    const i = name.lastIndexOf(".");
    return i > 0 ? name.slice(0, i) : name;
}
/**
 * Trim a note body before shipping it as model context. We keep it
 * generous (a few thousand chars) because the prompt itself enforces
 * a per-note cap — but we strip embedded data-URI image payloads first
 * so a single screenshot doesn't blow the budget.
 */
function truncateForPrompt(text, max) {
    if (!text)
        return "";
    const stripped = text.replace(/!\[[^\]]*]\(data:[^)]+\)/g, "[image]");
    if (stripped.length <= max)
        return stripped;
    return `${stripped.slice(0, max)}\n\n[truncated]`;
}
//# sourceMappingURL=ClassAsk.js.map