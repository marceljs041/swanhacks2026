/**
 * Quizzes hub — the dashboard for the quiz feature. Mirrors the
 * reference image: cream background, hero with goat illustration,
 * polished stat tiles, quick action chips, filter chips, and a grid of
 * quiz cards. Selecting a card pins `QuizDetailRail` into the third
 * column (same swap pattern Flashcards uses with `DeckDetailRail`).
 */
import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type QuizSummary,
  type QuizzesHubStats,
  quizSummaries,
  quizzesHubStats,
  recentWeakTopics,
  softDeleteQuiz,
} from "../db/repositories.js";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import { useApp } from "../store.js";
import type { ClassRow } from "@studynest/shared";
import { withViewTransition } from "../lib/viewTransition.js";
import { HeroSearch } from "./HeroSearch.js";
import { RightPanel } from "./RightPanel.js";
import { QuizDetailRail } from "./QuizDetailRail.js";
import { QuizGenerationModal } from "./QuizGenerationModal.js";
import { BRAND_QUIZ_HERO_URL } from "../lib/brand.js";
import {
  ArrowRightIcon,
  CalendarIcon,
  GraphIcon,
  PlayIcon,
  PlusIcon,
  QuizIcon,
  RestartIcon,
  SparklesIcon,
  TargetIcon,
  WarningIcon,
} from "./icons.js";
import { MoreMenu, type MoreMenuItem } from "./ui/MoreMenu.js";

const ZERO_STATS: QuizzesHubStats = {
  taken: 0,
  avgPct: 0,
  weakTopicCount: 0,
  dueToday: 0,
};

type FilterId =
  | "all"
  | "completed"
  | "in-progress"
  | "needs-review"
  | `class:${string}`;

