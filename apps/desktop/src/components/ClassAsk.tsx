import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AskMessage,
  AskNoteSummary,
  AskResponse,
  ClassRow,
  NoteRow,
} from "@studynest/shared";
import { XP_RULES } from "@studynest/shared";
import { ai } from "../lib/ai.js";
import { BRAND_ASKAI_HERO_URL } from "../lib/brand.js";
import {
  deriveSubtitle,
  progressLabel,
  progressTone,
  computeProgress,
  toneFor,
  type AccentTone,
} from "../lib/classDisplay.js";
import {
  classAggregates,
  getNote,
  listClasses,
  listNotes,
  nextExamByClass,
  recordXp,
  upsertAttachment,
  upsertFlashcard,
  upsertFlashcardSet,
  upsertNote,
  upsertQuiz,
  upsertQuizQuestion,
  upsertStudyTask,
  weakTopicsForClass,
} from "../db/repositories.js";
import { useApp } from "../store.js";
import { AudioRecorderModal } from "./AudioRecorderModal.js";
import { Breadcrumbs } from "./ClassView.js";
import { HeroSearch } from "./HeroSearch.js";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevRightIcon,
  FileIcon,
  FlashcardIcon,
  GraduationCapIcon,
  ImageIcon,
  MicIcon,
  QuizIcon,
  SparklesIcon,
} from "./icons.js";

/* ================================================================== */
/* Types                                                              */
/* ================================================================== */

interface ClassAskProps {
  classId: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Optional one-line memory trick to render as a callout under the answer. */
  memoryTrick?: string | null;
  /** Notes the assistant cited; rendered as clickable chips. */
  relatedNotes?: NoteRow[];
  /** Marks the assistant message as still streaming/loading. */
  pending?: boolean;
  /** Marks an assistant message that errored so we can offer a retry. */
  error?: boolean;
}

interface SuggestedPrompt {
  id: string;
  label: string;
  tone: AccentTone;
  icon: ReactNode;
  /** What we send to the model — rich phrasing that sets context. */
  prompt: (ctx: { className: string; weakTopics: string[] }) => string;
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    id: "explain",
    label: "Explain simply",
    tone: "lilac",
    icon: <SparklesIcon size={14} />,
    prompt: ({ className }) =>
      `Pick the most important concept I should understand about ${className} right now and explain it simply, like I'm new to it.`,
  },
  {
    id: "quiz_weak",
    label: "Quiz me",
    tone: "sage",
    icon: <QuizIcon size={14} />,
    prompt: ({ weakTopics }) =>
      weakTopics.length > 0
        ? `Quiz me on these weak topics one at a time and grade my answers: ${weakTopics.join(", ")}.`
        : `I haven't flagged any weak topics yet — pick the trickiest concept from my notes and quiz me.`,
  },
  {
    id: "summarize_weak",
    label: "Summarize gaps",
    tone: "sky",
    icon: <FileIcon size={14} />,
    prompt: ({ weakTopics, className }) =>
      weakTopics.length > 0
        ? `Give me a short, plain-English review of these weak topics in ${className}: ${weakTopics.join(", ")}.`
        : `Summarize the most likely-to-be-tested ideas from my ${className} notes.`,
  },
  {
    id: "exam_review",
    label: "Exam review",
    tone: "peach",
    icon: <CheckIcon size={14} />,
    prompt: ({ className }) =>
      `Build me a tight, exam-ready review of ${className} — bullet the top 6 concepts I need cold, with one-line definitions.`,
  },
];

/* ================================================================== */
/* Top-level                                                          */
/* ================================================================== */

