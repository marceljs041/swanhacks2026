import type { FC } from "react";
import { useEffect, useState } from "react";
import {
  listNotes,
  listTasksForRange,
  upsertStudyPlan,
  upsertStudyTask,
} from "../db/repositories.js";
import { ai } from "../lib/ai.js";
import { useApp } from "../store.js";
import type { StudyTaskRow } from "@studynest/shared";

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(d.getDate() - d.getDay());
  return out;
}

export const Calendar: FC = () => {
  const [tasks, setTasks] = useState<StudyTaskRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setWeekTasks = useApp((s) => s.setWeekTasks);

  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  async function refresh(): Promise<void> {
    const t = await listTasksForRange(weekStart.toISOString(), weekEnd.toISOString());
    setTasks(t);
    setWeekTasks(t);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generatePlan(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const notes = (await listNotes(null)).slice(0, 8);
      const res = await ai.studyPlan({
        goal: "Review my recent notes and prep for the week.",
        exam_date: null,
        notes: notes.map((n) => ({ id: n.id, title: n.title, summary: n.summary })),
        days_available: 7,
      });
      const plan = await upsertStudyPlan({ title: "Weekly study plan" });
      for (const t of res.tasks) {
        await upsertStudyTask({
          plan_id: plan.id,
          note_id: t.note_id ?? null,
          title: t.title,
          type: t.type,
          scheduled_for: new Date(t.scheduled_for).toISOString(),
          duration_minutes: t.duration_minutes,
        });
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div className="main">
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Calendar</h2>
        <div style={{ flex: 1 }} />
        <button className="primary" onClick={() => void generatePlan()} disabled={busy}>
          {busy ? "Generating…" : "Generate study plan"}
        </button>
      </div>
      {error && (
        <div style={{ color: "var(--danger)", padding: "0 24px" }}>{error}</div>
      )}
      <div className="calendar-grid">
        {days.map((d) => {
          const ds = d.toISOString().slice(0, 10);
          const dayTasks = tasks.filter((t) => t.scheduled_for.slice(0, 10) === ds);
          return (
            <div key={ds} className="calendar-day">
              <div className="calendar-day-num">
                {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
              </div>
              {dayTasks.map((t) => (
                <div
                  key={t.id}
                  className={`calendar-task ${t.completed_at ? "completed" : ""}`}
                  onClick={async () => {
                    await upsertStudyTask({
                      ...t,
                      completed_at: t.completed_at ? null : new Date().toISOString(),
                    });
                    await refresh();
                  }}
                >
                  {t.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
