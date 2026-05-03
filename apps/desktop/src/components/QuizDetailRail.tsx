/**
 * Third-column detail rail for quizzes — same grid cell as the global
 * `RightPanel`, swapped in by the Quizzes hub / take / results screens.
 *
 * Three variants:
 *  - `hub`     — quiz overview, recent scores, AI tools (matches the
 *                first reference image's right panel).
 *  - `session` — active take view: questions / completed / remaining /
 *                accuracy stats + Explain This Question (image #2).
 *  - `results` — post-submit summary, weak topics, linked notes,
 *                follow-up actions.
 */
import type { FC, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  type QuizSummary,
  getNote,
  getQuiz,
  quizAttemptsForQuiz,
  quizSummaries,
} from "../db/repositories.js";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import { useApp } from "../store.js";
import type {
  ClassRow,
  NoteRow,
  QuizAttemptRow,
  QuizQuestionRow,
  QuizRow,
} from "@studynest/shared";
import { withViewTransition } from "../lib/viewTransition.js";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookmarkIcon,
  CheckIcon,
  CloudCheckIcon,
  CloudOffIcon,
  FlashcardIcon,
  GraphIcon,
  QuizIcon,
  SparklesIcon,
  TargetIcon,
  TrophyIcon,
} from "./icons.js";

export type QuizRailVariant = "hub" | "session" | "results";

interface SessionStats {
  /** Total questions in the quiz. */
  total: number;
  /** Number answered (length of `answers`). */
  completed: number;
  /** Total minus completed. */
  remaining: number;
  /** 0–100 accuracy of answers given so far. */
  accuracy: number;
  /** Topics for the questions still being worked on; chips. */
  currentFocus: string[];
}

interface ResultsStats {
  score: number;
  total: number;
  pct: number;
  timeSpentSeconds: number;
  weakTopics: string[];
}

interface Props {
  variant: QuizRailVariant;
  /** Required when `variant !== "hub"`. */
  quizId?: string;
  /** Session-only: live quiz stats so the rail updates with each answer. */
  sessionStats?: SessionStats;
  /** The active question (for the "Explain This Question" tool). */
  currentQuestion?: QuizQuestionRow | null;
  /** Results-only: post-submit summary. */
  resultsStats?: ResultsStats;
  /** Optional handlers wired by the parent (Quiz / QuizzesHub). */
  onExplainQuestion?: () => void;
  onSummarizeWeakTopics?: () => void;
  onMakeReviewSet?: () => void;
  onAskQuiz?: () => void;
}

