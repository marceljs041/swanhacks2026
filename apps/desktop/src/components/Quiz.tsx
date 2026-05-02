import type { FC } from "react";
import { useEffect, useState } from "react";
import { listQuizQuestions, recordQuizAttempt, recordXp } from "../db/repositories.js";
import { useApp } from "../store.js";
import type { QuizQuestionRow } from "@studynest/shared";
import { XP_RULES } from "@studynest/shared";

interface Props {
  quizId: string;
}

export const Quiz: FC<Props> = ({ quizId }) => {
  const [questions, setQuestions] = useState<QuizQuestionRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<{ score: number; total: number } | null>(null);
  const setView = useApp((s) => s.setView);

  useEffect(() => {
    void listQuizQuestions(quizId).then(setQuestions);
    setAnswers({});
    setSubmitted(null);
  }, [quizId]);

  function answer(qid: string, value: string): void {
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  async function submit(): Promise<void> {
    const score = questions.reduce((acc, q) => {
      const a = answers[q.id]?.trim().toLowerCase();
      const correct = q.correct_answer.trim().toLowerCase();
      return acc + (a === correct ? 1 : 0);
    }, 0);
    const total = questions.length;
    setSubmitted({ score, total });
    await recordQuizAttempt({ quiz_id: quizId, score, total, answers });
    await recordXp("completeQuiz", XP_RULES.completeQuiz);
    if (total > 0 && score === total) {
      await recordXp("perfectQuizBonus", XP_RULES.perfectQuizBonus);
    }
  }

  return (
    <div className="main">
      <div className="toolbar">
        <button className="ghost" onClick={() => setView({ kind: "study" })}>
          ← Study
        </button>
        <div style={{ flex: 1 }} />
        {submitted && (
          <span style={{ color: "var(--accent)" }}>
            Score: {submitted.score} / {submitted.total}
          </span>
        )}
      </div>
      <div style={{ padding: 24, maxWidth: 720, margin: "0 auto", width: "100%" }}>
        {questions.map((q, i) => {
          const opts: string[] = q.options_json ? (JSON.parse(q.options_json) as string[]) : [];
          const userAnswer = answers[q.id];
          const isCorrect = submitted && userAnswer?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
          return (
            <div key={q.id} className="note-card" style={{ marginBottom: 16 }}>
              <div className="note-card-title">
                {i + 1}. {q.question}
              </div>
              <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                {q.type === "multiple_choice" &&
                  opts.map((o) => (
                    <label key={o} style={{ display: "flex", gap: 8, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name={q.id}
                        checked={userAnswer === o}
                        onChange={() => answer(q.id, o)}
                        disabled={!!submitted}
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                {q.type === "true_false" &&
                  ["true", "false"].map((o) => (
                    <label key={o} style={{ display: "flex", gap: 8, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name={q.id}
                        checked={userAnswer === o}
                        onChange={() => answer(q.id, o)}
                        disabled={!!submitted}
                      />
                      <span>{o}</span>
                    </label>
                  ))}
              </div>
              {submitted && (
                <div
                  style={{
                    marginTop: 8,
                    color: isCorrect ? "var(--success)" : "var(--danger)",
                    fontSize: 13,
                  }}
                >
                  {isCorrect ? "Correct" : `Correct answer: ${q.correct_answer}`}
                  {q.explanation && (
                    <div style={{ color: "var(--muted)", marginTop: 4 }}>{q.explanation}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!submitted && questions.length > 0 && (
          <button className="primary" onClick={() => void submit()}>
            Submit
          </button>
        )}
        {questions.length === 0 && <div className="empty">No questions in this quiz.</div>}
      </div>
    </div>
  );
};
