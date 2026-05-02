import type { FC, ReactNode } from "react";
import { useEffect, useMemo } from "react";
import {
  currentStreak,
  listDueFlashcards,
  listNotes,
  listTasksForRange,
  totalXpToday,
} from "../db/repositories.js";
import { useApp } from "../store.js";
import { Card } from "./ui/Card.js";
import { Donut, ProgressRing } from "./ui/ProgressRing.js";
import { BRAND_HERO_URL } from "../lib/brand.js";
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
  SearchIcon,
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
  const xpToday = useApp((s) => s.xpToday);
  const streak = useApp((s) => s.streak);
  const dueCards = useApp((s) => s.dueCards);
  const weekTasks = useApp((s) => s.weekTasks);
  const notes = useApp((s) => s.notes);

  useEffect(() => {
    void (async () => {
      const [xp, str, due, ns] = await Promise.all([
        totalXpToday(),
        currentStreak(),
        listDueFlashcards(50),
        listNotes(null),
      ]);
      setXp(xp, str);
      setDueCards(due);
      setNotes(ns);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const inAWeek = new Date(today);
      inAWeek.setDate(today.getDate() + 7);
      setWeekTasks(await listTasksForRange(today.toISOString(), inAWeek.toISOString()));
    })();
  }, [setXp, setDueCards, setWeekTasks, setNotes]);

  return (
    <main className="main">
      <TopSearchBar />
      <div className="main-inner">
        <Hero />
        <QuickActions />
        <div className="dash-row">
          <StreakCard streak={streak} />
          <ContinueLastNoteCard />
          <TodaysPlanCard />
        </div>
        <div className="dash-row">
          <RecentNotesCard />
          <FlashcardsDueCard dueCount={dueCards.length} />
          <QuizProgressCard />
        </div>
        {/* Surface XP today subtly so the value still drives the right panel. */}
        <span style={{ display: "none" }}>{xpToday}{weekTasks.length}{notes.length}</span>
      </div>
    </main>
  );
};

/* ---- search bar -------------------------------------------------- */

const TopSearchBar: FC = () => (
  <div className="topbar">
    <label className="search">
      <span className="search-icon"><SearchIcon size={16} /></span>
      <input
        type="search"
        placeholder="Search notes, classes, or topics..."
        aria-label="Search"
      />
    </label>
  </div>
);

/* ---- hero -------------------------------------------------------- */

