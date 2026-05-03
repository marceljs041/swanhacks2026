/**
 * Third-column detail for flashcards: same grid cell as the global
 * `RightPanel`, swapped in by the Flashcards hub / review routes when a
 * deck is focused (`useApp.selectedDeckId`).
 *
 * Two variants:
 *  - `hub`     — adds a "Preview (3)" list of upcoming cards.
 *  - `review`  — replaces the preview with a "Current Card" snapshot
 *                tied to the card the user is on.
 */
import type { FC, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  deckStats,
  getNote,
  listFlashcards,
  listFlashcardSets,
  recordRewardPoints,
  recordXp,
  upsertQuiz,
  upsertQuizQuestion,
  upsertStudyTask,
} from "../db/repositories.js";
import { upsertEvent as upsertCalendarEvent } from "../db/calendar.js";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import { useApp, type ReviewMode } from "../store.js";
import type { FlashcardRow, FlashcardSetRow, NoteRow } from "@studynest/shared";
import { POINTS_RULES, ulid, XP_RULES } from "@studynest/shared";
import { ai } from "../lib/ai.js";
import { enqueueQuizGeneration } from "../lib/quizGenerationQueue.js";
import { withViewTransition } from "../lib/viewTransition.js";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookmarkIcon,
  CheckIcon,
  CloudCheckIcon,
  CloudOffIcon,
  FlashcardIcon,
  HeadphonesIcon,
  QuizIcon,
  SparklesIcon,
  StarIcon,
} from "./icons.js";
import { MoreMenu, type MoreMenuItem } from "./ui/MoreMenu.js";

interface Props {
  variant: "hub" | "review";
  /** When provided in `review` variant, drives the "Current Card" panel. */
  currentCard?: FlashcardRow | null;
  /** Whether the back of the current card is currently visible. */
  currentCardRevealed?: boolean;
  /** Called when the user toggles the favorite chip. */
  onToggleFavorite?: () => void;
  /** Whether the deck is currently a favorite. */
  isFavorite?: boolean;
  /** Trigger Read Aloud / Audio review on the current card or deck. */
  onAudio?: () => void;
  /** Open the Ask AI surface for the deck (review variant only). */
  onAskAI?: () => void;
}

