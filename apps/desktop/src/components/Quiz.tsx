/**
 * Active quiz screen — three modes:
 *
 *   take    — single-question flow with progress bar, action bar, and
 *             persistent session state for resume.
 *   results — post-submit summary, topic performance, wrong-answer
 *             list, and follow-up actions (flashcards / study plan).
 *   review  — step-through of only missed questions, with explanations
 *             and per-question "turn into flashcard".
 *
 * The third column is the `QuizDetailRail` in `session` / `results`
 * variant.  All three modes share the same outer chrome.
 */
import type { FC, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type TopicPerformance,
  clearQuizSession,
  getNote,
  getQuiz,
  getQuizSession,
  listQuizQuestions,
  quizAttemptsForQuiz,
  recordQuizAttempt,
  recordXp,
  saveQuizSession,
  topicPerformance,
  upsertFlashcard,
  upsertFlashcardSet,
  upsertStudyTask,
} from "../db/repositories.js";
import { useApp, type QuizMode } from "../store.js";
import { iconFor, toneFor } from "../lib/classDisplay.js";
import type {
  ClassRow,
  NoteRow,
  QuizAttemptRow,
  QuizQuestionRow,
  QuizRow,
} from "@studynest/shared";
import { ulid, XP_RULES } from "@studynest/shared";
import { withViewTransition } from "../lib/viewTransition.js";
import { BRAND_QUIZ_HERO_URL } from "../lib/brand.js";
import { QuizDetailRail } from "./QuizDetailRail.js";
import { Donut } from "./ui/ProgressRing.js";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckIcon,
  CloudCheckIcon,
  CloudOffIcon,
  FlashcardIcon,
  GraphIcon,
  NoteIcon,
  QuizIcon,
  SparklesIcon,
  TargetIcon,
  VolumeIcon,
  WarningIcon,
} from "./icons.js";

interface Props {
  quizId: string;
  mode: QuizMode;
}

export const Quiz: FC<Props> = ({ quizId, mode }) => {
  const setView = useApp((s) => s.setView);
  const setSelectedQuiz = useApp((s) => s.setSelectedQuiz);
  const classes = useApp((s) => s.classes);

  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionRow[]>([]);
  const [note, setNote] = useState<NoteRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [q, qs] = await Promise.all([
        getQuiz(quizId),
        listQuizQuestions(quizId),
      ]);
      if (cancelled) return;
      setQuiz(q);
      setQuestions(qs);
      if (q?.note_id) {
        const n = await getNote(q.note_id);
        if (!cancelled) setNote(n);
      } else {
        setNote(null);
      }
      setSelectedQuiz(quizId);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId, setSelectedQuiz]);

  const cls = useMemo<ClassRow | null>(() => {
    const id = quiz?.class_id ?? note?.class_id ?? null;
    if (!id) return null;
    return classes.find((c) => c.id === id) ?? null;
  }, [quiz, note, classes]);

  if (loading || !quiz) {
    return (
      <main className="main">
        <div className="main-inner">
          <p className="quiz-loading">Loading quiz…</p>
        </div>
      </main>
    );
  }

  if (mode === "results") {
    return (
      <ResultsView
        quiz={quiz}
        questions={questions}
        cls={cls}
        note={note}
        onRetake={() =>
          withViewTransition(() =>
            setView({ kind: "quiz", quizId, mode: "take" }),
          )
        }
        onReview={() =>
          withViewTransition(() =>
            setView({ kind: "quiz", quizId, mode: "review" }),
          )
        }
      />
    );
  }

  if (mode === "review") {
    return (
      <ReviewView
        quiz={quiz}
        questions={questions}
        cls={cls}
        note={note}
        onBack={() =>
          withViewTransition(() =>
            setView({ kind: "quiz", quizId, mode: "results" }),
          )
        }
      />
    );
  }

  return (
    <TakeView
      quiz={quiz}
      questions={questions}
      cls={cls}
      note={note}
      onSubmitted={() =>
        withViewTransition(() =>
          setView({ kind: "quiz", quizId, mode: "results" }),
        )
      }
    />
  );
};

/* ============================================================ */
/* Take                                                         */
/* ============================================================ */

interface TakeProps {
  quiz: QuizRow;
  questions: QuizQuestionRow[];
  cls: ClassRow | null;
  note: NoteRow | null;
  onSubmitted: () => void;
}

