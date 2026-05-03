import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ClassOverviewNoteInput,
  ClassRow,
  FlashcardSetRow,
  NoteRow,
  QuizRow,
  StudyTaskRow,
} from "@studynest/shared";
import { POINTS_RULES, XP_RULES } from "@studynest/shared";
import { ai } from "../lib/ai.js";
import { BRAND_CLASS_HERO_URL } from "../lib/brand.js";
import { enqueueQuizGeneration } from "../lib/quizGenerationQueue.js";
import {
  computeProgress,
  deriveSubtitle,
  progressLabel,
  progressTone,
  shortDate,
  toneFor,
  type AccentTone,
} from "../lib/classDisplay.js";
import {
  classActivityWeek,
  classAggregates,
  flashcardSetsForClass,
  type ClassActivityDay,
  type ClassAggregate,
  listClasses,
  listFlashcards,
  listNotes,
  nextExamByClass,
  nextTaskByClass,
  quizStatsForClass,
  quizzesForClass,
  recordRewardPoints,
  recordXp,
  tasksForClass,
  upsertFlashcard,
  upsertFlashcardSet,
  upsertNote,
  upsertClass,
  upsertQuiz,
  upsertQuizQuestion,
  upsertStudyTask,
  weakTopicsForClass,
  type QuizStats,
} from "../db/repositories.js";
import { useApp } from "../store.js";
import { HeroSearch } from "./HeroSearch.js";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ChevRightIcon,
  ClockIcon,
  FileIcon,
  FlashcardIcon,
  GraduationCapIcon,
  PlusIcon,
  QuizIcon,
  SparklesIcon,
} from "./icons.js";

/* ================================================================== */
/* Types                                                              */
/* ================================================================== */

type Tab = "overview" | "notes" | "flashcards" | "quizzes" | "studyPlan";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "notes", label: "Notes" },
  { id: "flashcards", label: "Flashcards" },
  { id: "quizzes", label: "Quizzes" },
  { id: "studyPlan", label: "Study Plan" },
];

const MAX_OVERVIEW_NOTES = 48;
const MAX_OVERVIEW_CHARS_PER_NOTE = 1400;

