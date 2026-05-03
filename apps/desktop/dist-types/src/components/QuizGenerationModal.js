import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { XP_RULES } from "@studynest/shared";
import { ai } from "../lib/ai.js";
import { enqueueQuizGeneration } from "../lib/quizGenerationQueue.js";
import { listClasses, listFlashcardSets, listFlashcards, listNotes, recordXp, upsertQuiz, upsertQuizQuestion, } from "../db/repositories.js";
/** Minimum content length we'll send to `ai.quiz` — anything shorter
 *  produces hallucination-heavy questions, so we surface an error
 *  instead and ask the user to add notes first. */
const MIN_CONTENT_LEN = 80;
export const QuizGenerationModal = ({ initialSource, onClose, onGenerated, }) => {
    const [source, setSource] = useState(initialSource?.kind ?? "note");
    const [notes, setNotes] = useState([]);
    const [classes, setClasses] = useState([]);
    const [decks, setDecks] = useState([]);
    const [noteId, setNoteId] = useState(initialSource?.kind === "note" ? initialSource.id : "");
    const [classId, setClassId] = useState(initialSource?.kind === "class" ? initialSource.id : "");
    const [deckId, setDeckId] = useState(initialSource?.kind === "flashcards" ? initialSource.id : "");
    const [count, setCount] = useState(8);
    const [type, setType] = useState("multiple_choice");
    const [difficulty, setDifficulty] = useState("medium");
    const [includeExplanations, setIncludeExplanations] = useState(true);
    const [includeHints, setIncludeHints] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        void Promise.all([listNotes(null), listClasses(), listFlashcardSets(null)]).then(([n, c, d]) => {
            setNotes(n);
            setClasses(c);
            setDecks(d);
            if (!noteId && initialSource?.kind !== "note")
                setNoteId(n[0]?.id ?? "");
            if (!classId && initialSource?.kind !== "class")
                setClassId(c[0]?.id ?? "");
            if (!deckId && initialSource?.kind !== "flashcards")
                setDeckId(d[0]?.id ?? "");
        });
    }, []);
    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape" && !busy)
                onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose, busy]);
    const sourceOk = (source === "note" && !!noteId) ||
        (source === "class" && !!classId) ||
        (source === "flashcards" && !!deckId);
    const sourceTitle = useMemo(() => {
        if (source === "note")
            return notes.find((n) => n.id === noteId)?.title ?? "";
        if (source === "class")
            return classes.find((c) => c.id === classId)?.name ?? "";
        return decks.find((d) => d.id === deckId)?.title ?? "";
    }, [source, noteId, classId, deckId, notes, classes, decks]);
    async function buildContent() {
        if (source === "note") {
            const n = notes.find((x) => x.id === noteId);
            if (!n)
                throw new Error("Pick a note first.");
            return {
                title: n.title,
                content: n.content_markdown,
                note_id: n.id,
                class_id: n.class_id,
                source_ids: [n.id],
                source_type: "note",
            };
        }
        if (source === "class") {
            const c = classes.find((x) => x.id === classId);
            if (!c)
                throw new Error("Pick a class first.");
            const allNotes = await listNotes(c.id);
            if (allNotes.length === 0) {
                throw new Error("That class has no notes yet — add notes first.");
            }
            const merged = allNotes
                .map((n) => `# ${n.title}\n\n${n.content_markdown}`)
                .join("\n\n---\n\n")
                .slice(0, 12_000);
            return {
                title: `${c.name} review`,
                content: merged,
                note_id: allNotes[0]?.id ?? null,
                class_id: c.id,
                source_ids: allNotes.map((n) => n.id),
                source_type: "class",
            };
        }
        const d = decks.find((x) => x.id === deckId);
        if (!d)
            throw new Error("Pick a flashcard deck first.");
        const cards = await listFlashcards(d.id);
        if (cards.length === 0)
            throw new Error("That deck is empty.");
        const text = cards.map((c) => `Q: ${c.front}\nA: ${c.back}`).join("\n\n");
        return {
            title: `${d.title} quiz`,
            content: text,
            note_id: d.note_id ?? null,
            class_id: null,
            source_ids: [d.id],
            source_type: "flashcards",
        };
    }
    async function submit() {
        setError(null);
        if (!sourceOk) {
            setError("Pick a source first.");
            return;
        }
        setBusy(true);
        try {
            const quiz = await enqueueQuizGeneration(`Generate quiz from ${sourceTitle || source}`, async () => {
                const ctx = await buildContent();
                if (!ctx.content || ctx.content.length < MIN_CONTENT_LEN) {
                    throw new Error("Source content is too short to generate a quality quiz.");
                }
                const types = pickTypes(type);
                const res = await ai.quiz({
                    note_id: ctx.note_id ?? "",
                    title: ctx.title,
                    content: ctx.content,
                    count,
                    types,
                });
                const quizRow = await upsertQuiz({
                    title: ctx.title,
                    note_id: ctx.note_id,
                    class_id: ctx.class_id,
                    description: descriptionFor(ctx, count, difficulty),
                    difficulty,
                    status: "new",
                    source_type: ctx.source_type,
                    source_ids_json: JSON.stringify(ctx.source_ids),
                    tags_json: JSON.stringify(defaultTagsFor(ctx.source_type)),
                });
                let position = 0;
                for (const q of res.questions) {
                    await upsertQuizQuestion({
                        quiz_id: quizRow.id,
                        type: q.type,
                        question: q.question,
                        options_json: q.type === "multiple_choice" ? JSON.stringify(q.options) : null,
                        correct_answer: String(q.answer),
                        explanation: includeExplanations ? q.explanation ?? null : null,
                        hint: includeHints ? deriveHint(q) : null,
                        source_note_id: ctx.note_id,
                        position: position++,
                    });
                }
                await recordXp("generateFlashcards", XP_RULES.generateFlashcards);
                return quizRow;
            });
            onGenerated(quiz.id);
        }
        catch (e) {
            setError(e.message || "Couldn't generate a quiz.");
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsx("div", { className: "qz-modal-backdrop", onClick: () => !busy && onClose(), children: _jsxs("div", { className: "qz-modal", role: "dialog", "aria-modal": "true", "aria-label": "Generate quiz", onClick: (e) => e.stopPropagation(), children: [_jsxs("header", { className: "qz-modal-head", children: [_jsx("h2", { children: "Generate a quiz" }), _jsx("p", { children: "Note Goat will turn your study material into practice questions." })] }), _jsxs("div", { className: "qz-modal-body", children: [_jsxs(Section, { title: "1. Pick a source", children: [_jsx("div", { className: "qz-source-row", role: "tablist", "aria-label": "Quiz source", children: ["note", "class", "flashcards"].map((k) => (_jsx("button", { type: "button", role: "tab", "aria-selected": source === k, className: `qz-source-tab${source === k ? " active" : ""}`, onClick: () => setSource(k), children: k === "note"
                                            ? "From a Note"
                                            : k === "class"
                                                ? "From a Class"
                                                : "From Flashcards" }, k))) }), source === "note" && (_jsxs("label", { className: "qz-modal-label", children: [_jsx("span", { children: "Note" }), _jsx("select", { className: "field", value: noteId, onChange: (e) => setNoteId(e.target.value), disabled: notes.length === 0, children: notes.length === 0 ? (_jsx("option", { value: "", children: "\u2014 No notes yet" })) : (notes.map((n) => (_jsx("option", { value: n.id, children: n.title || "Untitled" }, n.id)))) })] })), source === "class" && (_jsxs("label", { className: "qz-modal-label", children: [_jsx("span", { children: "Class" }), _jsx("select", { className: "field", value: classId, onChange: (e) => setClassId(e.target.value), disabled: classes.length === 0, children: classes.length === 0 ? (_jsx("option", { value: "", children: "\u2014 No classes yet" })) : (classes.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))) })] })), source === "flashcards" && (_jsxs("label", { className: "qz-modal-label", children: [_jsx("span", { children: "Deck" }), _jsx("select", { className: "field", value: deckId, onChange: (e) => setDeckId(e.target.value), disabled: decks.length === 0, children: decks.length === 0 ? (_jsx("option", { value: "", children: "\u2014 No decks yet" })) : (decks.map((d) => (_jsx("option", { value: d.id, children: d.title }, d.id)))) })] }))] }), _jsxs(Section, { title: "2. Configure", children: [_jsxs("div", { className: "qz-config-grid", children: [_jsxs("label", { className: "qz-modal-label", children: [_jsx("span", { children: "Questions" }), _jsx("input", { type: "number", className: "field", min: 3, max: 20, value: count, onChange: (e) => setCount(Math.min(20, Math.max(3, Number(e.target.value) || 5))) })] }), _jsxs("label", { className: "qz-modal-label", children: [_jsx("span", { children: "Type" }), _jsxs("select", { className: "field", value: type, onChange: (e) => setType(e.target.value), children: [_jsx("option", { value: "multiple_choice", children: "Multiple choice" }), _jsx("option", { value: "true_false", children: "True / False" }), _jsx("option", { value: "mixed", children: "Mixed" })] })] }), _jsxs("label", { className: "qz-modal-label", children: [_jsx("span", { children: "Difficulty" }), _jsxs("select", { className: "field", value: difficulty, onChange: (e) => setDifficulty(e.target.value), children: [_jsx("option", { value: "easy", children: "Easy" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "hard", children: "Hard" })] })] })] }), _jsxs("div", { className: "qz-toggle-row", children: [_jsxs("label", { className: "qz-toggle", children: [_jsx("input", { type: "checkbox", checked: includeExplanations, onChange: (e) => setIncludeExplanations(e.target.checked) }), _jsx("span", { children: "Include explanations" })] }), _jsxs("label", { className: "qz-toggle", children: [_jsx("input", { type: "checkbox", checked: includeHints, onChange: (e) => setIncludeHints(e.target.checked) }), _jsx("span", { children: "Include hints" })] })] })] }), sourceTitle && (_jsxs("p", { className: "qz-modal-hint", children: ["Generating from ", _jsx("strong", { children: sourceTitle }), "."] })), error && _jsx("div", { className: "qz-modal-error", children: error }), _jsxs("div", { className: "qz-modal-actions", children: [_jsx("button", { type: "button", className: "btn-ghost", onClick: onClose, disabled: busy, children: "Cancel" }), _jsx("button", { type: "button", className: "btn-primary", disabled: busy || !sourceOk, onClick: () => void submit(), children: busy ? "Generating…" : "Generate quiz" })] })] })] }) }));
};
const Section = ({ title, children }) => (_jsxs("section", { className: "qz-modal-section", children: [_jsx("h3", { className: "qz-modal-section-title", children: title }), children] }));
/* ---------------- helpers ---------------- */
function pickTypes(pref) {
    if (pref === "multiple_choice")
        return ["multiple_choice"];
    if (pref === "true_false")
        return ["true_false"];
    return ["multiple_choice", "true_false"];
}
function deriveHint(q) {
    if (!q.explanation)
        return null;
    const trimmed = q.explanation.trim();
    if (!trimmed)
        return null;
    return trimmed.split(/[.!?]/)[0]?.slice(0, 120) || null;
}
function descriptionFor(ctx, count, difficulty) {
    const subject = ctx.source_type === "class" ? "your class" : `“${ctx.title}”`;
    return `${count} ${difficulty} questions generated from ${subject}.`;
}
function defaultTagsFor(source) {
    if (source === "class")
        return ["Class", "Exam Review"];
    if (source === "flashcards")
        return ["Deck", "Practice"];
    return ["Lecture", "Practice"];
}
//# sourceMappingURL=QuizGenerationModal.js.map