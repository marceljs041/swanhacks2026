import type { FC } from "react";
import { useEffect } from "react";
import {
  currentStreak,
  listDueFlashcards,
  listNotes,
  listTasksForRange,
  totalXpToday,
} from "../db/repositories.js";
import { useApp } from "../store.js";

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
  const setView = useApp((s) => s.setView);
  const setSelectedNote = useApp((s) => s.setSelectedNote);

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

  const lastNote = notes[0];

  return (
    <div className="main">
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Welcome back</h2>
      </div>
      <div className="card-row">
        <div className="stat-card">
          <div className="label">Streak</div>
          <div className="value">{streak} day{streak === 1 ? "" : "s"}</div>
        </div>
        <div className="stat-card">
          <div className="label">XP today</div>
          <div className="value">{xpToday}</div>
        </div>
        <div className="stat-card">
          <div className="label">Cards due</div>
          <div className="value">{dueCards.length}</div>
        </div>
      </div>
      <div className="card-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="stat-card">
          <div className="label">This week</div>
          <div style={{ marginTop: 8 }}>
            {weekTasks.length === 0 && <div style={{ color: "var(--muted)" }}>No tasks scheduled. Generate a study plan from any note.</div>}
            {weekTasks.slice(0, 5).map((t) => (
              <div
                key={t.id}
                style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--border)" }}
              >
                <span>{t.title}</span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {new Date(t.scheduled_for).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Continue</div>
          <div style={{ marginTop: 8 }}>
            {lastNote ? (
              <button
                className="primary"
                onClick={() => {
                  setSelectedNote(lastNote);
                  setView({ kind: "note", noteId: lastNote.id });
                }}
              >
                {lastNote.title || "Untitled"}
              </button>
            ) : (
              <div style={{ color: "var(--muted)" }}>No notes yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
