/**
 * Per-deck flashcard review. Drives the SM-2-ish scheduler in
 * `schedule()`, exposes the four-button Again / Hard / Good / Easy
 * grading bar, and tracks per-session XP / correct / streak / time via
 * `lib/flashcardSession`. The right rail (`DeckDetailRail`) is shared
 * with the hub so both screens stay visually consistent.
 */
import type { FC, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ReviewMode,
  getNote,
  listFlashcardSets,
  listFlashcardsByMode,
  markCardForReview,
  recordRewardPoints,
  recordXp,
  relatedDecksForCard,
  upsertFlashcard,
  upsertNote,
} from "../db/repositories.js";
import { useApp, type View } from "../store.js";
import type {
  Difficulty,
  FlashcardRow,
  FlashcardSetRow,
  NoteRow,
} from "@studynest/shared";
import { POINTS_RULES, XP_RULES, nowIso } from "@studynest/shared";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import {
  type FlashcardSessionGoals,
  type FlashcardSessionState,
  formatSessionTime,
  loadGoals,
  loadSession,
  resetSession,
  saveSession,
} from "../lib/flashcardSession.js";
import { BRAND_FLASHCARD_HERO_URL } from "../lib/brand.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { DeckDetailRail } from "./DeckDetailRail.js";
import { HeroSearch } from "./HeroSearch.js";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookmarkIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  FlameIcon,
  FlashcardIcon,
  HeadphonesIcon,
  PencilIcon,
  PlayIcon,
  RestartIcon,
  SparklesIcon,
  StarIcon,
  TargetIcon,
  TrophyIcon,
} from "./icons.js";

interface Props {
  setId: string;
  /** Review mode passed via the route (`flashcardSet` view kind). */
  mode?: ReviewMode;
}

/** Quartile rating fed into the scheduler. `again` resets the interval. */
type QuartileRating = "again" | "hard" | "good" | "easy";

