import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { ai } from "../lib/ai.js";
import {
  getNote,
  listFlashcardSets,
  listQuizzes,
  recordXp,
  upsertFlashcard,
  upsertFlashcardSet,
  upsertNote,
  upsertQuiz,
  upsertQuizQuestion,
} from "../db/repositories.js";
import { useApp } from "../store.js";
import { XP_RULES } from "@studynest/shared";
import type { FlashcardSetRow, NoteRow, QuizRow } from "@studynest/shared";
import { Card } from "./ui/Card.js";
import {
  ChevLeftIcon,
  FlashcardIcon,
  QuizIcon,
  SparklesIcon,
} from "./icons.js";

interface Props {
  noteId: string;
}

export const NoteEditor: FC<Props> = ({ noteId }) => {
  const [note, setNote] = useState<NoteRow | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sets, setSets] = useState<FlashcardSetRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const setSyncStatus = useApp((s) => s.setSyncStatus);
  const setView = useApp((s) => s.setView);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void getNote(noteId).then((n) => {
      setNote(n);
      setTitle(n?.title ?? "");
      setBody(n?.content_markdown ?? "");
    });
    void listFlashcardSets(noteId).then(setSets);
    void listQuizzes(noteId).then(setQuizzes);
  }, [noteId]);

  function scheduleSave(nextTitle: string, nextBody: string): void {
    setSyncStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const updated = await upsertNote({
        ...(note ?? {}),
        id: noteId,
        title: nextTitle || "Untitled",
        content_markdown: nextBody,
      });
      setNote(updated);
      setSyncStatus("synced");
    }, 700);
  }

  async function runAi(action: "summarize" | "flashcards" | "quiz" | "simple"): Promise<void> {
    if (!note) return;
    setBusy(action);
    setError(null);
    try {
      const ctx = { note_id: noteId, title, content: body };
      if (action === "summarize") {
        const res = await ai.summarize(ctx);
        const updated = await upsertNote({ ...note, summary: res.summary });
        setNote(updated);
      } else if (action === "simple") {
        const res = await ai.simpleExplain(ctx);
        const updated = await upsertNote({ ...note, summary: res.summary });
        setNote(updated);
      } else if (action === "flashcards") {
        const res = await ai.flashcards({ ...ctx, count: 8 });
        const set = await upsertFlashcardSet({
          note_id: noteId,
          title: `${title || "Untitled"} — flashcards`,
        });
        for (const c of res.cards) {
          await upsertFlashcard({ set_id: set.id, front: c.front, back: c.back });
        }
        await recordXp("generateFlashcards", XP_RULES.generateFlashcards);
        setSets(await listFlashcardSets(noteId));
      } else if (action === "quiz") {
        const res = await ai.quiz({ ...ctx, count: 5 });
        const quiz = await upsertQuiz({
          note_id: noteId,
          title: `${title || "Untitled"} — quiz`,
        });
        for (const q of res.questions) {
          await upsertQuizQuestion({
            quiz_id: quiz.id,
            type: q.type,
            question: q.question,
            options_json:
              q.type === "multiple_choice" ? JSON.stringify((q as any).options ?? []) : null,
            correct_answer: String((q as any).answer ?? ""),
            explanation: (q as any).explanation ?? null,
          });
        }
        setQuizzes(await listQuizzes(noteId));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!note) {
    return <main className="main empty">Loading…</main>;
  }

  return (
    <>
      <main className="main">
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn-ghost" onClick={() => setView({ kind: "notes" })}>
              <ChevLeftIcon size={14} /> Notes
            </button>
            <span className="spacer" style={{ flex: 1 }} />
            <span style={{ color: "var(--color-textSubtle)", fontSize: 12 }}>
              {new Date(note.updated_at).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="note-editor">
          <input
            className="note-title-input"
            placeholder="Untitled"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave(e.target.value, body);
            }}
          />
          <textarea
            className="note-body-input"
            placeholder="Start writing — markdown supported. Press the AI buttons on the right when you're ready."
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              scheduleSave(title, e.target.value);
            }}
          />
        </div>
      </main>
      <aside className="right-panel">
        <Card title="AI actions" icon={<SparklesIcon size={16} />}>
          <div style={{ display: "grid", gap: 8 }}>
            <button className="btn-secondary" onClick={() => void runAi("summarize")} disabled={!!busy}>
              {busy === "summarize" ? "Thinking offline…" : "Summarize"}
            </button>
            <button className="btn-secondary" onClick={() => void runAi("simple")} disabled={!!busy}>
              {busy === "simple" ? "Thinking offline…" : "Explain simply"}
            </button>
            <button className="btn-secondary" onClick={() => void runAi("flashcards")} disabled={!!busy}>
              {busy === "flashcards" ? "Thinking offline…" : "Generate flashcards"}
            </button>
            <button className="btn-secondary" onClick={() => void runAi("quiz")} disabled={!!busy}>
              {busy === "quiz" ? "Thinking offline…" : "Generate quiz"}
            </button>
          </div>
          {error && (
            <div className="pill error" style={{ marginTop: 8 }}>{error}</div>
          )}
        </Card>

        {note.summary && (
          <Card title="Summary">
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--color-text)" }}>
              {note.summary}
            </div>
          </Card>
        )}

        {sets.length > 0 && (
          <Card title="Flashcard sets" icon={<FlashcardIcon size={16} />}>
            <div className="recent-notes">
              {sets.map((s) => (
                <div
                  key={s.id}
                  className="recent-row"
                  style={{ gridTemplateColumns: "18px 1fr" }}
                  onClick={() => setView({ kind: "flashcardSet", setId: s.id })}
                >
                  <FlashcardIcon size={14} />
                  <span className="recent-title">{s.title}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {quizzes.length > 0 && (
          <Card title="Quizzes" icon={<QuizIcon size={16} />}>
            <div className="recent-notes">
              {quizzes.map((q) => (
                <div
                  key={q.id}
                  className="recent-row"
                  style={{ gridTemplateColumns: "18px 1fr" }}
                  onClick={() => setView({ kind: "quiz", quizId: q.id })}
                >
                  <QuizIcon size={14} />
                  <span className="recent-title">{q.title}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </aside>
    </>
  );
};
