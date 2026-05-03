import type { DragEvent as ReactDragEvent, FC, SVGProps } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Card } from "./ui/Card.js";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevLeftIcon,
  ChevRightIcon,
  ClassIcon,
  ClockIcon,
  FlameIcon,
  FlagIcon,
  FlashcardIcon,
  NoteIcon,
  PlusIcon,
  SparklesIcon,
  TrophyIcon,
} from "./icons.js";
import { useApp, type TimerMode } from "../store.js";
import {
  DEFAULT_TIMER_DURATIONS,
  TIMER_BOUNDS,
  getTimerDurations,
  saveTimerDurations,
  type TimerDurations,
} from "../lib/timerPrefs.js";
import { withViewTransition } from "../lib/viewTransition.js";
import {
  currentStreak,
  listClasses,
  listDueFlashcards,
  listFlashcardSets,
  listNotes,
  listTasksForRange,
  recordXp,
  totalXp,
  totalXpToday,
  upsertNote,
  upsertStudyTask,
  xpByDay,
} from "../db/repositories.js";
import { ulid, XP_RULES } from "@studynest/shared";
import type { ClassRow, NoteRow, StudyTaskRow } from "@studynest/shared";
import {
  ALL_WIDGETS,
  WIDGET_DESCRIPTIONS,
  WIDGET_LABELS,
  inactiveWidgets,
  type WidgetId,
} from "../lib/rightPanelLayout.js";

/* ---------------------------------------------------------------- */
/* Right panel — gamification + at-a-glance schedule                 */
/*                                                                  */
/* The visible cards are driven by `rightPanelWidgets` in the store. */
/* "Edit" enters a reorder mode where widgets collapse into          */
/* draggable tiles; Save commits, Cancel discards.                   */
/* ---------------------------------------------------------------- */

interface RightPanelProps {
  /** Participates in View Transitions when swapped with `ClassDetailPanel` on Classes. */
  classesSwap?: boolean;
  /** Participates in View Transitions when swapped with `DeckDetailRail` on Flashcards. */
  flashcardsSwap?: boolean;
  /** Participates in View Transitions when swapped with `EventDetailRail` on Calendar. */
  calendarSwap?: boolean;
}

