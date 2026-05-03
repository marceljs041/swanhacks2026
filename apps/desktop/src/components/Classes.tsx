import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { ClassRow, NoteRow, StudyTaskRow, SyncStatus } from "@studynest/shared";
import { ai } from "../lib/ai.js";
import {
  archiveClass as archiveClassDb,
  classAggregates,
  type ClassAggregate,
  listClasses,
  listDueFlashcards,
  listNotes,
  nextExamByClass,
  nextTaskByClass,
  softDeleteClass,
  upsertClass,
  upsertNote,
  weakTopicsForClass,
} from "../db/repositories.js";
import { useApp } from "../store.js";
import { BRAND_CLASS_HERO_URL } from "../lib/brand.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { HeroSearch } from "./HeroSearch.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import { MoreMenu, type MoreMenuItem } from "./ui/MoreMenu.js";
import { RightPanel } from "./RightPanel.js";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  AtomIcon,
  BeakerIcon,
  BookIcon,
  CalendarIcon,
  CheckIcon,
  ChevRightIcon,
  ClassIcon,
  ClockIcon,
  CloudCheckIcon,
  CloudOffIcon,
  FileIcon,
  FlashcardIcon,
  GlobeIcon,
  GraduationCapIcon,
  LeafIcon,
  PencilIcon,
  PillarIcon,
  PlusIcon,
  QuizIcon,
  SparklesIcon,
  TrashIcon,
  WarningIcon,
} from "./icons.js";

/* ================================================================== */
/* Types                                                              */
/* ================================================================== */

type AccentTone = "sage" | "sky" | "lilac" | "amber" | "peach";

const ALL_TONES: AccentTone[] = ["sage", "sky", "lilac", "amber", "peach"];

interface ClassSummary {
  cls: ClassRow;
  tone: AccentTone;
  icon: ReactNode;
  /** Optional human-friendly subtitle derived from `code`. */
  subtitle: string | null;
  notes: number;
  flashcards: number;
  quizzes: number;
  /** 0–100 progress, derived from completed / total study tasks; falls
   *  back to a count-based heuristic when no plan exists yet. */
  progress: number;
  progressTone: "success" | "warning";
  progressLabel: string;
  nextDeadline: { title: string; date: Date; daysLeft: number } | null;
  examInDays: number | null;
  recentNotes: NoteRow[];
  weakTopics: string[];
}

/* ================================================================== */
/* Top-level screen                                                   */
/* ================================================================== */