const TakeView: FC<TakeProps> = ({ quiz, questions, cls, note, onSubmitted }) => {
  const setView = useApp((s) => s.setView);
  const syncStatus = useApp((s) => s.syncStatus);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [shortInput, setShortInput] = useState("");
  const [hintOpen, setHintOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  /** Bumped every second so "Time elapsed" recomputes without waiting on other state. */
  const [, setSessionClockTick] = useState(0);
  const startedAtRef = useRef<string | null>(null);

  const total = questions.length;
  const current = questions[index] ?? null;

  useEffect(() => {
    const id = window.setInterval(() => {
      setSessionClockTick((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Hydrate from a persisted session, if one exists.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await getQuizSession(quiz.id);
      if (cancelled) return;
      if (session) {
        try {
          const restored = JSON.parse(session.answers_json) as Record<string, string>;
          setAnswers(restored ?? {});
          setIndex(Math.min(session.current_index, Math.max(0, total - 1)));
        } catch {
          /* ignore */
        }
        startedAtRef.current = session.started_at;
      } else {
        startedAtRef.current = new Date().toISOString();
      }
      if (!cancelled) setSessionClockTick((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [quiz.id, total]);

  // Reset per-question UI when the active question changes.
  useEffect(() => {
    setHintOpen(false);
    if (current?.type === "short_answer") {
      setShortInput(answers[current.id] ?? "");
    }
  }, [current?.id]);

  function setAnswer(questionId: string, value: string): void {
    setAnswers((a) => ({ ...a, [questionId]: value }));
    void saveQuizSession({
      quiz_id: quiz.id,
      current_index: index,
      answers: { ...answers, [questionId]: value },
      started_at: startedAtRef.current ?? undefined,
    });
  }

  function isCorrectFor(question: QuizQuestionRow, given: string | undefined): boolean {
    if (!given) return false;
    const a = given.trim().toLowerCase();
    const c = question.correct_answer.trim().toLowerCase();
    if (a === c) return true;
    // Lenient short-answer grading: punctuation-stripped match.
    if (question.type === "short_answer") {
      const norm = (s: string) => s.replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
      return norm(a) === norm(c);
    }
    return false;
  }

  function commitAnswer(): void {
    if (!current) return;
    if (current.type === "short_answer") {
      const v = shortInput.trim();
      if (!v) return;
      setAnswer(current.id, v);
    }
    const given = current.type === "short_answer" ? shortInput.trim() : answers[current.id];
    if (!given) return;
    setSubmitted((s) => ({ ...s, [current.id]: true }));
    const ok = isCorrectFor(current, given);
    if (ok) {
      setCorrectCount((c) => c + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  }

  function next(): void {
    if (index < total - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      void saveQuizSession({
        quiz_id: quiz.id,
        current_index: nextIdx,
        answers,
        started_at: startedAtRef.current ?? undefined,
      });
    } else {
      void finalize();
    }
  }

  function skip(): void {
    if (!current) return;
    setSubmitted((s) => ({ ...s, [current.id]: false }));
    setStreak(0);
    next();
  }

  async function finalize(): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    try {
      const startIso = startedAtRef.current ?? new Date().toISOString();
      const finishIso = new Date().toISOString();
      const elapsed = Math.max(
        0,
        Math.round((Date.parse(finishIso) - Date.parse(startIso)) / 1000),
      );
      let score = 0;
      const wrongTopics = new Set<string>();
      for (const q of questions) {
        const a = answers[q.id];
        if (a && isCorrectFor(q, a)) {
          score += 1;
        } else if (q.topic) {
          wrongTopics.add(q.topic);
        }
      }
      const weakTopics = Array.from(wrongTopics);
      await recordQuizAttempt({
        quiz_id: quiz.id,
        score,
        total,
        answers,
        weak_topics: weakTopics,
        started_at: startIso,
        finished_at: finishIso,
        time_spent_seconds: elapsed,
      });
      await clearQuizSession(quiz.id);
      await recordXp("completeQuiz", XP_RULES.completeQuiz);
      if (total > 0 && score === total) {
        await recordXp("perfectQuizBonus", XP_RULES.perfectQuizBonus);
      }
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  const progressPct = total === 0 ? 0 : Math.round((index / total) * 100);
  const completed = Object.keys(answers).length;
  const remaining = Math.max(0, total - completed);
  const accuracy = completed === 0 ? 0 : Math.round((correctCount / Math.max(1, completed)) * 100);
  const focusTopics = questions
    .slice(index, index + 3)
    .map((q) => q.topic)
    .filter((v): v is string => !!v);

  const sessionStats = {
    total,
    completed,
    remaining,
    accuracy,
    currentFocus: focusTopics,
  };

  const elapsedSeconds = startedAtRef.current
    ? Math.max(0, Math.round((Date.now() - Date.parse(startedAtRef.current)) / 1000))
    : 0;

  return (
    <>
      <main className="main">
        <div className="topbar">
          <button
            className="btn-ghost"
            onClick={() =>
              withViewTransition(() => setView({ kind: "quizzes" }))
            }
          >
            <ArrowLeftIcon size={14} /> Quizzes
          </button>
          <span style={{ flex: 1 }} />
          <SyncPill status={syncStatus} />
        </div>
        <div className="main-inner">
          <div className="quiz-take-shell">
            <section className="hero quiz-hero">
              <div className="hero-main">
                <Breadcrumb cls={cls} quiz={quiz} />
                <div className="hero-greeting">
                  <h1 className="hero-headline">Take Quiz</h1>
                  <p>Answer each question, track your progress, and learn as you go.</p>
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

            <MetaChips
              cls={cls}
              quiz={quiz}
              total={total}
              index={index}
              syncStatus={syncStatus}
            />

            <div className="qz-progress" aria-label="Quiz progress">
              <span
                className="qz-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
              <span className="qz-progress-meta">{progressPct}% complete</span>
            </div>

            {!current ? (
              <div className="qz-empty">
                <QuizIcon size={28} />
                <p>This quiz has no questions yet.</p>
              </div>
            ) : (
              <QuestionCard
                question={current}
                index={index}
                total={total}
                given={answers[current.id]}
                shortInput={shortInput}
                setShortInput={setShortInput}
                onSelect={(value) => setAnswer(current.id, value)}
                showFeedback={!!submitted[current.id]}
                hintOpen={hintOpen}
              />
            )}

            <div className="qz-action-bar">
              {current && !submitted[current.id] ? (
                <button
                  type="button"
                  className="btn-primary qz-action-primary"
                  disabled={
                    current.type === "short_answer"
                      ? shortInput.trim().length === 0
                      : !answers[current.id]
                  }
                  onClick={commitAnswer}
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary qz-action-primary"
                  disabled={submitting}
                  onClick={next}
                >
                  {index < total - 1 ? "Next Question" : submitting ? "Submitting…" : "Finish Quiz"}
                  <ArrowRightIcon size={12} />
                </button>
              )}
              <button
                type="button"
                className="qz-action-ghost"
                onClick={skip}
                disabled={!current}
              >
                Skip
              </button>
              <button
                type="button"
                className="qz-action-ghost"
                onClick={() => speak(current?.question ?? "")}
                disabled={!current}
              >
                <VolumeIcon size={14} /> Read Aloud
              </button>
              <button
                type="button"
                className="qz-action-ghost"
                onClick={() => setHintOpen((v) => !v)}
                disabled={!current?.hint}
              >
                <SparklesIcon size={14} /> Hint
              </button>
            </div>

            {hintOpen && current?.hint && (
              <p className="qz-hint">{current.hint}</p>
            )}

            <div className="qz-helper-row">
              <HelperCard
                title="Session Overview"
                icon={<GraphIcon size={16} />}
              >
                <div className="qz-helper-grid">
                  <KvStat label="Accuracy" value={`${accuracy}%`} />
                  <KvStat label="Correct in a row" value={streak} />
                  <KvStat label="Time elapsed" value={fmtMinSec(elapsedSeconds)} />
                </div>
              </HelperCard>

              <HelperCard
                title="Quick Actions"
                icon={<TargetIcon size={16} />}
              >
                <div className="qz-quick-row">
                  <QuickButton
                    icon={<NoteIcon size={14} />}
                    label="View Related Note"
                    onClick={() => {
                      if (note) setView({ kind: "note", noteId: note.id });
                    }}
                    disabled={!note}
                  />
                  <QuickButton
                    icon={<SparklesIcon size={14} />}
                    label="Ask AI"
                    onClick={() => {
                      if (cls) setView({ kind: "classAsk", classId: cls.id });
                    }}
                    disabled={!cls}
                  />
                  <QuickButton
                    icon={<WarningIcon size={14} />}
                    label="Report Issue"
                    onClick={() => {
                      window.alert(
                        "Thanks — we'll log this question for review.",
                      );
                    }}
                  />
                </div>
              </HelperCard>
            </div>
          </div>
        </div>
      </main>

      <QuizDetailRail
        variant="session"
        quizId={quiz.id}
        sessionStats={sessionStats}
        currentQuestion={current}
        onExplainQuestion={() => {
          if (current?.explanation) {
            setHintOpen(true);
          }
        }}
        onSummarizeWeakTopics={() => {
          if (cls) setView({ kind: "classAsk", classId: cls.id });
        }}
        onMakeReviewSet={() => {
          if (note) setView({ kind: "note", noteId: note.id });
        }}
        onAskQuiz={() => {
          if (cls) setView({ kind: "classAsk", classId: cls.id });
        }}
      />
    </>
  );
};

/* ============================================================ */
/* Results                                                      */
/* ============================================================ */

interface ResultsProps {
  quiz: QuizRow;
  questions: QuizQuestionRow[];
  cls: ClassRow | null;
  note: NoteRow | null;
  onRetake: () => void;
  onReview: () => void;
}

const ResultsView: FC<ResultsProps> = ({
  quiz,
  questions,
  cls,
  note,
  onRetake,
  onReview,
}) => {
  const setView = useApp((s) => s.setView);
  const syncStatus = useApp((s) => s.syncStatus);

  const [attempts, setAttempts] = useState<QuizAttemptRow[]>([]);
  const [perf, setPerf] = useState<TopicPerformance[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      quizAttemptsForQuiz(quiz.id),
      topicPerformance(quiz.id),
    ]).then(([atts, p]) => {
      setAttempts(atts.filter((a) => a.completed === 1));
      setPerf(p);
    });
  }, [quiz.id]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const latest = attempts[0] ?? null;

  const wrong = useMemo(() => {
    if (!latest) return [];
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(latest.answers_json) as Record<string, string>;
    } catch {
      /* drop */
    }
    return questions
      .map((q) => ({
        question: q,
        given: parsed[q.id] ?? "",
        correct: (parsed[q.id] ?? "").trim().toLowerCase() ===
          q.correct_answer.trim().toLowerCase(),
      }))
      .filter((r) => !r.correct);
  }, [latest, questions]);

  const score = latest?.score ?? 0;
  const total = latest?.total ?? questions.length;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const timeSpent = latest?.time_spent_seconds ?? 0;
  const weakTopics = useMemo(() => {
    if (!latest?.weak_topics_json) return [] as string[];
    try {
      const v = JSON.parse(latest.weak_topics_json) as unknown;
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
    } catch {
      /* drop */
    }
    return [];
  }, [latest]);

  async function generateFlashcards(): Promise<void> {
    if (wrong.length === 0) {
      setToast("Nothing to turn into flashcards — perfect score!");
      return;
    }
    setBusy("flash");
    try {
      const deck = await upsertFlashcardSet({
        title: `${quiz.title} · review cards`,
        note_id: quiz.note_id ?? null,
      });
      for (const r of wrong) {
        await upsertFlashcard({
          set_id: deck.id,
          front: r.question.question,
          back: r.question.correct_answer,
        });
      }
      setView({ kind: "flashcardSet", setId: deck.id });
    } catch {
      setToast("Couldn't generate flashcards.");
    } finally {
      setBusy(null);
    }
  }

  async function addToStudyPlan(): Promise<void> {
    setBusy("plan");
    try {
      const at = new Date();
      at.setHours(at.getHours() + 1, 0, 0, 0);
      const topics = weakTopics.length > 0 ? weakTopics : [quiz.title];
      for (const t of topics.slice(0, 3)) {
        await upsertStudyTask({
          id: ulid("tsk"),
          title: `Review: ${t}`,
          type: "review",
          scheduled_for: at.toISOString(),
          duration_minutes: 20,
          note_id: quiz.note_id ?? null,
        });
        at.setHours(at.getHours() + 1);
      }
      setToast("Added review blocks to your study plan.");
    } catch {
      setToast("Couldn't add to your study plan.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <main className="main">
        <div className="topbar">
          <button
            className="btn-ghost"
            onClick={() =>
              withViewTransition(() =>
                useApp.getState().setView({ kind: "quizzes" }),
              )
            }
          >
            <ArrowLeftIcon size={14} /> Quizzes
          </button>
          <span style={{ flex: 1 }} />
          <SyncPill status={syncStatus} />
        </div>
        <div className="main-inner">
          <div className="quiz-take-shell">
            <section className="hero quiz-hero">
              <div className="hero-main">
                <Breadcrumb cls={cls} quiz={quiz} suffix="Results" />
                <div className="hero-greeting">
                  <h1 className="hero-headline">Quiz Results</h1>
                  <p>Here's how you did. Review what you missed and turn gaps into wins.</p>
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

            <section className="qz-result-summary">
              <div className="qz-result-ring">
                <Donut
                  segments={[
                    { value: pct, color: "var(--color-primary)" },
                    {
                      value: Math.max(0, 100 - pct),
                      color: "var(--color-surfaceMuted)",
                    },
                  ]}
                  size={148}
                  thickness={14}
                >
                  <span className="donut-num">{pct}%</span>
                  <span className="donut-unit">score</span>
                </Donut>
              </div>
              <div className="qz-result-stats">
                <KvStat label="Score" value={`${score} / ${total}`} />
                <KvStat
                  label="Correct"
                  value={`${score} of ${total}`}
                />
                <KvStat
                  label="Time"
                  value={fmtMinSec(timeSpent)}
                />
                <KvStat
                  label="Attempts"
                  value={attempts.length}
                />
              </div>
              <div className="qz-result-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onRetake}
                >
                  Retake Quiz
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onReview}
                  disabled={wrong.length === 0}
                >
                  Review Wrong Answers
                </button>
              </div>
            </section>

            <section className="qz-result-block">
              <header className="qz-result-block-head">
                <h2>Performance by topic</h2>
              </header>
              {perf.length === 0 ? (
                <p className="qz-result-empty">
                  Add topics to your questions to see a breakdown here.
                </p>
              ) : (
                <ul className="qz-topic-bars">
                  {perf.map((t) => (
                    <li key={t.topic} className="qz-topic-bar">
                      <span className="qz-topic-name">{t.topic}</span>
                      <span className="qz-topic-track">
                        <span
                          className="qz-topic-fill"
                          style={{ width: `${t.pct}%` }}
                        />
                      </span>
                      <span className="qz-topic-pct">
                        {t.correct}/{t.total} · {t.pct}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {wrong.length > 0 && (
              <section className="qz-result-block">
                <header className="qz-result-block-head">
                  <h2>Wrong answers</h2>
                </header>
                <ul className="qz-wrong-list">
                  {wrong.slice(0, 6).map((r) => (
                    <li key={r.question.id} className="qz-wrong-item">
                      <div className="qz-wrong-q">
                        <span className="qz-wrong-eyebrow">
                          {r.question.topic ?? "Question"}
                        </span>
                        <p>{r.question.question}</p>
                      </div>
                      <div className="qz-wrong-rows">
                        <span className="qz-wrong-row wrong">
                          <span className="qz-wrong-tag">Your answer</span>
                          <span>{r.given || "(skipped)"}</span>
                        </span>
                        <span className="qz-wrong-row right">
                          <span className="qz-wrong-tag">Correct</span>
                          <span>{r.question.correct_answer}</span>
                        </span>
                        {r.question.explanation && (
                          <span className="qz-wrong-row hint">
                            <span className="qz-wrong-tag">Why</span>
                            <span>{r.question.explanation}</span>
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="qz-result-block">
              <header className="qz-result-block-head">
                <h2>Recommended next steps</h2>
              </header>
              <div className="qz-next-grid">
                <NextCard
                  icon={<TargetIcon size={16} />}
                  title="Review Wrong Answers"
                  caption="Step through what you missed."
                  onClick={onReview}
                  disabled={wrong.length === 0}
                />
                <NextCard
                  icon={<FlashcardIcon size={16} />}
                  title="Generate Flashcards from Mistakes"
                  caption={`${wrong.length} ${wrong.length === 1 ? "card" : "cards"}`}
                  onClick={() => void generateFlashcards()}
                  busy={busy === "flash"}
                  disabled={wrong.length === 0}
                />
                <NextCard
                  icon={<CalendarIcon size={16} />}
                  title="Add Weak Topics to Study Plan"
                  caption={
                    weakTopics.length > 0
                      ? `${weakTopics.length} topic${weakTopics.length === 1 ? "" : "s"}`
                      : "Schedule a review block"
                  }
                  onClick={() => void addToStudyPlan()}
                  busy={busy === "plan"}
                />
                <NextCard
                  icon={<SparklesIcon size={16} />}
                  title="Ask AI for Help"
                  caption={cls ? `In ${cls.name}` : "Open class chat"}
                  onClick={() => {
                    if (cls) setView({ kind: "classAsk", classId: cls.id });
                  }}
                  disabled={!cls}
                />
              </div>
            </section>
          </div>
          {toast && <div className="quiz-toast">{toast}</div>}
        </div>
      </main>

      <QuizDetailRail
        variant="results"
        quizId={quiz.id}
        resultsStats={{
          score,
          total,
          pct,
          timeSpentSeconds: timeSpent,
          weakTopics,
        }}
        onSummarizeWeakTopics={() => {
          if (cls) setView({ kind: "classAsk", classId: cls.id });
        }}
        onMakeReviewSet={() => void generateFlashcards()}
        onAskQuiz={() => {
          if (cls) setView({ kind: "classAsk", classId: cls.id });
        }}
      />
    </>
  );
};

/* ============================================================ */
/* Review (only missed)                                         */
/* ============================================================ */

interface ReviewProps {
  quiz: QuizRow;
  questions: QuizQuestionRow[];
  cls: ClassRow | null;
  note: NoteRow | null;
  onBack: () => void;
}

const ReviewView: FC<ReviewProps> = ({ quiz, questions, cls, note, onBack }) => {
  const setView = useApp((s) => s.setView);
  const syncStatus = useApp((s) => s.syncStatus);

  const [latest, setLatest] = useState<QuizAttemptRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void quizAttemptsForQuiz(quiz.id).then((atts) => {
      setLatest(atts.find((a) => a.completed === 1) ?? null);
    });
  }, [quiz.id]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const wrong = useMemo(() => {
    if (!latest) return [];
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(latest.answers_json) as Record<string, string>;
    } catch {
      /* drop */
    }
    return questions.filter((q) => {
      const a = (parsed[q.id] ?? "").trim().toLowerCase();
      return a !== q.correct_answer.trim().toLowerCase();
    }).map((q) => ({ question: q, given: parsed[q.id] ?? "" }));
  }, [latest, questions]);

  async function turnIntoFlashcard(q: QuizQuestionRow): Promise<void> {
    try {
      const deck = await upsertFlashcardSet({
        title: `${quiz.title} · review cards`,
        note_id: quiz.note_id ?? null,
      });
      await upsertFlashcard({
        set_id: deck.id,
        front: q.question,
        back: q.correct_answer,
      });
      setToast("Added to flashcards.");
    } catch {
      setToast("Couldn't add to flashcards.");
    }
  }

  return (
    <>
      <main className="main">
        <div className="topbar">
          <button className="btn-ghost" onClick={onBack}>
            <ArrowLeftIcon size={14} /> Results
          </button>
          <span style={{ flex: 1 }} />
          <SyncPill status={syncStatus} />
        </div>
        <div className="main-inner">
          <div className="quiz-take-shell">
            <section className="hero quiz-hero">
              <div className="hero-main">
                <Breadcrumb cls={cls} quiz={quiz} suffix="Review" />
                <div className="hero-greeting">
                  <h1 className="hero-headline">Review missed questions</h1>
                  <p>Walk through each question you missed and turn it into a flashcard.</p>
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

            {wrong.length === 0 ? (
              <div className="qz-empty">
                <CheckIcon size={28} />
                <p>No missed questions on the latest attempt — nice work.</p>
              </div>
            ) : (
              <ul className="qz-review-list">
                {wrong.map((r, i) => (
                  <li key={r.question.id} className="qz-review-item">
                    <header className="qz-review-head">
                      <span className="qz-review-eyebrow">
                        Missed {i + 1} of {wrong.length}
                      </span>
                      {r.question.topic && (
                        <span className="rail-chip rail-chip-rose">
                          {r.question.topic}
                        </span>
                      )}
                    </header>
                    <p className="qz-review-question">{r.question.question}</p>
                    <div className="qz-review-rows">
                      <span className="qz-wrong-row wrong">
                        <span className="qz-wrong-tag">Your answer</span>
                        <span>{r.given || "(skipped)"}</span>
                      </span>
                      <span className="qz-wrong-row right">
                        <span className="qz-wrong-tag">Correct</span>
                        <span>{r.question.correct_answer}</span>
                      </span>
                      {r.question.explanation && (
                        <span className="qz-wrong-row hint">
                          <span className="qz-wrong-tag">Why</span>
                          <span>{r.question.explanation}</span>
                        </span>
                      )}
                    </div>
                    <div className="qz-review-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          if (note) setView({ kind: "note", noteId: note.id });
                        }}
                        disabled={!note}
                      >
                        <NoteIcon size={12} /> Open source note
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => void turnIntoFlashcard(r.question)}
                      >
                        <FlashcardIcon size={12} /> Turn into flashcard
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {toast && <div className="quiz-toast">{toast}</div>}
        </div>
      </main>

      <QuizDetailRail variant="results" quizId={quiz.id} />
    </>
  );
};

/* ============================================================ */
/* Shared bits                                                  */
/* ============================================================ */

interface BreadcrumbProps {
  cls: ClassRow | null;
  quiz: QuizRow;
  suffix?: string;
}

const Breadcrumb: FC<BreadcrumbProps> = ({ cls, quiz, suffix }) => {
  const setView = useApp((s) => s.setView);
  return (
    <div className="qz-breadcrumb" aria-label="Breadcrumb">
      <button
        type="button"
        className="qz-breadcrumb-link"
        onClick={() => setView({ kind: "quizzes" })}
      >
        Quizzes
      </button>
      <span aria-hidden> / </span>
      {cls ? (
        <button
          type="button"
          className="qz-breadcrumb-link"
          onClick={() => setView({ kind: "classView", classId: cls.id })}
        >
          {cls.name}
        </button>
      ) : (
        <span>Library</span>
      )}
      <span aria-hidden> / </span>
      <span>{suffix ? `${quiz.title} · ${suffix}` : quiz.title}</span>
    </div>
  );
};

interface MetaChipsProps {
  cls: ClassRow | null;
  quiz: QuizRow;
  total: number;
  index: number;
  syncStatus: string;
}

const MetaChips: FC<MetaChipsProps> = ({ cls, quiz, total, index, syncStatus }) => {
  const tone = cls ? toneFor(cls) : "sage";
  return (
    <div className="qz-meta-chips">
      <span className={`qz-meta-chip tone-${tone}`}>
        {cls ? (
          <>
            <span className="qz-meta-chip-icon">{iconFor(cls, 14)}</span>
            <span>{cls.name}</span>
          </>
        ) : (
          <>
            <QuizIcon size={14} />
            <span>Library</span>
          </>
        )}
      </span>
      <span className="qz-meta-chip tone-sage">
        <BookmarkIcon size={14} />
        <span>{quiz.title}</span>
      </span>
      <span className="qz-meta-chip tone-sky">
        <QuizIcon size={14} />
        <span>{total} questions</span>
      </span>
      <span className="qz-meta-chip tone-lilac">
        <ArrowRightIcon size={14} />
        <span>
          Question {Math.min(index + 1, Math.max(1, total))} of {total}
        </span>
      </span>
      <span
        className={`qz-meta-chip tone-${syncStatus === "offline" ? "rose" : "sage"}`}
      >
        {syncStatus === "offline" ? (
          <CloudOffIcon size={14} />
        ) : (
          <CloudCheckIcon size={14} />
        )}
        <span>{syncStatus === "offline" ? "Offline" : "Synced"}</span>
      </span>
    </div>
  );
};

interface QuestionCardProps {
  question: QuizQuestionRow;
  index: number;
  total: number;
  given: string | undefined;
  shortInput: string;
  setShortInput: (v: string) => void;
  onSelect: (value: string) => void;
  showFeedback: boolean;
  hintOpen: boolean;
}

const QuestionCard: FC<QuestionCardProps> = ({
  question,
  index,
  total,
  given,
  shortInput,
  setShortInput,
  onSelect,
  showFeedback,
}) => {
  const correct = question.correct_answer.trim().toLowerCase();
  function optClasses(value: string): string {
    const out = ["qz-option"];
    const norm = value.trim().toLowerCase();
    const sel = (given ?? "").trim().toLowerCase();
    if (sel === norm) out.push("active");
    if (showFeedback) {
      if (norm === correct) out.push("correct");
      else if (sel === norm) out.push("wrong");
    }
    return out.join(" ");
  }

  return (
    <div className="qz-question-card">
      <span className="qz-question-eyebrow">
        Question {index + 1} of {total}
      </span>
      <h2 className="qz-question-prompt">{question.question}</h2>
      <p className="qz-question-helper">
        {question.type === "short_answer"
          ? "Type your answer in your own words."
          : question.type === "true_false"
          ? "Pick true or false."
          : "Select the best answer."}
      </p>

      {question.type === "multiple_choice" && (
        <div className="qz-options">
          {parseOptions(question.options_json).map((opt, i) => (
            <button
              type="button"
              key={`${question.id}-${i}`}
              className={optClasses(opt)}
              onClick={() => onSelect(opt)}
              disabled={showFeedback}
            >
              <span className="qz-option-letter">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="qz-option-text">{opt}</span>
            </button>
          ))}
        </div>
      )}

      {question.type === "true_false" && (
        <div className="qz-options">
          {["true", "false"].map((opt, i) => (
            <button
              type="button"
              key={opt}
              className={optClasses(opt)}
              onClick={() => onSelect(opt)}
              disabled={showFeedback}
            >
              <span className="qz-option-letter">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="qz-option-text" style={{ textTransform: "capitalize" }}>
                {opt}
              </span>
            </button>
          ))}
        </div>
      )}

      {question.type === "short_answer" && (
        <textarea
          className="qz-short-input field"
          rows={3}
          value={shortInput}
          onChange={(e) => setShortInput(e.target.value)}
          placeholder="Type your answer here…"
          disabled={showFeedback}
        />
      )}

      {showFeedback && (
        <div
          className={`qz-feedback ${
            (given ?? "").trim().toLowerCase() === correct ? "correct" : "wrong"
          }`}
        >
          {(given ?? "").trim().toLowerCase() === correct ? (
            <>
              <CheckIcon size={14} />
              <span>Correct.</span>
            </>
          ) : (
            <>
              <WarningIcon size={14} />
              <span>
                Correct answer: <strong>{question.correct_answer}</strong>
              </span>
            </>
          )}
          {question.explanation && (
            <p className="qz-feedback-explain">{question.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
};

const HelperCard: FC<{ title: string; icon: ReactNode; children: ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <div className="qz-helper-card">
    <header className="qz-helper-head">
      <span className="qz-helper-icon">{icon}</span>
      <h3>{title}</h3>
    </header>
    <div className="qz-helper-body">{children}</div>
  </div>
);

const KvStat: FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="qz-kv-stat">
    <span className="qz-kv-value">{value}</span>
    <span className="qz-kv-label">{label}</span>
  </div>
);

const QuickButton: FC<{
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, onClick, disabled }) => (
  <button
    type="button"
    className="qz-quick-btn"
    onClick={onClick}
    disabled={disabled}
  >
    <span className="qz-quick-btn-icon">{icon}</span>
    <span>{label}</span>
  </button>
);

const NextCard: FC<{
  icon: ReactNode;
  title: string;
  caption: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}> = ({ icon, title, caption, onClick, busy, disabled }) => (
  <button
    type="button"
    className="qz-next-card"
    onClick={onClick}
    disabled={busy || disabled}
  >
    <span className="qz-next-icon">{icon}</span>
    <span className="qz-next-text">
      <span className="qz-next-title">{busy ? "Working…" : title}</span>
      <span className="qz-next-caption">{caption}</span>
    </span>
    <ArrowRightIcon size={12} />
  </button>
);

const SyncPill: FC<{ status: string }> = ({ status }) => (
  <span
    className={`pill ${status === "offline" ? "pill-rose" : "pill-sage"}`}
    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
  >
    {status === "offline" ? <CloudOffIcon size={12} /> : <CloudCheckIcon size={12} />}
    <span style={{ textTransform: "capitalize" }}>{status}</span>
  </span>
);

/* ============================================================ */
/* Helpers                                                      */
/* ============================================================ */

function parseOptions(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json) as unknown;
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  } catch {
    /* drop */
  }
  return [];
}

function fmtMinSec(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** Read a question aloud via the browser's speech synthesis. Stubs out
 *  cleanly when the API isn't available (Electron renderer should have
 *  it, but tests / future Linux distros may not). */
function speak(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.0;
    window.speechSynthesis.speak(utt);
  } catch {
    /* drop */
  }
}
