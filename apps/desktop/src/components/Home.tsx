import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  currentStreak,
  listClasses,
  listDueFlashcards,
  listNotes,
  listTasksForRange,
  quizStats,
  recordXp,
  totalXpToday,
  upsertAttachment,
  upsertNote,
  upsertStudyTask,
} from "../db/repositories.js";
import { useApp } from "../store.js";
import { Card } from "./ui/Card.js";
import { Donut, ProgressRing } from "./ui/ProgressRing.js";
import { AudioRecorderModal } from "./AudioRecorderModal.js";
import { HeroSearch } from "./HeroSearch.js";
import { BRAND_HERO_URL } from "../lib/brand.js";
import { firstName } from "../lib/profile.js";
import { refreshUserBadges } from "../lib/badgesSync.js";
import { getGreeting } from "../lib/greeting.js";
import {
  BADGE_DEFINITIONS,
  XP_RULES,
  isBadgeId,
} from "@studynest/shared";
import type { ClassRow, StudyTaskRow } from "@studynest/shared";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  FlameIcon,
  FlashcardIcon,
  ImageIcon,
  MicIcon,
  NoteIcon,
  PencilIcon,
  QuizIcon,
  SparklesIcon,
} from "./icons.js";

/* ================================================================== */
/* Home — primary dashboard                                            */
/* ================================================================== */

export const Home: FC = () => {
  const setXp = useApp((s) => s.setXp);
  const setDueCards = useApp((s) => s.setDueCards);
  const setWeekTasks = useApp((s) => s.setWeekTasks);
  const setNotes = useApp((s) => s.setNotes);
  const setClasses = useApp((s) => s.setClasses);
  const xpToday = useApp((s) => s.xpToday);
  const streak = useApp((s) => s.streak);
  const dueCards = useApp((s) => s.dueCards);
  const weekTasks = useApp((s) => s.weekTasks);
  const notes = useApp((s) => s.notes);

  // Quiz stats are home-only state — kept here so refreshing this view
  // (e.g. after a new attempt) doesn't require a global store slot.
  const [stats, setStats] = useState<{ taken: number; avgPct: number; best: number }>({
    taken: 0,
    avgPct: 0,
    best: 0,
  });

  const reloadAll = useCallback(async (): Promise<void> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inAWeek = new Date(today);
    inAWeek.setDate(today.getDate() + 7);
    const [xp, str, due, ns, cls, tasks, qs] = await Promise.all([
      totalXpToday(),
      currentStreak(),
      listDueFlashcards(50),
      listNotes(null),
      listClasses(),
      listTasksForRange(today.toISOString(), inAWeek.toISOString()),
      quizStats(),
    ]);
    setXp(xp, str);
    setDueCards(due);
    setNotes(ns);
    setClasses(cls);
    setWeekTasks(tasks);
    setStats(qs);
    await refreshUserBadges();
  }, [setXp, setDueCards, setNotes, setClasses, setWeekTasks]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  return (
    <main className="main">
      <div className="main-inner">
        <Hero />
        <QuickActions onCreated={() => void reloadAll()} />
        <div className="dash-row">
          <StreakCard streak={streak} />
          <ContinueLastNoteCard />
          <TodaysPlanCard tasks={weekTasks} onChange={() => void reloadAll()} />
        </div>
        <div className="dash-row">
          <RecentNotesCard />
          <FlashcardsDueCard dueCount={dueCards.length} />
          <QuizProgressCard stats={stats} />
        </div>
        {/* Surface XP today subtly so the value still drives the right panel. */}
        <span style={{ display: "none" }}>{xpToday}{weekTasks.length}{notes.length}</span>
      </div>
    </main>
  );
};

/* ---- hero -------------------------------------------------------- */

