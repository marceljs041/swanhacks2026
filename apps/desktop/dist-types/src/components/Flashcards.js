import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { getNote, listFlashcardSets, listFlashcardsByMode, markCardForReview, recordRewardPoints, recordXp, relatedDecksForCard, upsertFlashcard, upsertNote, } from "../db/repositories.js";
import { useApp } from "../store.js";
import { POINTS_RULES, XP_RULES, nowIso } from "@studynest/shared";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import { formatSessionTime, loadGoals, loadSession, resetSession, saveSession, } from "../lib/flashcardSession.js";
import { BRAND_FLASHCARD_HERO_URL } from "../lib/brand.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { DeckDetailRail } from "./DeckDetailRail.js";
import { HeroSearch } from "./HeroSearch.js";
import { ArrowLeftIcon, ArrowRightIcon, BookmarkIcon, CheckIcon, ClockIcon, FlagIcon, FlameIcon, FlashcardIcon, HeadphonesIcon, PencilIcon, PlayIcon, RestartIcon, SparklesIcon, StarIcon, TargetIcon, TrophyIcon, } from "./icons.js";
const RATING_TO_DIFFICULTY = {
    again: "new",
    hard: "hard",
    good: "medium",
    easy: "easy",
};
/**
 * SM-2-ish scheduler — keeps the same shape as the previous `schedule`
 * helper so existing review counts / ease values stay coherent. `again`
 * resets the interval to zero so the card pops up next session.
 */