export const DeckDetailRail: FC<Props> = ({
  variant,
  currentCard = null,
  currentCardRevealed = false,
  onToggleFavorite,
  isFavorite = false,
  onAudio,
  onAskAI,
}) => {
  const selectedDeckId = useApp((s) => s.selectedDeckId);
  const setSelectedDeck = useApp((s) => s.setSelectedDeck);
  const setView = useApp((s) => s.setView);
  const classes = useApp((s) => s.classes);
  const syncStatus = useApp((s) => s.syncStatus);

  const [deck, setDeck] = useState<FlashcardSetRow | null>(null);
  const [note, setNote] = useState<NoteRow | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof deckStats>>>({
    total: 0,
    due: 0,
    mastered: 0,
    weak: 0,
    mastery_pct: 0,
  });
  const [previewCards, setPreviewCards] = useState<FlashcardRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Load deck + stats whenever the active id changes. We also refresh
  // when `currentCard` changes (review mode) so the stat tiles tick down
  // as the user grades cards without having to reach back into the DB.
  useEffect(() => {
    let cancelled = false;
    if (!selectedDeckId) {
      setDeck(null);
      setNote(null);
      return () => undefined;
    }
    void (async () => {
      const sets = await listFlashcardSets(null);
      if (cancelled) return;
      const next = sets.find((s) => s.id === selectedDeckId) ?? null;
      setDeck(next);
      if (next?.note_id) {
        const n = await getNote(next.note_id);
        if (!cancelled) setNote(n);
      } else {
        setNote(null);
      }
      const s = await deckStats(selectedDeckId);
      if (!cancelled) setStats(s);
      const cards = await listFlashcards(selectedDeckId);
      if (!cancelled) setPreviewCards(cards.slice(0, 3));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDeckId, currentCard?.id, currentCardRevealed]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const cls = useMemo(() => {
    if (!note?.class_id) return null;
    return classes.find((c) => c.id === note.class_id) ?? null;
  }, [note, classes]);

  const panelChrome =
    "right-panel deck-detail-rail deck-rail right-panel--flashcards-swap";

  if (!selectedDeckId) {
    return (
      <aside className={`${panelChrome} empty`} aria-label="Deck details">
        <p className="deck-rail-empty-msg">
          Select a deck to see its mastery progress and AI tools.
        </p>
      </aside>
    );
  }

  if (!deck) {
    return (
      <aside className={`${panelChrome} empty`} aria-label="Deck details">
        <p className="deck-rail-empty-msg">Loading deck…</p>
      </aside>
    );
  }

  const tone = cls ? toneFor(cls) : "sky";
  const subtitle = cls?.code ?? cls?.name ?? "Unfiled";
  const description =
    note?.summary ||
    (note?.content_markdown
      ? truncate(stripMarkdown(note.content_markdown), 140)
      : "Tap any card to reveal the answer and grade your recall.");

  async function generateQuiz(): Promise<void> {
    if (!deck) return;
    setBusy("quiz");
    try {
      const result = await enqueueQuizGeneration(`Deck quiz: ${deck.title}`, async () => {
        const cards = await listFlashcards(deck.id);
        if (cards.length === 0) {
          throw new Error("Deck has no cards yet.");
        }
        const text = cards.map((c) => `Q: ${c.front}\nA: ${c.back}`).join("\n\n");
        const noteIdForAi = deck.note_id ?? deck.id;
        const res = await ai.quiz({
          note_id: noteIdForAi,
          title: deck.title,
          content: text,
          count: Math.min(8, Math.max(3, Math.floor(cards.length / 2))),
        });
        const quizRow = await upsertQuiz({
          title: `${deck.title} · quiz`,
          note_id: deck.note_id ?? null,
          description: `Quiz generated from your “${deck.title}” deck.`,
          source_type: "flashcards",
          source_ids_json: JSON.stringify([deck.id]),
          tags_json: JSON.stringify(["Deck", "Practice"]),
        });
        let position = 0;
        for (const q of res.questions) {
          await upsertQuizQuestion({
            quiz_id: quizRow.id,
            type: q.type,
            question: q.question,
            options_json:
              q.type === "multiple_choice" ? JSON.stringify(q.options) : null,
            correct_answer: String(q.answer),
            explanation: q.explanation ?? null,
            source_note_id: deck.note_id ?? null,
            position: position++,
          });
        }
        return { quiz: quizRow, questionCount: res.questions.length };
      });
      setToast(`Quiz ready — ${result.questionCount} questions.`);
      setView({ kind: "quiz", quizId: result.quiz.id, mode: "take" });
    } catch (e) {
      setToast((e as Error).message || "Couldn't generate a quiz from this deck.");
    } finally {
      setBusy(null);
    }
  }

  async function addToStudyPlan(): Promise<void> {
    if (!deck) return;
    setBusy("plan");
    try {
      const start = new Date();
      start.setHours(start.getHours() + 1, 0, 0, 0);
      const minutes = Math.max(10, Math.min(45, stats.due * 1));
      const end = new Date(start.getTime() + minutes * 60_000);
      // Persist into both stores: legacy `study_tasks` for older
      // surfaces (Home, RightPanel widgets that still read it) and
      // the richer `calendar_events` so the new Calendar shows it.
      await upsertStudyTask({
        id: ulid("tsk"),
        type: "flashcards",
        title: `Review: ${deck.title}`,
        scheduled_for: start.toISOString(),
        duration_minutes: minutes,
        note_id: deck.note_id ?? null,
      });
      await upsertCalendarEvent({
        title: `Review: ${deck.title}`,
        type: "flashcards",
        flashcard_set_id: deck.id,
        note_id: deck.note_id ?? null,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        source_type: "manual",
      });
      await recordXp("studyTaskComplete", 1);
      await recordRewardPoints("finishStudyTask", POINTS_RULES.finishStudyTask);
      setToast("Added a review block to your study plan.");
    } catch {
      setToast("Couldn't add to your study plan.");
    } finally {
      setBusy(null);
    }
  }

  function scheduleSession(): void {
    if (!deck) return;
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    setView({ kind: "calendar" });
    queueMicrotask(() => {
      useApp.getState().setCalendarComposer({
        mode: "create",
        prefill: {
          type: "flashcards",
          title: `${deck.title} review`,
          flashcard_set_id: deck.id,
          note_id: deck.note_id ?? null,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
        },
      });
    });
  }

  function startMode(mode: ReviewMode): void {
    if (!deck) return;
    setView({ kind: "flashcardSet", setId: deck.id, mode });
  }

  const moreItems: MoreMenuItem[] = [
    {
      label: "Open in deck list",
      icon: <FlashcardIcon size={14} />,
      onClick: () => setView({ kind: "flashcards" }),
    },
    {
      label: "Start review",
      icon: <ArrowRightIcon size={14} />,
      onClick: () => startMode("due"),
    },
    {
      label: "Cram all cards",
      icon: <SparklesIcon size={14} />,
      onClick: () => startMode("cram"),
    },
  ];

  return (
    <aside className={panelChrome} aria-label="Deck details">
      <header className="deck-rail-head">
        <button
          type="button"
          className="deck-rail-back"
          aria-label="Back to all decks"
          onClick={() => {
            if (variant === "review") {
              withViewTransition(() => setView({ kind: "flashcards" }));
            } else {
              withViewTransition(() => setSelectedDeck(null));
            }
          }}
        >
          <ArrowLeftIcon size={16} />
        </button>
        <span className="deck-rail-spacer" />
        <MoreMenu items={moreItems} label="Deck actions" />
      </header>

      <div className="deck-rail-title">
        <span className={`deck-rail-icon tone-${tone}`}>
          {cls ? iconFor(cls, 22) : <FlashcardIcon size={22} />}
        </span>
        <div className="deck-rail-title-text">
          <h2>{deck.title}</h2>
          <span className="deck-rail-subtitle">{subtitle}</span>
        </div>
      </div>

      <div className="deck-rail-chips">
        <span className="rail-chip rail-chip-sage">
          {note ? "Lecture" : "Deck"}
        </span>
        <span className="rail-chip rail-chip-rose">Exam 1</span>
        <button
          type="button"
          className={`rail-chip rail-chip-fav${isFavorite ? " active" : ""}`}
          onClick={() => onToggleFavorite?.()}
        >
          <StarIcon size={11} />
          <span>{isFavorite ? "Favorite" : "Favorite"}</span>
        </button>
      </div>

      <p className="deck-rail-description">{description}</p>

      <div className="deck-rail-stats">
        <RailStat label="Total Cards" value={stats.total} icon={<FlashcardIcon size={14} />} tone="amber" />
        <RailStat label="Due Today" value={stats.due} icon={<BookmarkIcon size={14} />} tone="peach" />
        <RailStat label="Mastered" value={stats.mastered} icon={<CheckIcon size={14} />} tone="sage" />
        <RailStat label="Weak Cards" value={stats.weak} icon={<SparklesIcon size={14} />} tone="rose" />
      </div>

      <section className="deck-rail-block">
        <header className="deck-rail-block-head">
          <span>Mastery Progress</span>
          <span className="deck-rail-mastery-pct">
            {Math.round(stats.mastery_pct * 100)}%
          </span>
        </header>
        <div className="deck-rail-mastery-bar">
          <span style={{ width: `${stats.mastery_pct * 100}%` }} />
        </div>
        <p className="deck-rail-mastery-sub">
          {stats.mastered} of {stats.total} cards mastered
        </p>
      </section>

      {variant === "hub" ? (
        <section className="deck-rail-block">
          <header className="deck-rail-block-head">
            <span>Preview ({previewCards.length})</span>
            <button
              type="button"
              className="deck-rail-link"
              onClick={() => startMode("cram")}
            >
              View all
            </button>
          </header>
          {previewCards.length === 0 ? (
            <p className="deck-rail-empty-msg">
              This deck is empty. Generate cards from a note to populate it.
            </p>
          ) : (
            <ul className="deck-rail-preview">
              {previewCards.slice(0, 2).map((c) => (
                <li key={c.id} className="deck-rail-preview-item">
                  <div className="qa-row">
                    <span className="qa-tag qa-q">Q</span>
                    <span className="qa-text">{c.front}</span>
                  </div>
                  <div className="qa-row">
                    <span className="qa-tag qa-a">A</span>
                    <span className="qa-text">{c.back}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="deck-rail-block">
          <header className="deck-rail-block-head">
            <span>Current Card</span>
          </header>
          {currentCard ? (
            <div className="deck-rail-current">
              <div className="qa-row">
                <span className="qa-tag qa-q">Q</span>
                <span className="qa-text">{currentCard.front}</span>
              </div>
              {currentCardRevealed ? (
                <div className="deck-rail-answer-pill">
                  <span>{currentCard.back}</span>
                  <CheckIcon size={14} />
                </div>
              ) : (
                <p className="deck-rail-empty-msg">Reveal the card to see the answer here.</p>
              )}
            </div>
          ) : (
            <p className="deck-rail-empty-msg">Pick a card to start reviewing.</p>
          )}
        </section>
      )}

      <section className="deck-rail-block">
        <header className="deck-rail-block-head">
          <span>{variant === "hub" ? "AI Tools" : "Review Shortcuts"}</span>
        </header>
        <div className="deck-rail-tools">
          {variant === "hub" && (
            <RailToolButton
              icon={<SparklesIcon size={14} />}
              label="Generate Flashcards"
              onClick={() => setView({ kind: "notes" })}
              busy={false}
            />
          )}
          <RailToolButton
            icon={<HeadphonesIcon size={14} />}
            label="Review by Audio"
            onClick={() => {
              if (variant === "review") {
                onAudio?.();
              } else {
                startMode("audio");
              }
            }}
          />
          <RailToolButton
            icon={<QuizIcon size={14} />}
            label="Create Quiz"
            onClick={() => void generateQuiz()}
            busy={busy === "quiz"}
          />
          <RailToolButton
            icon={<BookmarkIcon size={14} />}
            label="Add to Study Plan"
            onClick={() => void addToStudyPlan()}
            busy={busy === "plan"}
          />
          <RailToolButton
            icon={<BookmarkIcon size={14} />}
            label="Schedule review"
            onClick={scheduleSession}
          />
          {variant === "review" && (
            <RailToolButton
              icon={<SparklesIcon size={14} />}
              label="Ask AI"
              onClick={() => onAskAI?.()}
            />
          )}
        </div>
      </section>

      <footer className={`deck-rail-sync sync-${syncStatus}`}>
        <span className="deck-rail-sync-icon">
          {syncStatus === "offline" ? <CloudOffIcon size={14} /> : <CloudCheckIcon size={14} />}
        </span>
        <div className="deck-rail-sync-text">
          <span className="lead">
            {syncStatus === "offline" ? "Working offline" : "All changes synced"}
          </span>
          <span className="sub">
            {syncStatus === "offline"
              ? "We'll catch up when you're online."
              : "Last synced just now"}
          </span>
        </div>
      </footer>

      {toast && <div className="deck-rail-toast">{toast}</div>}
    </aside>
  );
};

interface RailStatProps {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "amber" | "peach" | "sage" | "rose";
}

const RailStat: FC<RailStatProps> = ({ label, value, icon, tone }) => (
  <div className={`rail-stat tone-${tone}`}>
    <span className="rail-stat-icon">{icon}</span>
    <span className="rail-stat-num">{value}</span>
    <span className="rail-stat-label">{label}</span>
  </div>
);

interface RailToolButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  busy?: boolean;
}

const RailToolButton: FC<RailToolButtonProps> = ({ icon, label, onClick, busy }) => (
  <button
    type="button"
    className="deck-rail-tool"
    onClick={onClick}
    disabled={busy}
  >
    <span className="deck-rail-tool-icon">{icon}</span>
    <span className="deck-rail-tool-label">{busy ? "Working…" : label}</span>
    <ArrowRightIcon size={12} />
  </button>
);

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 32 ? cut.slice(0, lastSpace) : cut) + "…";
}
