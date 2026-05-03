/**
 * Calendar page — top-level orchestrator for the calendar feature.
 *
 * Layout:
 *   ┌──────────────────────────────────────┬──────────┐
 *   │ header  (title + search + mascot)    │          │
 *   │ stat row (today / exams / streak)    │  Event   │
 *   │ toolbar (today, prev/next, view)     │  Detail  │
 *   │ grid    (day | week | month)         │  Rail    │
 *   └──────────────────────────────────────┴──────────┘
 *
 * The right rail collapses when no event is selected; the third grid
 * track returns to the global default width via `calendarDetailPanelOpen`.
 */
import type { FC } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CalendarEventRow,
  ClassRow,
  NoteRow,
  QuizRow,
} from "@studynest/shared";
import { useApp } from "../store.js";
import {
  calendarStats as loadCalendarStats,
  ensureCalendarBackfill,
  getEvent,
  listEventsForRange,
  searchEvents as searchCalendarEvents,
  upsertEvent,
  type CalendarStats,
} from "../db/calendar.js";
import {
  listClasses,
  listNotes,
  listQuizzes,
} from "../db/repositories.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { RightPanel } from "./RightPanel.js";
import { AddEditEventDrawer } from "./calendar/AddEditEventDrawer.js";
import { DayView } from "./calendar/DayView.js";
import { EventDetailRail } from "./calendar/EventDetailRail.js";
import { MonthView } from "./calendar/MonthView.js";
import { StudyPlanGeneratorModal } from "./calendar/StudyPlanGeneratorModal.js";
import { computeTimedGridRange } from "./calendar/calendarGridRange.js";
import { WeekView } from "./calendar/WeekView.js";
import {
  fmtRangeLabel,
  fromIsoDate,
  isoDate,
  startOfMonth,
  startOfWeek,
} from "./calendar/eventVisuals.js";
import {
  CalendarIcon,
  CheckIcon,
  ChevLeftIcon,
  ChevRightIcon,
  FlameIcon,
  NoteIcon,
  PlusIcon,
  QuizIcon,
  SearchIcon,
  SparklesIcon,
  TrophyIcon,
} from "./icons.js";
import { BRAND_HERO_URL } from "../lib/brand.js";

