/**
 * Modal that turns existing app content (a note, a whole class, or a
 * flashcard set) into a fresh quiz via the local AI sidecar. Used by
 * the Quizzes hub, NoteEditor, ClassView, and the deck rail.
 *
 * The shell mirrors `ModalShell` from `FlashcardsHub.tsx` (same look +
 * keyboard handling), but it lives here because the quiz flow has its
 * own three-section layout (Source / Configuration / Generate).
 */
import type { FC, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  ClassRow,
  FlashcardSetRow,
  NoteRow,
  QuizDifficulty,
  QuizQuestionType,
  QuizRow,
  QuizSourceType,
} from "@studynest/shared";
import { XP_RULES } from "@studynest/shared";
import { ai } from "../lib/ai.js";
import { enqueueQuizGeneration } from "../lib/quizGenerationQueue.js";
import {
  listClasses,
  listFlashcardSets,
  listFlashcards,
  listNotes,
  recordXp,
  upsertQuiz,
  upsertQuizQuestion,
} from "../db/repositories.js";

export type QuizGenSourceKind = "note" | "class" | "flashcards";

export interface QuizGenInitialSource {
  kind: QuizGenSourceKind;
  /** Note id, class id, or flashcard set id depending on `kind`. */
  id: string;
}

interface Props {
  /** Optional initial source — when present the picker is preselected. */
  initialSource?: QuizGenInitialSource | null;
  onClose: () => void;
  /** Fired with the new quiz id once persisted. */
  onGenerated: (quizId: string) => void;
}

/** Minimum content length we'll send to `ai.quiz` — anything shorter
 *  produces hallucination-heavy questions, so we surface an error
 *  instead and ask the user to add notes first. */
const MIN_CONTENT_LEN = 80;