export const QuizzesHub: FC = () => {
  const setView = useApp((s) => s.setView);
  const setSelectedQuiz = useApp((s) => s.setSelectedQuiz);
  const selectedQuizId = useApp((s) => s.selectedQuizId);
  const setQuizzesDetailPanelOpen = useApp((s) => s.setQuizzesDetailPanelOpen);
  const classes = useApp((s) => s.classes);
  const [stats, setStats] = useState<QuizzesHubStats>(ZERO_STATS);
  const [summaries, setSummaries] = useState<QuizSummary[]>([]);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    void (async () => {
      const [hub, list, weak] = await Promise.all([
        quizzesHubStats(),
        quizSummaries(),
        recentWeakTopics(8),
      ]);
      setStats(hub);
      setSummaries(list);
      setWeakTopics(weak);

      const prev = useApp.getState().selectedQuizId;
      if (prev && list.some((s) => s.quiz.id === prev)) return;
      setSelectedQuiz(null);
    })();
  }, [reload, setSelectedQuiz]);

  useEffect(() => {
    setQuizzesDetailPanelOpen(!!selectedQuizId);
    return () => setQuizzesDetailPanelOpen(false);
  }, [selectedQuizId, setQuizzesDetailPanelOpen]);

  const selectQuizPreview = useCallback(
    (id: string | null) => {
      withViewTransition(() => setSelectedQuiz(id));
    },
    [setSelectedQuiz],
  );

  const filteredSummaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summaries.filter((s) => {
      if (q) {
        const haystack = [
          s.quiz.title,
          s.noteTitle ?? "",
          classes.find((c) => c.id === s.classId)?.name ?? "",
          parseTags(s.quiz.tags_json).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filter === "all") return true;
      if (filter === "completed") return s.status === "completed";
      if (filter === "in-progress") return s.status === "in_progress";
      if (filter === "needs-review") return s.needsReview;
      if (filter.startsWith("class:")) {
        return s.classId === filter.slice("class:".length);
      }
      return true;
    });
  }, [summaries, search, filter, classes]);

  function startQuiz(quizId: string): void {
    setSelectedQuiz(quizId);
    setView({ kind: "quiz", quizId, mode: "take" });
  }

  function openResults(quizId: string): void {
    setSelectedQuiz(quizId);
    setView({ kind: "quiz", quizId, mode: "results" });
  }

  function takeDue(): void {
    const target = summaries.find((s) => s.status !== "completed") ?? summaries[0];
    if (target) startQuiz(target.quiz.id);
  }

  function reviewWeak(): void {
    const target =
      summaries.find((s) => s.needsReview) ?? summaries.find((s) => s.attempts > 0);
    if (target) {
      setSelectedQuiz(target.quiz.id);
      setView({ kind: "quiz", quizId: target.quiz.id, mode: "review" });
    }
  }

  function practiceAgain(): void {
    const target = summaries
      .filter((s) => s.attempts > 0)
      .sort((a, b) =>
        (a.lastAttemptAt ?? "").localeCompare(b.lastAttemptAt ?? ""),
      )
      .pop();
    if (target) startQuiz(target.quiz.id);
  }

  return (
    <>
      <main className="main">
        <div className="main-inner">
          <div className="quizzes-center">
            <section className="hero">
              <div className="hero-main">
                <HeroSearch />
                <div className="hero-greeting">
                  <h1 className="hero-headline">Quizzes</h1>
                  <p>Practice what you know, find weak spots, and get ready for exams.</p>
                </div>
              </div>
              <div className="hero-illustration" aria-hidden>
                <img
                  className="hero-illustration-img"
                  src={BRAND_QUIZ_HERO_URL}
                  alt=""
                  decoding="async"
                />
              </div>
            </section>

            <section className="qz-stat-grid">
              <QzStat
                icon={<QuizIcon size={18} />}
                tone="peach"
                value={stats.taken}
                label="Quizzes Taken"
              />
              <QzStat
                icon={<GraphIcon size={18} />}
                tone="sky"
                value={`${stats.avgPct}%`}
                label="Average Score"
              />
              <QzStat
                icon={<TargetIcon size={18} />}
                tone="sage"
                value={stats.weakTopicCount}
                label={stats.weakTopicCount === 1 ? "Weak Topic" : "Weak Topics"}
              />
              <QzStat
                icon={<CalendarIcon size={18} />}
                tone="lilac"
                value={stats.dueToday}
                label={stats.dueToday === 1 ? "Exam Soon" : "Exams Soon"}
              />
            </section>

            <div className="search-wrap qz-deck-filter">
              <label className="search">
                <span className="search-icon">
                  <SearchInline />
                </span>
                <input
                  type="search"
                  placeholder="Search quizzes, decks, or topics..."
                  aria-label="Filter quizzes"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>

            <section className="qz-action-chips" aria-label="Quiz actions">
              <ActionChip
                icon={<PlusIcon size={16} />}
                label="Generate Quiz"
                tone="peach"
                onClick={() => setGenerateOpen(true)}
              />
              <ActionChip
                icon={<PlayIcon size={16} />}
                label="Take Due Quiz"
                tone="sage"
                onClick={takeDue}
              />
              <ActionChip
                icon={<TargetIcon size={16} />}
                label="Review Weak Topics"
                tone="rose"
                onClick={reviewWeak}
              />
              <ActionChip
                icon={<RestartIcon size={16} />}
                label="Practice Again"
                tone="sky"
                onClick={practiceAgain}
              />
            </section>

            <FilterRow
              classes={classes}
              summaries={summaries}
              filter={filter}
              setFilter={setFilter}
            />

            <section className="qz-deck-grid" aria-label="Quizzes">
              {filteredSummaries.length === 0 ? (
                <div className="qz-empty">
                  <QuizIcon size={28} />
                  <p>
                    {summaries.length === 0
                      ? "You don't have any quizzes yet — generate one from a note, class, or deck."
                      : "No quizzes match this filter."}
                  </p>
                  {summaries.length === 0 && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setGenerateOpen(true)}
                    >
                      Generate quiz
                    </button>
                  )}
                </div>
              ) : (
                filteredSummaries.map((s) => (
                  <QuizCard
                    key={s.quiz.id}
                    summary={s}
                    classes={classes}
                    active={selectedQuizId === s.quiz.id}
                    onSelect={() => {
                      if (selectedQuizId === s.quiz.id) selectQuizPreview(null);
                      else selectQuizPreview(s.quiz.id);
                    }}
                    onTake={() => startQuiz(s.quiz.id)}
                    onResults={() => openResults(s.quiz.id)}
                    onAskAi={() => {
                      setSelectedQuiz(s.quiz.id);
                      setView({ kind: "quiz", quizId: s.quiz.id, mode: "review" });
                    }}
                    onDelete={() => {
                      void softDeleteQuiz(s.quiz.id).then(() => {
                        if (selectedQuizId === s.quiz.id) setSelectedQuiz(null);
                        setReload((n) => n + 1);
                      });
                    }}
                  />
                ))
              )}
            </section>

            {weakTopics.length > 0 && (
              <section className="qz-insights">
                <span className="qz-insights-label">
                  <SparklesIcon size={14} /> Quiz Insights
                </span>
                <div className="qz-insights-chips">
                  {weakTopics.map((t) => (
                    <span key={t} className="rail-chip rail-chip-rose">
                      {t}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {generateOpen && (
          <QuizGenerationModal
            onClose={() => setGenerateOpen(false)}
            onGenerated={(quizId) => {
              setGenerateOpen(false);
              setSelectedQuiz(quizId);
              setReload((n) => n + 1);
            }}
          />
        )}
      </main>

      {selectedQuizId ? (
        <QuizDetailRail variant="hub" quizId={selectedQuizId} />
      ) : (
        <RightPanel />
      )}
    </>
  );
};

/* =========== bits =========== */

interface QzStatProps {
  icon: ReactNode;
  tone: "amber" | "peach" | "sage" | "lilac" | "sky" | "rose";
  value: number | string;
  label: string;
}

const QzStat: FC<QzStatProps> = ({ icon, tone, value, label }) => (
  <div className={`fh-stat qz-stat tone-${tone}`}>
    <span className="fh-stat-icon">{icon}</span>
    <div className="fh-stat-body">
      <span className="fh-stat-value">{value}</span>
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

interface FilterRowProps {
  classes: ClassRow[];
  summaries: QuizSummary[];
  filter: FilterId;
  setFilter: (f: FilterId) => void;
}

const FilterRow: FC<FilterRowProps> = ({ classes, summaries, filter, setFilter }) => {
  const classCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of summaries) {
      if (s.classId) m.set(s.classId, (m.get(s.classId) ?? 0) + 1);
    }
    return m;
  }, [summaries]);

  const usedClasses = classes.filter((c) => classCounts.has(c.id));

  const items: Array<{ id: FilterId; label: string }> = [
    { id: "all", label: "All" },
    ...usedClasses.map((c) => ({
      id: `class:${c.id}` as FilterId,
      label: c.name,
    })),
    { id: "completed", label: "Completed" },
    { id: "in-progress", label: "In Progress" },
    { id: "needs-review", label: "Needs Review" },
  ];

  return (
    <section className="qz-filter-row" aria-label="Filter quizzes">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={`qz-filter-chip${filter === it.id ? " active" : ""}`}
          onClick={() => setFilter(it.id)}
        >
          {it.label}
        </button>
      ))}
    </section>
  );
};

