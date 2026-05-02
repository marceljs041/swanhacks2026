import type { FC } from "react";
import { useEffect, useState } from "react";
import {
  currentStreak,
  listDueFlashcards,
  listFlashcardSets,
  listQuizzes,
  totalXpToday,
} from "../db/repositories.js";
import type { FlashcardSetRow, QuizRow } from "@studynest/shared";
import { useApp } from "../store.js";

export const Study: FC = () => {
  const [sets, setSets] = useState<FlashcardSetRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const setView = useApp((s) => s.setView);
  const setXp = useApp((s) => s.setXp);
  const setDueCards = useApp((s) => s.setDueCards);
  const dueCards = useApp((s) => s.dueCards);
  const xpToday = useApp((s) => s.xpToday);
  const streak = useApp((s) => s.streak);

  useEffect(() => {
    void (async () => {
      const [s, q, due, xp, str] = await Promise.all([
        listFlashcardSets(null),
        listQuizzes(null),
        listDueFlashcards(50),
        totalXpToday(),
        currentStreak(),
      ]);
      setSets(s);
      setQuizzes(q);
      setDueCards(due);
      setXp(xp, str);
    })();
  }, [setDueCards, setXp]);

  return (
    <div className="main">
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Study</h2>
      </div>
      <div className="card-row">
        <div className="stat-card">
          <div className="label">Streak</div>
          <div className="value">{streak}</div>
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
      <div style={{ padding: "16px 24px" }}>
        <h3>Flashcard sets</h3>
        {sets.length === 0 && (
          <div style={{ color: "var(--muted)" }}>
            No flashcards yet. Open a note and click "Generate flashcards".
          </div>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          {sets.map((s) => (
            <div
              key={s.id}
              className="note-card"
              onClick={() => setView({ kind: "flashcards", setId: s.id })}
            >
              <div className="note-card-title">{s.title}</div>
            </div>
          ))}
        </div>
        <h3 style={{ marginTop: 24 }}>Quizzes</h3>
        {quizzes.length === 0 && (
          <div style={{ color: "var(--muted)" }}>No quizzes yet.</div>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          {quizzes.map((q) => (
            <div
              key={q.id}
              className="note-card"
              onClick={() => setView({ kind: "quiz", quizId: q.id })}
            >
              <div className="note-card-title">{q.title}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