export const RightPanel: FC<RightPanelProps> = ({
  classesSwap,
  flashcardsSwap,
  calendarSwap,
}) => {
  const activeIds = useApp((s) => s.rightPanelWidgets);
  const setActive = useApp((s) => s.setRightPanelWidgets);

  const valid = useMemo(
    () => activeIds.filter((id): id is WidgetId => ALL_WIDGETS.includes(id)),
    [activeIds],
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WidgetId[]>(valid);

  // Keep the draft in sync if the persisted list changes while we're not editing.
  useEffect(() => {
    if (!editing) setDraft(valid);
  }, [valid, editing]);

  function enterEdit(): void {
    withViewTransition(() => {
      setDraft(valid);
      setEditing(true);
    });
  }
  function cancel(): void {
    withViewTransition(() => {
      setDraft(valid);
      setEditing(false);
    });
  }
  function save(): void {
    withViewTransition(() => {
      setActive(draft);
      setEditing(false);
    });
  }

  function reorder(from: number, to: number): void {
    if (from === to || from < 0 || to < 0) return;
    const next = [...draft];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    setDraft(next);
  }

  function removeFromDraft(id: WidgetId): void {
    setDraft(draft.filter((w) => w !== id));
  }

  function add(id: WidgetId): void {
    if (valid.includes(id)) return;
    setActive([...valid, id]);
  }

  return (
    <aside
      className={`right-panel${classesSwap ? " right-panel--classes-swap" : ""}${
        flashcardsSwap ? " right-panel--flashcards-swap" : ""
      }${calendarSwap ? " right-panel--calendar-swap" : ""}`}
    >
      <RightPanelHeader
        editing={editing}
        canSave={draft.length > 0 || valid.length === 0}
        onEdit={enterEdit}
        onCancel={cancel}
        onSave={save}
      />

      {editing ? (
        <ReorderList
          ids={draft}
          onReorder={reorder}
          onRemove={removeFromDraft}
        />
      ) : (
        <>
          {valid.map((id) => {
            const Component = WIDGETS[id];
            return <Component key={id} />;
          })}
          <AddWidgetSkeleton inactive={inactiveWidgets(valid)} onAdd={add} />
        </>
      )}
    </aside>
  );
};

/* ---- Widget registry --------------------------------------------- */

const WIDGETS: Record<WidgetId, FC> = {
  level: LevelCard,
  deadlines: UpcomingDeadlinesCard,
  studyTimer: StudyTimerCard,
  dueFlashcards: DueFlashcardsCard,
  todaysPlan: TodaysPlanCard,
  quickCapture: QuickCaptureCard,
  aiQuickPrompts: AiQuickPromptsCard,
  streakHeatmap: StreakHeatmapCard,
  classFilter: ClassFilterCard,
  studyGoals: StudyGoalsCard,
  miniCalendar: MiniCalendarCard,
};

const WIDGET_ICONS: Record<WidgetId, FC<{ size?: number }>> = {
  level: TrophyIcon,
  deadlines: FlagIcon,
  studyTimer: ClockIcon,
  dueFlashcards: FlashcardIcon,
  todaysPlan: CheckIcon,
  quickCapture: PlusIcon,
  aiQuickPrompts: SparklesIcon,
  streakHeatmap: FlameIcon,
  classFilter: ClassIcon,
  studyGoals: FlagIcon,
  miniCalendar: CalendarIcon,
};

/* ---- Header (Edit / Save / Cancel) ------------------------------- */

interface HeaderProps {
  editing: boolean;
  canSave: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

const RightPanelHeader: FC<HeaderProps> = ({ editing, canSave, onEdit, onCancel, onSave }) => {
  if (!editing) {
    return (
      <div className="right-panel-header">
        <button type="button" className="right-panel-edit" onClick={onEdit}>
          Edit
        </button>
      </div>
    );
  }
  return (
    <div className="right-panel-header editing">
      <span className="right-panel-edit-title">Reorder modules</span>
      <div className="right-panel-edit-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onSave}
          disabled={!canSave}
        >
          Save
        </button>
      </div>
    </div>
  );
};

/* ---- Reorder list (drag & drop tiles) ---------------------------- */

interface ReorderProps {
  ids: WidgetId[];
  onReorder: (from: number, to: number) => void;
  onRemove: (id: WidgetId) => void;
}

const ReorderList: FC<ReorderProps> = ({ ids, onReorder, onRemove }) => {
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const tileRefs = useRef<Map<WidgetId, HTMLLIElement>>(new Map());
  const prevTops = useRef<Map<WidgetId, number>>(new Map());
  // Remember which target index we last decided on, so dragover frames
  // inside the same slot don't re-fire the same reorder.
  const lastTargetIdx = useRef<number | null>(null);

  // FLIP: after each reorder, slide every *non-dragged* tile from its
  // previous Y to the new one so the rest of the list visibly opens up
  // for the dragged item.
  useLayoutEffect(() => {
    const next = new Map<WidgetId, number>();
    tileRefs.current.forEach((el, id) => {
      if (el.isConnected) next.set(id, el.getBoundingClientRect().top);
    });
    next.forEach((top, id) => {
      if (id === dragId) return;
      const prev = prevTops.current.get(id);
      const el = tileRefs.current.get(id);
      if (!el || prev === undefined || prev === top) return;
      const delta = prev - top;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      void el.offsetHeight;
      el.style.transition = "transform 180ms cubic-bezier(0.2, 0.7, 0.3, 1)";
      el.style.transform = "";
    });
    prevTops.current = next;
  }, [ids, dragId]);

  if (ids.length === 0) {
    return (
      <p className="right-empty">
        No modules. Cancel and use “Add a module” to choose one.
      </p>
    );
  }

  function handleDragOver(e: ReactDragEvent<HTMLLIElement>, hoverIdx: number): void {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragId) return;
    const fromIdx = ids.indexOf(dragId);
    if (fromIdx < 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const after = e.clientY > midY;
    let toIdx = after ? hoverIdx + 1 : hoverIdx;
    if (fromIdx < toIdx) toIdx -= 1;
    if (toIdx < 0) toIdx = 0;
    if (toIdx >= ids.length) toIdx = ids.length - 1;

    if (toIdx === fromIdx) return;
    if (lastTargetIdx.current === toIdx) return;
    lastTargetIdx.current = toIdx;
    onReorder(fromIdx, toIdx);
  }

  return (
    <ul className="reorder-list" role="listbox" aria-label="Drag to reorder">
      {ids.map((id, i) => {
        const Icon = WIDGET_ICONS[id];
        const isDragging = dragId === id;
        return (
          <li
            key={id}
            ref={(el) => {
              if (el) tileRefs.current.set(id, el);
              else tileRefs.current.delete(id);
            }}
            className={`reorder-tile${isDragging ? " is-dragging" : ""}`}
            draggable
            onDragStart={(e) => {
              setDragId(id);
              lastTargetIdx.current = i;
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", id);
            }}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => {
              e.preventDefault();
              setDragId(null);
              lastTargetIdx.current = null;
            }}
            onDragEnd={() => {
              setDragId(null);
              lastTargetIdx.current = null;
            }}
          >
            <span className="reorder-grip" aria-hidden>
              <GripIcon />
            </span>
            <span className="reorder-icon"><Icon size={16} /></span>
            <span className="reorder-label">{WIDGET_LABELS[id]}</span>
            <button
              type="button"
              className="reorder-remove"
              aria-label={`Remove ${WIDGET_LABELS[id]}`}
              onClick={() => onRemove(id)}
            >
              <XIcon />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const GripIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <circle cx="9" cy="6" r="1.4" />
    <circle cx="15" cy="6" r="1.4" />
    <circle cx="9" cy="12" r="1.4" />
    <circle cx="15" cy="12" r="1.4" />
    <circle cx="9" cy="18" r="1.4" />
    <circle cx="15" cy="18" r="1.4" />
  </svg>
);

const XIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    {...props}
  >
    <path d="M6 6l12 12M6 18 18 6" />
  </svg>
);

/* ---- Shared task loading ---------------------------------------- */

const ACCENTS = [
  "var(--color-accentRose)",
  "var(--color-accentAmber)",
  "var(--color-accentSage)",
  "var(--color-primary)",
];

/**
 * Pulls scheduled tasks for the next `daysAhead` days. When the user has
 * picked a Focus Class we additionally load notes once and filter tasks
 * whose `note_id` belongs to that class. Notes are cached in component
 * state so toggling the filter is snappy.
 */
function useUpcomingTasks(daysAhead: number): StudyTaskRow[] {
  const focusedClassId = useApp((s) => s.focusedClassId);
  const [tasks, setTasks] = useState<StudyTaskRow[]>([]);
  const [noteToClass, setNoteToClass] = useState<Map<string, string | null>>(
    new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + daysAhead);
    void Promise.all([
      listTasksForRange(today.toISOString(), end.toISOString()),
      focusedClassId ? listNotes(null) : Promise.resolve<NoteRow[]>([]),
    ]).then(([rows, notes]) => {
      if (cancelled) return;
      const upcoming = rows
        .filter((r) => !r.completed_at)
        .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
      setTasks(upcoming);
      if (focusedClassId) {
        const m = new Map<string, string | null>();
        for (const n of notes) m.set(n.id, n.class_id);
        setNoteToClass(m);
      } else {
        setNoteToClass(new Map());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [daysAhead, focusedClassId]);

  if (!focusedClassId) return tasks;
  return tasks.filter(
    (t) => t.note_id && noteToClass.get(t.note_id) === focusedClassId,
  );
}

function fmtDeadline(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysUntil(d: Date): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const t = new Date(d);  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 86_400_000);
}

function describeDaysLeft(n: number): string {
  if (n <= 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `${n} days left`;
}

function fmtTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/* ---- Study Goals ------------------------------------------------- */

function StudyGoalsCard(): JSX.Element {
  const streak = useApp((s) => s.streak);
  const target = 6;
  const progress = Math.min(streak, target);
  return (
    <Card title="Study Goals" icon={<FlagIcon size={18} />} className="goal-card">
      <div className="goal-row">
        <span className="goal-name">Weekly Goal</span>
        <span className="goal-progress">{progress} of {target} days</span>
      </div>
      <div className="goal-bar">
        <span style={{ width: `${(progress / target) * 100}%` }} />
      </div>
      <p className="goal-encourage">Keep going! You've got this.</p>
      <button type="button" className="goal-button">View Goals</button>
    </Card>
  );
}

/* ---- Level / XP -------------------------------------------------- */

const XP_PER_LEVEL = 250;

function levelFromXp(xp: number): { level: number; floor: number; ceiling: number } {
  const level = Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
  const floor = (level - 1) * XP_PER_LEVEL;
  const ceiling = level * XP_PER_LEVEL;
  return { level, floor, ceiling };
}

function LevelCard(): JSX.Element {
  const xpToday = useApp((s) => s.xpToday);
  const [lifetime, setLifetime] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void totalXp().then((t) => {
      if (!cancelled) setLifetime(t);
    });
    return () => {
      cancelled = true;
    };
  }, [xpToday]);

  const { level, floor, ceiling } = levelFromXp(lifetime);
  const intoLevel = lifetime - floor;
  const span = ceiling - floor;
  const pct = Math.max(0, Math.min(1, intoLevel / span));

  return (
    <Card className="level-card">
      <div className="level-top">
        <span className="badge"><TrophyIcon size={14} /></span>
        <div className="level-text">
          <span className="l1">Level {level}</span>
          <span className="l2">Study Goat</span>
        </div>
      </div>
      <div className="xp-row">
        <span className="label">XP</span>
        <span className="val">
          {lifetime.toLocaleString()} / {ceiling.toLocaleString()}
        </span>
      </div>
      <div className="level-bar">
        <span style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="level-foot">
        {span - intoLevel} XP to level {level + 1}
      </div>
    </Card>
  );
}

/* ---- Upcoming Deadlines ------------------------------------------ */

function UpcomingDeadlinesCard(): JSX.Element {
  const tasks = useUpcomingTasks(14);
  const setView = useApp((s) => s.setView);
  const focusedClassId = useApp((s) => s.focusedClassId);

  const subtitle = focusedClassId ? "Filtered to focus class" : undefined;

  return (
    <Card title="Upcoming Deadlines">
      {subtitle && <span className="card-subtitle">{subtitle}</span>}
      {tasks.length === 0 ? (
        <p className="right-empty">
          {focusedClassId
            ? "No deadlines for the focused class."
            : "No deadlines in the next two weeks."}
        </p>
      ) : (
        <div className="deadlines">
          {tasks.slice(0, 4).map((t, i) => {
            const d = new Date(t.scheduled_for);
            const left = daysUntil(d);
            const color = ACCENTS[i % ACCENTS.length];
            return (
              <div key={t.id} className="deadline-row">
                <span className="bar" style={{ background: color }} />
                <div className="who">
                  <span className="title">{t.title}</span>
                  <span className="when">{fmtDeadline(d)}</span>
                </div>
                <span className="days">{describeDaysLeft(left)}</span>
              </div>
            );
          })}
        </div>
      )}
      <button
        type="button"
        className="deadline-link"
        onClick={() => setView({ kind: "calendar" })}
      >
        View all deadlines →
      </button>
    </Card>
  );
}

/* ---- Mini calendar ----------------------------------------------- */

function MiniCalendarCard(): JSX.Element {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const tasks = useUpcomingTasks(60);

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const eventDays = useMemo(
    () => new Set(tasks.map((t) => new Date(t.scheduled_for).toDateString())),
    [tasks],
  );

  function shift(delta: number): void {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + delta);
    setCursor(next);
  }

  return (
    <Card icon={<CalendarIcon size={16} />} title="Calendar" className="mini-cal-card">
      <div className="mini-cal-head">
        <span className="mini-month">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <div className="mini-nav">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevLeftIcon size={14} />
          </button>
          <button type="button" aria-label="Next month" onClick={() => shift(1)}>
            <ChevRightIcon size={14} />
          </button>
        </div>
      </div>
      <div className="mini-cal-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span className="dow" key={i}>{d}</span>
        ))}
        {grid.map(({ date, inMonth }) => {
          const isToday = date.toDateString() === today.toDateString();
          const hasEvt = eventDays.has(date.toDateString());
          const cls = ["day"];
          if (!inMonth) cls.push("outside");
          if (isToday) cls.push("today");
          if (hasEvt) cls.push("has-event");
          return (
            <span className={cls.join(" ")} key={date.toISOString()}>
              {date.getDate()}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

function buildMonthGrid(monthStart: Date): { date: Date; inMonth: boolean }[] {
  const m = monthStart.getMonth();
  const y = monthStart.getFullYear();
  const first = new Date(y, m, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const out: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({ date: d, inMonth: d.getMonth() === m });
  }
  return out;
}

/* ---- Study Timer ------------------------------------------------- */

const MODE_LABELS: Record<TimerMode, string> = {
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

const SettingsIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

/** Now-ms hook that re-renders every `intervalMs` while active. */
function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

function fmtMinSec(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function StudyTimerCard(): JSX.Element {
  const timer = useApp((s) => s.activeTimer);
  const setTimer = useApp((s) => s.setActiveTimer);
  const [mode, setMode] = useState<TimerMode>(timer?.mode ?? "focus");
  const [durations, setDurationsState] = useState<TimerDurations>(() =>
    getTimerDurations(),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  // While idle, let the user pre-select a task so the new session starts
  // already linked instead of needing two clicks.
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const running = !!timer && timer.pausedRemainingMs === null;
  const isPaused = !!timer && timer.pausedRemainingMs !== null;
  const now = useNow(running, 250);

  // Mirror the active timer's mode into the local UI mode.
  useEffect(() => {
    if (timer) setMode(timer.mode);
  }, [timer]);

  function persistDurations(next: TimerDurations): void {
    setDurationsState(next);
    saveTimerDurations(next);
  }

  const previewMs = durations[mode] * 60_000;
  const remainingMs = (() => {
    if (!timer) return previewMs;
    if (timer.pausedRemainingMs !== null) return timer.pausedRemainingMs;
    return Math.max(0, timer.endsAt - now);
  })();

  const pct = (() => {
    const dur = timer?.durationMs ?? previewMs;
    if (dur <= 0) return 0;
    if (!timer) return 0; // idle ring stays empty for a clean look
    return 1 - Math.max(0, Math.min(1, remainingMs / dur));
  })();

  // Award XP once when a focus session naturally finishes.
  const completedRef = useRef(false);
  useEffect(() => {
    if (!timer || timer.pausedRemainingMs !== null) {
      completedRef.current = false;
      return;
    }
    if (now >= timer.endsAt && !completedRef.current) {
      completedRef.current = true;
      const wasFocus = timer.mode === "focus";
      setTimer(null);
      if (wasFocus) void recordXp("studyTimerComplete", XP_RULES.studyTaskComplete);
    }
  }, [now, timer, setTimer]);

  function start(): void {
    const dur = durations[mode] * 60_000;
    setTimer({
      mode,
      endsAt: Date.now() + dur,
      durationMs: dur,
      pausedRemainingMs: null,
      taskId: pendingTaskId,
    });
  }
  function pause(): void {
    if (!timer || timer.pausedRemainingMs !== null) return;
    setTimer({
      ...timer,
      pausedRemainingMs: Math.max(0, timer.endsAt - Date.now()),
    });
  }
  function resume(): void {
    if (!timer || timer.pausedRemainingMs === null) return;
    setTimer({
      ...timer,
      endsAt: Date.now() + timer.pausedRemainingMs,
      pausedRemainingMs: null,
    });
  }
  function stop(): void {
    setTimer(null);
  }
  function reset(): void {
    if (!timer) return;
    const dur = timer.durationMs;
    setTimer({
      ...timer,
      endsAt: Date.now() + dur,
      pausedRemainingMs: null,
    });
  }

  const subLabel = isPaused
    ? "Paused"
    : timer
    ? MODE_LABELS[timer.mode]
    : MODE_LABELS[mode];

  return (
    <Card
      className="timer-card"
      icon={<ClockIcon size={16} />}
      title="Study Timer"
      action={
        <button
          type="button"
          className="header-action"
          aria-label="Timer settings"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
        >
          <SettingsIcon />
        </button>
      }
    >
      {settingsOpen ? (
        <TimerSettings
          durations={durations}
          onChange={persistDurations}
          onClose={() => setSettingsOpen(false)}
        />
      ) : (
        <>
          <div className="timer-modes" role="tablist" aria-label="Timer mode">
            {(Object.keys(MODE_LABELS) as TimerMode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`timer-mode${mode === m ? " active" : ""}`}
                onClick={() => {
                  if (running) return;
                  setMode(m);
                }}
                disabled={running}
                title={`${MODE_LABELS[m]} — ${durations[m]} min`}
              >
                <span className="timer-mode-label">{MODE_LABELS[m]}</span>
                <span className="timer-mode-mins">{durations[m]}m</span>
              </button>
            ))}
          </div>

          <TimerRing pct={pct} label={fmtMinSec(remainingMs)} sub={subLabel} state={running ? "running" : isPaused ? "paused" : "idle"} />

          <div className="timer-actions">
            {!timer && (
              <button type="button" className="btn-primary timer-start" onClick={start}>
                Start {durations[mode]}-min {MODE_LABELS[mode].toLowerCase()}
              </button>
            )}
            {timer && !isPaused && (
              <>
                <button type="button" className="btn-secondary" onClick={pause}>Pause</button>
                <button type="button" className="btn-ghost" onClick={reset} title="Restart from full duration">Reset</button>
                <button type="button" className="btn-ghost" onClick={stop}>Stop</button>
              </>
            )}
            {timer && isPaused && (
              <>
                <button type="button" className="btn-primary timer-start" onClick={resume}>Resume</button>
                <button type="button" className="btn-ghost" onClick={stop}>Stop</button>
              </>
            )}
          </div>

          <TaskBinder
            pendingTaskId={pendingTaskId}
            setPendingTaskId={setPendingTaskId}
          />
        </>
      )}
    </Card>
  );
}

/** Inline ring rendered with two circles (track + progress). */
const TimerRing: FC<{
  pct: number;
  label: string;
  sub: string;
  state: "idle" | "running" | "paused";
}> = ({ pct, label, sub, state }) => {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className={`timer-ring is-${state}`}>
      <svg viewBox="0 0 110 110" width={128} height={128} aria-hidden>
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--color-surfaceMuted)" strokeWidth="8" />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dashoffset 240ms linear" }}
        />
      </svg>
      <div className="timer-center">
        <span className="timer-time">{label}</span>
        <span className="timer-sub">{sub}</span>
      </div>
    </div>
  );
};

/** Settings popover for editing the per-mode durations. */
const TimerSettings: FC<{
  durations: TimerDurations;
  onChange: (next: TimerDurations) => void;
  onClose: () => void;
}> = ({ durations, onChange, onClose }) => {
  const [draft, setDraft] = useState<TimerDurations>(durations);

  function set(field: TimerMode, value: string): void {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return;
    setDraft((d) => ({ ...d, [field]: Math.min(TIMER_BOUNDS.max, Math.max(TIMER_BOUNDS.min, n)) }));
  }

  function save(): void {
    onChange(draft);
    onClose();
  }
  function reset(): void {
    setDraft({ ...DEFAULT_TIMER_DURATIONS });
  }

  return (
    <div className="timer-settings">
      <p className="card-subtitle muted" style={{ margin: 0 }}>
        Custom durations (minutes)
      </p>
      {(Object.keys(MODE_LABELS) as TimerMode[]).map((m) => (
        <label key={m} className="timer-settings-row">
          <span className="timer-settings-label">{MODE_LABELS[m]}</span>
          <input
            type="number"
            className="field"
            min={TIMER_BOUNDS.min}
            max={TIMER_BOUNDS.max}
            value={draft[m]}
            onChange={(e) => set(m, e.target.value)}
          />
        </label>
      ))}
      <div className="timer-settings-actions">
        <button type="button" className="btn-ghost" onClick={reset}>Reset</button>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save}>Save</button>
      </div>
    </div>
  );
};

/** Optional task picker. Pre-Start, edits a local pending id; mid-session,
 *  edits the live timer's `taskId` so re-binding works without restart. */
const TaskBinder: FC<{
  pendingTaskId: string | null;
  setPendingTaskId: (id: string | null) => void;
}> = ({ pendingTaskId, setPendingTaskId }) => {
  const timer = useApp((s) => s.activeTimer);
  const setTimer = useApp((s) => s.setActiveTimer);
  const tasks = useUpcomingTasks(7);

  if (tasks.length === 0) return null;

  const value = timer ? timer.taskId ?? "" : pendingTaskId ?? "";

  return (
    <label className="timer-task">
      <span className="timer-task-label">For task</span>
      <select
        className="field"
        value={value}
        onChange={(e) => {
          const id = e.target.value || null;
          if (timer) setTimer({ ...timer, taskId: id });
          else setPendingTaskId(id);
        }}
      >
        <option value="">— none —</option>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>{t.title}</option>
        ))}
      </select>
    </label>
  );
};

