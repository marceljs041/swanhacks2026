/**
 * Two-step modal that turns AI study plan output into real
 * `calendar_events` rows.
 *
 *  Step 1 — Configure  : pick a class, optional source decks/notes/quiz,
 *                        exam date, daily availability, strategy, and
 *                        which deliverables to include. Inputs flow
 *                        into the existing `ai.studyPlan` request.
 *  Step 2 — Preview    : render the proposed task list grouped by day.
 *                        Per-row remove + edit before accepting.
 *
 * On accept we upsert a new `study_plans` row to anchor the bundle,
 * then create one `calendar_events` row per surviving task with
 * `source_type='ai_generated'`.
 */
import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  CalendarEventType,
  ClassRow,
  FlashcardSetRow,
  NoteRow,
  QuizRow,
} from "@studynest/shared";
import { useApp } from "../../store.js";
import { ai } from "../../lib/ai.js";
import { upsertEvent } from "../../db/calendar.js";
import {
  listClasses,
  listFlashcardSets,
  listNotes,
  listQuizzes,
  upsertStudyPlan,
} from "../../db/repositories.js";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "../icons.js";
import { labelForType } from "./eventVisuals.js";

type Strategy =
  | "balanced"
  | "weak_topics_first"
  | "cram_prep"
  | "review_first";

const STRATEGY_LABELS: Record<Strategy, string> = {
  balanced: "Balanced",
  weak_topics_first: "Weak topics first",
  cram_prep: "Cram prep",
  review_first: "Review first",
};

const STRATEGY_GOALS: Record<Strategy, string> = {
  balanced:
    "Spread review evenly across notes, flashcards, and a practice quiz.",
  weak_topics_first:
    "Strategy: prioritize weak topics first, then layer review.",
  cram_prep:
    "Strategy: cram prep — pack the last days before the exam with high-density review and a final practice quiz.",
  review_first:
    "Strategy: review notes first, then introduce flashcards, finishing with a practice quiz.",
};

interface DraftTask {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  type: CalendarEventType;
  note_id: string | null;
}