interface QuizCardProps {
  summary: QuizSummary;
  classes: ClassRow[];
  active: boolean;
  onSelect: () => void;
  onTake: () => void;
  onResults: () => void;
  onAskAi: () => void;
  onDelete: () => void;
}

const QuizCard: FC<QuizCardProps> = ({
  summary,
  classes,
  active,
  onSelect,
  onTake,
  onResults,
  onAskAi,
  onDelete,
}) => {
  const cls = summary.classId
    ? classes.find((c) => c.id === summary.classId) ?? null
    : null;
  const tone = cls ? toneFor(cls) : "sage";
  const subtitle = cls?.name ?? summary.noteTitle ?? "Unfiled";
  const typeLabel = labelForQuiz(summary);
  const statusPill = pillForStatus(summary);

  const moreItems: MoreMenuItem[] = [
    {
      label: summary.attempts > 0 ? "View results" : "Take quiz",
      icon: <ArrowRightIcon size={14} />,
      onClick: summary.attempts > 0 ? onResults : onTake,
    },
    {
      label: "Delete quiz",
      icon: <WarningIcon size={14} />,
      onClick: onDelete,
      danger: true,
    },
  ];

  return (
    <article
      className={`qz-deck-card${active ? " active" : ""}`}
      onClick={onSelect}
    >
      <header className="qz-deck-head">
        <span className={`qz-deck-icon tone-${tone}`}>
          {cls ? iconFor(cls, 20) : <QuizIcon size={20} />}
        </span>
        <div
          className="qz-deck-more"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreMenu items={moreItems} label="Quiz actions" />
        </div>
      </header>
      <h3 className="qz-deck-title">{summary.quiz.title}</h3>
      <p className="qz-deck-subtitle">{subtitle}</p>
      <p className="qz-deck-meta">
        {summary.questionCount} {summary.questionCount === 1 ? "question" : "questions"}
        {" • "}
        {typeLabel}
      </p>

      <div className="qz-deck-pills">
        <DeckStatPill
          label="Last score"
          value={summary.lastScorePct !== null ? `${summary.lastScorePct}%` : "—"}
        />
        <DeckStatPill
          label="Best"
          value={summary.bestScorePct !== null ? `${summary.bestScorePct}%` : "—"}
        />
        <DeckStatPill label="Attempts" value={summary.attempts} />
      </div>

      {statusPill && (
        <div className={`qz-deck-status ${statusPill.tone}`}>
          <span className="qz-deck-status-dot" aria-hidden />
          <span>{statusPill.label}</span>
          {statusPill.detail && (
            <span className="qz-deck-status-detail">{statusPill.detail}</span>
          )}
        </div>
      )}

      <div className="qz-deck-actions">
        <button
          type="button"
          className="qz-deck-button primary"
          onClick={(e) => {
            e.stopPropagation();
            if (summary.status === "in_progress") {
              onTake();
            } else if (summary.attempts > 0) {
              onTake();
            } else {
              onTake();
            }
          }}
        >
          {summary.status === "in_progress"
            ? "Resume Quiz"
            : summary.attempts > 0
            ? "Take Quiz"
            : "Take Quiz"}
          <ArrowRightIcon size={12} />
        </button>
        <button
          type="button"
          className="qz-deck-button ghost"
          onClick={(e) => {
            e.stopPropagation();
            onAskAi();
          }}
        >
          <SparklesIcon size={12} />
          Ask AI
        </button>
      </div>
    </article>
  );
};

const DeckStatPill: FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="qz-deck-pill">
    <span className="qz-deck-pill-value">{value}</span>
    <span className="qz-deck-pill-label">{label}</span>
  </div>
);

/* =========== helpers =========== */

function parseTags(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json) as unknown;
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  } catch {
    /* drop */
  }
  return [];
}

function labelForQuiz(s: QuizSummary): string {
  const src = s.quiz.source_type;
  if (src === "class") return "Mixed";
  if (src === "flashcards") return "Practice";
  return "Multiple Choice";
}

function pillForStatus(
  s: QuizSummary,
): { label: string; tone: string; detail?: string } | null {
  if (s.status === "in_progress") {
    return { label: "In Progress", tone: "tone-amber" };
  }
  if (s.needsReview) {
    const weak = parseTags(s.quiz.weak_topics_json);
    return {
      label: "Needs Review",
      tone: "tone-rose",
      detail:
        weak.length > 0 ? `Weak topic: ${weak[0]}` : undefined,
    };
  }
  if (s.attempts > 0) {
    return { label: "On Track", tone: "tone-sage" };
  }
  return null;
}

const SearchInline: FC = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-3.5-3.5" />
  </svg>
);