/* ---- Due Flashcards --------------------------------------------- */

function DueFlashcardsCard(): JSX.Element {
  const setView = useApp((s) => s.setView);
  const [count, setCount] = useState<number>(0);
  const [decks, setDecks] = useState<Array<{ id: string; title: string; due: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listDueFlashcards(200), listFlashcardSets(null)]).then(
      ([due, sets]) => {
        if (cancelled) return;
        setCount(due.length);
        const bySet = new Map<string, number>();
        for (const c of due) bySet.set(c.set_id, (bySet.get(c.set_id) ?? 0) + 1);
        const ranked = sets
          .map((s) => ({ id: s.id, title: s.title, due: bySet.get(s.id) ?? 0 }))
          .filter((s) => s.due > 0)
          .sort((a, b) => b.due - a.due)
          .slice(0, 3);
        setDecks(ranked);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card title="Flashcards Due" icon={<FlashcardIcon size={16} />} className="flashdue-card">
      <div className="flashdue-top">
        <span className="flashdue-count">{count}</span>
        <span className="flashdue-unit">cards due</span>
      </div>
      {decks.length > 0 ? (
        <div className="flashdue-decks">
          {decks.map((d) => (
            <button
              key={d.id}
              type="button"
              className="flashdue-deck"
              onClick={() => setView({ kind: "flashcardSet", setId: d.id })}
            >
              <span className="flashdue-deck-title">{d.title}</span>
              <span className="flashdue-deck-count">{d.due}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="right-empty">No decks have due cards. Create some flashcards from a note.</p>
      )}
      <button
        type="button"
        className="btn-primary"
        disabled={count === 0}
        onClick={() => setView({ kind: "flashcards" })}
      >
        Review now
      </button>
    </Card>
  );
}

/* ---- Today's Plan ----------------------------------------------- */

function TodaysPlanCard(): JSX.Element {
  const setView = useApp((s) => s.setView);
  const focusedClassId = useApp((s) => s.focusedClassId);
  const [tasks, setTasks] = useState<StudyTaskRow[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [classMap, setClassMap] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    void Promise.all([
      listTasksForRange(today.toISOString(), tomorrow.toISOString()),
      focusedClassId ? listNotes(null) : Promise.resolve<NoteRow[]>([]),
    ]).then(([rows, notes]) => {
      if (cancelled) return;
      setTasks(rows.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
      const m = new Map<string, string | null>();
      for (const n of notes) m.set(n.id, n.class_id);
      setClassMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadTick, focusedClassId]);

  const visible = focusedClassId
    ? tasks.filter((t) => t.note_id && classMap.get(t.note_id) === focusedClassId)
    : tasks;

  async function toggle(t: StudyTaskRow): Promise<void> {
    const wasComplete = !!t.completed_at;
    await upsertStudyTask({
      ...t,
      completed_at: wasComplete ? null : new Date().toISOString(),
    });
    if (!wasComplete) await recordXp("studyTaskComplete", XP_RULES.studyTaskComplete);
    setReloadTick((n) => n + 1);
  }

  return (
    <Card title="Today's Plan" icon={<CheckIcon size={16} />} className="today-plan-card">
      {visible.length === 0 ? (
        <p className="right-empty">Nothing scheduled today.</p>
      ) : (
        <div className="plan-list compact">
          {visible.map((t) => {
            const done = !!t.completed_at;
            return (
              <div key={t.id} className={`plan-row ${done ? "done" : ""}`}>
                <button
                  type="button"
                  className={`plan-check ${done ? "done" : ""}`}
                  aria-label={done ? "Mark task incomplete" : "Mark task complete"}
                  onClick={() => void toggle(t)}
                >
                  {done && <CheckIcon size={12} />}
                </button>
                <span className="plan-title">{t.title}</span>
                <span className="plan-time">{fmtTimeOfDay(t.scheduled_for)}</span>
              </div>
            );
          })}
        </div>
      )}
      <button type="button" className="plan-link" onClick={() => setView({ kind: "calendar" })}>
        Full schedule <ArrowRightIcon size={12} />
      </button>
    </Card>
  );
}

/* ---- Quick Capture ---------------------------------------------- */

function QuickCaptureCard(): JSX.Element {
  const setView = useApp((s) => s.setView);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"task" | "note" | null>(null);

  async function addTask(): Promise<void> {
    const title = text.trim();
    if (!title) return;
    setBusy("task");
    try {
      const today = new Date();
      today.setHours(9, 0, 0, 0);
      await upsertStudyTask({
        id: ulid("tsk"),
        type: "review",
        title,
        scheduled_for: today.toISOString(),
        duration_minutes: 25,
      });
      await recordXp("createNote", 1);
      setText("");
    } finally {
      setBusy(null);
    }
  }

  async function addNote(): Promise<void> {
    const title = text.trim();
    if (!title) return;
    setBusy("note");
    try {
      const note = await upsertNote({ title, content_markdown: "" });
      setSelectedNote(note);
      setView({ kind: "note", noteId: note.id });
      await recordXp("createNote", XP_RULES.createNote);
      setText("");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Quick Capture" icon={<PlusIcon size={16} />} className="capture-card">
      <input
        className="field"
        placeholder="What's on your mind?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void addTask();
          }
        }}
        disabled={busy !== null}
      />
      <div className="capture-actions">
        <button
          type="button"
          className="btn-secondary"
          disabled={!text.trim() || busy !== null}
          onClick={() => void addTask()}
        >
          {busy === "task" ? "Adding…" : "Add task"}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!text.trim() || busy !== null}
          onClick={() => void addNote()}
        >
          {busy === "note" ? "Opening…" : "New note"}
        </button>
      </div>
    </Card>
  );
}

/* ---- AI Quick Prompts ------------------------------------------- */

function AiQuickPromptsCard(): JSX.Element {
  const sidecarLoaded = useApp((s) => s.sidecarLoaded);
  const setView = useApp((s) => s.setView);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const [recent, setRecent] = useState<NoteRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listNotes(null).then((ns) => {
      if (!cancelled) setRecent(ns[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function openLastNote(): void {
    if (!recent) return;
    setSelectedNote(recent);
    setView({ kind: "note", noteId: recent.id });
  }

  return (
    <Card title="AI Shortcuts" icon={<SparklesIcon size={16} />} className="ai-card">
      {!sidecarLoaded && (
        <p className="card-subtitle muted">
          The learning assistant is still starting. Try again in a moment.
        </p>
      )}
      <div className="ai-actions">
        <button
          type="button"
          className="btn-secondary"
          disabled={!recent}
          onClick={openLastNote}
        >
          Summarize last note
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setView({ kind: "calendar" })}
        >
          Plan with AI
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setView({ kind: "quizzes" })}
        >
          Quiz me
        </button>
      </div>
    </Card>
  );
}

/* ---- Streak Heatmap --------------------------------------------- */

const HEATMAP_WEEKS = 12;

function StreakHeatmapCard(): JSX.Element {
  const xpToday = useApp((s) => s.xpToday);
  const [byDay, setByDay] = useState<Map<string, number>>(new Map());
  const [streak, setStreak] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([xpByDay(HEATMAP_WEEKS * 7), currentStreak()]).then(
      ([rows, s]) => {
        if (cancelled) return;
        const m = new Map<string, number>();
        for (const r of rows) m.set(r.date, r.points);
        setByDay(m);
        setStreak(s);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [xpToday]);

  const cells = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // End on Saturday of this week so the grid lines up neatly.
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const out: Array<{ date: Date; level: number; points: number }> = [];
    for (let i = HEATMAP_WEEKS * 7 - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const pts = byDay.get(key) ?? 0;
      const level = pts === 0 ? 0 : pts < 10 ? 1 : pts < 25 ? 2 : pts < 50 ? 3 : 4;
      out.push({ date: d, level, points: pts });
    }
    return out;
  }, [byDay]);

  const total = useMemo(
    () => Array.from(byDay.values()).reduce((a, b) => a + b, 0),
    [byDay],
  );

  return (
    <Card title="Activity Heatmap" icon={<FlameIcon size={16} />} className="heatmap-card">
      <div className="heatmap-stats">
        <div>
          <span className="hm-num">{streak}</span>
          <span className="hm-lbl">day streak</span>
        </div>
        <div>
          <span className="hm-num">{total.toLocaleString()}</span>
          <span className="hm-lbl">XP last 12w</span>
        </div>
      </div>
      <div
        className="heatmap-grid"
        role="img"
        aria-label={`Activity heatmap, ${streak} day streak`}
      >
        {cells.map((c) => (
          <span
            key={c.date.toISOString()}
            className={`hm-cell hm-l${c.level}`}
            title={`${c.date.toLocaleDateString()} — ${c.points} XP`}
          />
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`hm-cell hm-l${l}`} />
        ))}
        <span>More</span>
      </div>
    </Card>
  );
}

/* ---- Class Filter ----------------------------------------------- */

function ClassFilterCard(): JSX.Element {
  const focusedClassId = useApp((s) => s.focusedClassId);
  const setFocusedClass = useApp((s) => s.setFocusedClass);
  const classesInStore = useApp((s) => s.classes);
  const [classes, setClasses] = useState<ClassRow[]>(classesInStore);

  useEffect(() => {
    if (classesInStore.length > 0) {
      setClasses(classesInStore);
      return;
    }
    let cancelled = false;
    void listClasses().then((rows) => {
      if (!cancelled) setClasses(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [classesInStore]);

  return (
    <Card title="Focus Class" icon={<ClassIcon size={16} />} className="class-filter-card">
      {classes.length === 0 ? (
        <p className="right-empty">No classes yet. Add one from the Classes page.</p>
      ) : (
        <div className="class-chip-row">
          <button
            type="button"
            className={`class-chip${focusedClassId === null ? " active" : ""}`}
            onClick={() => setFocusedClass(null)}
          >
            All
          </button>
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`class-chip${focusedClassId === c.id ? " active" : ""}`}
              style={
                focusedClassId === c.id && c.color
                  ? { background: c.color, borderColor: c.color, color: "var(--color-onPrimary)" }
                  : undefined
              }
              onClick={() => setFocusedClass(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      {focusedClassId && (
        <p className="card-subtitle muted">
          Deadlines, calendar and Today's Plan are filtered.
        </p>
      )}
    </Card>
  );
}

/* ---- Add widget skeleton ----------------------------------------- */

interface AddProps {
  inactive: WidgetId[];
  onAdd: (id: WidgetId) => void;
}

const AddWidgetSkeleton: FC<AddProps> = ({ inactive, onAdd }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Remember the panel's scrollTop at the moment we open the menu so we
  // can smoothly slide back up after the user closes it.
  const restoreScroll = useRef<number | null>(null);

  /** Walk up to find the `.right-panel` aside, which is the scroll container. */
  function getScroller(): HTMLElement | null {
    return wrapRef.current?.closest(".right-panel") as HTMLElement | null;
  }

  // When the menu opens, scroll the panel just enough to show the full
  // popover. When it closes, slide back to where the user was.
  useEffect(() => {
    const scroller = getScroller();
    if (!scroller) return;
    if (open) {
      restoreScroll.current = scroller.scrollTop;
      // Wait a frame so the menu has actually been rendered and has a
      // measurable height before we compute the scroll target.
      const id = requestAnimationFrame(() => {
        const menu = menuRef.current;
        if (!menu) return;
        const menuBottom = menu.getBoundingClientRect().bottom;
        const scrollerBottom = scroller.getBoundingClientRect().bottom;
        const overflow = menuBottom - scrollerBottom;
        if (overflow > 0) {
          scroller.scrollTo({
            top: scroller.scrollTop + overflow + 12, // 12px breathing room
            behavior: "smooth",
          });
        }
      });
      return () => cancelAnimationFrame(id);
    }
    // Closing — restore prior scroll position if we have one.
    if (restoreScroll.current !== null) {
      scroller.scrollTo({ top: restoreScroll.current, behavior: "smooth" });
      restoreScroll.current = null;
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent): void {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const empty = inactive.length === 0;

  return (
    <div className="add-widget" ref={wrapRef}>
      <button
        type="button"
        className="add-widget-card"
        onClick={() => !empty && setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={empty}
      >
        <span className="add-widget-icon"><PlusIcon size={18} /></span>
        <span className="add-widget-text">
          <span className="add-widget-title">
            {empty ? "All modules added" : "Add a module"}
          </span>
          <span className="add-widget-sub">
            {empty
              ? "Use Edit to remove or reorder modules."
              : "Customize what shows in this panel."}
          </span>
        </span>
      </button>
      {open && !empty && (
        <div className="add-widget-menu" role="menu" ref={menuRef}>
          {inactive.map((id) => {
            const Icon = WIDGET_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                className="add-widget-item"
                onClick={() => {
                  setOpen(false);
                  onAdd(id);
                }}
              >
                <span className="add-widget-item-row">
                  <span className="add-widget-item-icon"><Icon size={14} /></span>
                  <span className="add-widget-item-title">{WIDGET_LABELS[id]}</span>
                </span>
                <span className="add-widget-item-sub">{WIDGET_DESCRIPTIONS[id]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