export const Classes: FC = () => {
  const setView = useApp((s) => s.setView);
  const setSelectedClass = useApp((s) => s.setSelectedClass);
  const setFocusedClass = useApp((s) => s.setFocusedClass);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const setClassesDetailPanelOpen = useApp((s) => s.setClassesDetailPanelOpen);

  const selectClassPreview = useCallback((id: string | null) => {
    withViewTransition(() => {
      setSelectedId(id);
    });
  }, []);
  const classes = useApp((s) => s.classes);
  const setClasses = useApp((s) => s.setClasses);
  const syncStatus = useApp((s) => s.syncStatus);

  const [summaries, setSummaries] = useState<ClassSummary[]>([]);
  const [dueFlashcards, setDueFlashcards] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // `selectedId` is the class whose detail panel is shown to the right.
  // `null` means "nothing previewed" — in that case we render the global
  // RightPanel. Opening the tab starts with nothing selected until the user
  // picks a class.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [renaming, setRenaming] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const cls = await listClasses();
    setClasses(cls);
    const [aggs, nextTasks, exams, due] = await Promise.all([
      classAggregates(),
      nextTaskByClass(),
      nextExamByClass(),
      listDueFlashcards(500),
    ]);
    setDueFlashcards(due.length);
    const today = Date.now();
    const builtBase = await Promise.all(
      cls.map(async (c) => {
        const agg = aggs.get(c.id) ?? EMPTY_AGG;
        const recent = (await listNotes(c.id)).slice(0, 3);
        const weak = await weakTopicsForClass(c.id, 3);
        const next = nextTasks.get(c.id) ?? null;
        const exam = exams.get(c.id) ?? null;
        return summariseClass(c, agg, recent, weak, next, exam, today);
      }),
    );
    setSummaries(builtBase);
    setLoaded(true);
    setSelectedId((prev) => {
      if (prev && builtBase.some((s) => s.cls.id === prev)) return prev;
      return null;
    });
  }, [setClasses]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  /** Only non-null when the user (or first-load auto-select) has a class
   *  previewed. When `selectedId` is null after Back, this must stay null
   *  so the global RightPanel renders — do not fall back to summaries[0]. */
  const selected = useMemo((): ClassSummary | null => {
    if (!selectedId) return null;
    return summaries.find((s) => s.cls.id === selectedId) ?? null;
  }, [summaries, selectedId]);

  // Wider app grid (360px) only while the class detail column is shown;
  // global RightPanel uses the same 304px track as Home/Notes.
  useEffect(() => {
    setClassesDetailPanelOpen(!!selected);
    return () => setClassesDetailPanelOpen(false);
  }, [selected, setClassesDetailPanelOpen]);

  /* ---- Card actions ---------------------------------------------- */

  const openClass = useCallback(
    (id: string) => {
      setSelectedClass(id);
      setFocusedClass(id);
      setView({ kind: "classView", classId: id });
    },
    [setFocusedClass, setSelectedClass, setView],
  );

  const askClass = useCallback(
    (id: string) => {
      setSelectedClass(id);
      setFocusedClass(id);
      setView({ kind: "classAsk", classId: id });
    },
    [setFocusedClass, setSelectedClass, setView],
  );

  const openNote = useCallback(
    (note: NoteRow) => {
      setSelectedNote(note);
      setView({ kind: "note", noteId: note.id });
    },
    [setSelectedNote, setView],
  );

  /* ---- Class management ------------------------------------------ */

  const createClass = useCallback(
    async (name: string, code: string | null, color: string | null) => {
      await upsertClass({ name, code, color });
      await reload();
      setToast(`Added “${name}”`);
    },
    [reload],
  );

  const renameClass = useCallback(
    async (cls: ClassRow, name: string, code: string | null, color: string | null) => {
      await upsertClass({ ...cls, name, code, color });
      await reload();
      setToast(`Updated “${name}”`);
    },
    [reload],
  );

  const deleteClass = useCallback(
    async (cls: ClassRow) => {
      await softDeleteClass(cls.id);
      await reload();
      setToast(`Removed “${cls.name}”`);
    },
    [reload],
  );

  const archiveClass = useCallback(
    async (cls: ClassRow) => {
      const id = cls.id;
      if (selectedId === id) selectClassPreview(null);
      await archiveClassDb(id);
      await reload();
      setToast(`Archived “${cls.name}”`);
    },
    [reload, selectClassPreview, selectedId],
  );

  /* ---- AI tools -------------------------------------------------- */

  const runSummarize = useCallback(
    async (summary: ClassSummary) => {
      // Prefer a note that doesn't yet have a summary so repeat clicks
      // gradually fill out the class instead of re-summarising the same
      // note over and over.
      const target =
        summary.recentNotes.find((n) => !n.summary || n.summary.trim() === "") ??
        summary.recentNotes[0];
      if (!target) {
        setToast(`Add a note to ${summary.cls.name} first.`);
        return;
      }
      setAiBusy(`summarize-${summary.cls.id}`);
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
    },
    [reload],
  );

  const runStudyPlan = useCallback(
    async (summary: ClassSummary) => {
      if (summary.recentNotes.length === 0) {
        setToast(`Add notes to ${summary.cls.name} first.`);
        return;
      }
      // The full study plan flow lives in Calendar — focus the class
      // and jump there so the existing planner picks it up.
      setFocusedClass(summary.cls.id);
      setView({ kind: "calendar" });
    },
    [setFocusedClass, setView],
  );

  /* ---- Render ---------------------------------------------------- */

  return (
    <>
      <main className="main">
        <div className="main-inner">
          <ClassesHero />

          <SummaryStatsRow summaries={summaries} dueFlashcards={dueFlashcards} />

          {!loaded ? (
            <ClassGridSkeleton />
          ) : summaries.length === 0 ? (
            <EmptyState onAdd={() => setShowCreate(true)} />
          ) : (
            <section className="classes-grid" aria-label="Your classes">
              {summaries.map((s) => (
                <ClassCard
                  key={s.cls.id}
                  data={s}
                  selected={s.cls.id === selected?.cls.id}
                  onSelect={() => selectClassPreview(s.cls.id)}
                  onOpen={() => openClass(s.cls.id)}
                  onAsk={() => askClass(s.cls.id)}
                  onRename={() => setRenaming(s.cls)}
                  onArchive={() => void archiveClass(s.cls)}
                />
              ))}
              <NewClassSkeletonCard onClick={() => setShowCreate(true)} />
            </section>
          )}
        </div>

        {toast && (
          <div className="classes-toast" role="status" aria-live="polite">
            {toast}
          </div>
        )}
      </main>

      {selected ? (
        <ClassDetailPanel
          data={selected}
          syncStatus={syncStatus}
          aiBusy={aiBusy}
          onBack={() => selectClassPreview(null)}
          onOpenNote={openNote}
          onViewAll={() => openClass(selected.cls.id)}
          onSummarize={() => void runSummarize(selected)}
          onStudyPlan={() => void runStudyPlan(selected)}
          onMakeQuiz={() => {
            setFocusedClass(selected.cls.id);
            setView({ kind: "quizzes" });
          }}
          onAsk={() => askClass(selected.cls.id)}
          onRename={() => setRenaming(selected.cls)}
          onArchive={() => void archiveClass(selected.cls)}
          onDelete={() => setDeleting(selected.cls)}
        />
      ) : (
        // No class previewed — fall back to the same global right panel
        // the rest of the app uses (gamification, deadlines, AI shortcuts…).
        <RightPanel classesSwap />
      )}

      {showCreate && (
        <ClassEditDialog
          title="Add a class"
          confirmLabel="Add class"
          existing={classes}
          onCancel={() => setShowCreate(false)}
          onSave={async (vals) => {
            await createClass(vals.name, vals.code, vals.color);
            setShowCreate(false);
          }}
        />
      )}
      {renaming && (
        <ClassEditDialog
          title="Edit class"
          confirmLabel="Save"
          existing={classes}
          initial={renaming}
          onCancel={() => setRenaming(null)}
          onSave={async (vals) => {
            await renameClass(renaming, vals.name, vals.code, vals.color);
            setRenaming(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Remove ${deleting.name}?`}
          body={
            <p className="modal-subtle">
              Notes and study tools created under this class will stay in your
              library — you can move them to another class anytime. This action
              syncs to your other devices.
            </p>
          }
          confirmLabel="Remove class"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const cls = deleting;
            setDeleting(null);
            void deleteClass(cls);
          }}
        />
      )}
    </>
  );
};

/* ================================================================== */
/* Hero + toolbar (matches Home / Notes layout)                     */
/* ================================================================== */

const ClassesHero: FC = () => (
  <section className="hero">
    <div className="hero-main">
      <HeroSearch />
      <div className="hero-greeting">
        <h1 className="hero-headline">Classes</h1>
        <p>Your courses, progress, and study tools all in one place.</p>
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

/* ================================================================== */
/* Summary stats                                                      */
/* ================================================================== */

const SummaryStatsRow: FC<{
  summaries: ClassSummary[];
  dueFlashcards: number;
}> = ({ summaries, dueFlashcards }) => {
  const totals = useMemo(() => {
    let notes = 0;
    let exams = 0;
    for (const s of summaries) {
      notes += s.notes;
      if (s.examInDays !== null && s.examInDays <= 7) exams += 1;
    }
    return {
      classes: summaries.length,
      notes,
      exams,
    };
  }, [summaries]);

  return (
    <section className="stat-row" aria-label="Class summary">
      <SummaryStatCard
        icon={<GraduationCapIcon size={18} />}
        tone="peach"
        number={totals.classes.toString()}
        label="Active Classes"
      />
      <SummaryStatCard
        icon={<FileIcon size={18} />}
        tone="sky"
        number={totals.notes.toString()}
        label="Notes"
      />
      <SummaryStatCard
        icon={<FlashcardIcon size={18} />}
        tone="sage"
        number={dueFlashcards.toString()}
        label="Flashcards Due"
      />
      <SummaryStatCard
        icon={<CalendarIcon size={18} />}
        tone="lilac"
        number={totals.exams.toString()}
        label="Exams This Week"
      />
    </section>
  );
};

const SummaryStatCard: FC<{
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
/* Class card                                                         */
/* ================================================================== */

const ClassCard: FC<{
  data: ClassSummary;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onAsk: () => void;
  onRename: () => void;
  onArchive: () => void;
}> = ({ data, selected, onSelect, onOpen, onAsk, onRename, onArchive }) => {
  const menu: MoreMenuItem[] = [
    { label: "Open class notes", icon: <FileIcon size={14} />, onClick: onOpen },
    { label: "Ask AI about this class", icon: <SparklesIcon size={14} />, onClick: onAsk },
    { label: "Edit class", icon: <PencilIcon size={14} />, onClick: onRename },
    { label: "Archive class", icon: <ArchiveIcon size={14} />, onClick: onArchive },
  ];

  return (
    <article
      className={`class-card${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <header className="class-card-head">
        <span className={`class-card-icon tone-${data.tone}`} aria-hidden>
          {data.icon}
        </span>
        <div className="class-card-title">
          <span className="class-card-course">{data.cls.name}</span>
          {data.subtitle && (
            <span className="class-card-subtitle">{data.subtitle}</span>
          )}
          <span className="class-card-prof">
            {data.cls.code && data.subtitle !== data.cls.code
              ? data.cls.code
              : "Course"}
          </span>
        </div>
        <div
          className="class-card-more-wrap"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MoreMenu items={menu} label={`Options for ${data.cls.name}`} />
        </div>
      </header>

      <div className="class-card-stats">
        <CardStat icon={<FileIcon size={14} />} tone="sky" value={data.notes} label="Notes" />
        <CardStat
          icon={<FlashcardIcon size={14} />}
          tone="sage"
          value={data.flashcards}
          label="Flashcards"
        />
        <CardStat
          icon={<QuizIcon size={14} />}
          tone="amber"
          value={data.quizzes}
          label="Quizzes"
        />
      </div>

      <div className="class-card-progress">
        <div className="class-card-progress-row">
          <span className={`progress-label tone-${data.progressTone}`}>
            {data.progressLabel}
          </span>
          <span className="progress-value">{data.progress}%</span>
        </div>
        <ProgressBar value={data.progress} tone={data.tone} />
      </div>

      <div className="class-card-next">
        <CalendarIcon size={14} />
        <span>
          {data.nextDeadline
            ? `Next: ${data.nextDeadline.title}`
            : "No upcoming deadlines"}
        </span>
      </div>

      <div className="class-card-actions">
        <button
          type="button"
          className="class-action class-action-primary"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          Open Class <ChevRightIcon size={14} />
        </button>
        <button
          type="button"
          className="class-action class-action-ai"
          onClick={(e) => {
            e.stopPropagation();
            onAsk();
          }}
        >
          <SparklesIcon size={14} /> Ask AI
        </button>
      </div>
    </article>
  );
};

const CardStat: FC<{
  icon: ReactNode;
  tone: AccentTone;
  value: number;
  label: string;
}> = ({ icon, tone, value, label }) => (
  <div className="card-stat">
    <span className={`card-stat-icon tone-${tone}`} aria-hidden>
      {icon}
    </span>
    <span className="card-stat-value">{value}</span>
    <span className="card-stat-label">{label}</span>
  </div>
);

const ProgressBar: FC<{ value: number; tone: AccentTone }> = ({ value, tone }) => (
  <div className="progress-bar">
    <span
      className={`progress-fill tone-${tone}`}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

/* ================================================================== */
/* Right detail panel                                                 */
/* ================================================================== */

interface DetailProps {
  data: ClassSummary;
  syncStatus: SyncStatus;
  aiBusy: string | null;
  onBack: () => void;
  onOpenNote: (n: NoteRow) => void;
  onViewAll: () => void;
  onSummarize: () => void;
  onMakeQuiz: () => void;
  onStudyPlan: () => void;
  onAsk: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

const ClassDetailPanel: FC<DetailProps> = ({
  data,
  syncStatus,
  aiBusy,
  onBack,
  onOpenNote,
  onViewAll,
  onSummarize,
  onMakeQuiz,
  onStudyPlan,
  onAsk,
  onRename,
  onArchive,
  onDelete,
}) => {
  const detailMenu: MoreMenuItem[] = [
    { label: "Edit class", icon: <PencilIcon size={14} />, onClick: onRename },
    { label: "Archive class", icon: <ArchiveIcon size={14} />, onClick: onArchive },
    { label: "Remove class", icon: <TrashIcon size={14} />, onClick: onDelete, danger: true },
  ];

  // Prefer an AI-generated summary of the most recent note; falls back
  // to a static blurb so the detail card never looks empty.
  const recentSummary = data.recentNotes.find(
    (n) => n.summary && n.summary.trim().length > 0,
  )?.summary;
  const description =
    recentSummary ??
    (data.cls.code && data.cls.code !== data.subtitle
      ? data.cls.code
      : data.subtitle ??
        "Track your notes, flashcards and quizzes for this course in one place. Open it to focus your study session here.");

  const chips: { label: string; tone: "info" | "danger" | "success" | "warning" }[] = [];
  chips.push({ label: data.notes > 0 ? "Active" : "New", tone: "info" });
  if (data.examInDays !== null && data.examInDays <= 14) {
    chips.push({
      label: data.examInDays <= 0 ? "Exam today" : `Exam in ${data.examInDays}d`,
      tone: data.examInDays <= 3 ? "danger" : "warning",
    });
  }
  chips.push({
    label: data.progressTone === "warning" ? "Catching up" : "On Track",
    tone: data.progressTone === "warning" ? "warning" : "success",
  });

  return (
    <aside className="right-panel class-detail-panel right-panel--classes-swap">
      <header className="detail-toolbar">
        <button
          type="button"
          className="detail-icon-btn"
          aria-label="Back to home"
          onClick={onBack}
        >
          <ArrowLeftIcon size={16} />
        </button>
        <div className="detail-toolbar-more">
          <MoreMenu items={detailMenu} label="Class options" />
        </div>
      </header>

      <section className="detail-hero">
        <span className={`class-card-icon tone-${data.tone} detail-hero-icon`} aria-hidden>
          {data.icon}
        </span>
        <div className="detail-hero-text">
          <h2>{data.cls.name}</h2>
          <p>{data.subtitle ?? "Course"}</p>
        </div>
      </section>

      <div className="detail-chips">
        {chips.map((c) => (
          <span key={c.label} className={`detail-chip tone-${c.tone}`}>
            {c.label}
          </span>
        ))}
      </div>

      <p className="detail-description">{description}</p>

      <hr className="detail-divider" />

      <section className="detail-section">
        <div className="detail-section-head">
          <span className="detail-section-title">
            <FileIcon size={14} /> Recent Notes
          </span>
          <button type="button" className="detail-link" onClick={onViewAll}>
            View all
          </button>
        </div>
        {data.recentNotes.length === 0 ? (
          <p className="detail-empty">
            No notes yet. Open this class to create your first note.
          </p>
        ) : (
          <ul className="detail-note-list">
            {data.recentNotes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="detail-note-row"
                  onClick={() => onOpenNote(n)}
                >
                  <span className="detail-note-icon" aria-hidden>
                    <FileIcon size={14} />
                  </span>
                  <span className="detail-note-title">{n.title}</span>
                  <span className="detail-note-date">{shortDate(n.updated_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <hr className="detail-divider" />

      <section className="detail-section">
        <div className="detail-section-head">
          <span className="detail-section-title">
            <BookIcon size={14} /> Study Progress
          </span>
        </div>
        <div className="detail-tile-grid">
          <DetailTile
            tone="sky"
            icon={<FileIcon size={14} />}
            number={data.notes.toString()}
            label="Notes"
          />
          <DetailTile
            tone="sage"
            icon={<FlashcardIcon size={14} />}
            number={data.flashcards.toString()}
            label="Flashcards"
          />
          <DetailTile
            tone="amber"
            icon={<QuizIcon size={14} />}
            number={data.quizzes.toString()}
            label="Quizzes"
          />
          <DetailTile
            tone="lilac"
            icon={<ClockIcon size={14} />}
            number={data.examInDays === null ? "—" : `${data.examInDays}d`}
            label={data.examInDays === null ? "No exam" : "Exam in"}
            stacked
          />
        </div>
      </section>

      <hr className="detail-divider" />

      <section className="detail-section">
        <div className="detail-section-head">
          <span className="detail-section-title">Weak Topics</span>
        </div>
        {data.weakTopics.length === 0 ? (
          <p className="detail-empty">
            No weak topics yet — rate flashcards as “hard” to surface them here.
          </p>
        ) : (
          <div className="weak-topic-row">
            {data.weakTopics.map((t) => (
              <span key={t} className="weak-topic">
                {t}
              </span>
            ))}
          </div>
        )}
      </section>

      <hr className="detail-divider" />

      <section className="detail-section">
        <div className="detail-section-head">
          <span className="detail-section-title">
            <SparklesIcon size={14} /> AI Tools
          </span>
        </div>
        <div className="ai-tools">
          <AIActionButton
            tone="sky"
            icon={<SparklesIcon size={14} />}
            label="Summarize Class"
            busy={aiBusy === `summarize-${data.cls.id}`}
            onClick={onSummarize}
          />
          <AIActionButton
            tone="sage"
            icon={<CheckIcon size={14} />}
            label="Make Exam Review"
            onClick={onMakeQuiz}
          />
          <AIActionButton
            tone="lilac"
            icon={<CalendarIcon size={14} />}
            label="Generate Study Plan"
            onClick={onStudyPlan}
          />
          <AIActionButton
            tone="peach"
            icon={<FileIcon size={14} />}
            label="Ask This Class"
            onClick={onAsk}
          />
        </div>
      </section>

      <SyncStatusCard status={syncStatus} />
    </aside>
  );
};

const DetailTile: FC<{
  tone: AccentTone;
  icon: ReactNode;
  number: string;
  label: string;
  stacked?: boolean;
}> = ({ tone, icon, number, label, stacked }) => (
  <div className={`detail-tile tone-${tone}${stacked ? " stacked" : ""}`}>
    <span className="detail-tile-icon" aria-hidden>
      {icon}
    </span>
    <span className="detail-tile-number">{number}</span>
    <span className="detail-tile-label">{label}</span>
  </div>
);

const AIActionButton: FC<{
  tone: AccentTone;
  icon: ReactNode;
  label: string;
  busy?: boolean;
  onClick: () => void;
}> = ({ tone, icon, label, busy, onClick }) => (
  <button
    type="button"
    className={`ai-action tone-${tone}`}
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

const SYNC_PRESENTATION: Record<
  SyncStatus,
  { title: string; sub: string; icon: ReactNode; tone: "success" | "warning" | "danger" | "muted" }
> = {
  synced: {
    title: "All changes synced",
    sub: "Last synced just now",
    icon: <CloudCheckIcon size={14} />,
    tone: "success",
  },
  syncing: {
    title: "Syncing changes…",
    sub: "Working in the background",
    icon: <GlobeIcon size={14} />,
    tone: "warning",
  },
  saving: {
    title: "Saving locally…",
    sub: "Will sync once changes settle",
    icon: <CheckIcon size={14} />,
    tone: "warning",
  },
  conflict: {
    title: "Conflict detected",
    sub: "Open Settings to resolve",
    icon: <WarningIcon size={14} />,
    tone: "warning",
  },
  error: {
    title: "Sync error",
    sub: "We'll retry automatically",
    icon: <WarningIcon size={14} />,
    tone: "danger",
  },
  offline: {
    title: "You're offline",
    sub: "Changes save locally and resume on reconnect",
    icon: <CloudOffIcon size={14} />,
    tone: "muted",
  },
};

const SyncStatusCard: FC<{ status: SyncStatus }> = ({ status }) => {
  const view = SYNC_PRESENTATION[status] ?? SYNC_PRESENTATION.synced;
  return (
    <div className={`sync-card sync-${view.tone}`}>
      <span className="sync-card-icon" aria-hidden>
        <CheckIcon size={14} />
      </span>
      <div className="sync-card-text">
        <span className="sync-card-title">{view.title}</span>
        <span className="sync-card-sub">{view.sub}</span>
      </div>
      <span className="sync-card-badge" aria-hidden>
        {view.icon}
      </span>
    </div>
  );
};

/* ================================================================== */
/* Empty / loading / no-match states                                  */
/* ================================================================== */

const EmptyState: FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <section className="classes-empty">
    <span className="classes-empty-icon" aria-hidden>
      <GraduationCapIcon size={28} />
    </span>
    <h2>Add your first class</h2>
    <p>
      Group your notes, flashcards, and quizzes by subject. You can rename or
      remove classes at any time.
    </p>
    <div className="classes-empty-add-wrap">
      <NewClassSkeletonCard onClick={onAdd} />
    </div>
  </section>
);

/** Skeleton tile with “Add a module”–style hints; opens create-class on click. */
const NewClassSkeletonCard: FC<{ onClick: () => void }> = ({ onClick }) => {
  const hintId = useId();
  const titleId = `${hintId}-title`;
  const subId = `${hintId}-sub`;
  return (
    <button
      type="button"
      className="class-card skeleton class-card--new"
      onClick={onClick}
      aria-labelledby={titleId}
      aria-describedby={subId}
    >
      <div className="class-card-new-hint">
        <span className="add-widget-icon" aria-hidden>
          <PlusIcon size={18} />
        </span>
        <span className="add-widget-text">
          <span className="add-widget-title" id={titleId}>
            Add a new class
          </span>
          <span className="add-widget-sub" id={subId}>
            Click here to name your course and start organizing notes and study tools.
          </span>
        </span>
      </div>
      <div className="class-card-stats">
        <span className="card-stat skeleton-bar" />
        <span className="card-stat skeleton-bar" />
        <span className="card-stat skeleton-bar" />
      </div>
      <div className="progress-bar skeleton-bar" />
    </button>
  );
};

const ClassGridSkeleton: FC = () => (
  <section className="classes-grid" aria-hidden>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="class-card skeleton">
        <div className="class-card-head">
          <span className="class-card-icon" />
          <div className="class-card-title">
            <span className="class-card-course skeleton-bar" />
            <span className="class-card-subtitle skeleton-bar" />
          </div>
        </div>
        <div className="class-card-stats">
          <span className="card-stat skeleton-bar" />
          <span className="card-stat skeleton-bar" />
          <span className="card-stat skeleton-bar" />
        </div>
        <div className="progress-bar skeleton-bar" />
      </div>
    ))}
  </section>
);

/* ================================================================== */
/* Create / edit dialog                                               */
/* ================================================================== */

interface ClassEditValues {
  name: string;
  code: string | null;
  color: string | null;
}

const COLOR_CHOICES: { id: string; value: string; label: string; tone: AccentTone }[] = [
  { id: "sage",  value: "var(--color-accentSage)",  label: "Sage",   tone: "sage" },
  { id: "sky",   value: "var(--color-accentSky)",   label: "Sky",    tone: "sky" },
  { id: "lilac", value: "var(--color-accentLilac)", label: "Lilac",  tone: "lilac" },
  { id: "amber", value: "var(--color-accentAmber)", label: "Amber",  tone: "amber" },
  { id: "peach", value: "var(--color-accentPeach)", label: "Peach",  tone: "peach" },
];

const ClassEditDialog: FC<{
  title: string;
  confirmLabel: string;
  initial?: ClassRow;
  existing: ClassRow[];
  onCancel: () => void;
  onSave: (vals: ClassEditValues) => Promise<void>;
}> = ({ title, confirmLabel, initial, existing, onCancel, onSave }) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [color, setColor] = useState<string>(
    initial?.color ?? COLOR_CHOICES[0]!.value,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const trimmedName = name.trim();
  const duplicate = existing.some(
    (c) =>
      c.id !== initial?.id &&
      c.name.trim().toLowerCase() === trimmedName.toLowerCase(),
  );

  async function handleSave(): Promise<void> {
    if (!trimmedName) {
      setError("Add a class name to continue.");
      return;
    }
    if (duplicate) {
      setError("You already have a class with that name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: trimmedName,
        code: code.trim() ? code.trim() : null,
        color,
      });
    } catch (e) {
      setError((e as Error).message ?? "Couldn't save the class.");
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="modal-card class-edit-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{title}</span>
        </div>
        <label className="class-edit-field">
          <span>Class name</span>
          <input
            className="field"
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Biology 201"
            maxLength={80}
          />
        </label>
        <label className="class-edit-field">
          <span>Subtitle (optional)</span>
          <input
            className="field"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. Cell Biology with Dr. Miller"
            maxLength={120}
          />
        </label>
        <div className="class-edit-field">
          <span>Accent</span>
          <div className="class-color-row">
            {COLOR_CHOICES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-label={c.label}
                aria-pressed={color === c.value}
                className={`class-color-swatch tone-${c.tone}${
                  color === c.value ? " is-active" : ""
                }`}
                onClick={() => setColor(c.value)}
              >
                <span className="class-color-dot" />
              </button>
            ))}
          </div>
        </div>
        {error && <p className="class-edit-error">{error}</p>}
        <div className="confirm-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleSave()}
            disabled={busy || !trimmedName}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ================================================================== */
/* Helpers                                                            */
/* ================================================================== */

const EMPTY_AGG: ClassAggregate = {
  notes: 0,
  flashcards: 0,
  quizzes: 0,
  totalTasks: 0,
  completedTasks: 0,
};

/** Builds a `ClassSummary` from a raw class row + its derived metrics. */
function summariseClass(
  cls: ClassRow,
  agg: ClassAggregate,
  recentNotes: NoteRow[],
  weakTopics: string[],
  nextTask: StudyTaskRow | null,
  exam: { iso: string; days: number } | null,
  todayMs: number,
): ClassSummary {
  const tone = toneFor(cls);
  const icon = iconFor(cls, tone);
  const subtitle = deriveSubtitle(cls);
  const progress = computeProgress(agg);
  const progressTone: ClassSummary["progressTone"] =
    progress >= 60 || agg.totalTasks === 0 ? "success" : "warning";
  const progressLabel = labelForProgress(progress, agg);

  let nextDeadline: ClassSummary["nextDeadline"] = null;
  if (nextTask) {
    const d = new Date(nextTask.scheduled_for);
    nextDeadline = {
      title: nextTask.title,
      date: d,
      daysLeft: Math.max(0, Math.round((d.getTime() - todayMs) / 86_400_000)),
    };
  }

  return {
    cls,
    tone,
    icon,
    subtitle,
    notes: agg.notes,
    flashcards: agg.flashcards,
    quizzes: agg.quizzes,
    progress,
    progressTone,
    progressLabel,
    nextDeadline,
    examInDays: exam ? exam.days : null,
    recentNotes,
    weakTopics,
  };
}

/**
 * Resolve a tone from a ClassRow:
 *  1. If `color` is one of our CSS accent tokens, map directly.
 *  2. Otherwise pick a deterministic tone from the class name hash so
 *     the same class always renders the same colour.
 */
function toneFor(cls: ClassRow): AccentTone {
  const color = (cls.color ?? "").toLowerCase();
  if (color.includes("sage") || color.includes("green")) return "sage";
  if (color.includes("sky") || color.includes("blue")) return "sky";
  if (color.includes("lilac") || color.includes("purple") || color.includes("violet"))
    return "lilac";
  if (color.includes("amber") || color.includes("yellow") || color.includes("gold"))
    return "amber";
  if (color.includes("peach") || color.includes("rose") || color.includes("orange"))
    return "peach";
  // Deterministic fallback by id so colours are stable across reloads.
  let h = 0;
  for (let i = 0; i < cls.id.length; i++) h = (h * 31 + cls.id.charCodeAt(i)) >>> 0;
  return ALL_TONES[h % ALL_TONES.length] ?? "sky";
}

/** Pick a subject-aware glyph based on the class name (when possible). */
function iconFor(cls: ClassRow, tone: AccentTone): ReactNode {
  const n = cls.name.toLowerCase();
  if (/(bio|cell|genetic|anatom)/.test(n)) return <LeafIcon size={20} />;
  if (/(chem|lab|reaction)/.test(n)) return <BeakerIcon size={20} />;
  if (/(history|civics|world|europe)/.test(n)) return <PillarIcon size={20} />;
  if (/(physics|mechanic|astro)/.test(n)) return <AtomIcon size={20} />;
  if (/(english|writing|literature|comp)/.test(n)) return <PencilIcon size={20} />;
  if (/(geo|earth|map)/.test(n)) return <GlobeIcon size={20} />;
  if (/(book|reading)/.test(n)) return <BookIcon size={20} />;
  // Generic class icon, coloured via tone.
  void tone;
  return <ClassIcon size={20} />;
}

/** Subtitle is derived from `code` when present (matches our seed convention). */
function deriveSubtitle(cls: ClassRow): string | null {
  if (!cls.code || !cls.code.trim()) return null;
  return cls.code.trim();
}

/**
 * Progress percentage. Prefers task completion when a study plan exists;
 * otherwise falls back to a coarse "study tools coverage" heuristic so a
 * brand-new class doesn't render at 0% forever.
 */
function computeProgress(agg: ClassAggregate): number {
  if (agg.totalTasks > 0) {
    return Math.round((agg.completedTasks / agg.totalTasks) * 100);
  }
  // Heuristic: 30% per study tool category, capped at 90% so the user
  // still sees room to grow even on well-stocked classes without plans.
  const score =
    (agg.notes > 0 ? 30 : 0) +
    (agg.flashcards > 0 ? 30 : 0) +
    (agg.quizzes > 0 ? 30 : 0);
  return Math.min(score, 90);
}

function labelForProgress(progress: number, agg: ClassAggregate): string {
  if (agg.totalTasks === 0 && agg.notes === 0) return "Just Starting";
  if (progress >= 60) return "On Track";
  if (progress >= 30) return "Catching Up";
  return "Behind";
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days >= 2 && days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