function truncateForClassOverviewBody(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[truncated]`;
}

function notesPayloadForOverview(notes: NoteRow[]): ClassOverviewNoteInput[] {
  return notes.slice(0, MAX_OVERVIEW_NOTES).map((n) => ({
    note_id: n.id,
    title: n.title,
    summary: n.summary,
    content: truncateForClassOverviewBody(n.content_markdown, MAX_OVERVIEW_CHARS_PER_NOTE),
  }));
}

interface ClassViewProps {
  classId: string;
}

interface LoadedData {
  cls: ClassRow;
  agg: ClassAggregate;
  notes: NoteRow[];
  flashcardSets: FlashcardSetRow[];
  quizzes: QuizRow[];
  weakTopics: string[];
  weekTasks: StudyTaskRow[];
  upcoming: StudyTaskRow[];
  nextTask: StudyTaskRow | null;
  examInDays: number | null;
  quizStats: QuizStats;
  activity: ClassActivityDay[];
}

/* ================================================================== */
/* Top-level                                                          */
/* ================================================================== */

export const ClassView: FC<ClassViewProps> = ({ classId }) => {
  const setView = useApp((s) => s.setView);
  const setSelectedClass = useApp((s) => s.setSelectedClass);
  const setFocusedClass = useApp((s) => s.setFocusedClass);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const all = await listClasses();
    const cls = all.find((c) => c.id === classId);
    if (!cls) {
      setMissing(true);
      setLoading(false);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inAWeek = new Date(today);
    inAWeek.setDate(today.getDate() + 7);
    const inAMonth = new Date(today);
    inAMonth.setDate(today.getDate() + 30);

    const [
      aggMap,
      notes,
      sets,
      quizzes,
      weak,
      weekTasks,
      upcoming,
      nextTaskMap,
      examMap,
      qStats,
      activity,
    ] = await Promise.all([
      classAggregates(),
      listNotes(classId),
      flashcardSetsForClass(classId),
      quizzesForClass(classId),
      weakTopicsForClass(classId, 6),
      tasksForClass(classId, today.toISOString(), inAWeek.toISOString()),
      tasksForClass(classId, today.toISOString(), inAMonth.toISOString()),
      nextTaskByClass(),
      nextExamByClass(),
      quizStatsForClass(classId),
      classActivityWeek(classId),
    ]);

    setData({
      cls,
      agg:
        aggMap.get(classId) ?? {
          notes: 0,
          flashcards: 0,
          quizzes: 0,
          totalTasks: 0,
          completedTasks: 0,
        },
      notes,
      flashcardSets: sets,
      quizzes,
      weakTopics: weak,
      weekTasks,
      upcoming,
      nextTask: nextTaskMap.get(classId) ?? null,
      examInDays: examMap.get(classId)?.days ?? null,
      quizStats: qStats,
      activity,
    });
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    setLoading(true);
    setMissing(false);
    void reload();
  }, [reload]);

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ---- nav helpers -------------------------------------------------

  const goBack = useCallback(() => {
    setView({ kind: "classes" });
  }, [setView]);

  const goAsk = useCallback(() => {
    setView({ kind: "classAsk", classId });
  }, [classId, setView]);

  const openNote = useCallback(
    (n: NoteRow) => {
      setSelectedNote(n);
      setView({ kind: "note", noteId: n.id });
    },
    [setSelectedNote, setView],
  );

  const newNote = useCallback(async () => {
    setSelectedClass(classId);
    setFocusedClass(classId);
    const note = await upsertNote({
      title: "Untitled",
      content_markdown: "",
      class_id: classId,
    });
    await recordXp("createNote", XP_RULES.createNote);
    setSelectedNote(note);
    setView({ kind: "note", noteId: note.id });
  }, [classId, setFocusedClass, setSelectedClass, setSelectedNote, setView]);

  // ---- AI tools ----------------------------------------------------

  const runSummarize = useCallback(async () => {
    if (!data) return;
    const target =
      data.notes.find((n) => !n.summary || n.summary.trim() === "") ??
      data.notes[0];
    if (!target) {
      setToast(`Add a note to ${data.cls.name} first.`);
      return;
    }
    setAiBusy("summarize");
    try {
      const res = await ai.summarize({
        note_id: target.id,
        title: target.title,
        content: target.content_markdown,
      });
      await upsertNote({ ...target, summary: res.summary });
      setToast(`Summary saved for “${target.title}”.`);
      await reload();
    } catch {
      setToast("The assistant isn’t responding right now. Try again in a moment.");
    } finally {
      setAiBusy(null);
    }
  }, [data, reload]);

  const runMakeQuiz = useCallback(async () => {
    if (!data) return;
    const target = data.notes[0];
    if (!target) {
      setToast(`Add a note to ${data.cls.name} first.`);
      return;
    }
    setAiBusy("quiz");
    try {
      await enqueueQuizGeneration(`Class quiz: ${data.cls.name}`, async () => {
        const res = await ai.quiz({
          note_id: target.id,
          title: target.title,
          content: target.content_markdown,
        });
        const quiz = await upsertQuiz({
          title: `${data.cls.name} review`,
          note_id: target.id,
          class_id: data.cls.id,
          description: `Exam review generated from “${target.title}”.`,
          source_type: "class",
          source_ids_json: JSON.stringify(data.notes.map((n) => n.id)),
          tags_json: JSON.stringify(["Exam Review", "Class"]),
        });
        let position = 0;
        for (const q of res.questions) {
          await upsertQuizQuestion({
            quiz_id: quiz.id,
            type: q.type,
            question: q.question,
            options_json:
              q.type === "multiple_choice" ? JSON.stringify(q.options) : null,
            correct_answer: String(q.answer),
            explanation: q.explanation ?? null,
            source_note_id: target.id,
            position: position++,
          });
        }
      });
      setToast(`Exam review created from “${target.title}”.`);
      await reload();
    } catch {
      setToast("The assistant isn’t responding right now. Try again in a moment.");
    } finally {
      setAiBusy(null);
    }
  }, [data, reload]);

  const runStudyPlan = useCallback(() => {
    if (!data) return;
    // Anchor the focus filter so the resulting study plan and the
    // existing right-panel widgets (Today's Plan, Upcoming Deadlines)
    // are scoped to this class.
    setFocusedClass(classId);
    setView({ kind: "calendar" });
    // Defer opening the generator until after the calendar mounts
    // so the modal renders on top of the new view rather than the
    // current ClassView.
    queueMicrotask(() => {
      useApp.getState().setCalendarPlanGeneratorOpen(true);
    });
  }, [classId, data, setFocusedClass, setView]);


  const runRegenerateOverview = useCallback(async () => {
    if (!data) return;
    if (!data.notes.length) {
      setToast(`Add at least one note to ${data.cls.name} first.`);
      return;
    }
    setAiBusy("overview");
    try {
      const res = await ai.classOverview({
        class_name: data.cls.name,
        class_subtitle: deriveSubtitle(data.cls),
        notes: notesPayloadForOverview(data.notes),
      });
      const overview = res.overview.trim();
      if (!overview) {
        setToast("Couldn't generate an overview. Try again.");
        return;
      }
      await upsertClass({ ...data.cls, overview_text: overview });
      setToast("Class overview updated.");
      await reload();
    } catch {
      setToast("The assistant isn’t responding right now. Try again in a moment.");
    } finally {
      setAiBusy(null);
    }
  }, [data, reload]);

  const runMakeFlashcards = useCallback(async () => {
    if (!data) return;
    const target = data.notes[0];
    if (!target) {
      setToast(`Add a note to ${data.cls.name} first.`);
      return;
    }
    setAiBusy("flashcards");
    try {
      const res = await ai.flashcards({
        note_id: target.id,
        title: target.title,
        content: target.content_markdown,
      });
      const set = await upsertFlashcardSet({
        title: `${data.cls.name} cards`,
        note_id: target.id,
      });
      for (const c of res.cards) {
        await upsertFlashcard({ set_id: set.id, front: c.front, back: c.back });
      }
      await recordXp("generateFlashcards", XP_RULES.generateFlashcards);
      setToast(`${res.cards.length} flashcards added to ${data.cls.name}.`);
      await reload();
    } catch {
      setToast("The assistant isn’t responding right now. Try again in a moment.");
    } finally {
      setAiBusy(null);
    }
  }, [data, reload]);

  // ---- render ------------------------------------------------------

  if (missing) {
    return (
      <main className="main">
        <div className="main-inner">
          <button type="button" className="crumb-back" onClick={goBack}>
            <ArrowLeftIcon size={14} /> Back to Classes
          </button>
          <section className="classes-empty">
            <span className="classes-empty-icon" aria-hidden>
              <GraduationCapIcon size={28} />
            </span>
            <h2>Class not found</h2>
            <p>It may have been removed or hasn't synced to this device yet.</p>
          </section>
        </div>
      </main>
    );
  }

  if (loading || !data) {
    return (
      <main className="main">
        <div className="main-inner">
          <ClassViewHeroSkeleton />
          <section className="stat-row" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="stat-card skeleton" />
            ))}
          </section>
        </div>
      </main>
    );
  }

  const tone = toneFor(data.cls);
  const subtitle = deriveSubtitle(data.cls);
  const progress = computeProgress(data.agg);
  const pTone = progressTone(progress, data.agg);
  const pLabel = progressLabel(progress, data.agg);

  return (
    <main className="main">
      <div className="main-inner">
        <ClassHero
          cls={data.cls}
          tone={tone}
          subtitle={subtitle}
          examInDays={data.examInDays}
          progressLabel={pLabel}
          progressTone={pTone}
          onBack={goBack}
        />

        <ClassKpiRow
          notes={data.agg.notes}
          flashcards={data.agg.flashcards}
          quizzes={data.agg.quizzes}
          examInDays={data.examInDays}
        />

        <ClassTabs current={tab} onChange={setTab} />

        {tab === "overview" && (
          <OverviewTab
            data={data}
            tone={tone}
            progress={progress}
            progressLabel={pLabel}
            progressTone={pTone}
            aiBusy={aiBusy}
            onOpenNote={openNote}
            onViewAllNotes={() => setTab("notes")}
            onSummarize={() => void runSummarize()}
            onMakeQuiz={() => void runMakeQuiz()}
            onMakeFlashcards={() => void runMakeFlashcards()}
            onStudyPlan={runStudyPlan}
            onAsk={goAsk}
            onRegenerateOverview={() => void runRegenerateOverview()}
            onCheckTask={async (t) => {
              await upsertStudyTask({
                ...t,
                completed_at: t.completed_at
                  ? null
                  : new Date().toISOString(),
              });
              if (!t.completed_at) {
                await recordXp("studyTaskComplete", XP_RULES.studyTaskComplete);
                await recordRewardPoints("finishStudyTask", POINTS_RULES.finishStudyTask);
              }
              await reload();
            }}
          />
        )}

        {tab === "notes" && (
          <NotesTab
            cls={data.cls}
            notes={data.notes}
            onOpen={openNote}
            onNew={() => void newNote()}
          />
        )}

        {tab === "flashcards" && (
          <FlashcardsTab
            cls={data.cls}
            sets={data.flashcardSets}
            onOpen={(setId) => setView({ kind: "flashcardSet", setId })}
            onMake={() => void runMakeFlashcards()}
            busy={aiBusy === "flashcards"}
          />
        )}

        {tab === "quizzes" && (
          <QuizzesTab
            cls={data.cls}
            quizzes={data.quizzes}
            stats={data.quizStats}
            onOpen={(quizId) => setView({ kind: "quiz", quizId })}
            onMake={() => void runMakeQuiz()}
            busy={aiBusy === "quiz"}
          />
        )}

        {tab === "studyPlan" && (
          <StudyPlanTab
            cls={data.cls}
            tasks={data.upcoming}
            onCheck={async (t) => {
              await upsertStudyTask({
                ...t,
                completed_at: t.completed_at ? null : new Date().toISOString(),
              });
              if (!t.completed_at) {
                await recordXp("studyTaskComplete", XP_RULES.studyTaskComplete);
                await recordRewardPoints("finishStudyTask", POINTS_RULES.finishStudyTask);
              }
              await reload();
            }}
            onPlan={runStudyPlan}
          />
        )}
      </div>

      {toast && (
        <div className="classes-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
};

/* ================================================================== */
/* Hero (search + breadcrumbs + headline + pills + illustration)      */
/* ================================================================== */

const ClassHero: FC<{
  cls: ClassRow;
  tone: AccentTone;
  subtitle: string | null;
  examInDays: number | null;
  progressLabel: string;
  progressTone: "success" | "warning";
  onBack: () => void;
}> = ({ cls, tone, subtitle, examInDays, progressLabel, progressTone, onBack }) => {
  return (
    <section className="hero">
      <div className="hero-main">
        <HeroSearch />
        <Breadcrumbs
          trail={[
            { label: "Classes", onClick: onBack },
            { label: cls.name },
          ]}
        />
        <div className="hero-greeting classview-hero-text">
          <h1 className="hero-headline">{cls.name}</h1>
          <p>{subtitle ?? "Course"}</p>
          <div className="classview-pill-row">
            <span className={`classview-pill tone-${tone}`}>Lecture</span>
            {examInDays !== null && (
              <span
                className={`classview-pill tone-${
                  examInDays <= 3 ? "danger" : "amber"
                }`}
              >
                {examInDays <= 0 ? "Exam today" : `Exam in ${examInDays}d`}
              </span>
            )}
            <span
              className={`classview-pill tone-${
                progressTone === "warning" ? "warning" : "success"
              }`}
            >
              {progressLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="hero-illustration" aria-hidden>
        <img
          className="hero-illustration-img"
          src={BRAND_CLASS_HERO_URL}
          alt=""
          decoding="async"
        />
      </div>
    </section>
  );
};

const ClassViewHeroSkeleton: FC = () => (
  <section className="hero" aria-hidden>
    <div className="hero-main">
      <div className="search skeleton-bar" style={{ height: 36 }} />
      <div className="hero-greeting">
        <div className="skeleton-bar" style={{ width: 220, height: 32 }} />
        <div className="skeleton-bar" style={{ width: 280, height: 14 }} />
      </div>
    </div>
  </section>
);

/* ================================================================== */
/* Breadcrumbs                                                        */
/* ================================================================== */

interface Crumb {
  label: string;
  onClick?: () => void;
}

export const Breadcrumbs: FC<{ trail: Crumb[] }> = ({ trail }) => (
  <nav className="crumbs" aria-label="Breadcrumb">
    {trail.map((c, i) => {
      const isLast = i === trail.length - 1;
      return (
        <span key={`${c.label}-${i}`} className="crumb-item">
          {!isLast && c.onClick ? (
            <button
              type="button"
              className="crumb crumb-link"
              onClick={c.onClick}
            >
              {c.label}
            </button>
          ) : (
            <span className={`crumb${isLast ? " crumb-current" : ""}`}>
              {c.label}
            </span>
          )}
          {!isLast && (
            <span className="crumb-sep" aria-hidden>
              /
            </span>
          )}
        </span>
      );
    })}
  </nav>
);

/* ================================================================== */
/* KPI stat row                                                       */
/* ================================================================== */

const ClassKpiRow: FC<{
  notes: number;
  flashcards: number;
  quizzes: number;
  examInDays: number | null;
}> = ({ notes, flashcards, quizzes, examInDays }) => (
  <section className="stat-row" aria-label="Class metrics">
    <KpiCard
      icon={<FileIcon size={18} />}
      tone="sky"
      number={notes.toString()}
      label="Notes"
    />
    <KpiCard
      icon={<FlashcardIcon size={18} />}
      tone="sage"
      number={flashcards.toString()}
      label="Flashcards"
    />
    <KpiCard
      icon={<QuizIcon size={18} />}
      tone="lilac"
      number={quizzes.toString()}
      label="Quizzes"
    />
    <KpiCard
      icon={<CalendarIcon size={18} />}
      tone="peach"
      number={examInDays === null ? "—" : `${examInDays}d`}
      label={examInDays === null ? "No exam set" : "Exam in"}
    />
  </section>
);

const KpiCard: FC<{
  icon: ReactNode;
  tone: AccentTone;
  number: string;
  label: string;
}> = ({ icon, tone, number, label }) => (
  <div className="stat-card">
    <span className={`stat-icon tone-${tone}`} aria-hidden>
      {icon}
    </span>
    <div className="stat-text">
      <span className="stat-number">{number}</span>
      <span className="stat-label">{label}</span>
    </div>
  </div>
);

/* ================================================================== */
/* Tabs                                                               */
/* ================================================================== */

const ClassTabs: FC<{ current: Tab; onChange: (t: Tab) => void }> = ({
  current,
  onChange,
}) => (
  <div className="classview-tabs" role="tablist" aria-label="Class sections">
    {TABS.map((t) => (
      <button
        key={t.id}
        type="button"
        role="tab"
        aria-selected={current === t.id}
        className={`classview-tab${current === t.id ? " is-active" : ""}`}
        onClick={() => onChange(t.id)}
      >
        {t.label}
      </button>
    ))}
  </div>
);

/* ================================================================== */
/* Overview tab                                                       */
/* ================================================================== */

interface OverviewProps {
  data: LoadedData;
  tone: AccentTone;
  progress: number;
  progressLabel: string;
  progressTone: "success" | "warning";
  aiBusy: string | null;
  onOpenNote: (n: NoteRow) => void;
  onViewAllNotes: () => void;
  onSummarize: () => void;
  onMakeQuiz: () => void;
  onMakeFlashcards: () => void;
  onStudyPlan: () => void;
  onAsk: () => void;
  onRegenerateOverview: () => void;
  onCheckTask: (t: StudyTaskRow) => Promise<void>;
}

const OverviewTab: FC<OverviewProps> = ({
  data,
  tone,
  progress,
  progressLabel,
  progressTone,
  aiBusy,
  onOpenNote,
  onViewAllNotes,
  onSummarize,
  onMakeQuiz,
  onMakeFlashcards,
  onStudyPlan,
  onAsk,
  onRegenerateOverview,
  onCheckTask,
}) => {
  const description = useMemo(() => {
    const saved = data.cls.overview_text?.trim();
    if (saved) return saved;
    const summary = data.notes.find(
      (n) => n.summary && n.summary.trim().length > 0,
    )?.summary;
    return (
      summary ??
      deriveSubtitle(data.cls) ??
      "Track every note, flashcard, and quiz you create for this course in one workspace. Open notes to add new study material or generate AI study tools below."
    );
  }, [data]);

  const upcoming = useMemo(
    () => data.weekTasks.filter((t) => !t.completed_at).slice(0, 4),
    [data.weekTasks],
  );

  const recentNotes = data.notes.slice(0, 4);

  return (
    <div className="classview-overview">
      {/* Row 1 — overview + recent notes */}
      <section className="classview-row classview-row--two">
        <article className="classview-card">
          <div className="classview-card-head">
            <span className={`classview-head-icon tone-${tone}`} aria-hidden>
              <BookIconAlt />
            </span>
            <h3>Class Overview</h3>
            <button
              type="button"
              className="classview-overview-regenerate"
              onClick={onRegenerateOverview}
              disabled={!!aiBusy || data.notes.length === 0}
              title="Regenerate a short AI overview from all notes in this class"
            >
              <SparklesIcon size={14} aria-hidden />
              {aiBusy === "overview" ? "Generating…" : "Regenerate"}
            </button>
          </div>
          <p className="classview-card-body">{description}</p>
          <div className="classview-progress">
            <div className="classview-progress-row">
              <span className={`progress-label tone-${progressTone}`}>
                Study Progress
              </span>
              <span className="progress-value">{progress}%</span>
            </div>
            <div className="progress-bar">
              <span
                className={`progress-fill tone-${tone}`}
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
            <div className="classview-progress-foot">
              <CalendarIcon size={13} />
              <span>
                {data.nextTask
                  ? `Next milestone: ${data.nextTask.title}`
                  : `Status: ${progressLabel}`}
              </span>
            </div>
          </div>
        </article>

        <article className="classview-card">
          <div className="classview-card-head">
            <span className="classview-head-icon tone-sky" aria-hidden>
              <FileIcon size={16} />
            </span>
            <h3>Recent Notes</h3>
            <button
              type="button"
              className="classview-card-link"
              onClick={onViewAllNotes}
            >
              View all
            </button>
          </div>
          {recentNotes.length === 0 ? (
            <p className="classview-empty">
              No notes yet — open the Notes tab to create your first one.
            </p>
          ) : (
            <ul className="classview-note-list">
              {recentNotes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="classview-note-row"
                    onClick={() => onOpenNote(n)}
                  >
                    <span className="classview-note-icon" aria-hidden>
                      <FileIcon size={14} />
                    </span>
                    <span className="classview-note-title">
                      {n.title || "Untitled"}
                    </span>
                    <span className="classview-note-date">
                      {shortDate(n.updated_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {/* Row 2 — upcoming work + weak topics + study tools */}
      <section className="classview-row classview-row--three">
        <article className="classview-card">
          <div className="classview-card-head">
            <span className="classview-head-icon tone-amber" aria-hidden>
              <ClockIcon size={16} />
            </span>
            <h3>Upcoming Work</h3>
          </div>
          {upcoming.length === 0 ? (
            <p className="classview-empty">
              Nothing scheduled this week. Generate a plan with AI below.
            </p>
          ) : (
            <ul className="classview-task-list">
              {upcoming.map((t) => (
                <li key={t.id} className="classview-task-row">
                  <button
                    type="button"
                    className={`plan-check${t.completed_at ? " done" : ""}`}
                    aria-label={
                      t.completed_at
                        ? "Mark task incomplete"
                        : "Mark task complete"
                    }
                    onClick={() => void onCheckTask(t)}
                  >
                    {t.completed_at && <CheckIcon size={11} />}
                  </button>
                  <span className="classview-task-title">{t.title}</span>
                  <span className="classview-task-when">
                    {dueDayLabel(t.scheduled_for)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="classview-card">
          <div className="classview-card-head">
            <span className="classview-head-icon tone-peach" aria-hidden>
              <SparklesIcon size={16} />
            </span>
            <h3>Weak Topics</h3>
          </div>
          {data.weakTopics.length === 0 ? (
            <p className="classview-empty">
              Rate flashcards as “hard” to surface them as weak topics here.
            </p>
          ) : (
            <div className="weak-topic-row classview-weak-row">
              {data.weakTopics.map((t) => (
                <span key={t} className="weak-topic">
                  {t}
                </span>
              ))}
            </div>
          )}
        </article>

        <article className="classview-card">
          <div className="classview-card-head">
            <span className="classview-head-icon tone-lilac" aria-hidden>
              <SparklesIcon size={16} />
            </span>
            <h3>Study Tools</h3>
          </div>
          <div className="classview-tools-grid">
            <ToolButton
              tone="sky"
              icon={<SparklesIcon size={14} />}
              label="Summarize Class"
              busy={aiBusy === "summarize"}
              onClick={onSummarize}
            />
            <ToolButton
              tone="sage"
              icon={<CheckIcon size={14} />}
              label="Make Exam Review"
              busy={aiBusy === "quiz"}
              onClick={onMakeQuiz}
            />
            <ToolButton
              tone="amber"
              icon={<FlashcardIcon size={14} />}
              label="Generate Flashcards"
              busy={aiBusy === "flashcards"}
              onClick={onMakeFlashcards}
            />
            <ToolButton
              tone="lilac"
              icon={<CalendarIcon size={14} />}
              label="Generate Study Plan"
              onClick={onStudyPlan}
            />
            <ToolButton
              tone="peach"
              icon={<SparklesIcon size={14} />}
              label="Ask This Class"
              onClick={onAsk}
              wide
            />
          </div>
        </article>
      </section>

      {/* Row 3 — class activity */}
      <section className="classview-card classview-activity-card">
        <div className="classview-card-head">
          <span className="classview-head-icon tone-sage" aria-hidden>
            <ClockIcon size={16} />
          </span>
          <h3>Class Activity</h3>
          <span className="classview-card-sub">Study Progress This Week</span>
        </div>
        <div className="classview-activity-grid">
          <ActivityChart days={data.activity} />
          <div className="classview-activity-stats">
            <ActivityStat
              icon={<FileIcon size={14} />}
              tone="sky"
              number={sumKey(data.activity, "notesUpdated").toString()}
              label="Notes Reviewed"
              trend={trendPct(data.activity, "notesUpdated")}
            />
            <ActivityStat
              icon={<FlashcardIcon size={14} />}
              tone="sage"
              number={sumKey(data.activity, "flashcardsReviewed").toString()}
              label="Flashcards Done"
              trend={trendPct(data.activity, "flashcardsReviewed")}
            />
            <ActivityStat
              icon={<QuizIcon size={14} />}
              tone="amber"
              number={
                data.quizStats.taken === 0 ? "—" : `${data.quizStats.avgPct}%`
              }
              label="Quiz Accuracy"
              trend={data.quizStats.taken === 0 ? null : data.quizStats.best - data.quizStats.avgPct}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

/* ---- activity chart ---------------------------------------------- */

const ActivityChart: FC<{ days: ClassActivityDay[] }> = ({ days }) => {
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <div className="classview-bar-chart" role="img" aria-label="Activity per day">
      {days.map((d, i) => {
        const h = Math.round((d.total / max) * 100);
        const tone: AccentTone = i % 2 === 0 ? "sage" : "lilac";
        return (
          <div key={d.date} className="classview-bar-col">
            <span
              className={`classview-bar tone-${tone}`}
              style={{ height: `${Math.max(6, h)}%` }}
              title={`${d.date}: ${d.total} actions`}
            />
            <span className="classview-bar-label">
              {dayLetter(d.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const ActivityStat: FC<{
  icon: ReactNode;
  tone: AccentTone;
  number: string;
  label: string;
  trend: number | null;
}> = ({ icon, tone, number, label, trend }) => (
  <div className="stat-card classview-activity-stat">
    <span className={`stat-icon tone-${tone}`} aria-hidden>
      {icon}
    </span>
    <div className="stat-text">
      <span className="stat-number">{number}</span>
      <span className="stat-label">{label}</span>
    </div>
    {trend !== null && (
      <span
        className={`classview-trend ${
          trend >= 0 ? "trend-up" : "trend-down"
        }`}
      >
        {trend >= 0 ? "↑" : "↓"} {Math.abs(Math.round(trend))}%
      </span>
    )}
  </div>
);

/* ---- tool button ------------------------------------------------- */

const ToolButton: FC<{
  tone: AccentTone;
  icon: ReactNode;
  label: string;
  busy?: boolean;
  wide?: boolean;
  onClick: () => void;
}> = ({ tone, icon, label, busy, wide, onClick }) => (
  <button
    type="button"
    className={`ai-action tone-${tone}${wide ? " classview-tool--wide" : ""}`}
    onClick={onClick}
    disabled={busy}
    aria-busy={busy ? true : undefined}
  >
    <span className="ai-action-icon" aria-hidden>
      {icon}
    </span>
    <span className="ai-action-label">{busy ? "Working…" : label}</span>
    <span className="ai-action-chev" aria-hidden>
      <ChevRightIcon size={14} />
    </span>
  </button>
);

/* ================================================================== */
/* Notes tab                                                          */
/* ================================================================== */

const NotesTab: FC<{
  cls: ClassRow;
  notes: NoteRow[];
  onOpen: (n: NoteRow) => void;
  onNew: () => void;
}> = ({ cls, notes, onOpen, onNew }) => (
  <section className="classview-tab-panel">
    <div className="classview-tab-toolbar">
      <div>
        <h2 className="classview-section-title">Notes for {cls.name}</h2>
        <p className="classview-section-sub">
          {notes.length} note{notes.length === 1 ? "" : "s"} in this class
        </p>
      </div>
      <button type="button" className="btn-primary" onClick={onNew}>
        <PlusIcon size={14} /> New Note
      </button>
    </div>
    {notes.length === 0 ? (
      <EmptyTabState
        icon={<FileIcon size={22} />}
        title="No notes yet"
        body="Create your first note to start building your library for this class."
        cta="New Note"
        onCta={onNew}
      />
    ) : (
      <ul className="classview-note-grid">
        {notes.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className="classview-note-card"
              onClick={() => onOpen(n)}
            >
              <span className="classview-note-card-icon">
                <FileIcon size={16} />
              </span>
              <div className="classview-note-card-body">
                <span className="classview-note-card-title">
                  {n.title || "Untitled"}
                </span>
                {n.summary && (
                  <span className="classview-note-card-summary">
                    {n.summary.slice(0, 140)}
                  </span>
                )}
                <span className="classview-note-card-meta">
                  Edited {shortDate(n.updated_at)}
                </span>
              </div>
              <ChevRightIcon size={14} />
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
);

/* ================================================================== */
/* Flashcards tab                                                     */
/* ================================================================== */

const FlashcardsTab: FC<{
  cls: ClassRow;
  sets: FlashcardSetRow[];
  onOpen: (setId: string) => void;
  onMake: () => void;
  busy: boolean;
}> = ({ cls, sets, onOpen, onMake, busy }) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, number> = {};
      await Promise.all(
        sets.map(async (s) => {
          const cards = await listFlashcards(s.id);
          map[s.id] = cards.length;
        }),
      );
      if (!cancelled) setCounts(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [sets]);

  return (
    <section className="classview-tab-panel">
      <div className="classview-tab-toolbar">
        <div>
          <h2 className="classview-section-title">Flashcards for {cls.name}</h2>
          <p className="classview-section-sub">
            {sets.length} deck{sets.length === 1 ? "" : "s"} from your notes
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={onMake}
          disabled={busy}
        >
          <SparklesIcon size={14} /> {busy ? "Working…" : "Generate with AI"}
        </button>
      </div>
      {sets.length === 0 ? (
        <EmptyTabState
          icon={<FlashcardIcon size={22} />}
          title="No flashcard decks yet"
          body="Generate a deck from any note in this class — we'll spaced-repeat them for you."
          cta="Generate with AI"
          onCta={onMake}
          ctaDisabled={busy}
        />
      ) : (
        <ul className="classview-deck-grid">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="classview-deck-card"
                onClick={() => onOpen(s.id)}
              >
                <span className="classview-deck-icon tone-sage">
                  <FlashcardIcon size={16} />
                </span>
                <div className="classview-deck-body">
                  <span className="classview-deck-title">{s.title}</span>
                  <span className="classview-deck-meta">
                    {(counts[s.id] ?? 0)} card
                    {counts[s.id] === 1 ? "" : "s"} · created{" "}
                    {shortDate(s.created_at)}
                  </span>
                </div>
                <span className="classview-deck-cta">
                  Review <ChevRightIcon size={14} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/* ================================================================== */
/* Quizzes tab                                                        */
/* ================================================================== */

const QuizzesTab: FC<{
  cls: ClassRow;
  quizzes: QuizRow[];
  stats: QuizStats;
  onOpen: (id: string) => void;
  onMake: () => void;
  busy: boolean;
}> = ({ cls, quizzes, stats, onOpen, onMake, busy }) => (
  <section className="classview-tab-panel">
    <div className="classview-tab-toolbar">
      <div>
        <h2 className="classview-section-title">Quizzes for {cls.name}</h2>
        <p className="classview-section-sub">
          {stats.taken === 0
            ? "No attempts yet"
            : `Average ${stats.avgPct}% across ${stats.taken} attempts`}
        </p>
      </div>
      <button
        type="button"
        className="btn-primary"
        onClick={onMake}
        disabled={busy}
      >
        <SparklesIcon size={14} /> {busy ? "Working…" : "Make Exam Review"}
      </button>
    </div>
    {quizzes.length === 0 ? (
      <EmptyTabState
        icon={<QuizIcon size={22} />}
        title="No quizzes yet"
        body="Generate a quick quiz from any note in this class to test your knowledge."
        cta="Make Exam Review"
        onCta={onMake}
        ctaDisabled={busy}
      />
    ) : (
      <ul className="classview-quiz-grid">
        {quizzes.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              className="classview-quiz-card"
              onClick={() => onOpen(q.id)}
            >
              <span className="classview-deck-icon tone-amber">
                <QuizIcon size={16} />
              </span>
              <div className="classview-deck-body">
                <span className="classview-deck-title">{q.title}</span>
                <span className="classview-deck-meta">
                  Created {shortDate(q.created_at)}
                </span>
              </div>
              <span className="classview-deck-cta">
                Take quiz <ChevRightIcon size={14} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
);

/* ================================================================== */
/* Study Plan tab                                                     */
/* ================================================================== */

const StudyPlanTab: FC<{
  cls: ClassRow;
  tasks: StudyTaskRow[];
  onCheck: (t: StudyTaskRow) => Promise<void>;
  onPlan: () => void;
}> = ({ cls, tasks, onCheck, onPlan }) => {
  const grouped = useMemo(() => groupByDay(tasks), [tasks]);
  return (
    <section className="classview-tab-panel">
      <div className="classview-tab-toolbar">
        <div>
          <h2 className="classview-section-title">Study Plan for {cls.name}</h2>
          <p className="classview-section-sub">
            {tasks.length === 0
              ? "Nothing scheduled in the next 30 days"
              : `${tasks.length} task${tasks.length === 1 ? "" : "s"} ahead`}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={onPlan}>
          <CalendarIcon size={14} /> Plan with AI
        </button>
      </div>
      {grouped.length === 0 ? (
        <EmptyTabState
          icon={<CalendarIcon size={22} />}
          title="No tasks scheduled"
          body="Generate a daily plan that builds toward your next exam."
          cta="Plan with AI"
          onCta={onPlan}
        />
      ) : (
        <div className="classview-plan-list">
          {grouped.map(([day, items]) => (
            <article key={day} className="classview-plan-day">
              <header className="classview-plan-day-head">
                <span className="classview-plan-day-name">
                  {dayHeading(day)}
                </span>
                <span className="classview-plan-day-count">
                  {items.length} task{items.length === 1 ? "" : "s"}
                </span>
              </header>
              <ul className="classview-task-list">
                {items.map((t) => (
                  <li key={t.id} className="classview-task-row">
                    <button
                      type="button"
                      className={`plan-check${t.completed_at ? " done" : ""}`}
                      aria-label={
                        t.completed_at
                          ? "Mark task incomplete"
                          : "Mark task complete"
                      }
                      onClick={() => void onCheck(t)}
                    >
                      {t.completed_at && <CheckIcon size={11} />}
                    </button>
                    <span className="classview-task-title">{t.title}</span>
                    <span className="classview-task-when">
                      {timeOfDay(t.scheduled_for)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

/* ================================================================== */
/* Empty state                                                        */
/* ================================================================== */

const EmptyTabState: FC<{
  icon: ReactNode;
  title: string;
  body: string;
  cta: string;
  onCta: () => void;
  ctaDisabled?: boolean;
}> = ({ icon, title, body, cta, onCta, ctaDisabled }) => (
  <section className="classview-empty-tab">
    <span className="classview-empty-icon" aria-hidden>
      {icon}
    </span>
    <h3>{title}</h3>
    <p>{body}</p>
    <button
      type="button"
      className="btn-primary"
      onClick={onCta}
      disabled={ctaDisabled}
    >
      {cta}
    </button>
  </section>
);

/* ================================================================== */
/* Helpers                                                            */
/* ================================================================== */

function dueDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7)
    return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayLetter(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d
    .toLocaleDateString(undefined, { weekday: "short" })
    .slice(0, 1)
    .toUpperCase();
}

function dayHeading(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7)
    return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function groupByDay(tasks: StudyTaskRow[]): Array<[string, StudyTaskRow[]]> {
  const map = new Map<string, StudyTaskRow[]>();
  for (const t of tasks) {
    const key = t.scheduled_for.slice(0, 10);
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(t);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function sumKey<K extends keyof ClassActivityDay>(
  days: ClassActivityDay[],
  key: K,
): number {
  let total = 0;
  for (const d of days) total += Number(d[key] ?? 0);
  return total;
}

function trendPct(
  days: ClassActivityDay[],
  key: keyof ClassActivityDay,
): number {
  if (days.length < 2) return 0;
  const half = Math.floor(days.length / 2);
  let early = 0;
  let late = 0;
  for (let i = 0; i < half; i++) early += Number(days[i]![key] ?? 0);
  for (let i = half; i < days.length; i++) late += Number(days[i]![key] ?? 0);
  if (early === 0) return late > 0 ? 100 : 0;
  return Math.round(((late - early) / early) * 100);
}

/* Tiny inline glyph used as a tone-aware Overview header icon (book). */
const BookIconAlt: FC = () => (
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
    <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z" />
    <path d="M8 7h7M8 11h7M8 15h5" />
  </svg>
);