export const QuizGenerationModal: FC<Props> = ({
  initialSource,
  onClose,
  onGenerated,
}) => {
  const [source, setSource] = useState<QuizGenSourceKind>(
    initialSource?.kind ?? "note",
  );
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [decks, setDecks] = useState<FlashcardSetRow[]>([]);
  const [noteId, setNoteId] = useState<string>(
    initialSource?.kind === "note" ? initialSource.id : "",
  );
  const [classId, setClassId] = useState<string>(
    initialSource?.kind === "class" ? initialSource.id : "",
  );
  const [deckId, setDeckId] = useState<string>(
    initialSource?.kind === "flashcards" ? initialSource.id : "",
  );

  const [count, setCount] = useState(8);
  const [type, setType] = useState<"multiple_choice" | "true_false" | "mixed">(
    "multiple_choice",
  );
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("medium");
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [includeHints, setIncludeHints] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listNotes(null), listClasses(), listFlashcardSets(null)]).then(
      ([n, c, d]) => {
        setNotes(n);
        setClasses(c);
        setDecks(d);
        if (!noteId && initialSource?.kind !== "note") setNoteId(n[0]?.id ?? "");
        if (!classId && initialSource?.kind !== "class") setClassId(c[0]?.id ?? "");
        if (!deckId && initialSource?.kind !== "flashcards") setDeckId(d[0]?.id ?? "");
      },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const sourceOk =
    (source === "note" && !!noteId) ||
    (source === "class" && !!classId) ||
    (source === "flashcards" && !!deckId);

  const sourceTitle = useMemo(() => {
    if (source === "note") return notes.find((n) => n.id === noteId)?.title ?? "";
    if (source === "class") return classes.find((c) => c.id === classId)?.name ?? "";
    return decks.find((d) => d.id === deckId)?.title ?? "";
  }, [source, noteId, classId, deckId, notes, classes, decks]);

  async function buildContent(): Promise<{
    title: string;
    content: string;
    note_id: string | null;
    class_id: string | null;
    source_ids: string[];
    source_type: QuizSourceType;
  }> {
    if (source === "note") {
      const n = notes.find((x) => x.id === noteId);
      if (!n) throw new Error("Pick a note first.");
      return {
        title: n.title,
        content: n.content_markdown,
        note_id: n.id,
        class_id: n.class_id,
        source_ids: [n.id],
        source_type: "note",
      };
    }
    if (source === "class") {
      const c = classes.find((x) => x.id === classId);
      if (!c) throw new Error("Pick a class first.");
      const allNotes = await listNotes(c.id);
      if (allNotes.length === 0) {
        throw new Error("That class has no notes yet — add notes first.");
      }
      const merged = allNotes
        .map((n) => `# ${n.title}\n\n${n.content_markdown}`)
        .join("\n\n---\n\n")
        .slice(0, 12_000);
      return {
        title: `${c.name} review`,
        content: merged,
        note_id: allNotes[0]?.id ?? null,
        class_id: c.id,
        source_ids: allNotes.map((n) => n.id),
        source_type: "class",
      };
    }
    const d = decks.find((x) => x.id === deckId);
    if (!d) throw new Error("Pick a flashcard deck first.");
    const cards = await listFlashcards(d.id);
    if (cards.length === 0) throw new Error("That deck is empty.");
    const text = cards.map((c) => `Q: ${c.front}\nA: ${c.back}`).join("\n\n");
    return {
      title: `${d.title} quiz`,
      content: text,
      note_id: d.note_id ?? null,
      class_id: null,
      source_ids: [d.id],
      source_type: "flashcards",
    };
  }

  async function submit(): Promise<void> {
    setError(null);
    if (!sourceOk) {
      setError("Pick a source first.");
      return;
    }
    setBusy(true);
    try {
      const quiz = await enqueueQuizGeneration(
        `Generate quiz from ${sourceTitle || source}`,
        async () => {
        const ctx = await buildContent();
        if (!ctx.content || ctx.content.length < MIN_CONTENT_LEN) {
          throw new Error(
            "Source content is too short to generate a quality quiz.",
          );
        }
        const types = pickTypes(type);
        const res = await ai.quiz({
          note_id: ctx.note_id ?? "",
          title: ctx.title,
          content: ctx.content,
          count,
          types,
        });
        const quizRow = await upsertQuiz({
          title: ctx.title,
          note_id: ctx.note_id,
          class_id: ctx.class_id,
          description: descriptionFor(ctx, count, difficulty),
          difficulty,
          status: "new",
          source_type: ctx.source_type,
          source_ids_json: JSON.stringify(ctx.source_ids),
          tags_json: JSON.stringify(defaultTagsFor(ctx.source_type)),
        });
        let position = 0;
        for (const q of res.questions) {
          await upsertQuizQuestion({
            quiz_id: quizRow.id,
            type: q.type,
            question: q.question,
            options_json:
              q.type === "multiple_choice" ? JSON.stringify(q.options) : null,
            correct_answer: String(q.answer),
            explanation: includeExplanations ? q.explanation ?? null : null,
            hint: includeHints ? deriveHint(q) : null,
            source_note_id: ctx.note_id,
            position: position++,
          });
        }
        await recordXp("generateFlashcards", XP_RULES.generateFlashcards);
        return quizRow;
      });
      onGenerated(quiz.id);
    } catch (e) {
      setError((e as Error).message || "Couldn't generate a quiz.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="qz-modal-backdrop" onClick={() => !busy && onClose()}>
      <div
        className="qz-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Generate quiz"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="qz-modal-head">
          <h2>Generate a quiz</h2>
          <p>Note Goat will turn your study material into practice questions.</p>
        </header>
        <div className="qz-modal-body">
          <Section title="1. Pick a source">
            <div className="qz-source-row" role="tablist" aria-label="Quiz source">
              {(["note", "class", "flashcards"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={source === k}
                  className={`qz-source-tab${source === k ? " active" : ""}`}
                  onClick={() => setSource(k)}
                >
                  {k === "note"
                    ? "From a Note"
                    : k === "class"
                    ? "From a Class"
                    : "From Flashcards"}
                </button>
              ))}
            </div>

            {source === "note" && (
              <label className="qz-modal-label">
                <span>Note</span>
                <select
                  className="field"
                  value={noteId}
                  onChange={(e) => setNoteId(e.target.value)}
                  disabled={notes.length === 0}
                >
                  {notes.length === 0 ? (
                    <option value="">— No notes yet</option>
                  ) : (
                    notes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title || "Untitled"}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}
            {source === "class" && (
              <label className="qz-modal-label">
                <span>Class</span>
                <select
                  className="field"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  disabled={classes.length === 0}
                >
                  {classes.length === 0 ? (
                    <option value="">— No classes yet</option>
                  ) : (
                    classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}
            {source === "flashcards" && (
              <label className="qz-modal-label">
                <span>Deck</span>
                <select
                  className="field"
                  value={deckId}
                  onChange={(e) => setDeckId(e.target.value)}
                  disabled={decks.length === 0}
                >
                  {decks.length === 0 ? (
                    <option value="">— No decks yet</option>
                  ) : (
                    decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}
          </Section>

          <Section title="2. Configure">
            <div className="qz-config-grid">
              <label className="qz-modal-label">
                <span>Questions</span>
                <input
                  type="number"
                  className="field"
                  min={3}
                  max={20}
                  value={count}
                  onChange={(e) =>
                    setCount(Math.min(20, Math.max(3, Number(e.target.value) || 5)))
                  }
                />
              </label>
              <label className="qz-modal-label">
                <span>Type</span>
                <select
                  className="field"
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as typeof type)
                  }
                >
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="true_false">True / False</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
              <label className="qz-modal-label">
                <span>Difficulty</span>
                <select
                  className="field"
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as QuizDifficulty)
                  }
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            </div>
            <div className="qz-toggle-row">
              <label className="qz-toggle">
                <input
                  type="checkbox"
                  checked={includeExplanations}
                  onChange={(e) => setIncludeExplanations(e.target.checked)}
                />
                <span>Include explanations</span>
              </label>
              <label className="qz-toggle">
                <input
                  type="checkbox"
                  checked={includeHints}
                  onChange={(e) => setIncludeHints(e.target.checked)}
                />
                <span>Include hints</span>
              </label>
            </div>
          </Section>

          {sourceTitle && (
            <p className="qz-modal-hint">
              Generating from <strong>{sourceTitle}</strong>.
            </p>
          )}
          {error && <div className="qz-modal-error">{error}</div>}

          <div className="qz-modal-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !sourceOk}
              onClick={() => void submit()}
            >
              {busy ? "Generating…" : "Generate quiz"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Section: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <section className="qz-modal-section">
    <h3 className="qz-modal-section-title">{title}</h3>
    {children}
  </section>
);

/* ---------------- helpers ---------------- */

function pickTypes(
  pref: "multiple_choice" | "true_false" | "mixed",
): Array<QuizQuestionType> | undefined {
  if (pref === "multiple_choice") return ["multiple_choice"];
  if (pref === "true_false") return ["true_false"];
  return ["multiple_choice", "true_false"];
}

function deriveHint(q: {
  type: QuizQuestionType;
  question: string;
  explanation?: string;
}): string | null {
  if (!q.explanation) return null;
  const trimmed = q.explanation.trim();
  if (!trimmed) return null;
  return trimmed.split(/[.!?]/)[0]?.slice(0, 120) || null;
}

function descriptionFor(
  ctx: { source_type: QuizSourceType; title: string },
  count: number,
  difficulty: QuizDifficulty,
): string {
  const subject = ctx.source_type === "class" ? "your class" : `“${ctx.title}”`;
  return `${count} ${difficulty} questions generated from ${subject}.`;
}

function defaultTagsFor(source: QuizSourceType): string[] {
  if (source === "class") return ["Class", "Exam Review"];
  if (source === "flashcards") return ["Deck", "Practice"];
  return ["Lecture", "Practice"];
}

/* Re-exported types so callers can build the modal generically. */
export type { QuizRow };