export const Calendar: FC = () => {
  const view = useApp((s) => s.calendarView);
  const setView = useApp((s) => s.setCalendarView);
  const cursorIso = useApp((s) => s.calendarCursor);
  const setCursor = useApp((s) => s.setCalendarCursor);
  const selectedEventId = useApp((s) => s.calendarSelectedEventId);
  const setSelectedEvent = useApp((s) => s.setCalendarSelectedEvent);
  const setComposer = useApp((s) => s.setCalendarComposer);
  const setPlanGeneratorOpen = useApp((s) => s.setCalendarPlanGeneratorOpen);

  const cursor = useMemo(() => fromIsoDate(cursorIso), [cursorIso]);

  // Compute the visible window based on the current view; the grid
  // queries the DB for any event overlapping this window.
  const { rangeStart, rangeEnd } = useMemo(
    () => visibleRange(view, cursor),
    [view, cursor],
  );

  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [stats, setStats] = useState<CalendarStats>({
    todaysTasks: 0,
    upcomingExams: 0,
    studyStreak: 0,
    tasksCompletedThisWeek: 0,
  });
  const [reloadTick, setReloadTick] = useState(0);

  const refresh = useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  // Load events for the visible window + the supporting class list.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Backfill is idempotent — safe to call on every mount; it
      // short-circuits if the flag is already set.
      await ensureCalendarBackfill();
      const [evs, cls, st] = await Promise.all([
        listEventsForRange(rangeStart.toISOString(), rangeEnd.toISOString()),
        listClasses(),
        loadCalendarStats(),
      ]);
      if (cancelled) return;
      setEvents(evs);
      setClasses(cls);
      setStats(st);
    })();
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, reloadTick]);

  // When the user creates/edits/deletes an event the rail closes the
  // composer and bumps `reloadTick` so the grid catches up.
  const composer = useApp((s) => s.calendarComposer);
  useEffect(() => {
    if (composer === null) refresh();
  }, [composer, refresh]);

  // Same trick for plan generator modal (closes after accept).
  const planOpen = useApp((s) => s.calendarPlanGeneratorOpen);
  useEffect(() => {
    if (!planOpen) refresh();
  }, [planOpen, refresh]);

  const classesById = useMemo(() => {
    const m = new Map<string, ClassRow>();
    for (const c of classes) m.set(c.id, c);
    return m;
  }, [classes]);

  const timedGridRange = useMemo(
    () => computeTimedGridRange(events),
    [events],
  );

  function shift(delta: number): void {
    const next = new Date(cursor);
    if (view === "day") next.setDate(next.getDate() + delta);
    else if (view === "week") next.setDate(next.getDate() + delta * 7);
    else next.setMonth(next.getMonth() + delta);
    setCursor(isoDate(next));
  }

  function goToday(): void {
    setCursor(isoDate(new Date()));
  }

  function selectDay(d: Date): void {
    setCursor(isoDate(d));
    setView("day");
  }

  function openCompose(): void {
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);
    setComposer({
      mode: "create",
      prefill: {
        type: "study_block",
        start_at: start.toISOString(),
        end_at: end.toISOString(),
      },
    });
  }

  // Drag-create from any timed cell — opens the composer prefilled with
  // the user's gesture so they can confirm metadata before saving.
  const onCreateRange = useCallback(
    (startIso: string, endIso: string): void => {
      setComposer({
        mode: "create",
        prefill: {
          type: "study_block",
          start_at: startIso,
          end_at: endIso,
        },
      });
    },
    [setComposer],
  );

  // Drag-move / drag-resize commits — write the new times directly so
  // the change feels instantaneous, then reload events.
  const onMutateEvent = useCallback(
    async (id: string, startIso: string, endIso: string): Promise<void> => {
      const existing = await getEvent(id);
      if (!existing) return;
      // Optimistic update so the card snaps to its new spot before sync.
      setEvents((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, start_at: startIso, end_at: endIso } : e,
        ),
      );
      await upsertEvent({
        ...existing,
        start_at: startIso,
        end_at: endIso,
      });
      refresh();
    },
    [refresh],
  );

  function openPlanGenerator(): void {
    setPlanGeneratorOpen(true);
  }

  return (
    <>
      <main className="main">
        <div className="main-inner cal-page">
          <CalendarHeader />

          <CalendarStatsRow stats={stats} />

          <CalendarToolbar
            view={view}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onShift={shift}
            onToday={goToday}
            onChangeView={setView}
            onAdd={openCompose}
            onBuildPlan={openPlanGenerator}
          />

          <div className="cal-grid-wrap">
            {view === "week" && (
              <WeekView
                weekStart={rangeStart}
                events={events}
                classesById={classesById}
                selectedEventId={selectedEventId}
                gridRange={timedGridRange}
                onSelectEvent={(id) =>
                  withViewTransition(() => setSelectedEvent(id))
                }
                onMutateEvent={(id, startIso, endIso) =>
                  void onMutateEvent(id, startIso, endIso)
                }
                onCreateRange={onCreateRange}
              />
            )}
            {view === "day" && (
              <DayView
                date={cursor}
                events={events}
                classesById={classesById}
                selectedEventId={selectedEventId}
                gridRange={timedGridRange}
                onSelectEvent={(id) =>
                  withViewTransition(() => setSelectedEvent(id))
                }
                onMutateEvent={(id, startIso, endIso) =>
                  void onMutateEvent(id, startIso, endIso)
                }
                onCreateRange={onCreateRange}
              />
            )}
            {view === "month" && (
              <MonthView
                monthStart={rangeStart}
                events={events}
                classesById={classesById}
                selectedEventId={selectedEventId}
                onSelectEvent={(id) =>
                  withViewTransition(() => setSelectedEvent(id))
                }
                onSelectDay={selectDay}
              />
            )}
          </div>
        </div>
      </main>

      {selectedEventId ? (
        <EventDetailRail eventId={selectedEventId} />
      ) : (
        <RightPanel calendarSwap />
      )}

      <AddEditEventDrawer />
      <StudyPlanGeneratorModal />
    </>
  );
};

/* ---------- Header ---------- */