export const StudyPlanGeneratorModal: FC = () => {
  const open = useApp((s) => s.calendarPlanGeneratorOpen);
  const setOpen = useApp((s) => s.setCalendarPlanGeneratorOpen);
  const setSelected = useApp((s) => s.setCalendarSelectedEvent);
  const sidecarLoaded = useApp((s) => s.sidecarLoaded);

  const [step, setStep] = useState<"configure" | "preview">("configure");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [decks, setDecks] = useState<FlashcardSetRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);

  const [classId, setClassId] = useState<string>("");
  const [examDate, setExamDate] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(todayIso());
  const [endDate, setEndDate] = useState<string>(plusDaysIso(7));
  const [dailyMinutes, setDailyMinutes] = useState<number>(60);
  const [strategy, setStrategy] = useState<Strategy>("balanced");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);
  const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);
  const [includeReview, setIncludeReview] = useState(true);
  const [includeFlashcards, setIncludeFlashcards] = useState(true);
  const [includeQuiz, setIncludeQuiz] = useState(true);
  const [includeCram, setIncludeCram] = useState(false);

  const [tasks, setTasks] = useState<DraftTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([
      listClasses(),
      listNotes(null),
      listFlashcardSets(null),
      listQuizzes(null),
    ]).then(([cs, ns, ds, qs]) => {
      if (cancelled) return;
      setClasses(cs);
      setNotes(ns);
      setDecks(ds);
      setQuizzes(qs);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset between opens.
  useEffect(() => {
    if (!open) {
      setStep("configure");
      setTasks([]);
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const filteredNotes = useMemo<NoteRow[]>(() => {
    if (!classId) return notes;
    return notes.filter((n) => n.class_id === classId);
  }, [notes, classId]);

  const filteredDecks = useMemo<FlashcardSetRow[]>(() => {
    if (!classId) return decks;
    const noteIdsInClass = new Set(
      notes.filter((n) => n.class_id === classId).map((n) => n.id),
    );
    return decks.filter((d) => !d.note_id || noteIdsInClass.has(d.note_id));
  }, [decks, classId, notes]);

  const filteredQuizzes = useMemo<QuizRow[]>(() => {
    if (!classId) return quizzes;
    return quizzes.filter((q) => {
      if (q.class_id === classId) return true;
      const note = q.note_id ? notes.find((n) => n.id === q.note_id) : null;
      return note?.class_id === classId;
    });
  }, [quizzes, classId, notes]);

  function close(): void {
    if (busy) return;
    setOpen(false);
  }

  async function generate(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const cls = classes.find((c) => c.id === classId);
      const goalParts: string[] = [];
      goalParts.push(
        cls
          ? `Build a study plan for ${cls.name}.`
          : `Build a balanced study plan.`,
      );
      goalParts.push(STRATEGY_GOALS[strategy]);
      const includes: string[] = [];
      if (includeReview) includes.push("review notes");
      if (includeFlashcards) includes.push("flashcards");
      if (includeQuiz) includes.push("practice quiz");
      if (includeCram) includes.push("final cram session");
      if (includes.length > 0) goalParts.push(`Include: ${includes.join(", ")}.`);
      goalParts.push(
        `Daily availability: ${dailyMinutes} minutes. Date range ${startDate} to ${endDate}.`,
      );
      if (examDate) goalParts.push(`Exam date: ${examDate}.`);

      const sourceNotes =
        selectedNoteIds.length > 0
          ? notes.filter((n) => selectedNoteIds.includes(n.id))
          : filteredNotes.slice(0, 8);

      const days = Math.max(
        1,
        Math.round(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            86_400_000 +
            1,
        ),
      );

      const res = await ai.studyPlan({
        goal: goalParts.join(" "),
        exam_date: examDate || null,
        notes: sourceNotes.map((n) => ({
          id: n.id,
          title: n.title,
          summary: n.summary,
        })),
        days_available: days,
      });

      const drafts: DraftTask[] = res.tasks.map((t, i) => ({
        id: `draft_${i}_${Date.now()}`,
        title: t.title,
        date: clampDate(t.scheduled_for, startDate, endDate),
        durationMinutes: t.duration_minutes,
        type: mapStudyType(t.type),
        note_id: t.note_id ?? null,
      }));
      setTasks(drafts);
      setStep("preview");
    } catch (e) {
      setError(
        sidecarLoaded
          ? (e as Error).message
          : "The learning assistant is still warming up. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function accept(): Promise<void> {
    if (tasks.length === 0) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cls = classes.find((c) => c.id === classId);
      const plan = await upsertStudyPlan({
        title: cls ? `${cls.name} study plan` : "AI study plan",
        class_id: classId || null,
        exam_date: examDate ? new Date(examDate).toISOString() : null,
      });
      let firstId: string | null = null;
      for (const t of tasks) {
        const startIso = composeIso(t.date, "09:00");
        const endIso = new Date(
          new Date(startIso).getTime() + t.durationMinutes * 60_000,
        ).toISOString();
        const ev = await upsertEvent({
          title: t.title,
          type: t.type,
          class_id: classId || null,
          note_id: t.note_id,
          quiz_id:
            t.type === "quiz" && selectedQuizIds[0]
              ? selectedQuizIds[0]
              : null,
          flashcard_set_id:
            t.type === "flashcards" && selectedDeckIds[0]
              ? selectedDeckIds[0]
              : null,
          study_plan_id: plan.id,
          start_at: startIso,
          end_at: endIso,
          source_type: "ai_generated",
          color: "accentLilac",
        });
        if (!firstId) firstId = ev.id;
      }
      if (firstId) setSelected(firstId);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="plan-modal-scrim"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="plan-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Build study plan"
      >
        <header className="plan-modal-head">
          <div className="plan-modal-head-title">
            <span className="plan-modal-icon" aria-hidden>
              <SparklesIcon size={16} />
            </span>
            <h2>Build study plan</h2>
          </div>
          <button
            type="button"
            className="event-drawer-close"
            aria-label="Close"
            onClick={close}
          >
            <XIcon size={16} />
          </button>
        </header>

        <div className="plan-modal-stepper">
          <span className={`plan-step${step === "configure" ? " active" : ""}`}>
            1. Configure
          </span>
          <span className="plan-step-sep" />
          <span className={`plan-step${step === "preview" ? " active" : ""}`}>
            2. Preview
          </span>
        </div>

        {step === "configure" ? (
          <ConfigureStep
            classes={classes}
            classId={classId}
            setClassId={setClassId}
            examDate={examDate}
            setExamDate={setExamDate}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            dailyMinutes={dailyMinutes}
            setDailyMinutes={setDailyMinutes}
            strategy={strategy}
            setStrategy={setStrategy}
            filteredNotes={filteredNotes}
            filteredDecks={filteredDecks}
            filteredQuizzes={filteredQuizzes}
            selectedNoteIds={selectedNoteIds}
            setSelectedNoteIds={setSelectedNoteIds}
            selectedDeckIds={selectedDeckIds}
            setSelectedDeckIds={setSelectedDeckIds}
            selectedQuizIds={selectedQuizIds}
            setSelectedQuizIds={setSelectedQuizIds}
            includeReview={includeReview}
            setIncludeReview={setIncludeReview}
            includeFlashcards={includeFlashcards}
            setIncludeFlashcards={setIncludeFlashcards}
            includeQuiz={includeQuiz}
            setIncludeQuiz={setIncludeQuiz}
            includeCram={includeCram}
            setIncludeCram={setIncludeCram}
            sidecarLoaded={sidecarLoaded}
            error={error}
          />
        ) : (
          <PreviewStep tasks={tasks} setTasks={setTasks} />
        )}

        <footer className="plan-modal-foot">
          {step === "configure" ? (
            <>
              <button
                type="button"
                className="btn-ghost"
                onClick={close}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void generate()}
                disabled={busy || !sidecarLoaded}
              >
                <SparklesIcon size={14} />
                {busy ? "Generating…" : "Generate plan"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep("configure")}
                disabled={busy}
              >
                <ArrowLeftIcon size={12} /> Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void accept()}
                disabled={busy || tasks.length === 0}
              >
                {busy ? "Adding…" : "Add to calendar"}
                <ArrowRightIcon size={12} />
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
};

interface ConfigProps {
  classes: ClassRow[];
  classId: string;
  setClassId: (v: string) => void;
  examDate: string;
  setExamDate: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  dailyMinutes: number;
  setDailyMinutes: (v: number) => void;
  strategy: Strategy;
  setStrategy: (v: Strategy) => void;
  filteredNotes: NoteRow[];
  filteredDecks: FlashcardSetRow[];
  filteredQuizzes: QuizRow[];
  selectedNoteIds: string[];
  setSelectedNoteIds: (v: string[]) => void;
  selectedDeckIds: string[];
  setSelectedDeckIds: (v: string[]) => void;
  selectedQuizIds: string[];
  setSelectedQuizIds: (v: string[]) => void;
  includeReview: boolean;
  setIncludeReview: (v: boolean) => void;
  includeFlashcards: boolean;
  setIncludeFlashcards: (v: boolean) => void;
  includeQuiz: boolean;
  setIncludeQuiz: (v: boolean) => void;
  includeCram: boolean;
  setIncludeCram: (v: boolean) => void;
  sidecarLoaded: boolean;
  error: string | null;
}

const ConfigureStep: FC<ConfigProps> = (p) => (
  <div className="plan-modal-body">
    {!p.sidecarLoaded && (
      <p className="pill warning">
        The local AI assistant is still warming up. Generation will be enabled in a moment.
      </p>
    )}

    <div className="plan-grid">
      <Field label="Class">
        <select
          className="field"
          value={p.classId}
          onChange={(e) => p.setClassId(e.target.value)}
        >
          <option value="">Any class</option>
          {p.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Exam date">
        <input
          type="date"
          className="field"
          value={p.examDate}
          onChange={(e) => p.setExamDate(e.target.value)}
        />
      </Field>
      <Field label="Start date">
        <input
          type="date"
          className="field"
          value={p.startDate}
          onChange={(e) => p.setStartDate(e.target.value)}
        />
      </Field>
      <Field label="End date">
        <input
          type="date"
          className="field"
          value={p.endDate}
          onChange={(e) => p.setEndDate(e.target.value)}
        />
      </Field>
    </div>

    <Field label={`Daily availability (${p.dailyMinutes} minutes)`}>
      <input
        type="range"
        min={15}
        max={180}
        step={15}
        value={p.dailyMinutes}
        onChange={(e) => p.setDailyMinutes(parseInt(e.target.value, 10))}
      />
    </Field>

    <Field label="Strategy">
      <div className="event-drawer-segments">
        {(Object.keys(STRATEGY_LABELS) as Strategy[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`event-drawer-segment${p.strategy === s ? " active" : ""}`}
            onClick={() => p.setStrategy(s)}
          >
            {STRATEGY_LABELS[s]}
          </button>
        ))}
      </div>
    </Field>

    <Field label="Include">
      <div className="plan-includes">
        <label className="event-drawer-toggle">
          <input
            type="checkbox"
            checked={p.includeReview}
            onChange={(e) => p.setIncludeReview(e.target.checked)}
          />
          Review notes
        </label>
        <label className="event-drawer-toggle">
          <input
            type="checkbox"
            checked={p.includeFlashcards}
            onChange={(e) => p.setIncludeFlashcards(e.target.checked)}
          />
          Flashcards
        </label>
        <label className="event-drawer-toggle">
          <input
            type="checkbox"
            checked={p.includeQuiz}
            onChange={(e) => p.setIncludeQuiz(e.target.checked)}
          />
          Practice quiz
        </label>
        <label className="event-drawer-toggle">
          <input
            type="checkbox"
            checked={p.includeCram}
            onChange={(e) => p.setIncludeCram(e.target.checked)}
          />
          Cram session
        </label>
      </div>
    </Field>

    <div className="plan-source-grid">
      <SourcePicker
        title="Notes"
        items={p.filteredNotes.map((n) => ({ id: n.id, label: n.title }))}
        selected={p.selectedNoteIds}
        onToggle={(id) =>
          p.setSelectedNoteIds(toggle(p.selectedNoteIds, id))
        }
      />
      <SourcePicker
        title="Flashcard decks"
        items={p.filteredDecks.map((d) => ({ id: d.id, label: d.title }))}
        selected={p.selectedDeckIds}
        onToggle={(id) =>
          p.setSelectedDeckIds(toggle(p.selectedDeckIds, id))
        }
      />
      <SourcePicker
        title="Quizzes"
        items={p.filteredQuizzes.map((q) => ({ id: q.id, label: q.title }))}
        selected={p.selectedQuizIds}
        onToggle={(id) =>
          p.setSelectedQuizIds(toggle(p.selectedQuizIds, id))
        }
      />
    </div>

    {p.error && <p className="pill error">{p.error}</p>}
  </div>
);

interface PreviewProps {
  tasks: DraftTask[];
  setTasks: (next: DraftTask[]) => void;
}

const PreviewStep: FC<PreviewProps> = ({ tasks, setTasks }) => {
  const groups = useMemo(() => groupByDate(tasks), [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="plan-modal-body">
        <p className="pill warning">
          The assistant didn't return any tasks. Tweak the configuration and
          try again.
        </p>
      </div>
    );
  }

  function patch(id: string, next: Partial<DraftTask>): void {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, ...next } : t)));
  }
  function remove(id: string): void {
    setTasks(tasks.filter((t) => t.id !== id));
  }

  return (
    <div className="plan-modal-body">
      <p className="plan-modal-help">
        Tweak titles or remove tasks before adding them to your calendar.
      </p>
      {groups.map(({ date, items }) => (
        <div key={date} className="plan-day-group">
          <header className="plan-day-head">
            {new Date(`${date}T09:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
            <span className="plan-day-count">
              {items.length} task{items.length === 1 ? "" : "s"}
            </span>
          </header>
          <div className="plan-day-list">
            {items.map((t) => (
              <div key={t.id} className="plan-task-row">
                <span className="plan-task-tone" data-tone="lilac" aria-hidden />
                <input
                  className="field plan-task-title"
                  value={t.title}
                  onChange={(e) => patch(t.id, { title: e.target.value })}
                />
                <input
                  type="number"
                  min={10}
                  max={240}
                  step={5}
                  className="field plan-task-duration"
                  value={t.durationMinutes}
                  onChange={(e) =>
                    patch(t.id, {
                      durationMinutes: Math.max(
                        5,
                        parseInt(e.target.value, 10) || 30,
                      ),
                    })
                  }
                />
                <span className="plan-task-type">{labelForType(t.type)}</span>
                <button
                  type="button"
                  className="event-rail-task-remove"
                  aria-label="Remove"
                  onClick={() => remove(t.id)}
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const SourcePicker: FC<{
  title: string;
  items: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}> = ({ title, items, selected, onToggle }) => (
  <div className="plan-source-card">
    <header className="plan-source-head">{title}</header>
    {items.length === 0 ? (
      <p className="plan-source-empty">None available.</p>
    ) : (
      <ul className="plan-source-list">
        {items.slice(0, 12).map((it) => {
          const on = selected.includes(it.id);
          return (
            <li key={it.id}>
              <button
                type="button"
                className={`plan-source-item${on ? " active" : ""}`}
                onClick={() => onToggle(it.id)}
              >
                <span className="plan-source-check" aria-hidden>
                  {on ? "✓" : ""}
                </span>
                <span className="plan-source-label">{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

const Field: FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <label className="plan-field">
    <span className="plan-field-label">{label}</span>
    {children}
  </label>
);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function clampDate(input: string, start: string, end: string): string {
  let day = input.slice(0, 10);
  // The sidecar sometimes emits ISO timestamps; ensure we keep just the date.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    try {
      day = new Date(input).toISOString().slice(0, 10);
    } catch {
      day = start;
    }
  }
  if (day < start) return start;
  if (day > end) return end;
  return day;
}

function composeIso(date: string, time: string): string {
  const [yy, mm, dd] = date.split("-").map((s) => parseInt(s, 10));
  const [h, m] = time.split(":").map((s) => parseInt(s, 10));
  const d = new Date(yy!, (mm ?? 1) - 1, dd ?? 1, h ?? 9, m ?? 0, 0, 0);
  return d.toISOString();
}

function mapStudyType(
  t: "review" | "flashcards" | "quiz" | "read" | "write" | "practice",
): CalendarEventType {
  switch (t) {
    case "flashcards":
      return "flashcards";
    case "quiz":
      return "quiz";
    case "read":
      return "reading";
    case "write":
    case "practice":
      return "assignment";
    case "review":
    default:
      return "study_block";
  }
}

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

function groupByDate(
  tasks: DraftTask[],
): Array<{ date: string; items: DraftTask[] }> {
  const m = new Map<string, DraftTask[]>();
  for (const t of tasks) {
    const cur = m.get(t.date);
    if (cur) cur.push(t);
    else m.set(t.date, [t]);
  }
  return Array.from(m.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}
