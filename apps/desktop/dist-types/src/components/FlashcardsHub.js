import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { decksMissingQuiz, decksNotReviewedSince, flashcardsHubStats, listDeckSummaries, listNotes, recordXp, totalWeakCards, upsertFlashcard, upsertFlashcardSet, } from "../db/repositories.js";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import { useApp } from "../store.js";
import { XP_RULES } from "@studynest/shared";
import { ai } from "../lib/ai.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { DeckDetailRail } from "./DeckDetailRail.js";
import { HeroSearch } from "./HeroSearch.js";
import { RightPanel } from "./RightPanel.js";
import { BRAND_FLASHCARD_HERO_URL } from "../lib/brand.js";
import { ArrowRightIcon, BookmarkIcon, CalendarIcon, CheckIcon, FlameIcon, FlashcardIcon, HeadphonesIcon, ImportIcon, LightningIcon, PlayIcon, PlusIcon, RestartIcon, SearchIcon, SparklesIcon, StarIcon, TargetIcon, WarningIcon, } from "./icons.js";
const ZERO_HUB_STATS = {
    dueToday: 0,
    totalDecks: 0,
    mastered: 0,
    studyStreakDays: 0,
};
export const FlashcardsHub = () => {
    const setView = useApp((s) => s.setView);
    const setSelectedDeck = useApp((s) => s.setSelectedDeck);
    const selectedDeckId = useApp((s) => s.selectedDeckId);
    const setFlashcardsDetailPanelOpen = useApp((s) => s.setFlashcardsDetailPanelOpen);
    const classes = useApp((s) => s.classes);
    const [stats, setStats] = useState(ZERO_HUB_STATS);
    const [summaries, setSummaries] = useState([]);
    const [needsAttention, setNeedsAttention] = useState({
        hardCards: 0,
        staleDecks: 0,
        needsQuiz: 0,
    });
    const [search, setSearch] = useState("");
    const [favorites, setFavorites] = useState(() => loadFavorites());
    const [createOpen, setCreateOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [generateOpen, setGenerateOpen] = useState(false);
    const [reload, setReload] = useState(0);
    const selectDeckPreview = useCallback((id) => {
        withViewTransition(() => setSelectedDeck(id));
    }, [setSelectedDeck]);
    useEffect(() => {
        void (async () => {
            const [hub, list, weak, stale, miss] = await Promise.all([
                flashcardsHubStats(),
                listDeckSummaries(),
                totalWeakCards(),
                decksNotReviewedSince(new Date(Date.now() - 5 * 86_400_000).toISOString()),
                decksMissingQuiz(),
            ]);
            setStats(hub);
            setSummaries(list);
            setNeedsAttention({ hardCards: weak, staleDecks: stale, needsQuiz: miss });
            const prev = useApp.getState().selectedDeckId;
            if (prev && list.some((s) => s.set.id === prev)) {
                return;
            }
            setSelectedDeck(null);
        })();
    }, [reload, setSelectedDeck]);
    useEffect(() => {
        setFlashcardsDetailPanelOpen(!!selectedDeckId);
        return () => setFlashcardsDetailPanelOpen(false);
    }, [selectedDeckId, setFlashcardsDetailPanelOpen]);
    const filteredSummaries = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q)
            return summaries;
        return summaries.filter((s) => s.set.title.toLowerCase().includes(q) ||
            s.note?.title?.toLowerCase().includes(q) ||
            false);
    }, [search, summaries]);
    function startReview(setId, mode = "due") {
        withViewTransition(() => {
            setSelectedDeck(setId);
            setView({ kind: "flashcardSet", setId, mode });
        });
    }
    function startWeakReview() {
        const target = summaries.find((s) => s.stats.weak > 0) ?? summaries[0];
        if (!target)
            return;
        startReview(target.set.id, "weak");
    }
    function startDailyReview() {
        const target = summaries.find((s) => s.stats.due > 0) ?? summaries[0] ?? null;
        if (!target)
            return;
        startReview(target.set.id, "due");
    }
    function toggleFavorite(setId) {
        setFavorites((prev) => {
            const next = new Set(prev);
            if (next.has(setId))
                next.delete(setId);
            else
                next.add(setId);
            saveFavorites(next);
            return next;
        });
    }
    return (_jsxs(_Fragment, { children: [_jsxs("main", { className: "main", children: [_jsx("div", { className: "main-inner", children: _jsxs("div", { className: "flashcards-center", children: [_jsxs("section", { className: "hero", children: [_jsxs("div", { className: "hero-main", children: [_jsx(HeroSearch, {}), _jsxs("div", { className: "hero-greeting", children: [_jsx("h1", { className: "hero-headline", children: "Flashcards" }), _jsx("p", { children: "Review smarter with spaced repetition, decks, and daily goals." })] })] }), _jsx("div", { className: "hero-illustration", "aria-hidden": true, children: _jsx("img", { className: "hero-illustration-img", src: BRAND_FLASHCARD_HERO_URL, alt: "", decoding: "async" }) })] }), _jsxs("section", { className: "fh-stat-grid", children: [_jsx(FhStat, { icon: _jsx(CalendarIcon, { size: 18 }), tone: "peach", value: stats.dueToday, label: "Due Today" }), _jsx(FhStat, { icon: _jsx(FlashcardIcon, { size: 18 }), tone: "sage", value: stats.totalDecks, label: "Total Decks" }), _jsx(FhStat, { icon: _jsx(StarIcon, { size: 18 }), tone: "lilac", value: stats.mastered, label: "Mastered" }), _jsx(FhStat, { icon: _jsx(FlameIcon, { size: 18 }), tone: "amber", value: stats.studyStreakDays, label: stats.studyStreakDays === 1 ? "day Study Streak" : "days Study Streak", compact: true })] }), _jsxs("section", { className: "fh-daily", role: "region", "aria-label": "Daily review", children: [_jsx("span", { className: "fh-daily-icon", children: _jsx(CalendarIcon, { size: 22 }) }), _jsxs("div", { className: "fh-daily-text", children: [_jsx("span", { className: "fh-daily-title", children: "Daily Review" }), _jsxs("span", { className: "fh-daily-sub", children: [_jsxs("strong", { children: [stats.dueToday, " cards due today"] }), _jsx("span", { className: "fh-daily-divider", "aria-hidden": true, children: "\u00B7" }), _jsxs("span", { className: "fh-daily-time", children: ["~", Math.max(1, Math.round(stats.dueToday * 1)), " min"] }), _jsx("span", { className: "fh-daily-divider", "aria-hidden": true, children: "\u00B7" }), _jsx("span", { children: "Keep your streak alive" })] })] }), _jsxs("button", { type: "button", className: "fh-daily-cta", onClick: startDailyReview, disabled: stats.dueToday === 0 || summaries.length === 0, children: [_jsx(PlayIcon, { size: 14 }), _jsx("span", { children: "Start Review" })] })] }), _jsx("div", { className: "search-wrap fh-deck-filter", children: _jsxs("label", { className: "search", children: [_jsx("span", { className: "search-icon", children: _jsx(SearchIcon, { size: 16 }) }), _jsx("input", { type: "search", placeholder: "Filter decks by title or note\u2026", "aria-label": "Filter decks", value: search, onChange: (e) => setSearch(e.target.value) })] }) }), _jsxs("section", { className: "fh-action-chips", "aria-label": "Deck actions", children: [_jsx(ActionChip, { icon: _jsx(PlusIcon, { size: 16 }), label: "Create Deck", tone: "peach", onClick: () => setCreateOpen(true) }), _jsx(ActionChip, { icon: _jsx(SparklesIcon, { size: 16 }), label: "Generate Flashcards", tone: "sage", onClick: () => setGenerateOpen(true) }), _jsx(ActionChip, { icon: _jsx(ImportIcon, { size: 16 }), label: "Import Cards", tone: "sky", onClick: () => setImportOpen(true) }), _jsx(ActionChip, { icon: _jsx(TargetIcon, { size: 16 }), label: "Review Weak Cards", tone: "rose", onClick: startWeakReview })] }), _jsx("section", { className: "fh-deck-grid", "aria-label": "Decks", children: filteredSummaries.length === 0 ? (_jsxs("div", { className: "fh-empty", children: [_jsx(FlashcardIcon, { size: 28 }), _jsx("p", { children: summaries.length === 0
                                                    ? "You don't have any decks yet — generate one from a note or import from CSV."
                                                    : "No decks match that search." })] })) : (filteredSummaries.map((s) => (_jsx(DeckCard, { summary: s, classes: classes, active: selectedDeckId === s.set.id, isFavorite: favorites.has(s.set.id), onOpen: () => {
                                            if (selectedDeckId === s.set.id)
                                                selectDeckPreview(null);
                                            else
                                                selectDeckPreview(s.set.id);
                                        }, onStudy: () => startReview(s.set.id, "due"), onToggleFavorite: () => toggleFavorite(s.set.id) }, s.set.id)))) }), _jsxs("section", { className: "fh-bottom", children: [_jsxs("div", { className: "fh-bottom-card", children: [_jsx("header", { className: "fh-bottom-head", children: _jsx("h3", { children: "Review Modes" }) }), _jsxs("div", { className: "fh-mode-grid", children: [_jsx(ModeTile, { icon: _jsx(CalendarIcon, { size: 18 }), tone: "peach", title: "Due Cards", value: stats.dueToday, caption: "Ready to review", onClick: () => {
                                                                if (selectedDeckId)
                                                                    startReview(selectedDeckId, "due");
                                                                else
                                                                    startDailyReview();
                                                            } }), _jsx(ModeTile, { icon: _jsx(LightningIcon, { size: 18 }), tone: "lilac", title: "Cram Mode", value: summaries.reduce((acc, s) => acc + s.stats.total, 0), caption: "Study everything", onClick: () => {
                                                                if (selectedDeckId)
                                                                    startReview(selectedDeckId, "cram");
                                                                else if (summaries[0])
                                                                    startReview(summaries[0].set.id, "cram");
                                                            } }), _jsx(ModeTile, { icon: _jsx(TargetIcon, { size: 18 }), tone: "rose", title: "Weak Cards", value: needsAttention.hardCards, caption: "Focus on gaps", onClick: startWeakReview }), _jsx(ModeTile, { icon: _jsx(HeadphonesIcon, { size: 18 }), tone: "sage", title: "Audio Review", value: stats.dueToday, caption: "Listen & learn", onClick: () => {
                                                                if (selectedDeckId)
                                                                    startReview(selectedDeckId, "audio");
                                                                else if (summaries[0])
                                                                    startReview(summaries[0].set.id, "audio");
                                                            } })] })] }), _jsxs("div", { className: "fh-bottom-card", children: [_jsx("header", { className: "fh-bottom-head", children: _jsx("h3", { children: "Needs Attention" }) }), _jsxs("ul", { className: "fh-attention", children: [_jsxs("li", { className: "fh-attention-row tone-rose", onClick: startWeakReview, children: [_jsx("span", { className: "fh-attention-icon", children: _jsx(WarningIcon, { size: 14 }) }), _jsxs("span", { className: "fh-attention-text", children: [_jsx("strong", { children: needsAttention.hardCards }), " cards marked hard"] }), _jsx(ArrowRightIcon, { size: 12 })] }), _jsxs("li", { className: "fh-attention-row tone-amber", children: [_jsx("span", { className: "fh-attention-icon", children: _jsx(RestartIcon, { size: 14 }) }), _jsxs("span", { className: "fh-attention-text", children: [_jsx("strong", { children: needsAttention.staleDecks }), " decks haven't been reviewed in 5 days"] }), _jsx(ArrowRightIcon, { size: 12 })] }), _jsxs("li", { className: "fh-attention-row tone-sage", onClick: () => setView({ kind: "quizzes" }), children: [_jsx("span", { className: "fh-attention-icon", children: _jsx(CheckIcon, { size: 14 }) }), _jsxs("span", { className: "fh-attention-text", children: [_jsx("strong", { children: needsAttention.needsQuiz }), " decks ready for quiz generation"] }), _jsx(ArrowRightIcon, { size: 12 })] })] })] })] })] }) }), createOpen && (_jsx(CreateDeckModal, { onClose: () => setCreateOpen(false), onCreated: (deck) => {
                            setSelectedDeck(deck.id);
                            setCreateOpen(false);
                            setReload((n) => n + 1);
                        } })), importOpen && (_jsx(ImportCardsModal, { summaries: summaries, onClose: () => setImportOpen(false), onImported: () => {
                            setImportOpen(false);
                            setReload((n) => n + 1);
                        } })), generateOpen && (_jsx(GenerateFlashcardsModal, { onClose: () => setGenerateOpen(false), onGenerated: (setId) => {
                            setSelectedDeck(setId);
                            setGenerateOpen(false);
                            setReload((n) => n + 1);
                        } }))] }), selectedDeckId ? (_jsx(DeckDetailRail, { variant: "hub", isFavorite: favorites.has(selectedDeckId), onToggleFavorite: () => {
                    toggleFavorite(selectedDeckId);
                } })) : (_jsx(RightPanel, { flashcardsSwap: true }))] }));
};
const FhStat = ({ icon, tone, value, label, compact }) => (_jsxs("div", { className: `fh-stat tone-${tone}${compact ? " compact" : ""}`, children: [_jsx("span", { className: "fh-stat-icon", children: icon }), _jsxs("div", { className: "fh-stat-body", children: [_jsx("span", { className: "fh-stat-value", children: value.toLocaleString() }), _jsx("span", { className: "fh-stat-label", children: label })] })] }));
const ActionChip = ({ icon, label, tone, onClick }) => (_jsxs("button", { type: "button", className: `fh-chip tone-${tone}`, onClick: onClick, children: [_jsx("span", { className: "fh-chip-icon", children: icon }), _jsx("span", { children: label })] }));
const ModeTile = ({ icon, tone, title, value, caption, onClick }) => (_jsxs("button", { type: "button", className: `fh-mode tone-${tone}`, onClick: onClick, children: [_jsx("span", { className: "fh-mode-icon", children: icon }), _jsx("span", { className: "fh-mode-title", children: title }), _jsx("span", { className: "fh-mode-value", children: value.toLocaleString() }), _jsx("span", { className: "fh-mode-caption", children: caption })] }));
const DeckCard = ({ summary, classes, active, isFavorite, onOpen, onStudy, onToggleFavorite, }) => {
    const cls = summary.classId
        ? classes.find((c) => c.id === summary.classId) ?? null
        : null;
    const tone = cls ? toneFor(cls) : "sky";
    const subtitle = cls?.code ?? cls?.name ?? "Unfiled";
    const masteryPct = Math.round(summary.stats.mastery_pct * 100);
    const next = formatNextReview(summary.nextDueAt);
    return (_jsxs("article", { className: `fh-deck-card${active ? " active" : ""}`, onClick: onOpen, children: [_jsxs("header", { className: "fh-deck-head", children: [_jsx("span", { className: `fh-deck-icon tone-${tone}`, children: cls ? iconFor(cls, 20) : _jsx(FlashcardIcon, { size: 20 }) }), _jsx("button", { type: "button", className: `fh-deck-fav${isFavorite ? " active" : ""}`, "aria-label": isFavorite ? "Unfavorite deck" : "Favorite deck", onClick: (e) => {
                            e.stopPropagation();
                            onToggleFavorite();
                        }, children: _jsx(StarIcon, { size: 14 }) })] }), _jsx("h3", { className: "fh-deck-title", children: summary.set.title }), _jsx("p", { className: "fh-deck-subtitle", children: subtitle }), _jsxs("div", { className: "fh-deck-stats", children: [_jsx(DeckStatPill, { icon: _jsx(FlashcardIcon, { size: 12 }), label: "Cards", value: summary.stats.total }), _jsx(DeckStatPill, { icon: _jsx(CalendarIcon, { size: 12 }), label: "Due", value: summary.stats.due }), _jsx(DeckStatPill, { icon: _jsx(TargetIcon, { size: 12 }), label: "Mastery", value: `${masteryPct}%` })] }), _jsxs("p", { className: "fh-deck-next", children: ["Next review: ", next] }), _jsxs("div", { className: "fh-deck-actions", children: [_jsx("button", { type: "button", className: "fh-deck-button ghost", onClick: (e) => {
                            e.stopPropagation();
                            onOpen();
                        }, children: "Open Deck" }), _jsxs("button", { type: "button", className: "fh-deck-button study", onClick: (e) => {
                            e.stopPropagation();
                            onStudy();
                        }, children: [_jsx(BookmarkIcon, { size: 12 }), "Study"] })] })] }));
};
const DeckStatPill = ({ icon, label, value, }) => (_jsxs("div", { className: "fh-deck-pill", children: [_jsx("span", { className: "fh-deck-pill-icon", children: icon }), _jsx("span", { className: "fh-deck-pill-value", children: value }), _jsx("span", { className: "fh-deck-pill-label", children: label })] }));
function formatNextReview(iso) {
    if (!iso)
        return "Today";
    const d = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    const diff = Math.round((dt.getTime() - today.getTime()) / 86_400_000);
    if (diff <= 0)
        return "Today";
    if (diff === 1)
        return "Tomorrow";
    if (diff < 7)
        return d.toLocaleDateString(undefined, { weekday: "long" });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
const CreateDeckModal = ({ onClose, onCreated }) => {
    const [title, setTitle] = useState("");
    const [busy, setBusy] = useState(false);
    async function submit() {
        const t = title.trim();
        if (!t)
            return;
        setBusy(true);
        try {
            const deck = await upsertFlashcardSet({ title: t });
            onCreated(deck);
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs(ModalShell, { onClose: onClose, title: "Create deck", subtitle: "Empty decks live in the hub until you add cards.", children: [_jsxs("label", { className: "fh-modal-label", children: [_jsx("span", { children: "Deck name" }), _jsx("input", { autoFocus: true, className: "field", value: title, onChange: (e) => setTitle(e.target.value), placeholder: "e.g. Cell Structure", onKeyDown: (e) => {
                            if (e.key === "Enter")
                                void submit();
                        } })] }), _jsxs("div", { className: "fh-modal-actions", children: [_jsx("button", { type: "button", className: "btn-ghost", onClick: onClose, children: "Cancel" }), _jsx("button", { type: "button", className: "btn-primary", disabled: !title.trim() || busy, onClick: () => void submit(), children: busy ? "Creating…" : "Create deck" })] })] }));
};
const ImportCardsModal = ({ summaries, onClose, onImported }) => {
    const [setId, setSetId] = useState(summaries[0]?.set.id ?? "");
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    async function submit() {
        setError(null);
        let cards = [];
        const trimmed = text.trim();
        if (!trimmed) {
            setError("Paste at least one card.");
            return;
        }
        try {
            if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
                const parsed = JSON.parse(trimmed);
                const arr = Array.isArray(parsed) ? parsed : [parsed];
                cards = arr.map((row) => {
                    const r = row;
                    return {
                        front: String(r.front ?? r.q ?? ""),
                        back: String(r.back ?? r.a ?? ""),
                    };
                });
            }
            else {
                cards = trimmed
                    .split(/\r?\n/)
                    .map((line) => parseCsvRow(line))
                    .filter((row) => !!row);
            }
        }
        catch (e) {
            setError(`Couldn't parse: ${e.message}`);
            return;
        }
        cards = cards.filter((c) => c.front && c.back);
        if (cards.length === 0) {
            setError("No usable cards found. Use `front,back` per line, or JSON.");
            return;
        }
        let targetSetId = setId;
        if (!targetSetId) {
            const created = await upsertFlashcardSet({ title: "Imported deck" });
            targetSetId = created.id;
        }
        setBusy(true);
        try {
            for (const c of cards) {
                await upsertFlashcard({ set_id: targetSetId, front: c.front, back: c.back });
            }
            await recordXp("generateFlashcards", XP_RULES.generateFlashcards);
            onImported();
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs(ModalShell, { onClose: onClose, title: "Import cards", subtitle: "Paste CSV (front,back per line) or a JSON array of {front, back} objects.", children: [_jsxs("label", { className: "fh-modal-label", children: [_jsx("span", { children: "Target deck" }), _jsxs("select", { className: "field", value: setId, onChange: (e) => setSetId(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 Create a new deck" }), summaries.map((s) => (_jsx("option", { value: s.set.id, children: s.set.title }, s.set.id)))] })] }), _jsxs("label", { className: "fh-modal-label", children: [_jsx("span", { children: "Cards" }), _jsx("textarea", { className: "field fh-modal-textarea", rows: 8, value: text, onChange: (e) => setText(e.target.value), placeholder: 'mitochondria,Produces ATP\ncell membrane,Regulates what enters and exits the cell' })] }), error && _jsx("div", { className: "fh-modal-error", children: error }), _jsxs("div", { className: "fh-modal-actions", children: [_jsx("button", { type: "button", className: "btn-ghost", onClick: onClose, children: "Cancel" }), _jsx("button", { type: "button", className: "btn-primary", disabled: busy, onClick: () => void submit(), children: busy ? "Importing…" : "Import cards" })] })] }));
};
const GenerateFlashcardsModal = ({ onClose, onGenerated, }) => {
    const [notes, setNotes] = useState([]);
    const [noteId, setNoteId] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        void listNotes(null).then((ns) => {
            setNotes(ns);
            setNoteId(ns[0]?.id ?? "");
        });
    }, []);
    async function submit() {
        setError(null);
        const note = notes.find((n) => n.id === noteId);
        if (!note) {
            setError("Pick a note first.");
            return;
        }
        if (!note.content_markdown || note.content_markdown.length < 80) {
            setError("That note is too short to generate flashcards from.");
            return;
        }
        setBusy(true);
        try {
            const res = await ai.flashcards({
                note_id: note.id,
                title: note.title,
                content: note.content_markdown,
                count: 8,
            });
            const deck = await upsertFlashcardSet({
                title: note.title,
                note_id: note.id,
            });
            for (const c of res.cards) {
                await upsertFlashcard({ set_id: deck.id, front: c.front, back: c.back });
            }
            await recordXp("generateFlashcards", XP_RULES.generateFlashcards);
            onGenerated(deck.id);
        }
        catch {
            setError("Couldn't generate flashcards. Try again in a moment.");
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs(ModalShell, { onClose: onClose, title: "Generate flashcards", subtitle: "Pick a note \u2014 Note Goat will turn it into a fresh deck of cards.", children: [_jsxs("label", { className: "fh-modal-label", children: [_jsx("span", { children: "Source note" }), _jsx("select", { className: "field", value: noteId, onChange: (e) => setNoteId(e.target.value), children: notes.length === 0 ? (_jsx("option", { value: "", children: "\u2014 No notes yet" })) : (notes.map((n) => (_jsx("option", { value: n.id, children: n.title || "Untitled" }, n.id)))) })] }), error && _jsx("div", { className: "fh-modal-error", children: error }), _jsxs("div", { className: "fh-modal-actions", children: [_jsx("button", { type: "button", className: "btn-ghost", onClick: onClose, children: "Cancel" }), _jsx("button", { type: "button", className: "btn-primary", disabled: busy || !noteId, onClick: () => void submit(), children: busy ? "Generating…" : "Generate" })] })] }));
};
const ModalShell = ({ title, subtitle, children, onClose }) => {
    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape")
                onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);
    return (_jsx("div", { className: "fh-modal-backdrop", onClick: onClose, children: _jsxs("div", { className: "fh-modal", role: "dialog", "aria-modal": "true", "aria-label": title, onClick: (e) => e.stopPropagation(), children: [_jsxs("header", { className: "fh-modal-head", children: [_jsx("h2", { children: title }), subtitle && _jsx("p", { children: subtitle })] }), _jsx("div", { className: "fh-modal-body", children: children })] }) }));
};
/* ===== favorites (localStorage) ===== */
const FAV_KEY = "flashcards.favorites";
function loadFavorites() {
    try {
        const raw = typeof localStorage !== "undefined" ? localStorage.getItem(FAV_KEY) : null;
        if (!raw)
            return new Set();
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed))
            return new Set(parsed.filter((v) => typeof v === "string"));
        return new Set();
    }
    catch {
        return new Set();
    }
}
function saveFavorites(set) {
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set)));
        }
    }
    catch {
        /* drop */
    }
}
/** Naive CSV parser handling double-quoted fields with embedded commas. */
function parseCsvRow(raw) {
    const line = raw.trim();
    if (!line || line.startsWith("#"))
        return null;
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i += 1;
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (ch === "," && !inQuotes) {
            out.push(cur);
            cur = "";
        }
        else {
            cur += ch;
        }
    }
    out.push(cur);
    if (out.length < 2)
        return null;
    const front = out[0].trim();
    const back = out.slice(1).join(",").trim();
    if (!front || !back)
        return null;
    return { front, back };
}
//# sourceMappingURL=FlashcardsHub.js.map