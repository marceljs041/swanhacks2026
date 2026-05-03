import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { deckStats, listFlashcards, listFlashcardSets, recordXp, upsertQuiz, upsertQuizQuestion, upsertStudyTask, } from "../db/repositories.js";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import { useApp } from "../store.js";
import { ulid } from "@studynest/shared";
import { ai } from "../lib/ai.js";
import { ArrowLeftIcon, ArrowRightIcon, BookmarkIcon, CheckIcon, CloudCheckIcon, CloudOffIcon, FlashcardIcon, HeadphonesIcon, QuizIcon, SparklesIcon, StarIcon, } from "./icons.js";
import { MoreMenu } from "./ui/MoreMenu.js";
export const DeckDetailRail = ({ variant, currentCard = null, currentCardRevealed = false, summaries, onToggleFavorite, isFavorite = false, onAudio, onAskAI, }) => {
    const selectedDeckId = useApp((s) => s.selectedDeckId);
    const setSelectedDeck = useApp((s) => s.setSelectedDeck);
    const setView = useApp((s) => s.setView);
    const classes = useApp((s) => s.classes);
    const syncStatus = useApp((s) => s.syncStatus);
    const [deck, setDeck] = useState(null);
    const [note, setNote] = useState(null);
    const [stats, setStats] = useState({
        total: 0,
        due: 0,
        mastered: 0,
        weak: 0,
        mastery_pct: 0,
    });
    const [previewCards, setPreviewCards] = useState([]);
    const [busy, setBusy] = useState(null);
    const [toast, setToast] = useState(null);
    const fallbackDeckId = useMemo(() => {
        if (!summaries?.length)
            return null;
        return summaries[0]?.set.id ?? null;
    }, [summaries]);
    const activeDeckId = selectedDeckId ?? fallbackDeckId;
    // Load deck + stats whenever the active id changes. We also refresh
    // when `currentCard` changes (review mode) so the stat tiles tick down
    // as the user grades cards without having to reach back into the DB.
    useEffect(() => {
        let cancelled = false;
        if (!activeDeckId) {
            setDeck(null);
            setNote(null);
            return () => undefined;
        }
        void (async () => {
            const sets = await listFlashcardSets(null);
            if (cancelled)
                return;
            const next = sets.find((s) => s.id === activeDeckId) ?? null;
            setDeck(next);
            if (next?.note_id) {
                const { getNote } = await import("../db/repositories.js");
                const n = await getNote(next.note_id);
                if (!cancelled)
                    setNote(n);
            }
            else {
                setNote(null);
            }
            const s = await deckStats(activeDeckId);
            if (!cancelled)
                setStats(s);
            const cards = await listFlashcards(activeDeckId);
            if (!cancelled)
                setPreviewCards(cards.slice(0, 3));
        })();
        return () => {
            cancelled = true;
        };
    }, [activeDeckId, currentCard?.id, currentCardRevealed]);
    useEffect(() => {
        if (!toast)
            return;
        const id = window.setTimeout(() => setToast(null), 2400);
        return () => window.clearTimeout(id);
    }, [toast]);
    const cls = useMemo(() => {
        if (!note?.class_id)
            return null;
        return classes.find((c) => c.id === note.class_id) ?? null;
    }, [note, classes]);
    if (!activeDeckId || !deck) {
        return (_jsx("aside", { className: "deck-rail empty", "aria-label": "Deck details", children: _jsx("p", { className: "deck-rail-empty-msg", children: "Select a deck to see its mastery progress and AI tools." }) }));
    }
    const tone = cls ? toneFor(cls) : "sky";
    const subtitle = cls?.code ?? cls?.name ?? "Unfiled";
    const description = note?.summary ||
        (note?.content_markdown
            ? truncate(stripMarkdown(note.content_markdown), 140)
            : "Tap any card to reveal the answer and grade your recall.");
    async function generateQuiz() {
        if (!deck)
            return;
        setBusy("quiz");
        try {
            const cards = await listFlashcards(deck.id);
            if (cards.length === 0) {
                setToast("Deck has no cards yet.");
                return;
            }
            const text = cards.map((c) => `Q: ${c.front}\nA: ${c.back}`).join("\n\n");
            const noteIdForAi = deck.note_id ?? deck.id;
            const res = await ai.quiz({
                note_id: noteIdForAi,
                title: deck.title,
                content: text,
                count: Math.min(8, Math.max(3, Math.floor(cards.length / 2))),
            });
            const quiz = await upsertQuiz({
                title: `${deck.title} · quiz`,
                note_id: deck.note_id ?? null,
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
            setToast(`Quiz ready — ${res.questions.length} questions.`);
            setView({ kind: "quiz", quizId: quiz.id });
        }
        catch {
            setToast("Couldn't generate a quiz from this deck.");
        }
        finally {
            setBusy(null);
        }
    }
    async function addToStudyPlan() {
        if (!deck)
            return;
        setBusy("plan");
        try {
            const at = new Date();
            at.setHours(at.getHours() + 1, 0, 0, 0);
            await upsertStudyTask({
                id: ulid("tsk"),
                type: "review",
                title: `Review: ${deck.title}`,
                scheduled_for: at.toISOString(),
                duration_minutes: Math.max(10, Math.min(45, stats.due * 1)),
                note_id: deck.note_id ?? null,
            });
            await recordXp("studyTaskComplete", 1);
            setToast("Added a review block to your study plan.");
        }
        catch {
            setToast("Couldn't add to your study plan.");
        }
        finally {
            setBusy(null);
        }
    }
    function startMode(mode) {
        if (!deck)
            return;
        setView({ kind: "flashcardSet", setId: deck.id, mode });
    }
    const moreItems = [
        {
            label: "Open in deck list",
            icon: _jsx(FlashcardIcon, { size: 14 }),
            onClick: () => setView({ kind: "flashcards" }),
        },
        {
            label: "Start review",
            icon: _jsx(ArrowRightIcon, { size: 14 }),
            onClick: () => startMode("due"),
        },
        {
            label: "Cram all cards",
            icon: _jsx(SparklesIcon, { size: 14 }),
            onClick: () => startMode("cram"),
        },
    ];
    return (_jsxs("aside", { className: "deck-rail", "aria-label": "Deck details", children: [_jsxs("header", { className: "deck-rail-head", children: [_jsx("button", { type: "button", className: "deck-rail-back", "aria-label": "Back to all decks", onClick: () => {
                            if (variant === "review") {
                                setView({ kind: "flashcards" });
                            }
                            else {
                                setSelectedDeck(null);
                            }
                        }, children: _jsx(ArrowLeftIcon, { size: 16 }) }), _jsx("span", { className: "deck-rail-spacer" }), _jsx(MoreMenu, { items: moreItems, label: "Deck actions" })] }), _jsxs("div", { className: "deck-rail-title", children: [_jsx("span", { className: `deck-rail-icon tone-${tone}`, children: cls ? iconFor(cls, 22) : _jsx(FlashcardIcon, { size: 22 }) }), _jsxs("div", { className: "deck-rail-title-text", children: [_jsx("h2", { children: deck.title }), _jsx("span", { className: "deck-rail-subtitle", children: subtitle })] })] }), _jsxs("div", { className: "deck-rail-chips", children: [_jsx("span", { className: "rail-chip rail-chip-sage", children: note ? "Lecture" : "Deck" }), _jsx("span", { className: "rail-chip rail-chip-rose", children: "Exam 1" }), _jsxs("button", { type: "button", className: `rail-chip rail-chip-fav${isFavorite ? " active" : ""}`, onClick: () => onToggleFavorite?.(), children: [_jsx(StarIcon, { size: 11 }), _jsx("span", { children: isFavorite ? "Favorite" : "Favorite" })] })] }), _jsx("p", { className: "deck-rail-description", children: description }), _jsxs("div", { className: "deck-rail-stats", children: [_jsx(RailStat, { label: "Total Cards", value: stats.total, icon: _jsx(FlashcardIcon, { size: 14 }), tone: "amber" }), _jsx(RailStat, { label: "Due Today", value: stats.due, icon: _jsx(BookmarkIcon, { size: 14 }), tone: "peach" }), _jsx(RailStat, { label: "Mastered", value: stats.mastered, icon: _jsx(CheckIcon, { size: 14 }), tone: "sage" }), _jsx(RailStat, { label: "Weak Cards", value: stats.weak, icon: _jsx(SparklesIcon, { size: 14 }), tone: "rose" })] }), _jsxs("section", { className: "deck-rail-block", children: [_jsxs("header", { className: "deck-rail-block-head", children: [_jsx("span", { children: "Mastery Progress" }), _jsxs("span", { className: "deck-rail-mastery-pct", children: [Math.round(stats.mastery_pct * 100), "%"] })] }), _jsx("div", { className: "deck-rail-mastery-bar", children: _jsx("span", { style: { width: `${stats.mastery_pct * 100}%` } }) }), _jsxs("p", { className: "deck-rail-mastery-sub", children: [stats.mastered, " of ", stats.total, " cards mastered"] })] }), variant === "hub" ? (_jsxs("section", { className: "deck-rail-block", children: [_jsxs("header", { className: "deck-rail-block-head", children: [_jsxs("span", { children: ["Preview (", previewCards.length, ")"] }), _jsx("button", { type: "button", className: "deck-rail-link", onClick: () => startMode("cram"), children: "View all" })] }), previewCards.length === 0 ? (_jsx("p", { className: "deck-rail-empty-msg", children: "This deck is empty. Generate cards from a note to populate it." })) : (_jsx("ul", { className: "deck-rail-preview", children: previewCards.slice(0, 2).map((c) => (_jsxs("li", { className: "deck-rail-preview-item", children: [_jsxs("div", { className: "qa-row", children: [_jsx("span", { className: "qa-tag qa-q", children: "Q" }), _jsx("span", { className: "qa-text", children: c.front })] }), _jsxs("div", { className: "qa-row", children: [_jsx("span", { className: "qa-tag qa-a", children: "A" }), _jsx("span", { className: "qa-text", children: c.back })] })] }, c.id))) }))] })) : (_jsxs("section", { className: "deck-rail-block", children: [_jsx("header", { className: "deck-rail-block-head", children: _jsx("span", { children: "Current Card" }) }), currentCard ? (_jsxs("div", { className: "deck-rail-current", children: [_jsxs("div", { className: "qa-row", children: [_jsx("span", { className: "qa-tag qa-q", children: "Q" }), _jsx("span", { className: "qa-text", children: currentCard.front })] }), currentCardRevealed ? (_jsxs("div", { className: "deck-rail-answer-pill", children: [_jsx("span", { children: currentCard.back }), _jsx(CheckIcon, { size: 14 })] })) : (_jsx("p", { className: "deck-rail-empty-msg", children: "Reveal the card to see the answer here." }))] })) : (_jsx("p", { className: "deck-rail-empty-msg", children: "Pick a card to start reviewing." }))] })), _jsxs("section", { className: "deck-rail-block", children: [_jsx("header", { className: "deck-rail-block-head", children: _jsx("span", { children: variant === "hub" ? "AI Tools" : "Review Shortcuts" }) }), _jsxs("div", { className: "deck-rail-tools", children: [variant === "hub" && (_jsx(RailToolButton, { icon: _jsx(SparklesIcon, { size: 14 }), label: "Generate Flashcards", onClick: () => setView({ kind: "notes" }), busy: false })), _jsx(RailToolButton, { icon: _jsx(HeadphonesIcon, { size: 14 }), label: "Review by Audio", onClick: () => {
                                    if (variant === "review") {
                                        onAudio?.();
                                    }
                                    else {
                                        startMode("audio");
                                    }
                                } }), _jsx(RailToolButton, { icon: _jsx(QuizIcon, { size: 14 }), label: "Create Quiz", onClick: () => void generateQuiz(), busy: busy === "quiz" }), _jsx(RailToolButton, { icon: _jsx(BookmarkIcon, { size: 14 }), label: "Add to Study Plan", onClick: () => void addToStudyPlan(), busy: busy === "plan" }), variant === "review" && (_jsx(RailToolButton, { icon: _jsx(SparklesIcon, { size: 14 }), label: "Ask AI", onClick: () => onAskAI?.() }))] })] }), _jsxs("footer", { className: `deck-rail-sync sync-${syncStatus}`, children: [_jsx("span", { className: "deck-rail-sync-icon", children: syncStatus === "offline" ? _jsx(CloudOffIcon, { size: 14 }) : _jsx(CloudCheckIcon, { size: 14 }) }), _jsxs("div", { className: "deck-rail-sync-text", children: [_jsx("span", { className: "lead", children: syncStatus === "offline" ? "Working offline" : "All changes synced" }), _jsx("span", { className: "sub", children: syncStatus === "offline"
                                    ? "We'll catch up when you're online."
                                    : "Last synced just now" })] })] }), toast && _jsx("div", { className: "deck-rail-toast", children: toast })] }));
};
const RailStat = ({ label, value, icon, tone }) => (_jsxs("div", { className: `rail-stat tone-${tone}`, children: [_jsx("span", { className: "rail-stat-icon", children: icon }), _jsx("span", { className: "rail-stat-num", children: value }), _jsx("span", { className: "rail-stat-label", children: label })] }));
const RailToolButton = ({ icon, label, onClick, busy }) => (_jsxs("button", { type: "button", className: "deck-rail-tool", onClick: onClick, disabled: busy, children: [_jsx("span", { className: "deck-rail-tool-icon", children: icon }), _jsx("span", { className: "deck-rail-tool-label", children: busy ? "Working…" : label }), _jsx(ArrowRightIcon, { size: 12 })] }));
function stripMarkdown(md) {
    return md
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`[^`]*`/g, " ")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[#*_>~-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function truncate(text, max) {
    if (text.length <= max)
        return text;
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 32 ? cut.slice(0, lastSpace) : cut) + "…";
}
//# sourceMappingURL=DeckDetailRail.js.map