const CalendarHeader: FC = () => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CalendarEventRow[]>([]);
  const [extraNotes, setExtraNotes] = useState<NoteRow[]>([]);
  const [extraQuizzes, setExtraQuizzes] = useState<QuizRow[]>([]);
  const [extraClasses, setExtraClasses] = useState<ClassRow[]>([]);
  const setSelectedEvent = useApp((s) => s.setCalendarSelectedEvent);
  const setCursor = useApp((s) => s.setCalendarCursor);
  const setView = useApp((s) => s.setView);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setExtraNotes([]);
        setExtraQuizzes([]);
        setExtraClasses([]);
        return;
      }
      const [evs, cls, ns, qs] = await Promise.all([
        searchCalendarEvents(trimmed, 6),
        listClasses(),
        listNotes(null),
        listQuizzes(null),
      ]);
      const lc = trimmed.toLowerCase();
      setResults(evs);
      setExtraClasses(
        cls
          .filter(
            (c) =>
              c.name.toLowerCase().includes(lc) ||
              (c.code ?? "").toLowerCase().includes(lc),
          )
          .slice(0, 4),
      );
      setExtraNotes(
        ns.filter((n) => n.title.toLowerCase().includes(lc)).slice(0, 4),
      );
      setExtraQuizzes(
        qs.filter((qz) => qz.title.toLowerCase().includes(lc)).slice(0, 4),
      );
    }, 120);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent): void {
      if (!searchWrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const hasResults =
    results.length > 0 ||
    extraClasses.length > 0 ||
    extraNotes.length > 0 ||
    extraQuizzes.length > 0;

  const showDropdown = open && q.trim().length > 0;

  return (
    <section className="hero" aria-labelledby="calendar-hero-title">
      <div className="hero-main">
        <div className="search-wrap" ref={searchWrapRef}>
          <label className="search">
            <span className="search-icon" aria-hidden>
              <SearchIcon size={16} />
            </span>
            <input
              id="calendar-hero-search"
              type="search"
              placeholder="Search events, tasks, classes, or topics..."
              aria-label="Search calendar and related items"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
          </label>
          {showDropdown && (
            <div className="search-results" role="listbox">
              {!hasResults ? (
                <div className="search-empty">No matches yet.</div>
              ) : (
                <>
                  {results.length > 0 && (
                    <div className="search-group">
                      <div className="search-group-label">Events</div>
                      {results.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          role="option"
                          className="search-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            withViewTransition(() => {
                              const d = new Date(ev.start_at);
                              setCursor(isoDate(d));
                              setSelectedEvent(ev.id);
                              setOpen(false);
                              setQ("");
                            });
                          }}
                        >
                          <CalendarIcon size={14} />
                          <span className="search-item-title">{ev.title}</span>
                          <span className="search-item-sub">
                            {new Date(ev.start_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {extraClasses.length > 0 && (
                    <div className="search-group">
                      <div className="search-group-label">Classes</div>
                      {extraClasses.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          className="search-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setView({ kind: "classView", classId: c.id });
                            setOpen(false);
                            setQ("");
                          }}
                        >
                          <span
                            className="search-item-swatch"
                            style={{
                              background: c.color ?? "var(--color-primary)",
                            }}
                            aria-hidden
                          />
                          <span className="search-item-title">{c.name}</span>
                          <span className="search-item-sub">{c.code ?? ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {extraNotes.length > 0 && (
                    <div className="search-group">
                      <div className="search-group-label">Notes</div>
                      {extraNotes.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          role="option"
                          className="search-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setView({ kind: "note", noteId: n.id });
                            setOpen(false);
                            setQ("");
                          }}
                        >
                          <NoteIcon size={14} />
                          <span className="search-item-title">{n.title}</span>
                          <span className="search-item-sub">Note</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {extraQuizzes.length > 0 && (
                    <div className="search-group">
                      <div className="search-group-label">Quizzes</div>
                      {extraQuizzes.map((qz) => (
                        <button
                          key={qz.id}
                          type="button"
                          role="option"
                          className="search-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setView({ kind: "quiz", quizId: qz.id });
                            setOpen(false);
                            setQ("");
                          }}
                        >
                          <QuizIcon size={14} />
                          <span className="search-item-title">{qz.title}</span>
                          <span className="search-item-sub">Quiz</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <div className="hero-greeting">
          <h1 id="calendar-hero-title" className="hero-headline">
            Calendar
          </h1>
          <p>
            Plan your study, track deadlines, and stay on top of your goals.
          </p>
        </div>
      </div>
      <div className="hero-illustration" aria-hidden>
        <img
          className="hero-illustration-img"
          src={BRAND_HERO_URL}
          alt=""
          decoding="async"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
    </section>
  );
};

/* ---------- Stats ---------- */

const CalendarStatsRow: FC<{ stats: CalendarStats }> = ({ stats }) => (
  <div className="cal-stats">
    <StatTile
      tone="lilac"
      icon={<CalendarIcon size={16} />}
      label="Today's Tasks"
      value={stats.todaysTasks}
      sub="due today"
    />
    <StatTile
      tone="sage"
      icon={<TrophyIcon size={16} />}
      label="Upcoming Exams"
      value={stats.upcomingExams}
      sub="in next 7 days"
    />
    <StatTile
      tone="sky"
      icon={<FlameIcon size={16} />}
      label="Study Streak"
      value={stats.studyStreak}
      sub="days"
    />
    <StatTile
      tone="peach"
      icon={<CheckIcon size={16} />}
      label="Tasks Completed"
      value={stats.tasksCompletedThisWeek}
      sub="this week"
    />
  </div>
);

const StatTile: FC<{
  tone: "lilac" | "sage" | "sky" | "peach";
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
}> = ({ tone, icon, label, value, sub }) => (
  <div className={`cal-stat-card tone-${tone}`}>
    <span className="cal-stat-icon" aria-hidden>
      {icon}
    </span>
    <div className="cal-stat-text">
      <span className="cal-stat-label">{label}</span>
      <span className="cal-stat-value">{value}</span>
      <span className="cal-stat-sub">{sub}</span>
    </div>
  </div>
);

/* ---------- Toolbar ---------- */

interface ToolbarProps {
  view: "day" | "week" | "month";
  rangeStart: Date;
  rangeEnd: Date;
  onShift: (delta: number) => void;
  onToday: () => void;
  onChangeView: (v: "day" | "week" | "month") => void;
  onAdd: () => void;
  onBuildPlan: () => void;
}

const CalendarToolbar: FC<ToolbarProps> = ({
  view,
  rangeStart,
  rangeEnd,
  onShift,
  onToday,
  onChangeView,
  onAdd,
  onBuildPlan,
}) => {
  const label = useMemo(() => {
    if (view === "day") {
      return rangeStart.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    if (view === "month") {
      return rangeStart.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    }
    // For week view, end is exclusive — display the inclusive last day.
    const inclusiveEnd = new Date(rangeEnd);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
    return fmtRangeLabel(rangeStart, inclusiveEnd);
  }, [view, rangeStart, rangeEnd]);

  return (
    <div className="cal-toolbar">
      <div className="cal-toolbar-left">
        <button
          type="button"
          className="btn-secondary"
          onClick={onToday}
          aria-label="Jump to today"
        >
          Today
        </button>
        <div className="cal-toolbar-arrows">
          <button
            type="button"
            className="cal-toolbar-arrow"
            aria-label="Previous"
            onClick={() => onShift(-1)}
          >
            <ChevLeftIcon size={14} />
          </button>
          <button
            type="button"
            className="cal-toolbar-arrow"
            aria-label="Next"
            onClick={() => onShift(1)}
          >
            <ChevRightIcon size={14} />
          </button>
        </div>
        <h2 className="cal-toolbar-range">{label}</h2>
      </div>
      <div className="cal-toolbar-right">
        <div
          className="cal-view-switch"
          role="tablist"
          aria-label="Calendar view"
        >
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`cal-view-switch-btn${view === v ? " active" : ""}`}
              onClick={() => onChangeView(v)}
            >
              {v[0]!.toUpperCase()}
              {v.slice(1)}
            </button>
          ))}
        </div>
        <button type="button" className="btn-secondary" onClick={onBuildPlan}>
          <SparklesIcon size={14} /> Build Study Plan
        </button>
        <button type="button" className="btn-primary" onClick={onAdd}>
          <PlusIcon size={14} /> Add
        </button>
      </div>
    </div>
  );
};

/* ---------- helpers ---------- */

function visibleRange(
  view: "day" | "week" | "month",
  cursor: Date,
): { rangeStart: Date; rangeEnd: Date } {
  if (view === "day") {
    const start = new Date(cursor);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { rangeStart: start, rangeEnd: end };
  }
  if (view === "week") {
    const start = startOfWeek(cursor);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { rangeStart: start, rangeEnd: end };
  }
  const start = startOfMonth(cursor);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { rangeStart: start, rangeEnd: end };
}