function schedule(card, rating) {
    let ease = card.ease;
    let interval = card.interval_days;
    let reviewCount = card.review_count + 1;
    if (rating === "again") {
        ease = Math.max(1.3, card.ease - 0.2);
        interval = 0;
    }
    else if (rating === "hard") {
        ease = Math.max(1.3, card.ease - 0.15);
        interval = Math.max(1, Math.round((card.interval_days || 1) * 1.2));
    }
    else if (rating === "good") {
        ease = card.ease;
        interval =
            card.review_count === 0
                ? 1
                : Math.max(1, Math.round((card.interval_days || 1) * card.ease));
    }
    else {
        ease = Math.min(2.8, card.ease + 0.1);
        interval =
            card.review_count === 0
                ? 3
                : Math.max(3, Math.round((card.interval_days || 1) * card.ease * 1.5));
    }
    const next = new Date(Date.now() + Math.max(0, interval) * 86_400_000);
    return {
        due_at: next.toISOString(),
        ease,
        interval_days: interval,
        review_count: reviewCount,
    };
}
const RATING_XP = {
    again: 0,
    hard: 1,
    good: 3,
    easy: 5,
};
/** Matches Home / Notes / Classes: `HeroSearch` + brand hero art in `.hero`. */
const FlashcardsReviewHero = ({ children }) => (_jsxs("section", { className: "hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(HeroSearch, {}), children] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_FLASHCARD_HERO_URL, alt: "", decoding: "async" }) })] }));
export const Flashcards = ({ setId, mode = "due" }) => {
    const setView = useApp((s) => s.setView);
    const setSelectedDeck = useApp((s) => s.setSelectedDeck);
    const classes = useApp((s) => s.classes);
    const currentMode = useResolvedMode(mode);
    const [deck, setDeck] = useState(null);
    const [note, setNote] = useState(null);
    const [cards, setCards] = useState([]);
    const [originalTotal, setOriginalTotal] = useState(0);
    const [idx, setIdx] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [session, setSession] = useState(() => loadSession(setId));
    const [goals, setGoals] = useState(() => loadGoals(setId));
    const [related, setRelated] = useState([]);
    const [readingAloud, setReadingAloud] = useState(false);
    const audioWantedRef = useRef(currentMode === "audio");
    useEffect(() => {
        setSelectedDeck(setId);
    }, [setId, setSelectedDeck]);
    // Refresh whenever the deck or mode changes. We *replace* `cards` with
    // a fresh queue rather than splicing so a switch from `due` → `cram`
    // mid-session feels intentional.
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const sets = await listFlashcardSets(null);
            if (cancelled)
                return;
            const next = sets.find((s) => s.id === setId) ?? null;
            setDeck(next);
            if (next?.note_id) {
                const n = await getNote(next.note_id);
                if (!cancelled)
                    setNote(n);
            }
            else {
                setNote(null);
            }
            const queue = await listFlashcardsByMode(setId, currentMode);
            if (cancelled)
                return;
            setCards(queue);
            setOriginalTotal(queue.length);
            setIdx(0);
            setFlipped(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [setId, currentMode]);
    // Resume / refresh the persisted session on mount and whenever the
    // deck changes.
    useEffect(() => {
        setSession(loadSession(setId));
        setGoals(loadGoals(setId));
    }, [setId]);
    // Tick the timer every second so the session-strip clock updates.
    const [, forceTick] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
        return () => window.clearInterval(id);
    }, []);
    const card = cards[idx];
    // Speak the current face whenever it changes (auto-speak in audio
    // review mode, otherwise opt-in via the Read Aloud button).
    useEffect(() => {
        if (!card)
            return;
        if (audioWantedRef.current) {
            speak(flipped ? card.back : card.front);
        }
    }, [card?.id, flipped, card]);
    // Fetch related decks lazily — only when we have a card.
    useEffect(() => {
        if (!card) {
            setRelated([]);
            return;
        }
        let cancelled = false;
        void (async () => {
            const summaries = await relatedDecksForCard(card.id, 3);
            if (cancelled)
                return;
            setRelated(summaries.map((s) => ({
                id: s.set.id,
                title: s.set.title,
                cardCount: s.stats.total,
            })));
        })();
        return () => {
            cancelled = true;
        };
    }, [card?.id, card]);
    const cls = useMemo(() => {
        if (!note?.class_id)
            return null;
        return classes.find((c) => c.id === note.class_id) ?? null;
    }, [note, classes]);
    const totalForProgress = Math.max(originalTotal, 1);
    const progressPct = Math.min(100, Math.round((session.reviewed / totalForProgress) * 100));
    function toggleFlip() {
        setFlipped((f) => !f);
    }
    function speak(text) {
        if (typeof window === "undefined" || !window.speechSynthesis)
            return;
        try {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.rate = 1;
            utter.pitch = 1;
            utter.onstart = () => setReadingAloud(true);
            utter.onend = () => setReadingAloud(false);
            utter.onerror = () => setReadingAloud(false);
            window.speechSynthesis.speak(utter);
        }
        catch {
            setReadingAloud(false);
        }
    }
    function readAloud() {
        if (!card)
            return;
        if (readingAloud && typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setReadingAloud(false);
            return;
        }
        speak(flipped ? card.back : card.front);
    }
    async function handleAddNote() {
        if (!card)
            return;
        const titleSeed = card.front.replace(/\s+/g, " ").trim();
        const title = titleSeed.length > 60 ? titleSeed.slice(0, 60) + "…" : titleSeed;
        const created = await upsertNote({
            title: title || "Note from flashcard",
            content_markdown: `> ${card.front}\n\n${card.back}\n`,
            class_id: cls?.id ?? null,
        });
        setView({ kind: "note", noteId: created.id });
    }
    async function handleMarkForReview() {
        if (!card)
            return;
        await markCardForReview(card.id);
        // refresh local card state too so the difficulty pill re-renders
        setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, difficulty: "hard" } : c)));
    }
    async function rate(rating) {
        if (!card)
            return;
        const isMastered = card.interval_days >= 21;
        const next = schedule(card, rating);
        const updated = {
            ...card,
            ...next,
            difficulty: RATING_TO_DIFFICULTY[rating],
            last_reviewed_at: nowIso(),
        };
        await upsertFlashcard(updated);
        const xpEarned = RATING_XP[rating];
        if (xpEarned > 0)
            await recordXp("flashcardReview", xpEarned);
        const nextSession = {
            ...session,
            reviewed: session.reviewed + 1,
            correct: session.correct + (rating === "good" || rating === "easy" ? 1 : 0),
            streak: rating === "again" ? 0 : session.streak + 1,
            xp: session.xp + xpEarned,
            weakResolved: card.difficulty === "hard" && rating !== "again" && rating !== "hard"
                ? Array.from(new Set([...session.weakResolved, card.id]))
                : session.weakResolved,
        };
        setSession(nextSession);
        saveSession(setId, nextSession);
        if (nextSession.reviewed > 0 &&
            nextSession.reviewed % 10 === 0) {
            await recordXp("reviewTenCards", XP_RULES.reviewTenCards);
            await recordRewardPoints("reviewTenFlashcards", POINTS_RULES.reviewTenFlashcards);
        }
        setCards((prev) => prev.map((c) => (c.id === card.id ? updated : c)));
        setFlipped(false);
        if (idx + 1 >= cards.length) {
            // Session done — keep state persisted but bounce back to the hub.
            setView({ kind: "flashcards" });
            return;
        }
        setIdx(idx + 1);
        void isMastered;
    }
    function restart() {
        const fresh = resetSession(setId);
        setSession(fresh);
        setIdx(0);
        setFlipped(false);
    }
    if (!deck) {
        return (_jsxs(_Fragment, { children: [_jsx("main", { className: "main", children: _jsx("div", { className: "main-inner", children: _jsx("div", { className: "flashcards-center", children: _jsx(FlashcardsReviewHero, { children: _jsx("div", { className: "hero-greeting", children: _jsx("p", { children: "Loading deck\u2026" }) }) }) }) }) }), _jsx(DeckDetailRail, { variant: "review", currentCard: null, currentCardRevealed: false, onAudio: () => {
                        audioWantedRef.current = true;
                    } })] }));
    }
    const tone = cls ? toneFor(cls) : "sky";
    const subtitle = cls?.code ?? cls?.name ?? "Unfiled";
    if (!card) {
        const emptyProgressPct = Math.min(100, Math.round((session.reviewed / Math.max(originalTotal, 1)) * 100));
        return (_jsxs(_Fragment, { children: [_jsx("main", { className: "main", children: _jsx("div", { className: "main-inner", children: _jsxs("div", { className: "flashcards-center", children: [_jsx(FlashcardsReviewHero, { children: _jsxs("header", { className: "fr-header", children: [_jsx("button", { type: "button", className: "fr-back", "aria-label": "Back to decks", onClick: () => withViewTransition(() => setView({ kind: "flashcards" })), children: _jsx(ArrowLeftIcon, { size: 14 }) }), _jsx("span", { className: `fr-deck-icon tone-${tone}`, children: cls ? iconFor(cls, 18) : _jsx(FlashcardIcon, { size: 18 }) }), _jsxs("div", { className: "fr-header-text", children: [_jsx("h1", { children: deck.title }), _jsx("span", { children: subtitle })] }), _jsxs("div", { className: "fr-progress", children: [_jsx("span", { className: "fr-progress-label", children: originalTotal === 0
                                                            ? "No cards in queue"
                                                            : `Card ${Math.min(idx + 1, originalTotal)} of ${originalTotal}` }), _jsx("div", { className: "fr-progress-bar", "aria-hidden": true, children: _jsx("span", { style: { width: `${emptyProgressPct}%` } }) }), _jsxs("span", { className: "fr-progress-pct", children: [emptyProgressPct, "%"] })] }), _jsxs("div", { className: "fr-header-chips", children: [_jsx("span", { className: "rail-chip rail-chip-sage", children: "Lecture" }), _jsx("span", { className: "rail-chip rail-chip-rose", children: "Exam 1" }), _jsxs("span", { className: "rail-chip rail-chip-amber", children: [_jsx(PlayIcon, { size: 10 }), _jsx("span", { children: "Study Session" })] })] })] }) }), _jsxs("div", { className: "fr-empty", children: [_jsx(FlashcardIcon, { size: 36 }), _jsx("h2", { children: "All caught up!" }), _jsx("p", { children: currentMode === "weak"
                                                ? "No weak cards left in this deck — strong work."
                                                : currentMode === "due"
                                                    ? "No cards due in this deck right now."
                                                    : "This deck is empty. Add or generate cards to start studying." }), _jsxs("div", { className: "fr-empty-actions", children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: () => withViewTransition(() => setView({ kind: "flashcards" })), children: "Back to decks" }), _jsx("button", { type: "button", className: "btn-primary", onClick: () => withViewTransition(() => setView({ kind: "flashcardSet", setId, mode: "cram" })), children: "Cram everything" })] })] })] }) }) }), _jsx(DeckDetailRail, { variant: "review", currentCard: null, currentCardRevealed: false, onAudio: () => {
                        audioWantedRef.current = true;
                    } })] }));
    }
    const tag = pickTag(card.front);
    return (_jsxs(_Fragment, { children: [_jsx("main", { className: "main", children: _jsx("div", { className: "main-inner", children: _jsxs("div", { className: "flashcards-center", children: [_jsx(FlashcardsReviewHero, { children: _jsxs("header", { className: "fr-header", children: [_jsx("button", { type: "button", className: "fr-back", "aria-label": "Back to decks", onClick: () => withViewTransition(() => setView({ kind: "flashcards" })), children: _jsx(ArrowLeftIcon, { size: 14 }) }), _jsx("span", { className: `fr-deck-icon tone-${tone}`, children: cls ? iconFor(cls, 18) : _jsx(FlashcardIcon, { size: 18 }) }), _jsxs("div", { className: "fr-header-text", children: [_jsx("h1", { children: deck.title }), _jsx("span", { children: subtitle })] }), _jsxs("div", { className: "fr-progress", children: [_jsxs("span", { className: "fr-progress-label", children: ["Card ", Math.min(idx + 1, originalTotal), " of ", originalTotal] }), _jsx("div", { className: "fr-progress-bar", "aria-hidden": true, children: _jsx("span", { style: { width: `${progressPct}%` } }) }), _jsxs("span", { className: "fr-progress-pct", children: [progressPct, "%"] })] }), _jsxs("div", { className: "fr-header-chips", children: [_jsx("span", { className: "rail-chip rail-chip-sage", children: "Lecture" }), _jsx("span", { className: "rail-chip rail-chip-rose", children: "Exam 1" }), _jsxs("span", { className: "rail-chip rail-chip-amber", children: [_jsx(PlayIcon, { size: 10 }), _jsx("span", { children: "Study Session" })] })] })] }) }), _jsxs("section", { className: "fr-card-wrap", children: [_jsxs("div", { className: `fr-card${flipped ? " is-flipped" : ""}`, role: "button", tabIndex: 0, onClick: toggleFlip, onKeyDown: (e) => {
                                            if (e.key === " " || e.key === "Enter") {
                                                e.preventDefault();
                                                toggleFlip();
                                            }
                                        }, "aria-label": flipped ? "Hide answer" : "Show answer", children: [_jsx("span", { className: `fr-card-tag${flipped ? " answer" : ""}`, children: flipped ? "Answer" : "Question" }), _jsx("div", { className: "fr-card-text", children: flipped ? card.back : card.front }), !flipped && (_jsx("div", { className: "fr-card-hint", children: "Tap or click to reveal the answer \u2728" })), _jsxs("div", { className: "fr-card-meta", children: [_jsxs("span", { children: ["From: ", deck.title] }), _jsxs("span", { children: ["Tag: ", tag] }), _jsxs("span", { children: ["Difficulty: ", labelDifficulty(card.difficulty)] })] })] }), !flipped && (_jsxs("button", { type: "button", className: "fr-show-answer", onClick: toggleFlip, children: [_jsx(PlayIcon, { size: 14 }), _jsx("span", { children: "Show Answer" })] })), _jsxs("div", { className: "fr-quick-actions", children: [_jsxs("button", { type: "button", className: `fr-quick${readingAloud ? " active" : ""}`, onClick: readAloud, children: [_jsx(HeadphonesIcon, { size: 14 }), _jsx("span", { children: readingAloud ? "Stop" : "Read Aloud" })] }), _jsxs("button", { type: "button", className: "fr-quick", onClick: () => void handleAddNote(), children: [_jsx(PencilIcon, { size: 14 }), _jsx("span", { children: "Add Note" })] }), _jsxs("button", { type: "button", className: "fr-quick", onClick: () => void handleMarkForReview(), children: [_jsx(BookmarkIcon, { size: 14 }), _jsx("span", { children: "Mark for Review" })] })] })] }), flipped && (_jsxs("section", { className: "fr-grade-bar", "aria-label": "Grade card", children: [_jsx("p", { className: "fr-grade-prompt", children: "How well did you know it?" }), _jsxs("div", { className: "fr-grade-buttons", children: [_jsx(GradeButton, { tone: "rose", rating: "again", onClick: () => void rate("again") }), _jsx(GradeButton, { tone: "amber", rating: "hard", onClick: () => void rate("hard") }), _jsx(GradeButton, { tone: "sage", rating: "good", onClick: () => void rate("good") }), _jsx(GradeButton, { tone: "sky", rating: "easy", onClick: () => void rate("easy") })] })] })), _jsxs("section", { className: "fr-session", "aria-label": "Session stats", children: [_jsx(SessionPill, { icon: _jsx(TrophyIcon, { size: 14 }), tone: "amber", label: "Session XP", value: session.xp }), _jsx(SessionPill, { icon: _jsx(CheckIcon, { size: 14 }), tone: "sage", label: "Correct", value: session.correct }), _jsx(SessionPill, { icon: _jsx(FlameIcon, { size: 14 }), tone: "peach", label: "Streak", value: session.streak }), _jsx(SessionPill, { icon: _jsx(ClockIcon, { size: 14 }), tone: "lilac", label: "Time", value: formatSessionTime(session) })] }), _jsxs("section", { className: "fr-bottom", children: [_jsxs("div", { className: "fr-bottom-card", children: [_jsxs("header", { className: "fr-bottom-head", children: [_jsxs("span", { className: "fr-bottom-title", children: [_jsx(FlagIcon, { size: 14 }), "Session Goals"] }), _jsxs("button", { type: "button", className: "fh-modal-button-link", onClick: restart, children: [_jsx(RestartIcon, { size: 12 }), _jsx("span", { children: "Restart" })] })] }), _jsxs("ul", { className: "fr-goal-list", children: [_jsx(GoalRow, { label: `Review ${goals.reviewTarget} cards`, current: session.reviewed, target: goals.reviewTarget }), _jsx(GoalRow, { label: "Keep streak alive", current: session.streak, target: goals.keepStreak ? Math.max(5, goals.reviewTarget / 4) : 5, small: true }), _jsx(GoalRow, { label: `Master ${goals.masterWeak} weak cards`, current: session.weakResolved.length, target: Math.max(1, goals.masterWeak) })] })] }), _jsxs("div", { className: "fr-bottom-card", children: [_jsx("header", { className: "fr-bottom-head", children: _jsxs("span", { className: "fr-bottom-title", children: [_jsx(SparklesIcon, { size: 14 }), "Related Review"] }) }), related.length === 0 ? (_jsx("p", { className: "deck-rail-empty-msg", children: "No closely related decks yet." })) : (_jsx("div", { className: "fr-related-grid", children: related.map((r) => (_jsxs("button", { type: "button", className: "fr-related-tile", onClick: () => {
                                                        setSelectedDeck(r.id);
                                                        setView({ kind: "flashcardSet", setId: r.id, mode: currentMode });
                                                    }, children: [_jsx("span", { className: "fr-related-title", children: r.title }), _jsxs("span", { className: "fr-related-meta", children: [r.cardCount, " cards"] })] }, r.id))) })), _jsxs("button", { type: "button", className: "fh-modal-button-link", onClick: () => setView({ kind: "flashcards" }), children: ["View all related topics", _jsx(ArrowRightIcon, { size: 11 })] })] })] })] }) }) }), _jsx(DeckDetailRail, { variant: "review", currentCard: card, currentCardRevealed: flipped, onAudio: () => {
                    audioWantedRef.current = !audioWantedRef.current;
                    if (audioWantedRef.current && card)
                        speak(flipped ? card.back : card.front);
                    else if (typeof window !== "undefined" && window.speechSynthesis) {
                        window.speechSynthesis.cancel();
                    }
                }, onAskAI: () => {
                    if (cls)
                        setView({ kind: "classAsk", classId: cls.id });
                    else if (note)
                        setView({ kind: "note", noteId: note.id });
                } })] }));
};
/* ===== helpers ===== */
function useResolvedMode(mode) {
    // Memoize so the cards effect doesn't re-fire on unrelated re-renders.
    return useMemo(() => mode, [mode]);
}
function labelDifficulty(d) {
    if (d === "new")
        return "New";
    if (d === "easy")
        return "Easy";
    if (d === "hard")
        return "Hard";
    return "Medium";
}
function pickTag(front) {
    const tokens = front
        .replace(/[^a-zA-Z0-9 ]+/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 3);
    if (tokens.length === 0)
        return "Concepts";
    const choice = tokens[0];
    return choice.charAt(0).toUpperCase() + choice.slice(1).toLowerCase();
}
const GRADE_LABELS = {
    again: { title: "Again", emoji: _jsx(RestartIcon, { size: 14 }) },
    hard: { title: "Hard", emoji: _jsx(TargetIcon, { size: 14 }) },
    good: { title: "Good", emoji: _jsx(CheckIcon, { size: 14 }) },
    easy: { title: "Easy", emoji: _jsx(StarIcon, { size: 14 }) },
};
const GradeButton = ({ rating, tone, onClick }) => {
    const meta = GRADE_LABELS[rating];
    return (_jsxs("button", { type: "button", className: `fr-grade fr-grade-${tone}`, onClick: onClick, children: [_jsx("span", { className: "fr-grade-icon", children: meta.emoji }), _jsx("span", { className: "fr-grade-title", children: meta.title })] }));
};
const SessionPill = ({ icon, tone, label, value }) => (_jsxs("div", { className: `fr-session-pill tone-${tone}`, children: [_jsx("span", { className: "fr-session-pill-icon", children: icon }), _jsxs("div", { className: "fr-session-pill-body", children: [_jsx("span", { className: "fr-session-pill-label", children: label }), _jsx("span", { className: "fr-session-pill-value", children: value })] })] }));
const GoalRow = ({ label, current, target, small }) => {
    const pct = Math.min(100, Math.round((current / Math.max(1, target)) * 100));
    const done = current >= target;
    return (_jsxs("li", { className: `fr-goal-row${done ? " done" : ""}${small ? " small" : ""}`, children: [_jsx("span", { className: `fr-goal-check${done ? " done" : ""}`, children: done ? _jsx(CheckIcon, { size: 11 }) : null }), _jsx("span", { className: "fr-goal-label", children: label }), _jsxs("span", { className: "fr-goal-progress", children: [current, " / ", target] })] }));
};
//# sourceMappingURL=Flashcards.js.map