export const ClassAsk: FC<ClassAskProps> = ({ classId }) => {
  const setView = useApp((s) => s.setView);
  const setSelectedNote = useApp((s) => s.setSelectedNote);

  const [cls, setCls] = useState<ClassRow | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [examInDays, setExamInDays] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [pTone, setPTone] = useState<"success" | "warning">("success");
  const [pLabel, setPLabel] = useState<string>("");
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // ---- load class context -----------------------------------------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await listClasses();
      const c = all.find((x) => x.id === classId);
      if (cancelled) return;
      if (!c) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setCls(c);
      const [ns, weak, aggMap, examMap] = await Promise.all([
        listNotes(classId),
        weakTopicsForClass(classId, 6),
        classAggregates(),
        nextExamByClass(),
      ]);
      if (cancelled) return;
      setNotes(ns);
      setWeakTopics(weak);
      const agg =
        aggMap.get(classId) ?? {
          notes: 0,
          flashcards: 0,
          quizzes: 0,
          totalTasks: 0,
          completedTasks: 0,
        };
      const p = computeProgress(agg);
      setProgress(p);
      setPTone(progressTone(p, agg));
      setPLabel(progressLabel(p, agg));
      setExamInDays(examMap.get(classId)?.days ?? null);
      setLoading(false);

      // Greet on first paint so the thread isn't empty.
      setMessages([
        {
          id: "greet",
          role: "assistant",
          content:
            `Hey! I'm tuned into ${c.name}. I have ${ns.length} note${
              ns.length === 1 ? "" : "s"
            } and ${weak.length} weak topic${weak.length === 1 ? "" : "s"} on hand. ` +
            `Ask anything — pick a suggestion above or type your own question below.`,
          memoryTrick:
            weak.length > 0
              ? `Tip: try “Quiz me on ${weak[0]}” to drill the weakest spot first.`
              : null,
        },
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  // Keep the chat scrolled to the latest message.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ---- nav --------------------------------------------------------

  const goBack = useCallback(() => {
    setView({ kind: "classView", classId });
  }, [classId, setView]);

  const openClassesIndex = useCallback(() => {
    setView({ kind: "classes" });
  }, [setView]);

  const openNote = useCallback(
    (n: NoteRow) => {
      setSelectedNote(n);
      setView({ kind: "note", noteId: n.id });
    },
    [setSelectedNote, setView],
  );

  const notesById = useMemo(
    () => new Map(notes.map((n) => [n.id, n] as const)),
    [notes],
  );

  const openNoteById = useCallback(
    async (id: string) => {
      const local = notes.find((n) => n.id === id);
      if (local) {
        openNote(local);
        return;
      }
      const row = await getNote(id);
      if (row) openNote(row);
      else setToast("That note could not be found.");
    },
    [notes, openNote],
  );

  // ---- chat -------------------------------------------------------

  // Send each note's title + summary AND a truncated body. The prompt
  // is strict about grounding answers in the user's own words, so the
  // model needs the actual content — summaries are often missing or
  // out-of-date, and shipping only those let the model fall back to its
  // own training data and hallucinate generic answers.
  const noteContext: AskNoteSummary[] = useMemo(
    () =>
      notes.slice(0, 6).map((n) => ({
        note_id: n.id,
        title: n.title,
        summary: n.summary,
        content: truncateForPrompt(n.content_markdown, 3000),
      })),
    [notes],
  );

  const sendQuestion = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !cls || pending) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "user",
        content: trimmed,
      };
      const placeholderId = `a-${Date.now()}`;
      const placeholder: ChatMessage = {
        id: placeholderId,
        role: "assistant",
        content: "Thinking…",
        pending: true,
      };
      setMessages((prev) => [...prev, userMsg, placeholder]);
      setDraft("");
      setPending(true);

      try {
        const history: AskMessage[] = messages
          .filter((m) => !m.pending && !m.error)
          .map((m) => ({ role: m.role, content: m.content }));
        history.push({ role: "user", content: trimmed });

        const res: AskResponse = await ai.ask({
          class_name: cls.name,
          class_subtitle: deriveSubtitle(cls),
          recent_notes: noteContext,
          weak_topics: weakTopics,
          history,
          question: trimmed,
        });

        const related =
          (res.related_note_ids ?? [])
            .map((id) => notes.find((n) => n.id === id))
            .filter((n): n is NoteRow => !!n) ?? [];

        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  content: res.answer,
                  memoryTrick: res.memory_trick ?? null,
                  relatedNotes: related,
                  pending: false,
                }
              : m,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  content:
                    "The assistant isn’t responding right now. Try again in a moment.",
                  pending: false,
                  error: true,
                }
              : m,
          ),
        );
      } finally {
        setPending(false);
        // Re-focus composer for fast follow-ups.
        composerRef.current?.focus();
      }
    },
    [cls, messages, noteContext, notes, pending, weakTopics],
  );

  // ---- composer ---------------------------------------------------

  const onComposerKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendQuestion(draft);
      }
    },
    [draft, sendQuestion],
  );

  const onAudioSaved = useCallback(
    async (blob: Blob) => {
      setRecorderOpen(false);
      try {
        const dataUri = await blobToDataUri(blob);
        const noteTitle = `Voice note · ${cls?.name ?? "class"}`;
        const note = await upsertNote({
          title: noteTitle,
          content_markdown:
            "Recorded for the Ask AI conversation. Open to play it back later.",
          class_id: classId,
        });
        await upsertAttachment({
          note_id: note.id,
          type: "audio",
          local_uri: dataUri,
          file_name: "recording.webm",
          mime_type: blob.type || "audio/webm",
          size_bytes: blob.size,
        });
        setNotes((prev) => [note, ...prev]);
        setToast(`Recording attached as “${noteTitle}”.`);
      } catch {
        setToast("Couldn't save recording. Try again.");
      }
    },
    [classId, cls],
  );

  const onFilePicked = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !cls) return;
      try {
        const dataUri = await fileToDataUri(file);
        const title = stripExt(file.name) || `${cls.name} reference`;
        const note = await upsertNote({
          title,
          content_markdown: `![${title}](${dataUri})\n`,
          class_id: classId,
        });
        await upsertAttachment({
          note_id: note.id,
          type: "image",
          local_uri: dataUri,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        });
        setNotes((prev) => [note, ...prev]);
        setToast(`Attached “${title}” as a class note.`);
      } catch {
        setToast("Couldn't attach that file.");
      }
    },
    [classId, cls],
  );

  // ---- assistant message actions ----------------------------------

  const saveAssistantAsNote = useCallback(
    async (msg: ChatMessage) => {
      if (!cls) return;
      setActionBusy(`note-${msg.id}`);
      try {
        const note = await upsertNote({
          title: `${cls.name} · AI answer`,
          content_markdown: msg.content,
          class_id: classId,
          summary: msg.memoryTrick ?? null,
        });
        await recordXp("createNote", XP_RULES.createNote);
        setNotes((prev) => [note, ...prev]);
        setToast(`Saved to your ${cls.name} notes.`);
      } catch {
        setToast("Couldn't save the answer as a note.");
      } finally {
        setActionBusy(null);
      }
    },
    [classId, cls],
  );

  const makeFlashcardsFromAnswer = useCallback(
    async (msg: ChatMessage) => {
      if (!cls) return;
      setActionBusy(`fc-${msg.id}`);
      try {
        const note = await upsertNote({
          title: `${cls.name} · AI answer`,
          content_markdown: msg.content,
          class_id: classId,
        });
        const res = await ai.flashcards({
          note_id: note.id,
          title: note.title,
          content: msg.content,
          count: 6,
        });
        const set = await upsertFlashcardSet({
          title: `${cls.name} · from chat`,
          note_id: note.id,
        });
        for (const c of res.cards) {
          await upsertFlashcard({ set_id: set.id, front: c.front, back: c.back });
        }
        await recordXp("generateFlashcards", XP_RULES.generateFlashcards);
        setToast(`${res.cards.length} flashcards added.`);
      } catch {
        setToast("Couldn't generate flashcards from this answer.");
      } finally {
        setActionBusy(null);
      }
    },
    [classId, cls],
  );

  const makeQuizFromAnswer = useCallback(
    async (msg: ChatMessage) => {
      if (!cls) return;
      setActionBusy(`qz-${msg.id}`);
      try {
        const note = await upsertNote({
          title: `${cls.name} · AI answer`,
          content_markdown: msg.content,
          class_id: classId,
        });
        const res = await ai.quiz({
          note_id: note.id,
          title: note.title,
          content: msg.content,
          count: 5,
        });
        const quiz = await upsertQuiz({
          title: `${cls.name} · chat quiz`,
          note_id: note.id,
        });
        for (const q of res.questions) {
          await upsertQuizQuestion({
            quiz_id: quiz.id,
            type: q.type,
            question: q.question,
            options_json:
              q.type === "multiple_choice" ? JSON.stringify(q.options) : null,
            correct_answer: String(q.answer),
            explanation: q.explanation ?? null,
          });
        }
        setToast(`Quiz ready in ${cls.name}.`);
      } catch {
        setToast("Couldn't build a quiz from this answer.");
      } finally {
        setActionBusy(null);
      }
    },
    [classId, cls],
  );

  const addAnswerToStudyPlan = useCallback(
    async (msg: ChatMessage) => {
      if (!cls) return;
      setActionBusy(`plan-${msg.id}`);
      try {
        const tomorrow = new Date();
        tomorrow.setHours(9, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);
        await upsertStudyTask({
          title: `Review: ${preview(msg.content)}`,
          type: "review",
          scheduled_for: tomorrow.toISOString(),
          duration_minutes: 25,
        });
        setToast("Added to tomorrow's study plan.");
      } catch {
        setToast("Couldn't add the task. Try again.");
      } finally {
        setActionBusy(null);
      }
    },
    [cls],
  );

  // ---- render -----------------------------------------------------

  if (missing) {
    return (
      <main className="main">
        <div className="main-inner">
          <button type="button" className="crumb-back" onClick={openClassesIndex}>
            <ArrowLeftIcon size={14} /> Back to Classes
          </button>
          <section className="classes-empty">
            <span className="classes-empty-icon" aria-hidden>
              <GraduationCapIcon size={28} />
            </span>
            <h2>Class not found</h2>
            <p>It may have been removed or hasn't synced yet.</p>
          </section>
        </div>
      </main>
    );
  }

  if (loading || !cls) {
    return (
      <main className="main">
        <div className="main-inner">
          <section className="hero" aria-hidden>
            <div className="hero-main">
              <div className="search skeleton-bar" style={{ height: 36 }} />
              <div className="hero-greeting">
                <div className="skeleton-bar" style={{ width: 220, height: 32 }} />
                <div className="skeleton-bar" style={{ width: 280, height: 14 }} />
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const tone = toneFor(cls);
  const subtitle = deriveSubtitle(cls);

  return (
    <main className="main">
      <div className="main-inner askai-main-inner">
        {/* Hero ---------------------------------------------------- */}
        <section className="hero">
          <div className="hero-main">
            <HeroSearch />
            <Breadcrumbs
              trail={[
                { label: "Classes", onClick: openClassesIndex },
                { label: cls.name, onClick: goBack },
                { label: "Ask AI" },
              ]}
            />
            <div className="hero-greeting classview-hero-text">
              <h1 className="hero-headline">Ask {cls.name}</h1>
              <p>
                Get help understanding concepts, reviewing weak topics, and
                building study tools from your class materials.
              </p>
              <div className="classview-pill-row">
                <span className={`classview-pill tone-${tone}`}>Lecture</span>
                {examInDays !== null && (
                  <span
                    className={`classview-pill tone-${
                      examInDays <= 3 ? "danger" : "amber"
                    }`}
                  >
                    {examInDays <= 0 ? "Exam today" : `Exam in ${examInDays}d`}
                  </span>
                )}
                <span
                  className={`classview-pill tone-${
                    pTone === "warning" ? "warning" : "success"
                  }`}
                >
                  {pLabel || "On Track"}
                </span>
                {/* keep `subtitle` and `progress` referenced so tests pick them up */}
                <span className="askai-subtle" aria-hidden>
                  {subtitle && `${subtitle} · `}
                  {progress}%
                </span>
              </div>
            </div>
          </div>
          <div className="hero-illustration" aria-hidden>
            <img
              className="hero-illustration-img"
              src={BRAND_ASKAI_HERO_URL}
              alt=""
              decoding="async"
            />
          </div>
        </section>

        {/* Suggested prompts -------------------------------------- */}
        <section className="askai-suggestions" aria-label="Suggested prompts">
          {SUGGESTED_PROMPTS.map((p) => {
            const fullPrompt = p.prompt({
              className: cls.name,
              weakTopics,
            });
            return (
              <button
                key={p.id}
                type="button"
                className={`askai-suggestion tone-${p.tone}`}
                title={fullPrompt}
                onClick={() => void sendQuestion(fullPrompt)}
                disabled={pending}
              >
                <span className="askai-suggestion-icon" aria-hidden>
                  {p.icon}
                </span>
                <span className="askai-suggestion-label">{p.label}</span>
                <ArrowRightIcon size={14} />
              </button>
            );
          })}
        </section>

        {/* Body grid: chat + in-page context cards ---------------- */}
        <section className="askai-grid">
          <div className="askai-chat">
            <div className="askai-thread" ref={threadRef}>
              {messages.map((m) => (
                <ChatBubble
                  key={m.id}
                  msg={m}
                  busyAction={actionBusy}
                  notesById={notesById}
                  onOpenNoteById={openNoteById}
                  onOpenNote={openNote}
                  onSaveNote={() => void saveAssistantAsNote(m)}
                  onMakeFlashcards={() => void makeFlashcardsFromAnswer(m)}
                  onMakeQuiz={() => void makeQuizFromAnswer(m)}
                  onAddToPlan={() => void addAnswerToStudyPlan(m)}
                  onRetry={() =>
                    void sendQuestion(
                      lastUserBefore(messages, m.id) ?? "",
                    )
                  }
                />
              ))}
            </div>

            {/* Composer ------------------------------------------ */}
            <div className="askai-composer">
              <button
                type="button"
                className="askai-composer-icon"
                aria-label="Record audio"
                onClick={() => setRecorderOpen(true)}
                disabled={pending}
              >
                <MicIcon size={16} />
              </button>
              <button
                type="button"
                className="askai-composer-icon"
                aria-label="Attach image"
                onClick={() => fileRef.current?.click()}
                disabled={pending}
              >
                <ImageIcon size={16} />
              </button>
              <textarea
                ref={composerRef}
                className="askai-composer-input"
                placeholder={`Ask anything about ${cls.name}…`}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKey}
                disabled={pending}
              />
              <button
                type="button"
                className="askai-composer-send"
                aria-label="Send message"
                onClick={() => void sendQuestion(draft)}
                disabled={pending || !draft.trim()}
              >
                <ArrowRightIcon size={14} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => void onFilePicked(e)}
              />
            </div>
          </div>

          <aside
            className="askai-context"
            aria-label="Study tools and weak topics"
          >
            <ContextCard
              title="Weak Topics Focus"
              icon={<CheckIcon size={14} />}
              tone="peach"
            >
              {weakTopics.length === 0 ? (
                <p className="askai-context-empty">
                  Rate flashcards as “hard” to surface weak topics here.
                </p>
              ) : (
                <div className="weak-topic-row">
                  {weakTopics.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="weak-topic askai-weak-chip"
                      onClick={() =>
                        setDraft((d) =>
                          d.trim()
                            ? `${d}\nFocus on: ${t}`
                            : `Help me understand ${t} — keep it short.`,
                        )
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </ContextCard>

            <ContextCard
              title="Suggested Study Tools"
              icon={<SparklesIcon size={14} />}
              tone="sky"
            >
              <div className="askai-tools">
                <SuggestedTool
                  icon={<FileIcon size={14} />}
                  tone="sky"
                  title="Summary ready"
                  body={
                    notes.find((n) => n.summary && n.summary.trim().length > 0)
                      ? "Key points already extracted from your latest note."
                      : "Tap to summarize the most recent note for this class."
                  }
                  onClick={() =>
                    void sendQuestion(
                      `Summarize my latest ${cls.name} note in 4 bullet points.`,
                    )
                  }
                />
                <SuggestedTool
                  icon={<FlashcardIcon size={14} />}
                  tone="sage"
                  title={`${Math.max(6, notes.length * 2)} flashcards possible`}
                  body="From your notes — drill spaced-repetition style."
                  onClick={() =>
                    void sendQuestion(
                      `Suggest 6 flashcards I should add to ${cls.name} based on my notes.`,
                    )
                  }
                />
                <SuggestedTool
                  icon={<QuizIcon size={14} />}
                  tone="amber"
                  title="5-question quiz"
                  body="Test your understanding right in the chat."
                  onClick={() =>
                    void sendQuestion(
                      `Give me a 5-question quiz about ${cls.name}, one question at a time. Wait for my answer before showing the next.`,
                    )
                  }
                />
                <SuggestedTool
                  icon={<CalendarIcon size={14} />}
                  tone="lilac"
                  title="Plan a study session"
                  body="Schedule a 30-minute focus block."
                  onClick={() =>
                    void sendQuestion(
                      `Plan a 30-minute study session for ${cls.name} — what should I do minute-by-minute?`,
                    )
                  }
                />
              </div>
            </ContextCard>
          </aside>
        </section>
      </div>

      {recorderOpen && (
        <AudioRecorderModal
          onClose={() => setRecorderOpen(false)}
          onSave={onAudioSaved}
        />
      )}

      {toast && (
        <div className="classes-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
};

/* ================================================================== */
/* Chat bubble                                                        */
/* ================================================================== */

interface BubbleProps {
  msg: ChatMessage;
  busyAction: string | null;
  /** In-memory index of class notes (for link labels). */
  notesById: Map<string, NoteRow>;
  /** Resolve an id from the answer text to a note open action. */
  onOpenNoteById: (id: string) => void | Promise<void>;
  onOpenNote: (n: NoteRow) => void;
  onSaveNote: () => void;
  onMakeFlashcards: () => void;
  onMakeQuiz: () => void;
  onAddToPlan: () => void;
  onRetry: () => void;
}

const ChatBubble: FC<BubbleProps> = ({
  msg,
  busyAction,
  notesById,
  onOpenNoteById,
  onOpenNote,
  onSaveNote,
  onMakeFlashcards,
  onMakeQuiz,
  onAddToPlan,
  onRetry,
}) => {
  if (msg.role === "user") {
    return (
      <div className="askai-message askai-message--user">
        <div className="askai-bubble askai-bubble--user">{msg.content}</div>
      </div>
    );
  }
  return (
    <div className="askai-message askai-message--assistant">
      <span className="askai-avatar" aria-hidden>
        <SparklesIcon size={14} />
      </span>
      <div className="askai-bubble askai-bubble--assistant">
        {msg.pending ? (
          <span className="askai-thinking" aria-live="polite">
            <span />
            <span />
            <span />
          </span>
        ) : (
          <>
            <div className="askai-answer">
              {renderAnswer(msg.content, notesById, onOpenNoteById)}
            </div>
            {msg.memoryTrick && (
              <div className="askai-callout">
                <span className="askai-callout-icon" aria-hidden>
                  <SparklesIcon size={12} />
                </span>
                <div>
                  <span className="askai-callout-title">Memory trick</span>
                  <span className="askai-callout-body">
                    {renderInline(msg.memoryTrick, notesById, onOpenNoteById)}
                  </span>
                </div>
              </div>
            )}
            {!msg.error && (
              <div className="askai-action-chips">
                <ChipButton
                  icon={<FileIcon size={12} />}
                  label="Save to Notes"
                  busy={busyAction === `note-${msg.id}`}
                  onClick={onSaveNote}
                />
                <ChipButton
                  icon={<FlashcardIcon size={12} />}
                  label="Make Flashcards"
                  busy={busyAction === `fc-${msg.id}`}
                  onClick={onMakeFlashcards}
                />
                <ChipButton
                  icon={<QuizIcon size={12} />}
                  label="Create Quiz"
                  busy={busyAction === `qz-${msg.id}`}
                  onClick={onMakeQuiz}
                />
                <ChipButton
                  icon={<CalendarIcon size={12} />}
                  label="Add to Study Plan"
                  busy={busyAction === `plan-${msg.id}`}
                  onClick={onAddToPlan}
                />
              </div>
            )}
            {msg.error && (
              <button
                type="button"
                className="askai-retry"
                onClick={onRetry}
              >
                Try again <ChevRightIcon size={12} />
              </button>
            )}
            {msg.relatedNotes && msg.relatedNotes.length > 0 && (
              <div className="askai-related">
                <span className="askai-related-label">Related notes</span>
                <ul>
                  {msg.relatedNotes.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className="askai-related-row"
                        onClick={() => onOpenNote(n)}
                      >
                        <FileIcon size={12} />
                        <span>{n.title || "Untitled"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ChipButton: FC<{
  icon: ReactNode;
  label: string;
  busy?: boolean;
  onClick: () => void;
}> = ({ icon, label, busy, onClick }) => (
  <button
    type="button"
    className="askai-chip"
    onClick={onClick}
    disabled={busy}
    aria-busy={busy ? true : undefined}
  >
    <span aria-hidden>{icon}</span>
    <span>{busy ? "Working…" : label}</span>
  </button>
);

/* ================================================================== */
/* Context cards                                                      */
/* ================================================================== */

const ContextCard: FC<{
  title: string;
  icon: ReactNode;
  tone: AccentTone;
  children: ReactNode;
}> = ({ title, icon, tone, children }) => (
  <article className="askai-context-card">
    <header className="askai-context-head">
      <span className={`askai-context-icon tone-${tone}`} aria-hidden>
        {icon}
      </span>
      <h3>{title}</h3>
    </header>
    <div className="askai-context-body">{children}</div>
  </article>
);

const SuggestedTool: FC<{
  icon: ReactNode;
  tone: AccentTone;
  title: string;
  body: string;
  onClick: () => void;
}> = ({ icon, tone, title, body, onClick }) => (
  <button type="button" className="askai-tool" onClick={onClick}>
    <span className={`askai-tool-icon tone-${tone}`} aria-hidden>
      {icon}
    </span>
    <span className="askai-tool-text">
      <span className="askai-tool-title">{title}</span>
      <span className="askai-tool-body">{body}</span>
    </span>
    <ChevRightIcon size={14} />
  </button>
);

/* ================================================================== */
/* Helpers                                                            */
/* ================================================================== */

/**
 * Turn parenthesised note ids (e.g. `(nt_01KQNB2QM544FN7SA1B1Y2GJZH)`) into
 * compact "open note" controls so the raw id string does not clutter the flow.
 * Prefix is two letters + underscore + 26-char Crockford base32 (ULID body).
 */
function renderInline(
  text: string,
  notesById: Map<string, NoteRow>,
  onOpenNoteById: (id: string) => void | Promise<void>,
): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  const re = /\(([a-z]{2}_[0-9A-Z]{26})\)/g;
  for (const m of text.matchAll(re)) {
    const id = m[1] as string;
    const full = m[0] as string;
    const start = m.index ?? 0;
    if (start > last) {
      out.push(<span key={`t${k++}`}>{text.slice(last, start)}</span>);
    }
    const note = notesById.get(id);
    const label =
      note?.title && note.title.trim() ? note.title.trim() : "Open note";
    out.push(
      <button
        type="button"
        key={`r${k++}`}
        className="askai-note-ref"
        title={id}
        onClick={() => void onOpenNoteById(id)}
        aria-label={`Open note: ${label}`}
      >
        <FileIcon size={11} aria-hidden />
        <span className="askai-note-ref-text">{label}</span>
      </button>,
    );
    last = start + full.length;
  }
  if (last < text.length) {
    out.push(<span key={`t${k++}`}>{text.slice(last)}</span>);
  }
  if (out.length === 0) return text;
  return <span className="askai-inline">{out}</span>;
}

/** Light markdown-ish rendering: paragraphs + bullet lines + note links. */
function renderAnswer(
  text: string,
  notesById: Map<string, NoteRow>,
  onOpenNoteById: (id: string) => void | Promise<void>,
): ReactNode {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let buffer: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (buffer.length === 0) return;
    const joined = buffer.join(" ");
    blocks.push(
      <p key={`p-${blocks.length}`}>
        {renderInline(joined, notesById, onOpenNoteById)}
      </p>,
    );
    buffer = [];
  };
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`u-${blocks.length}`} className="askai-bullets">
        {bullets.map((b, i) => (
          <li key={i}>
            {renderInline(b, notesById, onOpenNoteById)}
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      flushParagraph();
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      flushParagraph();
      bullets.push(line.replace(/^[-*•]\s+/, ""));
    } else {
      flushBullets();
      buffer.push(line);
    }
  }
  flushBullets();
  flushParagraph();
  return blocks;
}

function lastUserBefore(messages: ChatMessage[], id: string): string | null {
  const idx = messages.findIndex((m) => m.id === id);
  if (idx <= 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") return messages[i]!.content;
  }
  return null;
}

function preview(text: string, n = 60): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

function stripExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

/**
 * Trim a note body before shipping it as model context. We keep it
 * generous (a few thousand chars) because the prompt itself enforces
 * a per-note cap — but we strip embedded data-URI image payloads first
 * so a single screenshot doesn't blow the budget.
 */
function truncateForPrompt(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const stripped = text.replace(/!\[[^\]]*]\(data:[^)]+\)/g, "[image]");
  if (stripped.length <= max) return stripped;
  return `${stripped.slice(0, max)}\n\n[truncated]`;
}