const Hero: FC = () => {
  const profileName = useApp((s) => s.profile.name);
  const profileBadges = useApp((s) => s.profile.badges);
  const setView = useApp((s) => s.setView);
  const name = useMemo(() => firstName(profileName), [profileName]);
  const unlockedDefs = useMemo(() => {
    const ids = new Set(profileBadges.filter(isBadgeId));
    return BADGE_DEFINITIONS.filter((d) => ids.has(d.id));
  }, [profileBadges]);
  const badgeTotal = BADGE_DEFINITIONS.length;

  // Recompute the greeting on a low-frequency cadence so a long-open
  // window crosses bucket boundaries (e.g. afternoon → evening) without
  // a refresh. We also key the headline on the bucket so the text fades
  // in when the bucket changes.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const greeting = useMemo(() => getGreeting(name, now), [name, now]);

  return (
    <section className="hero">
      <div className="hero-main">
        <HeroSearch />
        <div className="hero-greeting">
          <h1 key={greeting.bucket} className="hero-headline">
            {greeting.headline}{" "}
            <span aria-hidden style={{ display: "inline-block", transform: "translateY(-2px)" }}>
              {greeting.emoji}
            </span>
          </h1>
          <p>{greeting.subline}</p>
          <div className="hero-badges" aria-label="Badges">
            <span className="hero-badges-meta">
              {unlockedDefs.length}/{badgeTotal} badges
              <button
                type="button"
                className="hero-badges-link"
                onClick={() => setView({ kind: "settings" })}
              >
                View all
              </button>
            </span>
            {unlockedDefs.length > 0 ? (
              <div className="hero-badges-row" role="list">
                {unlockedDefs.slice(0, 8).map((b) => (
                  <span
                    key={b.id}
                    role="listitem"
                    className="hero-badge-emoji"
                    title={`${b.title} — ${b.description}`}
                  >
                    {b.emoji}
                  </span>
                ))}
                {unlockedDefs.length > 8 && (
                  <span className="hero-badge-more">+{unlockedDefs.length - 8}</span>
                )}
              </div>
            ) : (
              <p className="hero-badges-hint">
                Take notes, review flashcards, and finish quizzes to unlock badges.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="hero-illustration" aria-hidden>
        <img
          className="hero-illustration-img"
          src={BRAND_HERO_URL}
          alt=""
          decoding="async"
        />
      </div>
    </section>
  );
};

/* ---- quick actions ----------------------------------------------- */

interface QAProps {
  title: string;
  sub: string;
  icon: ReactNode;
  bg: string;
  fg: string;
  onClick?: () => void;
}

const QuickActionTile: FC<QAProps> = ({ title, sub, icon, bg, fg, onClick }) => (
  <button type="button" className="quick-action" onClick={onClick}>
    <span className="qa-icon" style={{ background: bg, color: fg }}>{icon}</span>
    <span className="qa-text">
      <span className="qa-title">{title}</span>
      <span className="qa-sub">{sub}</span>
    </span>
  </button>
);

const QuickActions: FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const setView = useApp((s) => s.setView);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function newNote(): Promise<void> {
    const note = await upsertNote({ title: "Untitled", content_markdown: "" });
    await recordXp("createNote", XP_RULES.createNote);
    setSelectedNote(note);
    setView({ kind: "note", noteId: note.id });
    onCreated();
  }

  async function onImagePicked(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    try {
      const dataUri = await fileToDataUri(file);
      const title = stripExt(file.name) || "Image note";
      const note = await upsertNote({
        title,
        content_markdown: `![${title}](${dataUri})\n`,
      });
      await upsertAttachment({
        note_id: note.id,
        type: "image",
        local_uri: dataUri,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });
      await recordXp("createNote", XP_RULES.createNote);
      setSelectedNote(note);
      setView({ kind: "note", noteId: note.id });
      onCreated();
    } catch (err) {
      setError((err as Error).message || "Failed to upload image.");
    }
  }

  async function handleAudio(blob: Blob): Promise<void> {
    try {
      const dataUri = await blobToDataUri(blob);
      const title = `Voice note · ${new Date().toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`;
      const note = await upsertNote({
        title,
        content_markdown:
          "Recorded audio attached. Open the note to play it back or transcribe later.",
      });
      await upsertAttachment({
        note_id: note.id,
        type: "audio",
        local_uri: dataUri,
        file_name: "recording.webm",
        mime_type: blob.type || "audio/webm",
        size_bytes: blob.size,
      });
      await recordXp("createNote", XP_RULES.createNote);
      setSelectedNote(note);
      setView({ kind: "note", noteId: note.id });
      onCreated();
    } catch (err) {
      setError((err as Error).message || "Failed to save recording.");
    }
  }

  return (
    <>
      <section className="quick-actions">
        <QuickActionTile
          title="New Note" sub="Start writing"
          icon={<PencilIcon size={20} />}
          bg="var(--color-accentRoseSoft)" fg="var(--color-accentRose)"
          onClick={() => void newNote()}
        />
        <QuickActionTile
          title="Record Audio" sub="Capture ideas"
          icon={<MicIcon size={20} />}
          bg="var(--color-accentAmberSoft)" fg="var(--color-accentAmber)"
          onClick={() => {
            setError(null);
            setRecorderOpen(true);
          }}
        />
        <QuickActionTile
          title="Upload Image" sub="Add from device"
          icon={<ImageIcon size={20} />}
          bg="var(--color-accentSkySoft)" fg="var(--color-accentSky)"
          onClick={() => fileRef.current?.click()}
        />
        <QuickActionTile
          title="Generate Flashcards" sub="From your notes"
          icon={<SparklesIcon size={20} />}
          bg="var(--color-accentPeachSoft)" fg="var(--color-accentPeach)"
          onClick={() => setView({ kind: "flashcards" })}
        />
      </section>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => void onImagePicked(e)}
      />
      {recorderOpen && (
        <AudioRecorderModal
          onClose={() => setRecorderOpen(false)}
          onSave={async (b) => {
            setRecorderOpen(false);
            await handleAudio(b);
          }}
        />
      )}
      {error && (
        <div className="pill error" style={{ alignSelf: "flex-start" }}>{error}</div>
      )}
    </>
  );
};

function stripExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

/* ---- streak card ------------------------------------------------- */

const StreakCard: FC<{ streak: number }> = ({ streak }) => {
  const setView = useApp((s) => s.setView);
  // 7-day window: today plus the previous six. `streak` collapses
  // them all from the right (today) — purely visual feedback so the
  // number on the ring matches the dot count.
  const filled = Math.min(streak, 7);
  return (
    <Card
      title="Today's Study Streak"
      icon={<FlameIcon size={18} />}
      action={[
        { label: "View calendar", onClick: () => setView({ kind: "calendar" }) },
        { label: "Open settings", onClick: () => setView({ kind: "settings" }) },
      ]}
    >
      <div className="streak">
        <ProgressRing
          value={filled / 7}
          size={96}
          thickness={9}
          color="var(--color-primary)"
        >
          <span className="ring-num">{streak}</span>
          <span className="ring-unit">days</span>
        </ProgressRing>
        <div className="copy">
          <span className="lead">{streak > 0 ? "Keep it up!" : "Start a streak today"}</span>
          <span className="sub">You're building a great habit.</span>
        </div>
        <div className="week-dots">
          {Array.from({ length: 7 }).map((_, i) => {
            const done = i < filled;
            return (
              <span key={i} className={`week-dot ${done ? "done" : ""}`}>
                {done ? <CheckIcon size={11} /> : null}
              </span>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

/* ---- continue last note card ------------------------------------- */

const ContinueLastNoteCard: FC = () => {
  const notes = useApp((s) => s.notes);
  const classes = useApp((s) => s.classes);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const setView = useApp((s) => s.setView);
  const last = notes[0];

  const className = useMemo(() => {
    if (!last?.class_id) return null;
    return classes.find((c) => c.id === last.class_id)?.name ?? null;
  }, [last, classes]);

  return (
    <Card
      title="Continue Last Note"
      icon={<NoteIcon size={18} />}
      action={[
        {
          label: "Open note",
          onClick: () => {
            if (!last) return;
            setSelectedNote(last);
            setView({ kind: "note", noteId: last.id });
          },
        },
        { label: "View all notes", onClick: () => setView({ kind: "notes" }) },
      ]}
    >
      {last ? (
        <div className="continue-note">
          <div className="note-pill">
            <span className="note-glyph"><NoteIcon size={20} /></span>
            <div className="meta">
              <span className="title">{last.title || "Untitled"}</span>
              <span className="sub">{className ?? "Unfiled"}</span>
              <span className="when">
                Edited {fmtRelative(new Date(last.updated_at))}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="review-button"
            onClick={() => {
              setSelectedNote(last);
              setView({ kind: "note", noteId: last.id });
            }}
          >
            Open Note
          </button>
        </div>
      ) : (
        <div style={{ color: "var(--color-textMuted)", fontSize: 13 }}>
          You haven't created a note yet. Tap “New Note” above to get started.
        </div>
      )}
    </Card>
  );
};

function fmtRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

/* ---- today's plan card ------------------------------------------- */

const TodaysPlanCard: FC<{ tasks: StudyTaskRow[]; onChange: () => void }> = ({
  tasks,
  onChange,
}) => {
  const setView = useApp((s) => s.setView);

  // The home query loads a 7-day window so the calendar/right-panel
  // share state. Filter to *today* for this card so the list stays focused.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((t) => {
          const ts = new Date(t.scheduled_for).getTime();
          return ts >= today.getTime() && ts < tomorrow.getTime();
        })
        .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)),
    [tasks, today, tomorrow],
  );

  async function toggle(t: StudyTaskRow): Promise<void> {
    const wasComplete = !!t.completed_at;
    await upsertStudyTask({
      ...t,
      completed_at: wasComplete ? null : new Date().toISOString(),
    });
    if (!wasComplete) {
      await recordXp("studyTaskComplete", XP_RULES.studyTaskComplete);
    }
    onChange();
  }

  return (
    <Card
      title="Today's Plan"
      icon={<ClockIcon size={18} />}
      action={[
        { label: "Open calendar", onClick: () => setView({ kind: "calendar" }) },
        {
          label: "Plan with AI",
          onClick: () => setView({ kind: "calendar" }),
        },
      ]}
    >
      {todayTasks.length === 0 ? (
        <div style={{ color: "var(--color-textMuted)", fontSize: 13, padding: "8px 0" }}>
          Nothing scheduled for today. Generate a plan from the calendar.
        </div>
      ) : (
        <div className="plan-list">
          {todayTasks.map((t) => {
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
        View full schedule →
      </button>
    </Card>
  );
};

function fmtTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/* ---- recent notes card ------------------------------------------- */

const RecentNotesCard: FC = () => {
  const notes = useApp((s) => s.notes);
  const classes = useApp((s) => s.classes);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const setView = useApp((s) => s.setView);

  const recent = notes.slice(0, 5);
  const classMap = useMemo(() => {
    const m = new Map<string, ClassRow>();
    for (const c of classes) m.set(c.id, c);
    return m;
  }, [classes]);

  return (
    <Card
      title="Recent Notes"
      icon={<NoteIcon size={18} />}
      action={[
        { label: "View all notes", onClick: () => setView({ kind: "notes" }) },
        { label: "View classes", onClick: () => setView({ kind: "classes" }) },
      ]}
    >
      <div className="recent-notes">
        {recent.length === 0 && (
          <div style={{ color: "var(--color-textMuted)", fontSize: 13, padding: "8px 0" }}>
            No notes yet — your recents will appear here.
          </div>
        )}
        {recent.map((n) => {
          const cls = n.class_id ? classMap.get(n.class_id) : null;
          return (
            <div
              key={n.id}
              className="recent-row"
              onClick={() => {
                setSelectedNote(n);
                setView({ kind: "note", noteId: n.id });
              }}
            >
              <NoteIcon size={14} />
              <span className="recent-title">{n.title || "Untitled"}</span>
              <span className="recent-class">{cls?.name ?? "—"}</span>
              <span className="recent-when">{fmtShortDate(new Date(n.updated_at))}</span>
            </div>
          );
        })}
      </div>
      <button type="button" className="plan-link" onClick={() => setView({ kind: "notes" })}>
        View all notes →
      </button>
    </Card>
  );
};

function fmtShortDate(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dt = new Date(d);  dt.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dt.getTime()) / 86_400_000);
  if (diff === 0) return `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ---- flashcards due card ----------------------------------------- */

const FlashcardsDueCard: FC<{ dueCount: number }> = ({ dueCount }) => {
  const setView = useApp((s) => s.setView);
  const dueCards = useApp((s) => s.dueCards);

  // Categorize the real due cards by spaced-repetition state so the
  // legend reflects what we'd actually show in review.
  const { newCount, learning, review } = useMemo(() => {
    let n = 0;
    let l = 0;
    let r = 0;
    for (const c of dueCards) {
      if (c.review_count === 0 || c.difficulty === "new") n += 1;
      else if (c.interval_days < 7) l += 1;
      else r += 1;
    }
    return { newCount: n, learning: l, review: r };
  }, [dueCards]);

  const segments = useMemo(() => {
    if (dueCount === 0) {
      // Empty state ring stays muted instead of inventing fake data.
      return [{ value: 1, color: "var(--color-surfaceMuted)" }];
    }
    return [
      { value: newCount, color: "var(--color-accentSky)" },
      { value: learning, color: "var(--color-primary)" },
      { value: review, color: "var(--color-accentSage)" },
    ];
  }, [dueCount, newCount, learning, review]);

  return (
    <Card
      title="Flashcards Due"
      icon={<FlashcardIcon size={18} />}
      action={[
        { label: "Open flashcards", onClick: () => setView({ kind: "flashcards" }) },
      ]}
    >
      <div className="donut-card">
        <Donut segments={segments} size={104} thickness={12}>
          <span className="donut-num">{dueCount}</span>
          <span className="donut-unit">cards due</span>
        </Donut>
        <div className="legend">
          <div className="legend-row">
            <span className="swatch" style={{ background: "var(--color-accentSky)" }} />
            <span className="lbl">New</span>
            <span className="val">{newCount}</span>
          </div>
          <div className="legend-row">
            <span className="swatch" style={{ background: "var(--color-primary)" }} />
            <span className="lbl">Learning</span>
            <span className="val">{learning}</span>
          </div>
          <div className="legend-row">
            <span className="swatch" style={{ background: "var(--color-accentSage)" }} />
            <span className="lbl">Review</span>
            <span className="val">{review}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="review-button"
        disabled={dueCount === 0}
        onClick={() => setView({ kind: "flashcards" })}
      >
        Review Flashcards
      </button>
    </Card>
  );
};

/* ---- quiz progress card ------------------------------------------ */

const QuizProgressCard: FC<{ stats: { taken: number; avgPct: number; best: number } }> = ({
  stats,
}) => {
  const setView = useApp((s) => s.setView);
  const { taken, avgPct, best } = stats;
  return (
    <Card
      title="Quiz Progress"
      icon={<QuizIcon size={18} />}
      action={[
        { label: "View all quizzes", onClick: () => setView({ kind: "quizzes" }) },
      ]}
    >
      <div className="donut-card">
        <Donut
          segments={[
            { value: avgPct || 0,        color: "var(--color-accentSky)" },
            { value: 100 - (avgPct || 0),  color: "var(--color-surfaceMuted)" },
          ]}
          size={104}
          thickness={12}
        >
          <span className="donut-num">{taken === 0 ? "—" : `${avgPct}%`}</span>
          <span className="donut-unit">average score</span>
        </Donut>
        <div className="legend">
          <div className="legend-row">
            <span className="lbl">Quizzes Taken</span>
            <span className="val">{taken}</span>
          </div>
          <div className="legend-row">
            <span className="lbl">Average Score</span>
            <span className="val">{taken === 0 ? "—" : `${avgPct}%`}</span>
          </div>
          <div className="legend-row">
            <span className="lbl">Best Score</span>
            <span className="val">{taken === 0 ? "—" : `${best}%`}</span>
          </div>
        </div>
      </div>
      <button type="button" className="plan-link" onClick={() => setView({ kind: "quizzes" })}>
        View all quizzes <ArrowRightIcon size={12} />
      </button>
    </Card>
  );
};
