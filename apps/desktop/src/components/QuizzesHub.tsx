import type { FC } from "react";
import { useEffect, useState } from "react";
import { listQuizzes } from "../db/repositories.js";
import type { QuizRow } from "@studynest/shared";
import { useApp } from "../store.js";
import { Card } from "./ui/Card.js";
import { Donut } from "./ui/ProgressRing.js";
import { Placeholder } from "./ui/Placeholder.js";
import { ArrowRightIcon, QuizIcon, SearchIcon } from "./icons.js";

export const QuizzesHub: FC = () => {
  const setView = useApp((s) => s.setView);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);

  useEffect(() => {
    void listQuizzes(null).then(setQuizzes);
  }, []);

  return (
    <main className="main">
      <div className="topbar">
        <label className="search">
          <span className="search-icon"><SearchIcon size={16} /></span>
          <input type="search" placeholder="Search quizzes..." aria-label="Search quizzes" />
        </label>
      </div>
      <div className="main-inner">
        <div className="page-header">
          <h1>Quizzes</h1>
          <span className="pill">{quizzes.length} total</span>
          <span className="spacer" />
        </div>

        <div className="dash-row cols-2">
          <Card title="Average Score" icon={<QuizIcon size={18} />}>
            <div className="donut-card">
              <Donut
                segments={[
                  { value: 68, color: "var(--color-accentSky)" },
                  { value: 32, color: "var(--color-surfaceMuted)" },
                ]}
                size={104}
                thickness={12}
              >
                <span className="donut-num">68%</span>
                <span className="donut-unit">average</span>
              </Donut>
              <div style={{ fontSize: 12, color: "var(--color-textMuted)", lineHeight: 1.5 }}>
                Aggregate stats are placeholder while we wire up the quiz_attempts query.
              </div>
            </div>
          </Card>

          <Card title="Adaptive Difficulty">
            <Placeholder
              title="Adaptive quizzes not yet implemented"
              description="Once on, Note Goat will pick harder questions for topics you nail and easier ones for topics you miss."
            />
          </Card>
        </div>

        <Card title="Your Quizzes" action="more">
          {quizzes.length === 0 ? (
            <Placeholder
              icon={<QuizIcon size={22} />}
              title="No quizzes yet"
              description="Open any note and tap “Generate quiz” to make a quiz from it."
            />
          ) : (
            <div className="recent-notes">
              {quizzes.map((q) => (
                <div
                  key={q.id}
                  className="recent-row"
                  style={{ gridTemplateColumns: "18px 1fr auto" }}
                  onClick={() => setView({ kind: "quiz", quizId: q.id })}
                >
                  <QuizIcon size={14} />
                  <span className="recent-title">{q.title}</span>
                  <span className="recent-when">
                    Take <ArrowRightIcon size={11} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
};