export const QuizDetailRail: FC<Props> = ({
  variant,
  quizId,
  sessionStats,
  currentQuestion,
  resultsStats,
  onExplainQuestion,
  onSummarizeWeakTopics,
  onMakeReviewSet,
  onAskQuiz,
}) => {
  const setView = useApp((s) => s.setView);
  const setSelectedQuiz = useApp((s) => s.setSelectedQuiz);
  const classes = useApp((s) => s.classes);
  const syncStatus = useApp((s) => s.syncStatus);

  const selectedQuizId = useApp((s) => s.selectedQuizId);
  const effectiveQuizId = quizId ?? selectedQuizId;

  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [summary, setSummary] = useState<QuizSummary | null>(null);
  const [note, setNote] = useState<NoteRow | null>(null);
  const [attempts, setAttempts] = useState<QuizAttemptRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!effectiveQuizId) {
      setQuiz(null);
      setSummary(null);
      setNote(null);
      setAttempts([]);
      return () => undefined;
    }
    void (async () => {
      const [q, all, atts] = await Promise.all([
        getQuiz(effectiveQuizId),
        quizSummaries(),
        quizAttemptsForQuiz(effectiveQuizId),
      ]);
      if (cancelled) return;
      setQuiz(q);
      setSummary(all.find((s) => s.quiz.id === effectiveQuizId) ?? null);
      setAttempts(atts.filter((a) => a.completed === 1));
      if (q?.note_id) {
        const n = await getNote(q.note_id);
        if (!cancelled) setNote(n);
      } else {
        setNote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveQuizId, variant]);

  const cls = useMemo<ClassRow | null>(() => {
    const id = quiz?.class_id ?? note?.class_id ?? null;
    if (!id) return null;
    return classes.find((c) => c.id === id) ?? null;
  }, [quiz, note, classes]);

  const panelChrome =
    "right-panel quiz-detail-rail quiz-rail right-panel--quizzes-swap";

  if (!effectiveQuizId) {
    return (
      <aside className={`${panelChrome} empty`} aria-label="Quiz details">
        <p className="quiz-rail-empty-msg">
          Select a quiz to see its progress and AI tools.
        </p>
      </aside>
    );
  }

  if (!quiz) {
    return (
      <aside className={`${panelChrome} empty`} aria-label="Quiz details">
        <p className="quiz-rail-empty-msg">Loading quiz…</p>
      </aside>
    );
  }

  const tone = cls ? toneFor(cls) : "sage";
  const subtitle = cls?.code ?? cls?.name ?? "Unfiled";
  const description =
    quiz.description ||
    note?.summary ||
    `Test your understanding of ${quiz.title.toLowerCase()} with practice questions.`;

  const tags = parseStringArray(quiz.tags_json);
  const defaultTags = (() => {
    const base = ["Lecture", "Exam 1"];
    if (summary?.needsReview) base.push("Needs Review");
    return base;
  })();
  const renderTags = tags.length > 0 ? tags : defaultTags;

  const weakTopics = parseStringArray(quiz.weak_topics_json);
  const sessionFocus = sessionStats?.currentFocus ?? [];
  const focusTopics = (sessionFocus.length > 0 ? sessionFocus : weakTopics).slice(0, 4);

  return (
    <aside className={panelChrome} aria-label="Quiz details">
      <header className="quiz-rail-head">
        <button
          type="button"
          className="quiz-rail-back"
          aria-label="Back to all quizzes"
          onClick={() => {
            withViewTransition(() => {
              if (variant === "hub") setSelectedQuiz(null);
              else setView({ kind: "quizzes" });
            });
          }}
        >
          <ArrowLeftIcon size={16} />
        </button>
        <span className="quiz-rail-spacer" />
      </header>

      <div className="quiz-rail-title">
        <span className={`quiz-rail-icon tone-${tone}`}>
          {cls ? iconFor(cls, 22) : <QuizIcon size={22} />}
        </span>
        <div className="quiz-rail-title-text">
          <h2>{quiz.title}</h2>
          <span className="quiz-rail-subtitle">{subtitle}</span>
        </div>
      </div>

      <div className="quiz-rail-chips">
        {renderTags.map((tag) => (
          <span
            key={tag}
            className={`rail-chip rail-chip-${chipToneFor(tag)}`}
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="quiz-rail-description">{description}</p>

      {variant === "hub" && summary && (
        <HubBlocks summary={summary} attempts={attempts} />
      )}

      {variant === "session" && sessionStats && (
        <SessionBlocks stats={sessionStats} focusTopics={focusTopics} />
      )}

      {variant === "results" && resultsStats && (
        <ResultsBlocks stats={resultsStats} />
      )}

      <section className="quiz-rail-block">
        <header className="quiz-rail-block-head">
          <span>AI Tools</span>
        </header>
        <div className="quiz-rail-tools">
          {variant === "session" && (
            <RailToolButton
              icon={<SparklesIcon size={14} />}
              label="Explain This Question"
              onClick={() => onExplainQuestion?.()}
              disabled={!currentQuestion}
              tone="lilac"
            />
          )}
          <RailToolButton
            icon={<TargetIcon size={14} />}
            label="Summarize Weak Topics"
            onClick={() => onSummarizeWeakTopics?.()}
            tone="lilac"
          />
          <RailToolButton
            icon={<FlashcardIcon size={14} />}
            label="Make Review Set"
            onClick={() => onMakeReviewSet?.()}
            tone="sage"
          />
          <RailToolButton
            icon={<QuizIcon size={14} />}
            label="Ask This Quiz"
            onClick={() => onAskQuiz?.()}
            tone="sky"
          />
          <RailToolButton
            icon={<BookmarkIcon size={14} />}
            label="Schedule practice"
            tone="peach"
            onClick={() => {
              if (!quiz) return;
              const start = new Date();
              start.setDate(start.getDate() + 1);
              start.setHours(9, 0, 0, 0);
              const end = new Date(start.getTime() + 30 * 60_000);
              setView({ kind: "calendar" });
              queueMicrotask(() => {
                useApp.getState().setCalendarComposer({
                  mode: "create",
                  prefill: {
                    type: "quiz",
                    title: `Practice: ${quiz.title}`,
                    quiz_id: quiz.id,
                    note_id: quiz.note_id ?? null,
                    class_id: quiz.class_id ?? cls?.id ?? null,
                    start_at: start.toISOString(),
                    end_at: end.toISOString(),
                  },
                });
              });
            }}
          />
        </div>
      </section>

      <footer className={`quiz-rail-sync sync-${syncStatus}`}>
        <span className="quiz-rail-sync-icon">
          {syncStatus === "offline" ? (
            <CloudOffIcon size={14} />
          ) : (
            <CloudCheckIcon size={14} />
          )}
        </span>
        <div className="quiz-rail-sync-text">
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
    </aside>
  );
};

/* ============== blocks ============== */

const HubBlocks: FC<{ summary: QuizSummary; attempts: QuizAttemptRow[] }> = ({
  summary,
  attempts,
}) => {
  const recent = attempts.slice(0, 3);
  const weak = parseStringArray(summary.quiz.weak_topics_json);

  return (
    <>
      <section className="quiz-rail-block">
        <header className="quiz-rail-block-head">
          <span>
            <GraphIcon size={14} /> Recent Scores
          </span>
          <span className="quiz-rail-link-mute">View all</span>
        </header>
        {recent.length === 0 ? (
          <p className="quiz-rail-empty-msg">No attempts yet — take the quiz to see scores here.</p>
        ) : (
          <ul className="quiz-rail-scores">
            {recent.map((a) => {
              const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
              const at = a.finished_at ?? a.created_at;
              return (
                <li key={a.id} className="quiz-rail-score-row">
                  <span className="quiz-rail-score-date">{shortDate(at)}</span>
                  <span className="quiz-rail-score-pct">{pct}%</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="quiz-rail-block">
        <header className="quiz-rail-block-head">
          <span>Quiz Progress</span>
        </header>
        <div className="quiz-rail-stats">
          <RailStat
            label="Questions"
            value={summary.questionCount}
            icon={<QuizIcon size={14} />}
            tone="amber"
          />
          <RailStat
            label="Attempts"
            value={summary.attempts}
            icon={<BookmarkIcon size={14} />}
            tone="peach"
          />
          <RailStat
            label="Best"
            value={summary.bestScorePct !== null ? `${summary.bestScorePct}%` : "—"}
            icon={<TrophyIcon size={14} />}
            tone="lilac"
          />
          <RailStat
            label="Avg"
            value={
              summary.lastScorePct !== null ? `${summary.lastScorePct}%` : "—"
            }
            icon={<GraphIcon size={14} />}
            tone="sage"
          />
        </div>
      </section>

      {weak.length > 0 && (
        <section className="quiz-rail-block">
          <header className="quiz-rail-block-head">
            <span>Weak Topics</span>
          </header>
          <div className="quiz-rail-topic-chips">
            {weak.map((t) => (
              <span key={t} className="rail-chip rail-chip-rose">
                {t}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
};

const SessionBlocks: FC<{
  stats: SessionStats;
  focusTopics: string[];
}> = ({ stats, focusTopics }) => (
  <>
    <section className="quiz-rail-block">
      <header className="quiz-rail-block-head">
        <span>
          <GraphIcon size={14} /> Quiz Session
        </span>
      </header>
      <div className="quiz-rail-stats">
        <RailStat
          label="Questions"
          value={stats.total}
          icon={<QuizIcon size={14} />}
          tone="amber"
        />
        <RailStat
          label="Completed"
          value={stats.completed}
          icon={<CheckIcon size={14} />}
          tone="sage"
        />
        <RailStat
          label="Remaining"
          value={stats.remaining}
          icon={<BookmarkIcon size={14} />}
          tone="peach"
        />
        <RailStat
          label="Accuracy"
          value={`${stats.accuracy}%`}
          icon={<TrophyIcon size={14} />}
          tone="lilac"
        />
      </div>
    </section>

    {focusTopics.length > 0 && (
      <section className="quiz-rail-block">
        <header className="quiz-rail-block-head">
          <span>
            <TargetIcon size={14} /> Current Focus
          </span>
        </header>
        <div className="quiz-rail-topic-chips">
          {focusTopics.map((t) => (
            <span key={t} className="rail-chip rail-chip-rose">
              {t}
            </span>
          ))}
        </div>
      </section>
    )}
  </>
);

const ResultsBlocks: FC<{ stats: ResultsStats }> = ({ stats }) => (
  <>
    <section className="quiz-rail-block">
      <header className="quiz-rail-block-head">
        <span>
          <TrophyIcon size={14} /> Result
        </span>
      </header>
      <div className="quiz-rail-stats">
        <RailStat
          label="Score"
          value={`${stats.score}/${stats.total}`}
          icon={<QuizIcon size={14} />}
          tone="amber"
        />
        <RailStat
          label="Percent"
          value={`${stats.pct}%`}
          icon={<TrophyIcon size={14} />}
          tone="lilac"
        />
        <RailStat
          label="Time"
          value={fmtMinSec(stats.timeSpentSeconds)}
          icon={<GraphIcon size={14} />}
          tone="sage"
        />
        <RailStat
          label="Missed"
          value={Math.max(0, stats.total - stats.score)}
          icon={<TargetIcon size={14} />}
          tone="peach"
        />
      </div>
    </section>

    {stats.weakTopics.length > 0 && (
      <section className="quiz-rail-block">
        <header className="quiz-rail-block-head">
          <span>Weak Topics</span>
        </header>
        <div className="quiz-rail-topic-chips">
          {stats.weakTopics.map((t) => (
            <span key={t} className="rail-chip rail-chip-rose">
              {t}
            </span>
          ))}
        </div>
      </section>
    )}
  </>
);

/* ============== bits ============== */

interface RailStatProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone: "amber" | "peach" | "sage" | "rose" | "lilac" | "sky";
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
  disabled?: boolean;
  tone?: "lilac" | "sage" | "sky" | "peach";
}

const RailToolButton: FC<RailToolButtonProps> = ({
  icon,
  label,
  onClick,
  busy,
  disabled,
  tone = "lilac",
}) => (
  <button
    type="button"
    className={`quiz-rail-tool tone-${tone}`}
    onClick={onClick}
    disabled={busy || disabled}
  >
    <span className="quiz-rail-tool-icon">{icon}</span>
    <span className="quiz-rail-tool-label">{busy ? "Working…" : label}</span>
    <ArrowRightIcon size={12} />
  </button>
);

/* ============== helpers ============== */

function parseStringArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
    }
  } catch {
    /* drop */
  }
  return [];
}

function chipToneFor(tag: string): "sage" | "rose" | "amber" | "sky" {
  const t = tag.toLowerCase();
  if (t.includes("review") || t.includes("weak")) return "rose";
  if (t.includes("exam")) return "amber";
  if (t.includes("lecture") || t.includes("note")) return "sage";
  return "sky";
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtMinSec(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
