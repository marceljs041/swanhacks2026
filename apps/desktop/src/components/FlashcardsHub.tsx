/**
 * Flashcards hub. Owns deck listing, daily review banner, action chips,
 * deck grid, Review Modes + Needs Attention. When a deck is selected,
 * the third column shows `DeckDetailRail`; otherwise it swaps to the
 * global `RightPanel` (same pattern as Classes + `ClassDetailPanel`).
 */
import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type DeckSummary,
  type FlashcardsHubStats,
  decksMissingQuiz,
  decksNotReviewedSince,
  flashcardsHubStats,
  listDeckSummaries,
  listNotes,
  recordXp,
  totalWeakCards,
  upsertFlashcard,
  upsertFlashcardSet,
} from "../db/repositories.js";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import { useApp, type ReviewMode } from "../store.js";
import type { ClassRow, FlashcardSetRow, NoteRow } from "@studynest/shared";
import { ulid, XP_RULES } from "@studynest/shared";
import { ai } from "../lib/ai.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { DeckDetailRail } from "./DeckDetailRail.js";
import { HeroSearch } from "./HeroSearch.js";
import { RightPanel } from "./RightPanel.js";
import { BRAND_FLASHCARD_HERO_URL } from "../lib/brand.js";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckIcon,
  FlameIcon,
  FlashcardIcon,
  HeadphonesIcon,
  ImportIcon,
  LightningIcon,
  PlayIcon,
  PlusIcon,
  RestartIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
  TargetIcon,
  WarningIcon,
} from "./icons.js";

const ZERO_HUB_STATS: FlashcardsHubStats = {
  dueToday: 0,
  totalDecks: 0,
  mastered: 0,
  studyStreakDays: 0,
};

