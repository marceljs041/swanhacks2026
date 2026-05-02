import type { FC } from "react";
import { useMemo, useState } from "react";
import { Card } from "./ui/Card.js";
import {
  CalendarIcon,
  ChevLeftIcon,
  ChevRightIcon,
  FlagIcon,
  TrophyIcon,
} from "./icons.js";
import { useApp } from "../store.js";

/* ---------------------------------------------------------------- */
/* Right panel — gamification + at-a-glance schedule                 */
/* ---------------------------------------------------------------- */

export const RightPanel: FC = () => {
  return (
    <aside className="right-panel">
      <StudyGoalsCard />
      <LevelCard />
      <UpcomingDeadlinesCard />
      <MiniCalendarCard />
    </aside>
  );
};

/* ---- Study Goals --------------------------------------------------- */

const StudyGoalsCard: FC = () => {
  const streak = useApp((s) => s.streak);
  const target = 6; // days/week — TODO: user preference
  const progress = Math.min(streak, target);
  return (
    <Card title="Study Goals" icon={<FlagIcon size={18} />} action="more" className="goal-card">
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
};

/* ---- Level / XP --------------------------------------------------- */

const LevelCard: FC = () => {
  const xp = useApp((s) => s.xpToday);
  // Demo numbers — replace once we track lifetime XP for real.
  const lifetime = 1250 + xp;
  const nextLevel = 2000;
  const level = Math.max(1, Math.floor(lifetime / 200));
  const pct = Math.min(1, lifetime / nextLevel);
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
        <span className="val">{lifetime.toLocaleString()} / {nextLevel.toLocaleString()}</span>
      </div>
      <div className="level-bar">
        <span style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="level-foot">You're leveling up!</div>
    </Card>
  );
};

/* ---- Upcoming Deadlines ------------------------------------------ */

interface DeadlineItem {
  id: string;
  title: string;
  date: Date;
  color: string;
}

const DEMO_DEADLINES: DeadlineItem[] = [
  { id: "1", title: "Chemistry Lab Report", date: addDays(new Date(), 2),  color: "var(--color-accentRose)" },
  { id: "2", title: "History Essay",         date: addDays(new Date(), 6),  color: "var(--color-accentAmber)" },
  { id: "3", title: "Biology Quiz",          date: addDays(new Date(), 8),  color: "var(--color-accentSage)" },
];

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function fmtDeadline(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysUntil(d: Date): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const t = new Date(d);  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 86_400_000);
}

const UpcomingDeadlinesCard: FC = () => {
  return (
    <Card title="Upcoming Deadlines" action="more">
      <div className="deadlines">
        {DEMO_DEADLINES.map((d) => {
          const left = daysUntil(d.date);
          return (
            <div key={d.id} className="deadline-row">
              <span className="bar" style={{ background: d.color }} />
              <div className="who">
                <span className="title">{d.title}</span>
                <span className="when">{fmtDeadline(d.date)}</span>
              </div>
              <span className="days">{left} days left</span>
            </div>
          );
        })}
      </div>
      <button type="button" className="deadline-link">
        View all deadlines →
      </button>
    </Card>
  );
};

/* ---- Mini calendar ------------------------------------------------ */

const MiniCalendarCard: FC = () => {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const eventDays = useMemo(
    () => new Set(DEMO_DEADLINES.map((d) => d.date.toDateString())),
    [],
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
};

/** Returns 6 rows × 7 days starting on Sunday so the grid is always rectangular. */
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