const Hero: FC = () => {
  // TODO: real user name — wire to profile once auth lands.
  const name = "Marcel";
  return (
    <section className="hero">
      <div>
        <h1>
          Welcome back, {name}{" "}
          <span aria-hidden style={{ display: "inline-block", transform: "translateY(-2px)" }}>
            👋
          </span>
        </h1>
        <p>Ready to learn something great today?</p>
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

const QuickActions: FC = () => {
  const setView = useApp((s) => s.setView);
  return (
    <section className="quick-actions">
      <QuickActionTile
        title="New Note" sub="Start writing"
        icon={<PencilIcon size={20} />}
        bg="var(--color-accentRoseSoft)" fg="var(--color-accentRose)"
        onClick={() => setView({ kind: "notes" })}
      />
      <QuickActionTile
        title="Record Audio" sub="Capture ideas"
        icon={<MicIcon size={20} />}
        bg="var(--color-accentAmberSoft)" fg="var(--color-accentAmber)"
      />
      <QuickActionTile
        title="Upload Image" sub="Add from device"
        icon={<ImageIcon size={20} />}
        bg="var(--color-accentSkySoft)" fg="var(--color-accentSky)"
      />
      <QuickActionTile
        title="Generate Flashcards" sub="From your notes"
        icon={<SparklesIcon size={20} />}
        bg="var(--color-accentPeachSoft)" fg="var(--color-accentPeach)"
        onClick={() => setView({ kind: "flashcards" })}
      />
    </section>
  );
};

/* ---- streak card ------------------------------------------------- */

const StreakCard: FC<{ streak: number }> = ({ streak }) => {
  // 7-day window: today plus the previous six. `streak` collapses
  // them all from the right (today) — purely visual feedback so the
  // number on the ring matches the dot count.
  const filled = Math.min(streak, 7);
  return (
    <Card title="Today's Study Streak" icon={<FlameIcon size={18} />} action="more">
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
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const setView = useApp((s) => s.setView);
  const last = notes[0];

  return (
    <Card title="Continue Last Note" icon={<NoteIcon size={18} />} action="more">
      {last ? (
        <div className="continue-note">
          <div className="note-pill">
            <span className="note-glyph"><NoteIcon size={20} /></span>
            <div className="meta">
              <span className="title">{last.title || "Untitled"}</span>
              <span className="sub">
                {/* TODO: hook to real class name once class join is wired in */}
                Recent note
              </span>
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

interface PlanItem { id: string; title: string; time: string; done: boolean; }

const DEMO_PLAN: PlanItem[] = [
  { id: "1", title: "Review Cell Biology",   time: "9:00 AM",  done: true },
  { id: "2", title: "Flashcards: Mitosis",    time: "11:00 AM", done: true },
  { id: "3", title: "Chemistry Problem Set",  time: "1:30 PM",  done: false },
  { id: "4", title: "Read: The Great Gatsby", time: "4:00 PM",  done: false },
  { id: "5", title: "Quiz: World History",    time: "7:00 PM",  done: false },
];

const TodaysPlanCard: FC = () => {
  const setView = useApp((s) => s.setView);
  return (
    <Card title="Today's Plan" icon={<ClockIcon size={18} />} action="more">
      <div className="plan-list">
        {DEMO_PLAN.map((p) => (
          <div key={p.id} className={`plan-row ${p.done ? "done" : ""}`}>
            <span className={`plan-check ${p.done ? "done" : ""}`}>
              {p.done && <CheckIcon size={12} />}
            </span>
            <span className="plan-title">{p.title}</span>
            <span className="plan-time">{p.time}</span>
          </div>
        ))}
      </div>
      <button type="button" className="plan-link" onClick={() => setView({ kind: "calendar" })}>
        View full schedule →
      </button>
    </Card>
  );
};

/* ---- recent notes card ------------------------------------------- */

const RecentNotesCard: FC = () => {
  const notes = useApp((s) => s.notes);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const setView = useApp((s) => s.setView);

  const recent = notes.slice(0, 5);

  return (
    <Card title="Recent Notes" icon={<NoteIcon size={18} />} action="more">
      <div className="recent-notes">
        {recent.length === 0 && (
          <div style={{ color: "var(--color-textMuted)", fontSize: 13, padding: "8px 0" }}>
            No notes yet — your recents will appear here.
          </div>
        )}
        {recent.map((n) => (
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
            <span className="recent-class">—</span>
            <span className="recent-when">{fmtShortDate(new Date(n.updated_at))}</span>
          </div>
        ))}
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
  const newCount = Math.max(0, Math.min(dueCount, 12));
  const learning = Math.max(0, Math.min(dueCount - newCount, 24));
  const review = Math.max(0, dueCount - newCount - learning);
  const total = dueCount > 0 ? dueCount : 48;

  // Demo splits when we have no real data so the card looks alive.
  const segments = useMemo(
    () =>
      dueCount > 0
        ? [
            { value: newCount,   color: "var(--color-accentSky)"  },
            { value: learning,   color: "var(--color-primary)"    },
            { value: review,     color: "var(--color-accentSage)" },
          ]
        : [
            { value: 12, color: "var(--color-accentSky)"  },
            { value: 24, color: "var(--color-primary)"    },
            { value: 12, color: "var(--color-accentSage)" },
          ],
    [dueCount, newCount, learning, review],
  );

  return (
    <Card title="Flashcards Due" icon={<FlashcardIcon size={18} />} action="more">
      <div className="donut-card">
        <Donut segments={segments} size={104} thickness={12}>
          <span className="donut-num">{total}</span>
          <span className="donut-unit">cards due</span>
        </Donut>
        <div className="legend">
          <div className="legend-row">
            <span className="swatch" style={{ background: "var(--color-accentSky)" }} />
            <span className="lbl">New</span>
            <span className="val">{dueCount > 0 ? newCount : 12}</span>
          </div>
          <div className="legend-row">
            <span className="swatch" style={{ background: "var(--color-primary)" }} />
            <span className="lbl">Learning</span>
            <span className="val">{dueCount > 0 ? learning : 24}</span>
          </div>
          <div className="legend-row">
            <span className="swatch" style={{ background: "var(--color-accentSage)" }} />
            <span className="lbl">Review</span>
            <span className="val">{dueCount > 0 ? review : 12}</span>
          </div>
        </div>
      </div>
      <button type="button" className="review-button" onClick={() => setView({ kind: "flashcards" })}>
        Review Flashcards
      </button>
    </Card>
  );
};

/* ---- quiz progress card ------------------------------------------ */

const QuizProgressCard: FC = () => {
  const setView = useApp((s) => s.setView);
  // TODO: pull live aggregates from quiz_attempts table
  const avgPct = 68;
  const taken = 17;
  const best = 92;
  return (
    <Card title="Quiz Progress" icon={<QuizIcon size={18} />} action="more">
      <div className="donut-card">
        <Donut
          segments={[
            { value: avgPct,        color: "var(--color-accentSky)" },
            { value: 100 - avgPct,  color: "var(--color-surfaceMuted)" },
          ]}
          size={104}
          thickness={12}
        >
          <span className="donut-num">{avgPct}%</span>
          <span className="donut-unit">average score</span>
        </Donut>
        <div className="legend">
          <div className="legend-row">
            <span className="lbl">Quizzes Taken</span>
            <span className="val">{taken}</span>
          </div>
          <div className="legend-row">
            <span className="lbl">Average Score</span>
            <span className="val">{avgPct}%</span>
          </div>
          <div className="legend-row">
            <span className="lbl">Best Score</span>
            <span className="val">{best}%</span>
          </div>
        </div>
      </div>
      <button type="button" className="plan-link" onClick={() => setView({ kind: "quizzes" })}>
        View all quizzes <ArrowRightIcon size={12} />
      </button>
    </Card>
  );
};