export const FlashcardsHub: FC = () => {
  const setView = useApp((s) => s.setView);
  const setSelectedDeck = useApp((s) => s.setSelectedDeck);
  const selectedDeckId = useApp((s) => s.selectedDeckId);
  const setFlashcardsDetailPanelOpen = useApp((s) => s.setFlashcardsDetailPanelOpen);
  const classes = useApp((s) => s.classes);
  const [stats, setStats] = useState<FlashcardsHubStats>(ZERO_HUB_STATS);
  const [summaries, setSummaries] = useState<DeckSummary[]>([]);
  const [needsAttention, setNeedsAttention] = useState<NeedsAttention>({
    hardCards: 0,
    staleDecks: 0,
    needsQuiz: 0,
  });
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [reload, setReload] = useState(0);

  const selectDeckPreview = useCallback(
    (id: string | null) => {
      withViewTransition(() => setSelectedDeck(id));
    },
    [setSelectedDeck],
  );

  useEffect(() => {
    void (async () => {
      const [hub, list, weak, stale, miss] = await Promise.all([
        flashcardsHubStats(),
        listDeckSummaries(),
        totalWeakCards(),
        decksNotReviewedSince(
          new Date(Date.now() - 5 * 86_400_000).toISOString(),
        ),
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
    if (!q) return summaries;
    return summaries.filter(
      (s) =>
        s.set.title.toLowerCase().includes(q) ||
        s.note?.title?.toLowerCase().includes(q) ||
        false,
    );
  }, [search, summaries]);

  function startReview(setId: string, mode: ReviewMode = "due"): void {
    withViewTransition(() => {
      setSelectedDeck(setId);
      setView({ kind: "flashcardSet", setId, mode });
    });
  }

  function startWeakReview(): void {
    const target = summaries.find((s) => s.stats.weak > 0) ?? summaries[0];
    if (!target) return;
    startReview(target.set.id, "weak");
  }

  function startDailyReview(): void {
    const target =
      summaries.find((s) => s.stats.due > 0) ?? summaries[0] ?? null;
    if (!target) return;
    startReview(target.set.id, "due");
  }

  function toggleFavorite(setId: string): void {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      saveFavorites(next);
      return next;
    });
  }

  return (
    <>
      <main className="main">
        <div className="main-inner">
          <div className="flashcards-center">
          <section className="hero">
            <div className="hero-main">
              <HeroSearch />
              <div className="hero-greeting">
                <h1 className="hero-headline">Flashcards</h1>
                <p>Review smarter with spaced repetition, decks, and daily goals.</p>
              </div>
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

          <section className="fh-stat-grid">
            <FhStat
              icon={<CalendarIcon size={18} />}
              tone="peach"
              value={stats.dueToday}
              label="Due Today"
            />
            <FhStat
              icon={<FlashcardIcon size={18} />}
              tone="sage"
              value={stats.totalDecks}
              label="Total Decks"
            />
            <FhStat
              icon={<StarIcon size={18} />}
              tone="lilac"
              value={stats.mastered}
              label="Mastered"
            />
            <FhStat
              icon={<FlameIcon size={18} />}
              tone="amber"
              value={stats.studyStreakDays}
              label={stats.studyStreakDays === 1 ? "day Study Streak" : "days Study Streak"}
              compact
            />
          </section>

          <section className="fh-daily" role="region" aria-label="Daily review">
            <span className="fh-daily-icon"><CalendarIcon size={22} /></span>
            <div className="fh-daily-text">
              <span className="fh-daily-title">Daily Review</span>
              <span className="fh-daily-sub">
                <strong>{stats.dueToday} cards due today</strong>
                <span className="fh-daily-divider" aria-hidden>·</span>
                <span className="fh-daily-time">
                  ~{Math.max(1, Math.round(stats.dueToday * 1))} min
                </span>
                <span className="fh-daily-divider" aria-hidden>·</span>
                <span>Keep your streak alive</span>
              </span>
            </div>
            <button
              type="button"
              className="fh-daily-cta"
              onClick={startDailyReview}
              disabled={stats.dueToday === 0 || summaries.length === 0}
            >
              <PlayIcon size={14} />
              <span>Start Review</span>
            </button>
          </section>

          <div className="search-wrap fh-deck-filter">
            <label className="search">
              <span className="search-icon"><SearchIcon size={16} /></span>
              <input
                type="search"
                placeholder="Filter decks by title or note…"
                aria-label="Filter decks"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>

          <section className="fh-action-chips" aria-label="Deck actions">
            <ActionChip
              icon={<PlusIcon size={16} />}
              label="Create Deck"
              tone="peach"
              onClick={() => setCreateOpen(true)}
            />
            <ActionChip
              icon={<SparklesIcon size={16} />}
              label="Generate Flashcards"
              tone="sage"
              onClick={() => setGenerateOpen(true)}
            />
            <ActionChip
              icon={<ImportIcon size={16} />}
              label="Import Cards"
              tone="sky"
              onClick={() => setImportOpen(true)}
            />
            <ActionChip
              icon={<TargetIcon size={16} />}
              label="Review Weak Cards"
              tone="rose"
              onClick={startWeakReview}
            />
          </section>

          <section className="fh-deck-grid" aria-label="Decks">
            {filteredSummaries.length === 0 ? (
              <div className="fh-empty">
                <FlashcardIcon size={28} />
                <p>
                  {summaries.length === 0
                    ? "You don't have any decks yet — generate one from a note or import from CSV."
                    : "No decks match that search."}
                </p>
              </div>
            ) : (
              filteredSummaries.map((s) => (
                <DeckCard
                  key={s.set.id}
                  summary={s}
                  classes={classes}
                  active={selectedDeckId === s.set.id}
                  isFavorite={favorites.has(s.set.id)}
                  onOpen={() => {
                    if (selectedDeckId === s.set.id) selectDeckPreview(null);
                    else selectDeckPreview(s.set.id);
                  }}
                  onStudy={() => startReview(s.set.id, "due")}
                  onToggleFavorite={() => toggleFavorite(s.set.id)}
                />
              ))
            )}
          </section>

          <section className="fh-bottom">
            <div className="fh-bottom-card">
              <header className="fh-bottom-head">
                <h3>Review Modes</h3>
              </header>
              <div className="fh-mode-grid">
                <ModeTile
                  icon={<CalendarIcon size={18} />}
                  tone="peach"
                  title="Due Cards"
                  value={stats.dueToday}
                  caption="Ready to review"
                  onClick={() => {
                    if (selectedDeckId) startReview(selectedDeckId, "due");
                    else startDailyReview();
                  }}
                />
                <ModeTile
                  icon={<LightningIcon size={18} />}
                  tone="lilac"
                  title="Cram Mode"
                  value={summaries.reduce((acc, s) => acc + s.stats.total, 0)}
                  caption="Study everything"
                  onClick={() => {
                    if (selectedDeckId) startReview(selectedDeckId, "cram");
                    else if (summaries[0]) startReview(summaries[0].set.id, "cram");
                  }}
                />
                <ModeTile
                  icon={<TargetIcon size={18} />}
                  tone="rose"
                  title="Weak Cards"
                  value={needsAttention.hardCards}
                  caption="Focus on gaps"
                  onClick={startWeakReview}
                />
                <ModeTile
                  icon={<HeadphonesIcon size={18} />}
                  tone="sage"
                  title="Audio Review"
                  value={stats.dueToday}
                  caption="Listen & learn"
                  onClick={() => {
                    if (selectedDeckId) startReview(selectedDeckId, "audio");
                    else if (summaries[0]) startReview(summaries[0].set.id, "audio");
                  }}
                />
              </div>
            </div>

            <div className="fh-bottom-card">
              <header className="fh-bottom-head">
                <h3>Needs Attention</h3>
              </header>
              <ul className="fh-attention">
                <li
                  className="fh-attention-row tone-rose"
                  onClick={startWeakReview}
                >
                  <span className="fh-attention-icon"><WarningIcon size={14} /></span>
                  <span className="fh-attention-text">
                    <strong>{needsAttention.hardCards}</strong> cards marked hard
                  </span>
                  <ArrowRightIcon size={12} />
                </li>
                <li className="fh-attention-row tone-amber">
                  <span className="fh-attention-icon"><RestartIcon size={14} /></span>
                  <span className="fh-attention-text">
                    <strong>{needsAttention.staleDecks}</strong> decks haven't been reviewed in 5 days
                  </span>
                  <ArrowRightIcon size={12} />
                </li>
                <li
                  className="fh-attention-row tone-sage"
                  onClick={() => setView({ kind: "quizzes" })}
                >
                  <span className="fh-attention-icon"><CheckIcon size={14} /></span>
                  <span className="fh-attention-text">
                    <strong>{needsAttention.needsQuiz}</strong> decks ready for quiz generation
                  </span>
                  <ArrowRightIcon size={12} />
                </li>
              </ul>
            </div>
          </section>
        </div>
        </div>

      {createOpen && (
        <CreateDeckModal
          onClose={() => setCreateOpen(false)}
          onCreated={(deck) => {
            setSelectedDeck(deck.id);
            setCreateOpen(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      {importOpen && (
        <ImportCardsModal
          summaries={summaries}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      {generateOpen && (
        <GenerateFlashcardsModal
          onClose={() => setGenerateOpen(false)}
          onGenerated={(setId) => {
            setSelectedDeck(setId);
            setGenerateOpen(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      </main>

      {selectedDeckId ? (
        <DeckDetailRail
          variant="hub"
          isFavorite={favorites.has(selectedDeckId)}
          onToggleFavorite={() => {
            toggleFavorite(selectedDeckId);
          }}
        />
      ) : (
        <RightPanel flashcardsSwap />
      )}
    </>
  );
};

/* ===== bits ====== */

interface NeedsAttention {
  hardCards: number;
  staleDecks: number;
  needsQuiz: number;
}

interface FhStatProps {
  icon: ReactNode;
  tone: "amber" | "peach" | "sage" | "lilac" | "sky" | "rose";
  value: number;
  label: string;
  compact?: boolean;
}

const FhStat: FC<FhStatProps> = ({ icon, tone, value, label, compact }) => (
  <div className={`fh-stat tone-${tone}${compact ? " compact" : ""}`}>
    <span className="fh-stat-icon">{icon}</span>
    <div className="fh-stat-body">
      <span className="fh-stat-value">{value.toLocaleString()}</span>
      <span className="fh-stat-label">{label}</span>
    </div>
  </div>
);

interface ActionChipProps {
  icon: ReactNode;
  label: string;
  tone: "peach" | "sage" | "sky" | "rose";
  onClick: () => void;
}

const ActionChip: FC<ActionChipProps> = ({ icon, label, tone, onClick }) => (
  <button type="button" className={`fh-chip tone-${tone}`} onClick={onClick}>
    <span className="fh-chip-icon">{icon}</span>
    <span>{label}</span>
  </button>
);

interface ModeTileProps {
  icon: ReactNode;
  tone: "peach" | "lilac" | "rose" | "sage";
  title: string;
  value: number;
  caption: string;
  onClick: () => void;
}

const ModeTile: FC<ModeTileProps> = ({ icon, tone, title, value, caption, onClick }) => (
  <button type="button" className={`fh-mode tone-${tone}`} onClick={onClick}>
    <span className="fh-mode-icon">{icon}</span>
    <span className="fh-mode-title">{title}</span>
    <span className="fh-mode-value">{value.toLocaleString()}</span>
    <span className="fh-mode-caption">{caption}</span>
  </button>
);

/* ===== deck card ====== */

interface DeckCardProps {
  summary: DeckSummary;
  classes: ClassRow[];
  active: boolean;
  isFavorite: boolean;
  onOpen: () => void;
  onStudy: () => void;
  onToggleFavorite: () => void;
}

const DeckCard: FC<DeckCardProps> = ({
  summary,
  classes,
  active,
  isFavorite,
  onOpen,
  onStudy,
  onToggleFavorite,
}) => {
  const cls = summary.classId
    ? classes.find((c) => c.id === summary.classId) ?? null
    : null;
  const tone = cls ? toneFor(cls) : "sky";
  const subtitle = cls?.code ?? cls?.name ?? "Unfiled";
  const masteryPct = Math.round(summary.stats.mastery_pct * 100);
  const next = formatNextReview(summary.nextDueAt);

  return (
    <article className={`fh-deck-card${active ? " active" : ""}`} onClick={onOpen}>
      <header className="fh-deck-head">
        <span className={`fh-deck-icon tone-${tone}`}>
          {cls ? iconFor(cls, 20) : <FlashcardIcon size={20} />}
        </span>
        <button
          type="button"
          className={`fh-deck-fav${isFavorite ? " active" : ""}`}
          aria-label={isFavorite ? "Unfavorite deck" : "Favorite deck"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
        >
          <StarIcon size={14} />
        </button>
      </header>
      <h3 className="fh-deck-title">{summary.set.title}</h3>
      <p className="fh-deck-subtitle">{subtitle}</p>
      <div className="fh-deck-stats">
        <DeckStatPill
          icon={<FlashcardIcon size={12} />}
          label="Cards"
          value={summary.stats.total}
        />
        <DeckStatPill
          icon={<CalendarIcon size={12} />}
          label="Due"
          value={summary.stats.due}
        />
        <DeckStatPill
          icon={<TargetIcon size={12} />}
          label="Mastery"
          value={`${masteryPct}%`}
        />
      </div>
      <p className="fh-deck-next">Next review: {next}</p>
      <div className="fh-deck-actions">
        <button
          type="button"
          className="fh-deck-button ghost"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          Open Deck
        </button>
        <button
          type="button"
          className="fh-deck-button study"
          onClick={(e) => {
            e.stopPropagation();
            onStudy();
          }}
        >
          <BookmarkIcon size={12} />
          Study
        </button>
      </div>
    </article>
  );
};

const DeckStatPill: FC<{ icon: ReactNode; label: string; value: number | string }> = ({
  icon,
  label,
  value,
}) => (
  <div className="fh-deck-pill">
    <span className="fh-deck-pill-icon">{icon}</span>
    <span className="fh-deck-pill-value">{value}</span>
    <span className="fh-deck-pill-label">{label}</span>
  </div>
);

function formatNextReview(iso: string | null): string {
  if (!iso) return "Today";
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.getTime() - today.getTime()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7)
    return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ===== modals ===== */

interface CreateDeckModalProps {
  onClose: () => void;
  onCreated: (deck: FlashcardSetRow) => void;
}

const CreateDeckModal: FC<CreateDeckModalProps> = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      const deck = await upsertFlashcardSet({ title: t });
      onCreated(deck);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Create deck" subtitle="Empty decks live in the hub until you add cards.">
      <label className="fh-modal-label">
        <span>Deck name</span>
        <input
          autoFocus
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Cell Structure"
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
      </label>
      <div className="fh-modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn-primary"
          disabled={!title.trim() || busy}
          onClick={() => void submit()}
        >
          {busy ? "Creating…" : "Create deck"}
        </button>
      </div>
    </ModalShell>
  );
};

interface ImportCardsModalProps {
  summaries: DeckSummary[];
  onClose: () => void;
  onImported: () => void;
}

const ImportCardsModal: FC<ImportCardsModalProps> = ({ summaries, onClose, onImported }) => {
  const [setId, setSetId] = useState<string>(summaries[0]?.set.id ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setError(null);
    let cards: Array<{ front: string; back: string }> = [];
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Paste at least one card.");
      return;
    }
    try {
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed) as unknown;
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        cards = arr.map((row) => {
          const r = row as { front?: string; back?: string; q?: string; a?: string };
          return {
            front: String(r.front ?? r.q ?? ""),
            back: String(r.back ?? r.a ?? ""),
          };
        });
      } else {
        cards = trimmed
          .split(/\r?\n/)
          .map((line) => parseCsvRow(line))
          .filter((row): row is { front: string; back: string } => !!row);
      }
    } catch (e) {
      setError(`Couldn't parse: ${(e as Error).message}`);
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      onClose={onClose}
      title="Import cards"
      subtitle="Paste CSV (front,back per line) or a JSON array of {front, back} objects."
    >
      <label className="fh-modal-label">
        <span>Target deck</span>
        <select
          className="field"
          value={setId}
          onChange={(e) => setSetId(e.target.value)}
        >
          <option value="">— Create a new deck</option>
          {summaries.map((s) => (
            <option key={s.set.id} value={s.set.id}>{s.set.title}</option>
          ))}
        </select>
      </label>
      <label className="fh-modal-label">
        <span>Cards</span>
        <textarea
          className="field fh-modal-textarea"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'mitochondria,Produces ATP\ncell membrane,Regulates what enters and exits the cell'}
        />
      </label>
      {error && <div className="fh-modal-error">{error}</div>}
      <div className="fh-modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Importing…" : "Import cards"}
        </button>
      </div>
    </ModalShell>
  );
};

interface GenerateFlashcardsModalProps {
  onClose: () => void;
  onGenerated: (setId: string) => void;
}

const GenerateFlashcardsModal: FC<GenerateFlashcardsModalProps> = ({
  onClose,
  onGenerated,
}) => {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [noteId, setNoteId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listNotes(null).then((ns) => {
      setNotes(ns);
      setNoteId(ns[0]?.id ?? "");
    });
  }, []);

  async function submit(): Promise<void> {
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
    } catch {
      setError("Couldn't generate flashcards. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      onClose={onClose}
      title="Generate flashcards"
      subtitle="Pick a note — Note Goat will turn it into a fresh deck of cards."
    >
      <label className="fh-modal-label">
        <span>Source note</span>
        <select
          className="field"
          value={noteId}
          onChange={(e) => setNoteId(e.target.value)}
        >
          {notes.length === 0 ? (
            <option value="">— No notes yet</option>
          ) : (
            notes.map((n) => (
              <option key={n.id} value={n.id}>{n.title || "Untitled"}</option>
            ))
          )}
        </select>
      </label>
      {error && <div className="fh-modal-error">{error}</div>}
      <div className="fh-modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !noteId}
          onClick={() => void submit()}
        >
          {busy ? "Generating…" : "Generate"}
        </button>
      </div>
    </ModalShell>
  );
};

interface ModalShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}

const ModalShell: FC<ModalShellProps> = ({ title, subtitle, children, onClose }) => {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fh-modal-backdrop" onClick={onClose}>
      <div
        className="fh-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="fh-modal-head">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </header>
        <div className="fh-modal-body">{children}</div>
      </div>
    </div>
  );
};

/* ===== favorites (localStorage) ===== */

const FAV_KEY = "flashcards.favorites";

function loadFavorites(): Set<string> {
  try {
    const raw =
      typeof localStorage !== "undefined" ? localStorage.getItem(FAV_KEY) : null;
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed.filter((v): v is string => typeof v === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(set: Set<string>): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    /* drop */
  }
}

/** Naive CSV parser handling double-quoted fields with embedded commas. */
function parseCsvRow(raw: string): { front: string; back: string } | null {
  const line = raw.trim();
  if (!line || line.startsWith("#")) return null;
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  if (out.length < 2) return null;
  const front = out[0]!.trim();
  const back = out.slice(1).join(",").trim();
  if (!front || !back) return null;
  return { front, back };
}