const RATING_TO_DIFFICULTY: Record<QuartileRating, Difficulty> = {
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
function schedule(
  card: FlashcardRow,
  rating: QuartileRating,
): Pick<FlashcardRow, "due_at" | "ease" | "interval_days" | "review_count"> {
  let ease = card.ease;
  let interval = card.interval_days;
  let reviewCount = card.review_count + 1;
  if (rating === "again") {
    ease = Math.max(1.3, card.ease - 0.2);
    interval = 0;
  } else if (rating === "hard") {
    ease = Math.max(1.3, card.ease - 0.15);
    interval = Math.max(1, Math.round((card.interval_days || 1) * 1.2));
  } else if (rating === "good") {
    ease = card.ease;
    interval =
      card.review_count === 0
        ? 1
        : Math.max(1, Math.round((card.interval_days || 1) * card.ease));
  } else {
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

const RATING_XP: Record<QuartileRating, number> = {
  again: 0,
  hard: 1,
  good: 3,
  easy: 5,
};

/** Matches Home / Notes / Classes: `HeroSearch` + brand hero art in `.hero`. */
const FlashcardsReviewHero: FC<{ children: ReactNode }> = ({ children }) => (
  <section className="hero">
    <div className="hero-main">
      <HeroSearch />
      {children}
    </div>
    <div className="hero-illustration" aria-hidden>
      <img
        className="hero-illustration-img"
        src={BRAND_FLASHCARD_HERO_URL}
        alt=""
        decoding="async"
      />
    </div>
  </section>
);

export const Flashcards: FC<Props> = ({ setId, mode = "due" }) => {
  const setView = useApp((s) => s.setView);
  const setSelectedDeck = useApp((s) => s.setSelectedDeck);
  const classes = useApp((s) => s.classes);
  const currentMode = useResolvedMode(mode);

  const [deck, setDeck] = useState<FlashcardSetRow | null>(null);
  const [note, setNote] = useState<NoteRow | null>(null);
  const [cards, setCards] = useState<FlashcardRow[]>([]);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [session, setSession] = useState<FlashcardSessionState>(() =>
    loadSession(setId),
  );
  const [goals, setGoals] = useState<FlashcardSessionGoals>(() =>
    loadGoals(setId),
  );
  const [related, setRelated] = useState<
    Array<{ id: string; title: string; cardCount: number }>
  >([]);
  const [readingAloud, setReadingAloud] = useState(false);

  const audioWantedRef = useRef<boolean>(currentMode === "audio");

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
      if (cancelled) return;
      const next = sets.find((s) => s.id === setId) ?? null;
      setDeck(next);
      if (next?.note_id) {
        const n = await getNote(next.note_id);
        if (!cancelled) setNote(n);
      } else {
        setNote(null);
      }
      const queue = await listFlashcardsByMode(setId, currentMode);
      if (cancelled) return;
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
    if (!card) return;
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
      if (cancelled) return;
      setRelated(
        summaries.map((s) => ({
          id: s.set.id,
          title: s.set.title,
          cardCount: s.stats.total,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [card?.id, card]);

  const cls = useMemo(() => {
    if (!note?.class_id) return null;
    return classes.find((c) => c.id === note.class_id) ?? null;
  }, [note, classes]);

  const totalForProgress = Math.max(originalTotal, 1);
  const progressPct = Math.min(
    100,
    Math.round((session.reviewed / totalForProgress) * 100),
  );

  function toggleFlip(): void {
    setFlipped((f) => !f);
  }

  function speak(text: string): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1;
      utter.pitch = 1;
      utter.onstart = () => setReadingAloud(true);
      utter.onend = () => setReadingAloud(false);
      utter.onerror = () => setReadingAloud(false);
      window.speechSynthesis.speak(utter);
    } catch {
      setReadingAloud(false);
    }
  }

  function readAloud(): void {
    if (!card) return;
    if (readingAloud && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setReadingAloud(false);
      return;
    }
    speak(flipped ? card.back : card.front);
  }

  async function handleAddNote(): Promise<void> {
    if (!card) return;
    const titleSeed = card.front.replace(/\s+/g, " ").trim();
    const title = titleSeed.length > 60 ? titleSeed.slice(0, 60) + "…" : titleSeed;
    const created = await upsertNote({
      title: title || "Note from flashcard",
      content_markdown: `> ${card.front}\n\n${card.back}\n`,
      class_id: cls?.id ?? null,
    });
    setView({ kind: "note", noteId: created.id });
  }

  async function handleMarkForReview(): Promise<void> {
    if (!card) return;
    await markCardForReview(card.id);
    // refresh local card state too so the difficulty pill re-renders
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, difficulty: "hard" } : c)),
    );
  }

  async function rate(rating: QuartileRating): Promise<void> {
    if (!card) return;
    const isMastered = card.interval_days >= 21;
    const next = schedule(card, rating);
    const updated: FlashcardRow = {
      ...card,
      ...next,
      difficulty: RATING_TO_DIFFICULTY[rating],
      last_reviewed_at: nowIso(),
    };
    await upsertFlashcard(updated);

    const xpEarned = RATING_XP[rating];
    if (xpEarned > 0) await recordXp("flashcardReview", xpEarned);

    const nextSession: FlashcardSessionState = {
      ...session,
      reviewed: session.reviewed + 1,
      correct:
        session.correct + (rating === "good" || rating === "easy" ? 1 : 0),
      streak: rating === "again" ? 0 : session.streak + 1,
      xp: session.xp + xpEarned,
      weakResolved:
        card.difficulty === "hard" && rating !== "again" && rating !== "hard"
          ? Array.from(new Set([...session.weakResolved, card.id]))
          : session.weakResolved,
    };
    setSession(nextSession);
    saveSession(setId, nextSession);

    if (
      nextSession.reviewed > 0 &&
      nextSession.reviewed % 10 === 0
    ) {
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

  function restart(): void {
    const fresh = resetSession(setId);
    setSession(fresh);
    setIdx(0);
    setFlipped(false);
  }

  if (!deck) {
    return (
      <>
        <main className="main">
          <div className="main-inner">
            <div className="flashcards-center">
              <FlashcardsReviewHero>
                <div className="hero-greeting">
                  <p>Loading deck…</p>
                </div>
              </FlashcardsReviewHero>
            </div>
          </div>
        </main>
        <DeckDetailRail
          variant="review"
          currentCard={null}
          currentCardRevealed={false}
          onAudio={() => {
            audioWantedRef.current = true;
          }}
        />
      </>
    );
  }

  const tone = cls ? toneFor(cls) : "sky";
  const subtitle = cls?.code ?? cls?.name ?? "Unfiled";

  if (!card) {
    const emptyProgressPct = Math.min(
      100,
      Math.round((session.reviewed / Math.max(originalTotal, 1)) * 100),
    );
    return (
      <>
        <main className="main">
          <div className="main-inner">
            <div className="flashcards-center">
              <FlashcardsReviewHero>
                <header className="fr-header">
                  <button
                    type="button"
                    className="fr-back"
                    aria-label="Back to decks"
                    onClick={() =>
                      withViewTransition(() => setView({ kind: "flashcards" }))
                    }
                  >
                    <ArrowLeftIcon size={14} />
                  </button>
                  <span className={`fr-deck-icon tone-${tone}`}>
                    {cls ? iconFor(cls, 18) : <FlashcardIcon size={18} />}
                  </span>
                  <div className="fr-header-text">
                    <h1>{deck.title}</h1>
                    <span>{subtitle}</span>
                  </div>
                  <div className="fr-progress">
                    <span className="fr-progress-label">
                      {originalTotal === 0
                        ? "No cards in queue"
                        : `Card ${Math.min(idx + 1, originalTotal)} of ${originalTotal}`}
                    </span>
                    <div className="fr-progress-bar" aria-hidden>
                      <span style={{ width: `${emptyProgressPct}%` }} />
                    </div>
                    <span className="fr-progress-pct">{emptyProgressPct}%</span>
                  </div>
                  <div className="fr-header-chips">
                    <span className="rail-chip rail-chip-sage">Lecture</span>
                    <span className="rail-chip rail-chip-rose">Exam 1</span>
                    <span className="rail-chip rail-chip-amber">
                      <PlayIcon size={10} />
                      <span>Study Session</span>
                    </span>
                  </div>
                </header>
              </FlashcardsReviewHero>

              <div className="fr-empty">
                <FlashcardIcon size={36} />
                <h2>All caught up!</h2>
                <p>
                  {currentMode === "weak"
                    ? "No weak cards left in this deck — strong work."
                    : currentMode === "due"
                    ? "No cards due in this deck right now."
                    : "This deck is empty. Add or generate cards to start studying."}
                </p>
                <div className="fr-empty-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      withViewTransition(() => setView({ kind: "flashcards" }))
                    }
                  >
                    Back to decks
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() =>
                      withViewTransition(() =>
                        setView({ kind: "flashcardSet", setId, mode: "cram" }),
                      )
                    }
                  >
                    Cram everything
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
        <DeckDetailRail
          variant="review"
          currentCard={null}
          currentCardRevealed={false}
          onAudio={() => {
            audioWantedRef.current = true;
          }}
        />
      </>
    );
  }

  const tag = pickTag(card.front);

  return (
    <>
      <main className="main">
        <div className="main-inner">
          <div className="flashcards-center">
          <FlashcardsReviewHero>
          <header className="fr-header">
            <button
              type="button"
              className="fr-back"
              aria-label="Back to decks"
              onClick={() =>
                withViewTransition(() => setView({ kind: "flashcards" }))
              }
            >
              <ArrowLeftIcon size={14} />
            </button>
            <span className={`fr-deck-icon tone-${tone}`}>
              {cls ? iconFor(cls, 18) : <FlashcardIcon size={18} />}
            </span>
            <div className="fr-header-text">
              <h1>{deck.title}</h1>
              <span>{subtitle}</span>
            </div>
            <div className="fr-progress">
              <span className="fr-progress-label">
                Card {Math.min(idx + 1, originalTotal)} of {originalTotal}
              </span>
              <div className="fr-progress-bar" aria-hidden>
                <span style={{ width: `${progressPct}%` }} />
              </div>
              <span className="fr-progress-pct">{progressPct}%</span>
            </div>
            <div className="fr-header-chips">
              <span className="rail-chip rail-chip-sage">Lecture</span>
              <span className="rail-chip rail-chip-rose">Exam 1</span>
              <span className="rail-chip rail-chip-amber">
                <PlayIcon size={10} />
                <span>Study Session</span>
              </span>
            </div>
          </header>
          </FlashcardsReviewHero>

          <section className="fr-card-wrap">
            <div
              className={`fr-card${flipped ? " is-flipped" : ""}`}
              role="button"
              tabIndex={0}
              onClick={toggleFlip}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  toggleFlip();
                }
              }}
              aria-label={flipped ? "Hide answer" : "Show answer"}
            >
              <span className={`fr-card-tag${flipped ? " answer" : ""}`}>
                {flipped ? "Answer" : "Question"}
              </span>
              <div className="fr-card-text">
                {flipped ? card.back : card.front}
              </div>
              {!flipped && (
                <div className="fr-card-hint">
                  Tap or click to reveal the answer ✨
                </div>
              )}
              <div className="fr-card-meta">
                <span>From: {deck.title}</span>
                <span>Tag: {tag}</span>
                <span>Difficulty: {labelDifficulty(card.difficulty)}</span>
              </div>
            </div>

            {!flipped && (
              <button type="button" className="fr-show-answer" onClick={toggleFlip}>
                <PlayIcon size={14} />
                <span>Show Answer</span>
              </button>
            )}

            <div className="fr-quick-actions">
              <button
                type="button"
                className={`fr-quick${readingAloud ? " active" : ""}`}
                onClick={readAloud}
              >
                <HeadphonesIcon size={14} />
                <span>{readingAloud ? "Stop" : "Read Aloud"}</span>
              </button>
              <button type="button" className="fr-quick" onClick={() => void handleAddNote()}>
                <PencilIcon size={14} />
                <span>Add Note</span>
              </button>
              <button type="button" className="fr-quick" onClick={() => void handleMarkForReview()}>
                <BookmarkIcon size={14} />
                <span>Mark for Review</span>
              </button>
            </div>
          </section>

          {flipped && (
            <section className="fr-grade-bar" aria-label="Grade card">
              <p className="fr-grade-prompt">How well did you know it?</p>
              <div className="fr-grade-buttons">
                <GradeButton tone="rose" rating="again" onClick={() => void rate("again")} />
                <GradeButton tone="amber" rating="hard" onClick={() => void rate("hard")} />
                <GradeButton tone="sage" rating="good" onClick={() => void rate("good")} />
                <GradeButton tone="sky" rating="easy" onClick={() => void rate("easy")} />
              </div>
            </section>
          )}

          <section className="fr-session" aria-label="Session stats">
            <SessionPill
              icon={<TrophyIcon size={14} />}
              tone="amber"
              label="Session XP"
              value={session.xp}
            />
            <SessionPill
              icon={<CheckIcon size={14} />}
              tone="sage"
              label="Correct"
              value={session.correct}
            />
            <SessionPill
              icon={<FlameIcon size={14} />}
              tone="peach"
              label="Streak"
              value={session.streak}
            />
            <SessionPill
              icon={<ClockIcon size={14} />}
              tone="lilac"
              label="Time"
              value={formatSessionTime(session)}
            />
          </section>

          <section className="fr-bottom">
            <div className="fr-bottom-card">
              <header className="fr-bottom-head">
                <span className="fr-bottom-title">
                  <FlagIcon size={14} />
                  Session Goals
                </span>
                <button type="button" className="fh-modal-button-link" onClick={restart}>
                  <RestartIcon size={12} />
                  <span>Restart</span>
                </button>
              </header>
              <ul className="fr-goal-list">
                <GoalRow
                  label={`Review ${goals.reviewTarget} cards`}
                  current={session.reviewed}
                  target={goals.reviewTarget}
                />
                <GoalRow
                  label="Keep streak alive"
                  current={session.streak}
                  target={goals.keepStreak ? Math.max(5, goals.reviewTarget / 4) : 5}
                  small
                />
                <GoalRow
                  label={`Master ${goals.masterWeak} weak cards`}
                  current={session.weakResolved.length}
                  target={Math.max(1, goals.masterWeak)}
                />
              </ul>
            </div>

            <div className="fr-bottom-card">
              <header className="fr-bottom-head">
                <span className="fr-bottom-title">
                  <SparklesIcon size={14} />
                  Related Review
                </span>
              </header>
              {related.length === 0 ? (
                <p className="deck-rail-empty-msg">No closely related decks yet.</p>
              ) : (
                <div className="fr-related-grid">
                  {related.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="fr-related-tile"
                      onClick={() => {
                        setSelectedDeck(r.id);
                        setView({ kind: "flashcardSet", setId: r.id, mode: currentMode });
                      }}
                    >
                      <span className="fr-related-title">{r.title}</span>
                      <span className="fr-related-meta">{r.cardCount} cards</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="fh-modal-button-link"
                onClick={() => setView({ kind: "flashcards" })}
              >
                View all related topics
                <ArrowRightIcon size={11} />
              </button>
            </div>
          </section>
        </div>

        </div>
      </main>
      <DeckDetailRail
        variant="review"
        currentCard={card}
        currentCardRevealed={flipped}
        onAudio={() => {
          audioWantedRef.current = !audioWantedRef.current;
          if (audioWantedRef.current && card) speak(flipped ? card.back : card.front);
          else if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
        }}
        onAskAI={() => {
          if (cls) setView({ kind: "classAsk", classId: cls.id } as View);
          else if (note) setView({ kind: "note", noteId: note.id });
        }}
      />
    </>
  );
};

/* ===== helpers ===== */

function useResolvedMode(mode: ReviewMode): ReviewMode {
  // Memoize so the cards effect doesn't re-fire on unrelated re-renders.
  return useMemo(() => mode, [mode]);
}

function labelDifficulty(d: Difficulty): string {
  if (d === "new") return "New";
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function pickTag(front: string): string {
  const tokens = front
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3);
  if (tokens.length === 0) return "Concepts";
  const choice = tokens[0]!;
  return choice.charAt(0).toUpperCase() + choice.slice(1).toLowerCase();
}

interface GradeButtonProps {
  rating: QuartileRating;
  tone: "rose" | "amber" | "sage" | "sky";
  onClick: () => void;
}

const GRADE_LABELS: Record<QuartileRating, { title: string; emoji: ReactNode }> = {
  again: { title: "Again", emoji: <RestartIcon size={14} /> },
  hard: { title: "Hard", emoji: <TargetIcon size={14} /> },
  good: { title: "Good", emoji: <CheckIcon size={14} /> },
  easy: { title: "Easy", emoji: <StarIcon size={14} /> },
};

const GradeButton: FC<GradeButtonProps> = ({ rating, tone, onClick }) => {
  const meta = GRADE_LABELS[rating];
  return (
    <button type="button" className={`fr-grade fr-grade-${tone}`} onClick={onClick}>
      <span className="fr-grade-icon">{meta.emoji}</span>
      <span className="fr-grade-title">{meta.title}</span>
    </button>
  );
};

interface SessionPillProps {
  icon: ReactNode;
  tone: "amber" | "sage" | "peach" | "lilac";
  label: string;
  value: string | number;
}

const SessionPill: FC<SessionPillProps> = ({ icon, tone, label, value }) => (
  <div className={`fr-session-pill tone-${tone}`}>
    <span className="fr-session-pill-icon">{icon}</span>
    <div className="fr-session-pill-body">
      <span className="fr-session-pill-label">{label}</span>
      <span className="fr-session-pill-value">{value}</span>
    </div>
  </div>
);

interface GoalRowProps {
  label: string;
  current: number;
  target: number;
  small?: boolean;
}

const GoalRow: FC<GoalRowProps> = ({ label, current, target, small }) => {
  const pct = Math.min(100, Math.round((current / Math.max(1, target)) * 100));
  const done = current >= target;
  return (
    <li className={`fr-goal-row${done ? " done" : ""}${small ? " small" : ""}`}>
      <span className={`fr-goal-check${done ? " done" : ""}`}>
        {done ? <CheckIcon size={11} /> : null}
      </span>
      <span className="fr-goal-label">{label}</span>
      <span className="fr-goal-progress">
        {current} / {target}
      </span>
    </li>
  );
};
