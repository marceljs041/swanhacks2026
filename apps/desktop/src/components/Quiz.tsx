import type { FC } from "react";
import { useEffect, useState } from "react";
import { listQuizQuestions, recordQuizAttempt, recordXp } from "../db/repositories.js";
import { useApp } from "../store.js";
import type { QuizQuestionRow } from "@studynest/shared";
import { XP_RULES } from "@studynest/shared";
import { Card } from "./ui/Card.js";
import { ChevLeftIcon } from "./icons.js";

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
    <main className="main">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-ghost" onClick={() => setView({ kind: "quizzes" })}>
            <ChevLeftIcon size={14} /> Quizzes
          </button>
          <span style={{ flex: 1 }} />
          {submitted && (
            <span className="pill" style={{ background: "var(--color-primarySoft)", color: "var(--color-primaryStrong)" }}>
              Score: {submitted.score} / {submitted.total}
            </span>
          )}
        </div>
      </div>
      <div className="main-inner" style={{ maxWidth: 760 }}>
        {questions.map((q, i) => {
          const opts: string[] = q.options_json ? (JSON.parse(q.options_json) as string[]) : [];
          const userAnswer = answers[q.id];
          const isCorrect =
            submitted && userAnswer?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
          return (
            <Card key={q.id}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {i + 1}. {q.question}
              </div>
              <div style={{ marginTop: 4, display: "grid", gap: 8 }}>
                {q.type === "multiple_choice" &&
                  opts.map((o) => (
                    <label
                      key={o}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                        cursor: "pointer",
                        background: userAnswer === o ? "var(--color-primarySoft)" : "transparent",
                      }}
                    >
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
                    <label
                      key={o}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                        cursor: "pointer",
                        background: userAnswer === o ? "var(--color-primarySoft)" : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={userAnswer === o}
                        onChange={() => answer(q.id, o)}
                        disabled={!!submitted}
                      />
                      <span style={{ textTransform: "capitalize" }}>{o}</span>
                    </label>
                  ))}
              </div>
              {submitted && (
                <div
                  style={{
                    fontSize: 13,
                    color: isCorrect ? "var(--color-success)" : "var(--color-danger)",
                  }}
                >
                  {isCorrect ? "Correct" : `Correct answer: ${q.correct_answer}`}
                  {q.explanation && (
                    <div style={{ color: "var(--color-textMuted)", marginTop: 4 }}>
                      {q.explanation}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {!submitted && questions.length > 0 && (
          <button className="btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => void submit()}>
            Submit answers
          </button>
        )}
        {questions.length === 0 && (
          <div className="empty">No questions in this quiz yet.</div>
        )}
      </div>
    </main>
  );
};
