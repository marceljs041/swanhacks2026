import type {
  FC,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  SVGProps,
} from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ai } from "../lib/ai.js";
import { BRAND_AI_URL } from "../lib/brand.js";
import {
  NOTE_ICON_LIST,
  NoteGlyph,
  getNoteIconComponent,
} from "../lib/noteIcons.js";
import {
  getNote,
  listClasses,
  listFlashcardSets,
  listFlashcards,
  listNotes,
  listQuizzes,
  recordXp,
  softDeleteNote,
  upsertFlashcard,
  upsertFlashcardSet,
  upsertNote,
  upsertQuiz,
  upsertQuizQuestion,
  upsertStudyTask,
  searchNotes,
} from "../db/repositories.js";
import { MoreMenu, type MoreMenuItem } from "./ui/MoreMenu.js";
import { useApp } from "../store.js";
import { ulid, XP_RULES } from "@studynest/shared";
import type {
  ClassRow,
  FlashcardSetRow,
  NoteRow,
  QuizRow,
  SyncStatus,
} from "@studynest/shared";
import {
  ArrowRightIcon,
  CalendarIcon,
  ChevLeftIcon,
  CloudCheckIcon,
  CloudOffIcon,
  ImageIcon,
  MicIcon,
  MoreIcon,
  NoteIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from "./icons.js";
import { AudioRecorderModal } from "./AudioRecorderModal.js";

/* -----------------------------------------------------------------------
 * NoteEditor
 *
 *   Layout:
 *     .note-main
 *       ├─ NoteHeader  (breadcrumb · sync pill · title · tag editor)
 *       ├─ FormatToolbar (bigger buttons; talks to RichEditor via ref)
 *       ├─ AttachmentStrip (audio / image chips)
 *       └─ note-body-grid
 *             ├─ OutlinePanel
 *             └─ RichEditor (contentEditable WYSIWYG)
 *     .right-panel.note-aside (wider)
 *       ├─ AiMascotBanner   (the goat sits ABOVE the assistant card)
 *       ├─ AiAssistantCard  (Summarize / Make Flashcards / Quiz / …)
 *       ├─ Note Insights
 *       ├─ Linked Notes
 *       └─ Sync footer
 *
 *   Editing model:
 *     The body uses a `contentEditable` div ("RichEditor"). Markdown is
 *     the persisted source of truth — on note open we parse it to HTML
 *     and seed the editor; on every input we walk the DOM back to
 *     markdown and debounce-save it. Toolbar commands and checkbox
 *     toggles mutate the DOM directly and re-serialize.
 *     The editor only rebuilds its DOM when the *note id* changes so
 *     the user's caret never jumps mid-typing.
 * --------------------------------------------------------------------- */

interface Props {
  noteId: string;
}

interface AudioAttachment {
  id: string;
  kind: "audio";
  label: string;
  durationSec: number;
  url: string;
}
interface ImageAttachment {
  id: string;
  kind: "image";
  label: string;
  count: number;
  url: string;
}
type Attachment = AudioAttachment | ImageAttachment;

type AiAction =
  | "summarize"
  | "flashcards"
  | "quiz"
  | "simple"
  | "studyPlan"
  | "ask";

export const NoteEditor: FC<Props> = ({ noteId }) => {
  const [note, setNote] = useState<NoteRow | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<AiAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sets, setSets] = useState<FlashcardSetRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [allNotes, setAllNotes] = useState<NoteRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [flashcardCount, setFlashcardCount] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askResult, setAskResult] = useState<string | null>(null);
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("https://");
  const [linkHadHref, setLinkHadHref] = useState(false);
  const [slashPickerKind, setSlashPickerKind] = useState<"notelink" | "audiolink" | null>(null);

  const setSyncStatus = useApp((s) => s.setSyncStatus);
  const setView = useApp((s) => s.setView);
  const syncStatus = useApp((s) => s.syncStatus);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<EditorHandle | null>(null);

  /* --- data loading ---------------------------------------------------- */

  useEffect(() => {
    void getNote(noteId).then((n) => {
      setNote(n);
      const t = n?.title ?? "";
      setTitle(t);
      const raw = n?.content_markdown ?? "";
      setBody(ensureLeadingTitleH1(raw, t || "Untitled"));
    });
    void listFlashcardSets(noteId).then(setSets);
    void listQuizzes(noteId).then(setQuizzes);
    void listNotes(null).then(setAllNotes);
    void listClasses().then(setClasses);
  }, [noteId]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(sets.map((s) => listFlashcards(s.id))).then((rows) => {
      if (cancelled) return;
      setFlashcardCount(rows.reduce((sum, r) => sum + r.length, 0));
    });
    return () => {
      cancelled = true;
    };
  }, [sets]);

  useEffect(
    () => () => {
      attachments.forEach((a) => {
        if (a.url.startsWith("blob:")) URL.revokeObjectURL(a.url);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* --- derived --------------------------------------------------------- */

  const noteTypeLabel = useMemo(() => {
    if (!note) return "Note";
    const meta = NOTE_ICON_LIST.find((m) => m.key === note.icon);
    return meta?.label ?? "Note";
  }, [note]);

  const tags = useMemo<string[]>(() => parseTags(note?.tags_json), [note?.tags_json]);

  const outline = useMemo(() => extractOutline(body), [body]);
  const insights = useMemo(() => computeInsights(body), [body]);
  const audioUrlById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of attachments) {
      if (a.kind === "audio") m.set(a.id, a.url);
    }
    return m;
  }, [attachments]);
  const linked = useMemo(
    () => pickLinkedNotes(note, allNotes, body),
    [note, allNotes, body],
  );

  /* --- mutators -------------------------------------------------------- */

  function persistNote(patch: Partial<NoteRow>): void {
    setSyncStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const next = await upsertNote({
        ...(note ?? {}),
        id: noteId,
        title: patch.title ?? (title || "Untitled"),
        content_markdown: patch.content_markdown ?? body,
        ...patch,
      });
      setNote(next);
      setSyncStatus("synced");
    }, 600);
  }

  function onTitleChange(v: string): void {
    setTitle(v);
    persistNote({ title: v || "Untitled" });
    requestAnimationFrame(() => {
      editorRef.current?.syncTitleHeading(v);
    });
  }

  function onBodyChange(md: string): void {
    setBody(md);
    persistNote({ content_markdown: md });
  }

  function addTag(t: string): void {
    const clean = t.trim();
    if (!clean) return;
    if (tags.some((x) => x.toLowerCase() === clean.toLowerCase())) return;
    const next = [...tags, clean];
    persistNote({ tags_json: JSON.stringify(next) });
  }

  function removeTag(t: string): void {
    const next = tags.filter((x) => x !== t);
    persistNote({ tags_json: JSON.stringify(next) });
  }

  function openLinkEditor(): void {
    const href = editorRef.current?.getLinkHrefAtCaret();
    setLinkHadHref(Boolean(href && href.length > 0));
    setLinkDraft(href && href.length > 0 ? href : "https://");
    setLinkDialogOpen(true);
  }

  /* --- attachments ----------------------------------------------------- */

  function handleAudioRecorded(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    setAttachments((prev) => [
      ...prev,
      {
        id: ulid("att"),
        kind: "audio",
        label: "audio recording",
        durationSec: Math.round(blob.size / 12_000),
        url,
      },
    ]);
    setRecorderOpen(false);
  }

  function handleImagePicked(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const first = files[0]!;
    const url = URL.createObjectURL(first);
    setAttachments((prev) => [
      ...prev,
      {
        id: ulid("att"),
        kind: "image",
        label: files.length > 1 ? `${files.length} images` : first.name,
        count: files.length,
        url,
      },
    ]);
    e.target.value = "";
  }

  function removeAttachment(id: string): void {
    setAttachments((prev) => {
      const a = prev.find((x) => x.id === id);
      if (a && a.url.startsWith("blob:")) URL.revokeObjectURL(a.url);
      return prev.filter((x) => x.id !== id);
    });
  }

  /* --- AI actions ------------------------------------------------------ */

  async function runAi(action: AiAction, payload?: string): Promise<void> {
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
          class_id: note.class_id,
          title: `${title || "Untitled"} — quiz`,
          description: `${res.questions.length} practice questions generated from this note.`,
          source_type: "note",
          source_ids_json: JSON.stringify([noteId]),
          tags_json: JSON.stringify(["Lecture", "Practice"]),
        });
        let position = 0;
        for (const q of res.questions) {
          await upsertQuizQuestion({
            quiz_id: quiz.id,
            type: q.type,
            question: q.question,
            options_json:
              q.type === "multiple_choice"
                ? JSON.stringify((q as any).options ?? [])
                : null,
            correct_answer: String((q as any).answer ?? ""),
            explanation: (q as any).explanation ?? null,
            source_note_id: noteId,
            position: position++,
          });
        }
        await recordXp("generateFlashcards", XP_RULES.generateFlashcards);
        setQuizzes(await listQuizzes(noteId));
      } else if (action === "studyPlan") {
        const when = new Date();
        when.setHours(9, 0, 0, 0);
        when.setDate(when.getDate() + 1);
        await upsertStudyTask({
          id: ulid("tsk"),
          type: "review",
          title: `Review: ${title || "Untitled"}`,
          note_id: noteId,
          scheduled_for: when.toISOString(),
          duration_minutes: 30,
        });
      } else if (action === "ask") {
        const question = payload?.trim();
        if (!question) return;
        const res = await ai.summarize({
          ...ctx,
          content: `${body}\n\nQuestion: ${question}\n\nAnswer using only the note above.`,
        });
        setAskResult(res.summary);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /* --- note-level menu actions --------------------------------------- */

  async function duplicateNote(): Promise<void> {
    if (!note) return;
    const copy = await upsertNote({
      title: `${note.title || "Untitled"} (copy)`,
      content_markdown: body,
      class_id: note.class_id,
      icon: note.icon,
      tags_json: note.tags_json,
    });
    setView({ kind: "note", noteId: copy.id });
  }

  function exportMarkdown(): void {
    if (!note) return;
    const safe =
      (title || "untitled").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
      "untitled";
    const blob = new Blob([`# ${title || "Untitled"}\n\n${body}`], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safe}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyToClipboard(): Promise<void> {
    if (!note) return;
    try {
      await navigator.clipboard.writeText(`# ${title || "Untitled"}\n\n${body}`);
    } catch {
      /* clipboard may be denied; silently ignore */
    }
  }

  async function deleteNote(): Promise<void> {
    if (!note) return;
    const confirmed = window.confirm(
      `Delete "${title || "Untitled"}"? This will move the note to the trash.`,
    );
    if (!confirmed) return;
    await softDeleteNote(noteId);
    setView({ kind: "notes" });
  }

  function clearSummary(): void {
    if (!note) return;
    void upsertNote({ ...note, summary: null }).then(setNote);
    setAskResult(null);
  }

  /* --- render ---------------------------------------------------------- */

  if (!note) {
    return <main className="main empty">Loading…</main>;
  }

  const headerMenu: MoreMenuItem[] = [
    { label: "Duplicate", icon: <NoteIcon size={14} />, onClick: () => void duplicateNote() },
    { label: "Copy as markdown", icon: <UploadIcon size={14} />, onClick: () => void copyToClipboard() },
    { label: "Export .md", icon: <UploadIcon size={14} />, onClick: exportMarkdown },
    {
      label: "Add to calendar",
      icon: <CalendarIcon size={14} />,
      onClick: () => {
        // Suggest a 30-min review block tomorrow at 9 AM tied to this note.
        const start = new Date();
        start.setDate(start.getDate() + 1);
        start.setHours(9, 0, 0, 0);
        const end = new Date(start.getTime() + 30 * 60_000);
        setView({ kind: "calendar" });
        queueMicrotask(() => {
          useApp.getState().setCalendarComposer({
            mode: "create",
            prefill: {
              type: "study_block",
              title: `Review ${note.title}`,
              note_id: note.id,
              class_id: note.class_id ?? null,
              start_at: start.toISOString(),
              end_at: end.toISOString(),
            },
          });
        });
      },
    },
    { label: "Delete", icon: <TrashIcon size={14} />, danger: true, onClick: () => void deleteNote() },
  ];

  const outlineMenu: MoreMenuItem[] = [
    {
      label: outlineCollapsed ? "Show outline" : "Hide outline",
      onClick: () => setOutlineCollapsed((v) => !v),
    },
    { label: "Copy outline", onClick: () => void copyOutline(outline) },
  ];

  const aiMenu: MoreMenuItem[] = [
    {
      label: note.summary ? "Clear summary" : "No summary yet",
      onClick: clearSummary,
    },
    {
      label: askOpen ? "Hide question box" : "Ask a question",
      onClick: () => setAskOpen((v) => !v),
    },
  ];

  return (
    <>
      <a href="#note-editor-body" className="skip-to-note">
        Skip to note content
      </a>
      <main className="main note-main">
        <NoteHeader
          note={note}
          classes={classes}
          classId={note.class_id}
          noteTypeLabel={noteTypeLabel}
          title={title}
          onTitleChange={onTitleChange}
          onBack={() => setView({ kind: "notes" })}
          syncStatus={syncStatus}
          tags={tags}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          onChangeIcon={(iconKey) => persistNote({ icon: iconKey })}
          onClassChange={(id) => persistNote({ class_id: id })}
          menu={headerMenu}
        />

        <p id="note-editor-a11y-desc" className="visually-hidden">
          Formatting toolbar is directly above this note. Apply headings, lists, tasks, quotes,
          links, and images. Type // in the body for link shortcuts (note or audio recording).
          Drag the corner handle on images to resize.
        </p>
        <FormatToolbar
          onAction={(k, v) => editorRef.current?.run(k, v)}
          onLink={openLinkEditor}
          onMic={() => setRecorderOpen(true)}
          onImage={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleImagePicked}
        />

        {attachments.length > 0 && (
          <AttachmentStrip
            items={attachments}
            onRemove={removeAttachment}
            onInsertAudioLink={(id) => {
              const a = attachments.find((x) => x.id === id);
              if (!a || a.kind !== "audio") return;
              editorRef.current?.insertAudioLink(id, a.label || "Audio");
            }}
          />
        )}

        <div className={`note-body-grid${outlineCollapsed ? " no-outline" : ""}`}>
          {!outlineCollapsed && (
            <OutlinePanel
              title={title || "Untitled"}
              items={outline}
              onJump={(id) => editorRef.current?.scrollToHeading(id)}
              menu={outlineMenu}
            />
          )}

          <RichEditor
            // remount only when the note id changes — not on every keystroke
            key={noteId}
            ref={editorRef}
            initialMarkdown={body}
            onChange={onBodyChange}
            onOpenLink={openLinkEditor}
            audioUrlById={audioUrlById}
            onNavigateNote={(id) => setView({ kind: "note", noteId: id })}
            onSlashCommand={(kind) => setSlashPickerKind(kind)}
          />
        </div>
      </main>

      <aside className="right-panel note-aside">
        <AiMascotBanner />
        <AiAssistantCard
          busy={busy}
          onAction={(a) => void runAi(a)}
          onAsk={() => setAskOpen((v) => !v)}
          askOpen={askOpen}
          askResult={askResult}
          onAskSubmit={(q) => void runAi("ask", q)}
          menu={aiMenu}
        />
        {error && <div className="pill error" role="alert">{error}</div>}
        {note.summary && <SummaryCard summary={note.summary} />}
        <NoteInsightsCard
          readingMinutes={insights.readingMinutes}
          flashcards={flashcardCount}
          quizCount={quizzes.length}
          keyTerms={insights.keyTerms}
          onOpenFlashcards={() =>
            sets[0] && setView({ kind: "flashcardSet", setId: sets[0].id })
          }
          onOpenQuiz={() =>
            quizzes[0] && setView({ kind: "quiz", quizId: quizzes[0].id })
          }
        />
        <LinkedNotesCard
          items={linked}
          onOpen={(id) => setView({ kind: "note", noteId: id })}
        />
        <SyncFooter status={syncStatus} updatedAt={note.updated_at} />
      </aside>

      {recorderOpen && (
        <AudioRecorderModal
          onClose={() => setRecorderOpen(false)}
          onSave={handleAudioRecorded}
        />
      )}

      {linkDialogOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="note-link-dialog-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLinkDialogOpen(false);
          }}
        >
          <div
            className="modal-card note-link-dialog"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="note-link-dialog-title">Link</h2>
            <p className="modal-subtle">
              Web URL, or <code className="linked-syntax">note://…</code> /{" "}
              <code className="linked-syntax">audio://…</code> (optional title{" "}
              <code className="linked-syntax">&quot;clip:0-20&quot;</code>). For search-based picks, type{" "}
              <code className="linked-syntax">//</code> in the note body instead.
            </p>
            <label htmlFor="note-link-url" className="note-link-label">
              Address
            </label>
            <input
              id="note-link-url"
              type="text"
              className="note-link-url-input"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              placeholder="https://… or note://… or audio://…"
              autoComplete="off"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editorRef.current?.applyLink(linkDraft.trim());
                  setLinkDialogOpen(false);
                }
                if (e.key === "Escape") setLinkDialogOpen(false);
              }}
            />
            <div className="modal-actions note-link-actions">
              <button type="button" className="btn-ghost" onClick={() => setLinkDialogOpen(false)}>
                Cancel
              </button>
              {linkHadHref && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    editorRef.current?.applyLink(null);
                    setLinkDialogOpen(false);
                  }}
                >
                  Remove link
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  editorRef.current?.applyLink(linkDraft.trim());
                  setLinkDialogOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {slashPickerKind && (
        <SlashLinkPickerModal
          kind={slashPickerKind}
          currentNoteId={noteId}
          audioItems={attachments.filter((a): a is AudioAttachment => a.kind === "audio")}
          onClose={() => {
            setSlashPickerKind(null);
            editorRef.current?.abortSlashInsert();
          }}
          onPickNote={(n) => {
            editorRef.current?.insertNoteLink(n.id, n.title || "Untitled");
            setSlashPickerKind(null);
          }}
          onPickAudio={(a) => {
            editorRef.current?.insertAudioLink(a.id, a.label || "Audio");
            setSlashPickerKind(null);
          }}
        />
      )}
    </>
  );
};

/** Snippet for note search rows (same idea as HeroSearch). */
function slashPickerSnippet(content: string, query: string): string {
  if (!content) return "";
  const t = query.trim();
  if (!t) return content.slice(0, 80);
  const i = content.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return content.slice(0, 80);
  const start = Math.max(0, i - 24);
  const out = content.slice(start, start + 80).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + out + (start + 80 < content.length ? "…" : "");
}

const SlashLinkPickerModal: FC<{
  kind: "notelink" | "audiolink";
  currentNoteId: string;
  audioItems: AudioAttachment[];
  onClose: () => void;
  onPickNote: (n: NoteRow) => void;
  onPickAudio: (a: AudioAttachment) => void;
}> = ({ kind, currentNoteId, audioItems, onClose, onPickNote, onPickAudio }) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<NoteRow[]>([]);
  const [active, setActive] = useState(0);
  const reqId = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQ("");
    setResults([]);
    setActive(0);
    inputRef.current?.focus();
  }, [kind]);

  useEffect(() => {
    if (kind !== "notelink") return;
    const t = q.trim();
    if (!t) {
      setResults([]);
      return;
    }
    const my = ++reqId.current;
    const timer = window.setTimeout(() => {
      void searchNotes(t, 14).then((rows) => {
        if (my !== reqId.current) return;
        setResults(rows.filter((n) => n.id !== currentNoteId));
        setActive(0);
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [q, kind, currentNoteId]);

  const filteredAudio = useMemo(() => {
    if (kind !== "audiolink") return [];
    const t = q.trim().toLowerCase();
    if (!t) return audioItems;
    return audioItems.filter(
      (a) =>
        (a.label || "").toLowerCase().includes(t) ||
        formatDuration(a.durationSec).includes(t),
    );
  }, [kind, q, audioItems]);

  const noteRows = kind === "notelink" ? results : [];
  const audioRows = kind === "audiolink" ? filteredAudio : [];

  function handleListKeyDown(e: ReactKeyboardEvent<HTMLInputElement>): void {
    const rows = kind === "notelink" ? noteRows : audioRows;
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    }
    if (e.key === "Enter" && rows.length > 0) {
      e.preventDefault();
      const idx = Math.min(active, rows.length - 1);
      const row = rows[idx]!;
      if (kind === "notelink") onPickNote(row as NoteRow);
      else onPickAudio(row as AudioAttachment);
    }
  }

  const title = kind === "notelink" ? "Link to note" : "Link to recording";

  return (
    <div
      className="modal-backdrop slash-link-picker-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slash-link-picker-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card slash-link-picker" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="slash-link-picker-title">{title}</h2>
        <p className="modal-subtle slash-link-picker-hint">
          {kind === "notelink"
            ? "Search by title or note content — same database search as elsewhere."
            : "Pick a recording attached to this note."}
        </p>
        <label className="slash-link-picker-search">
          <span className="search-icon" aria-hidden>
            <SearchIcon size={16} />
          </span>
          <input
            ref={inputRef}
            type="search"
            placeholder={kind === "notelink" ? "Search notes…" : "Filter recordings…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleListKeyDown}
            autoComplete="off"
            aria-label={kind === "notelink" ? "Search notes" : "Filter recordings"}
          />
        </label>
        <div className="search-results slash-link-picker-results" role="listbox">
          {kind === "notelink" && q.trim() === "" && (
            <div className="search-empty">Type to search your notes.</div>
          )}
          {kind === "notelink" && q.trim() !== "" && noteRows.length === 0 && (
            <div className="search-empty">No notes match.</div>
          )}
          {kind === "notelink" &&
            noteRows.map((n, i) => (
              <button
                key={n.id}
                type="button"
                role="option"
                aria-selected={i === active}
                className={`search-item${i === active ? " active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => onPickNote(n)}
              >
                <NoteGlyph icon={n.icon} size={14} />
                <span className="search-item-title">{n.title || "Untitled"}</span>
                <span className="search-item-sub">{slashPickerSnippet(n.content_markdown ?? "", q)}</span>
              </button>
            ))}
          {kind === "audiolink" && audioRows.length === 0 && (
            <div className="search-empty">
              {audioItems.length === 0
                ? "Record audio from the toolbar first, then type // in the note and choose Link to audio."
                : "No recordings match your filter."}
            </div>
          )}
          {kind === "audiolink" &&
            audioRows.map((a, i) => (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={i === active}
                className={`search-item${i === active ? " active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => onPickAudio(a)}
              >
                <span className="slash-audio-ic" aria-hidden>
                  <MicIcon size={14} />
                </span>
                <span className="search-item-title">{a.label || "Recording"}</span>
                <span className="search-item-sub">{formatDuration(a.durationSec)} · audio</span>
              </button>
            ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

/* ====================================================================
 * Header  (breadcrumb + sync · title · tag editor)
 * ================================================================== */

interface HeaderProps {
  note: NoteRow;
  classes: ClassRow[];
  classId: string | null;
  noteTypeLabel: string;
  title: string;
  onTitleChange: (v: string) => void;
  onBack: () => void;
  syncStatus: SyncStatus;
  tags: string[];
  onAddTag: (t: string) => void;
  onRemoveTag: (t: string) => void;
  onChangeIcon: (key: string) => void;
  onClassChange: (classId: string | null) => void;
  menu: MoreMenuItem[];
}

const NoteHeader: FC<HeaderProps> = ({
  note,
  classes,
  classId,
  noteTypeLabel,
  title,
  onTitleChange,
  onBack,
  syncStatus,
  tags,
  onAddTag,
  onRemoveTag,
  onChangeIcon,
  onClassChange,
  menu,
}) => {
  const TypeIcon = getNoteIconComponent(note.icon);
  const sync = describeSync(syncStatus);

  return (
    <div className="note-header">
      <div className="note-breadcrumb">
        <button
          type="button"
          className="crumb-back"
          onClick={onBack}
          aria-label="Back to notes"
        >
          <ChevLeftIcon size={14} />
        </button>
        <button type="button" className="crumb crumb-link" onClick={onBack}>
          <NoteIcon size={13} /> Notes
        </button>
        <span className="crumb-sep">/</span>
        <ClassPicker classId={classId} classes={classes} onChange={onClassChange} />
        <span className="crumb-sep">/</span>
        <NoteTypePicker
          currentKey={note.icon}
          label={noteTypeLabel}
          IconComponent={TypeIcon}
          onChange={onChangeIcon}
        />
        <span className={`note-saved sync-${sync.tone}`} title={sync.detail}>
          <span className="dot" /> {sync.label}
        </span>
      </div>

      <div className="note-title-row">
        <input
          className="note-title-input"
          placeholder="Untitled"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <TagEditor tags={tags} onAdd={onAddTag} onRemove={onRemoveTag} />
        <span className={`tag-chip sync-pill sync-${sync.tone}`}>
          {sync.tone === "ok" ? <CloudCheckIcon size={12} /> : <CloudOffIcon size={12} />}
          {sync.tone === "ok" ? "Synced" : "Not synced"}
        </span>
        <span className="note-header-more">
          <MoreMenu items={menu} label="Note options" />
        </span>
      </div>
    </div>
  );
};

/** Friendly mapping over `SyncStatus`. */
function describeSync(s: SyncStatus): {
  tone: "ok" | "warn" | "bad";
  label: string;
  detail: string;
} {
  switch (s) {
    case "synced":
      return { tone: "ok", label: "Synced", detail: "All changes saved" };
    case "saving":
    case "syncing":
      return { tone: "warn", label: "Saving…", detail: "Saving changes" };
    case "offline":
      return { tone: "bad", label: "Not synced", detail: "Working offline" };
    case "conflict":
      return { tone: "bad", label: "Not synced", detail: "Sync conflict" };
    case "error":
      return { tone: "bad", label: "Not synced", detail: "Sync failed" };
  }
}

/* ---- Class picker (matches note type picker interaction) ---------- */

const ClassPicker: FC<{
  classId: string | null;
  classes: ClassRow[];
  onChange: (classId: string | null) => void;
}> = ({ classId, classes, onChange }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent): void {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = classId ? classes.find((c) => c.id === classId) : null;
  const label = current?.name ?? "Unfiled";

  return (
    <div className="type-picker class-picker" ref={wrapRef}>
      <button
        type="button"
        className="crumb crumb-type"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Move note to class"
      >
        <span
          className={`class-picker-trigger-swatch${current?.color ? "" : " class-picker-trigger-swatch--empty"}`}
          style={current?.color ? { background: current.color } : undefined}
          aria-hidden
        />
        <span className="class-picker-trigger-label">{label}</span>
      </button>
      {open && (
        <div className="type-picker-menu class-picker-menu" role="listbox">
          <button
            type="button"
            role="option"
            aria-selected={classId == null || classId === ""}
            className={`type-picker-item${!classId ? " active" : ""}`}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <span className="class-picker-swatch class-picker-swatch--empty" aria-hidden />
            <span className="class-picker-item-text">Unfiled</span>
          </button>
          {classes.map((c) => {
            const active = c.id === classId;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`type-picker-item${active ? " active" : ""}`}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <span
                  className="class-picker-swatch"
                  style={{ background: c.color ?? "var(--color-primary)" }}
                  aria-hidden
                />
                <span className="class-picker-item-text">{c.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ---- Note type (icon) picker --------------------------------------- */

const NoteTypePicker: FC<{
  currentKey: string;
  label: string;
  IconComponent: FC<{ size?: number }>;
  onChange: (key: string) => void;
}> = ({ currentKey, label, IconComponent, onChange }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent): void {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="type-picker" ref={wrapRef}>
      <button
        type="button"
        className="crumb crumb-type"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <IconComponent size={13} /> {label}
      </button>
      {open && (
        <div className="type-picker-menu" role="listbox">
          {NOTE_ICON_LIST.map((m) => {
            const Icon = m.Icon;
            const active = m.key === currentKey;
            return (
              <button
                key={m.key}
                type="button"
                role="option"
                aria-selected={active}
                className={`type-picker-item${active ? " active" : ""}`}
                onClick={() => {
                  onChange(m.key);
                  setOpen(false);
                }}
              >
                <Icon size={14} />
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ---- Tag editor ---------------------------------------------------- */

const TagEditor: FC<{
  tags: string[];
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
}> = ({ tags, onAdd, onRemove }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  function commit(): void {
    if (draft.trim()) onAdd(draft);
    setDraft("");
    setEditing(false);
  }

  return (
    <div className="note-tag-chips">
      {tags.map((t) => (
        <span key={t} className="tag-chip">
          {t}
          <button
            type="button"
            className="tag-remove"
            aria-label={`Remove ${t}`}
            onClick={() => onRemove(t)}
          >
            <XIcon size={12} />
          </button>
        </span>
      ))}
      {editing ? (
        <input
          ref={inputRef}
          className="tag-input"
          autoFocus
          placeholder="Add tag…"
          value={draft}
          maxLength={32}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft("");
              setEditing(false);
            }
          }}
          onBlur={commit}
        />
      ) : (
        <button
          type="button"
          className="tag-chip tag-add"
          onClick={() => setEditing(true)}
          aria-label="Add tag"
        >
          <PlusIcon size={11} /> Tag
        </button>
      )}
    </div>
  );
};

/* ====================================================================
 * Format toolbar
 * ================================================================== */

type ToolbarKind =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "bold"
  | "italic"
  | "ul"
  | "ol"
  | "task"
  | "quote"
  | "hilite"
  | "foreColor"
  | "fontSize";

interface ToolbarProps {
  onAction: (kind: ToolbarKind, value?: string) => void;
  onLink: () => void;
  onMic: () => void;
  onImage: () => void;
}

const HEADING_MENU: { kind: ToolbarKind; label: string }[] = [
  { kind: "paragraph", label: "Normal" },
  { kind: "h1", label: "Heading 1" },
  { kind: "h2", label: "Heading 2" },
  { kind: "h3", label: "Heading 3" },
  { kind: "h4", label: "Heading 4" },
  { kind: "h5", label: "Heading 5" },
  { kind: "h6", label: "Heading 6" },
];

const HIGHLIGHT_SWATCHES = ["transparent", "#fff59d", "#ffecb3", "#c8e6c9", "#bbdefb", "#e1bee7", "#ffcdd2"];
const TEXT_COLOR_SWATCHES = ["#1a1a1a", "#5d4037", "#c62828", "#1565c0", "#2e7d32", "#6a1b9a", "#546e7a"];
const FONT_SIZE_OPTS: { label: string; value: string }[] = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "4" },
  { label: "Huge", value: "6" },
];

const FormatToolbar: FC<ToolbarProps> = ({ onAction, onLink, onMic, onImage }) => (
  <div className="note-toolbar" role="toolbar" aria-label="Formatting">
    <div className="toolbar-dropdown">
      <button
        type="button"
        className="tool-btn tool-btn-text toolbar-dropdown-trigger"
        aria-haspopup="menu"
        aria-label="Paragraph and headings"
      >
        Styles
      </button>
      <div className="toolbar-dropdown-panel" role="menu">
        {HEADING_MENU.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            role="menuitem"
            className="toolbar-dropdown-item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAction(kind)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
    <span className="toolbar-sep" />
    <ToolBtn label="Bold" onClick={() => onAction("bold")} kind="text">
      <span style={{ fontWeight: 800 }}>B</span>
    </ToolBtn>
    <ToolBtn label="Italic" onClick={() => onAction("italic")} kind="text">
      <span style={{ fontStyle: "italic", fontFamily: "Georgia, serif" }}>I</span>
    </ToolBtn>
    <span className="toolbar-sep" />
    <ToolBtn label="Bullet list" onClick={() => onAction("ul")}>
      <BulletGlyph />
    </ToolBtn>
    <ToolBtn label="Numbered list" onClick={() => onAction("ol")}>
      <OrderedGlyph />
    </ToolBtn>
    <ToolBtn label="Task list" onClick={() => onAction("task")}>
      <TaskGlyph />
    </ToolBtn>
    <ToolBtn label="Quote" onClick={() => onAction("quote")}>
      <QuoteGlyph />
    </ToolBtn>
    <ToolBtn label="Link" onClick={onLink}>
      <LinkGlyph />
    </ToolBtn>
    <span className="toolbar-sep" />
    <ToolBtn label="Insert image" onClick={onImage}>
      <ImageIcon size={18} />
    </ToolBtn>
    <ToolBtn label="Record audio" onClick={onMic}>
      <MicIcon size={18} />
    </ToolBtn>
    <div className="toolbar-dropdown toolbar-dropdown-end">
      <button
        type="button"
        className="tool-btn"
        aria-haspopup="menu"
        aria-label="More text formatting"
        title="Highlight, text color, size"
      >
        <MoreIcon size={18} />
      </button>
      <div className="toolbar-dropdown-panel toolbar-dropdown-panel-wide" role="menu">
        <div className="toolbar-extras-section">
          <span className="toolbar-extras-label">Highlight</span>
          <div className="toolbar-swatch-row">
            {HIGHLIGHT_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={`toolbar-swatch${c === "transparent" ? " toolbar-swatch-clear" : ""}`}
                style={c === "transparent" ? undefined : { background: c }}
                aria-label={c === "transparent" ? "Clear highlight" : `Highlight ${c}`}
                title={c === "transparent" ? "Clear highlight" : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onAction("hilite", c)}
              />
            ))}
          </div>
        </div>
        <div className="toolbar-extras-section">
          <span className="toolbar-extras-label">Text color</span>
          <div className="toolbar-swatch-row">
            {TEXT_COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className="toolbar-swatch toolbar-swatch-ring"
                style={{ background: c }}
                aria-label={`Color ${c}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onAction("foreColor", c)}
              />
            ))}
          </div>
        </div>
        <div className="toolbar-extras-section">
          <span className="toolbar-extras-label">Size</span>
          <div className="toolbar-size-row">
            {FONT_SIZE_OPTS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className="toolbar-size-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onAction("fontSize", value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-extras-section">
          <span className="toolbar-extras-label">Pick color</span>
          <div className="toolbar-custom-color-row">
            <label className="toolbar-color-picker">
              <span>Highlight</span>
              <input
                type="color"
                defaultValue="#fff59d"
                aria-label="Pick highlight color"
                onMouseDown={(e) => e.preventDefault()}
                onInput={(e) => onAction("hilite", (e.target as HTMLInputElement).value)}
              />
            </label>
            <label className="toolbar-color-picker">
              <span>Text</span>
              <input
                type="color"
                defaultValue="#1a1a1a"
                aria-label="Pick text color"
                onMouseDown={(e) => e.preventDefault()}
                onInput={(e) => onAction("foreColor", (e.target as HTMLInputElement).value)}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ToolBtn: FC<{
  label: string;
  onClick: () => void;
  kind?: "icon" | "text";
  children: ReactNode;
}> = ({ label, onClick, kind = "icon", children }) => (
  <button
    type="button"
    className={`tool-btn tool-btn-${kind}`}
    aria-label={label}
    title={label}
    onMouseDown={(e) => e.preventDefault() /* keep selection in editor */}
    onClick={onClick}
  >
    {children}
  </button>
);

const BulletGlyph: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" {...props}>
    <circle cx="5" cy="6" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="5" cy="18" r="1.4" fill="currentColor" stroke="none" />
    <path d="M10 6h10M10 12h10M10 18h10" />
  </svg>
);
const OrderedGlyph: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" {...props}>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <text x="2" y="9" fontSize="6" fill="currentColor" stroke="none">1</text>
    <text x="2" y="14" fontSize="6" fill="currentColor" stroke="none">2</text>
    <text x="2" y="20" fontSize="6" fill="currentColor" stroke="none">3</text>
  </svg>
);
const TaskGlyph: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <path d="m4.5 7.2 1.6 1.6L9.4 5" />
    <path d="M14 6h7M14 12h7M14 18h7" />
    <rect x="3.5" y="14.5" width="7" height="7" rx="1.5" />
  </svg>
);
const QuoteGlyph: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" {...props}>
    <path d="M7 7h4v5c0 2-1 4-4 5M14 7h4v5c0 2-1 4-4 5" />
  </svg>
);
const LinkGlyph: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
  </svg>
);

/* ====================================================================
 * Attachment strip
 * ================================================================== */

const AttachmentStrip: FC<{
  items: Attachment[];
  onRemove: (id: string) => void;
  onInsertAudioLink?: (id: string) => void;
}> = ({ items, onRemove, onInsertAudioLink }) => (
  <div className="attachment-strip">
    {items.map((a) => (
      <div key={a.id} className={`attachment-chip ${a.kind}`}>
        <span className="ac-icon">
          {a.kind === "audio" ? <MicIcon size={14} /> : <ImageIcon size={14} />}
        </span>
        <div className="ac-text">
          <span className="ac-title">
            {a.kind === "audio"
              ? `${formatDuration(a.durationSec)} · audio`
              : `${a.count} image${a.count > 1 ? "s" : ""}`}
          </span>
          <span className="ac-sub">{a.label}</span>
        </div>
        {a.kind === "audio" && onInsertAudioLink && (
          <button
            type="button"
            className="ac-insert"
            title="Insert playable link in note"
            aria-label="Insert audio link in note"
            onClick={() => onInsertAudioLink(a.id)}
          >
            Link
          </button>
        )}
        <button
          type="button"
          className="ac-close"
          aria-label="Remove attachment"
          onClick={() => onRemove(a.id)}
        >
          ×
        </button>
      </div>
    ))}
  </div>
);

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ====================================================================
 * Outline panel
 * ================================================================== */

interface OutlineItem {
  id: string;
  text: string;
  level: number;
}

const OutlinePanel: FC<{
  title: string;
  items: OutlineItem[];
  onJump: (id: string) => void;
  menu: MoreMenuItem[];
}> = ({ title, items, onJump, menu }) => (
  <div className="outline-panel">
    <div className="outline-head">
      <span>Outline</span>
      <MoreMenu items={menu} label="Outline options" />
    </div>
    <button type="button" className="outline-doc">{title}</button>
    {items.length === 0 ? (
      <p className="outline-empty">Headings will appear here as you write.</p>
    ) : (
      <ul className="outline-list">
        {items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              className={`outline-item lvl-${it.level}`}
              onClick={() => onJump(it.id)}
            >
              {it.text}
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

/* ---- List / task backspace (contentEditable quirks) ---------------- */

function findContainingLi(node: Node | null, root: HTMLElement): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName === "LI") {
      return n as HTMLElement;
    }
    n = n.parentNode;
  }
  return null;
}

function collapseRangeAt(root: HTMLElement, el: HTMLElement, start = true): void {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  if (el.tagName === "LI" && el.classList.contains("md-task")) {
    const tt = el.querySelector(".md-task-text");
    const tn = tt?.firstChild;
    if (tn?.nodeType === Node.TEXT_NODE) {
      if (start) {
        r.setStart(tn, 0);
        r.collapse(true);
      } else {
        const len = tn.textContent?.length ?? 0;
        r.setStart(tn, len);
        r.collapse(true);
      }
    } else if (tt) {
      r.selectNodeContents(tt);
      if (start) r.collapse(true);
      else r.collapse(false);
    }
  } else {
    r.selectNodeContents(el);
    if (start) r.collapse(true);
    else r.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(r);
}

function rangeAtStartOfLi(li: HTMLElement, range: Range): boolean {
  const r = document.createRange();
  r.selectNodeContents(li);
  r.collapse(true);
  return range.compareBoundaryPoints(Range.START_TO_START, r) === 0;
}

function rangeAtStartOfTaskText(taskText: HTMLElement, range: Range): boolean {
  const first = taskText.firstChild;
  if (!first) return true;
  if (first.nodeType === Node.TEXT_NODE) {
    return range.startContainer === first && range.startOffset === 0;
  }
  return range.startContainer === taskText && range.startOffset === 0;
}

function deleteOrOutdentListItem(root: HTMLElement, li: HTMLElement, ul: HTMLElement): void {
  const text = li.textContent?.replace(/\u200b/g, "").trim() ?? "";
  const isTask = li.classList.contains("md-task");
  const taskEmpty =
    isTask && (!(li.querySelector(".md-task-text")?.textContent ?? "").replace(/\u200b/g, "").trim());

  if (text === "" || taskEmpty) {
    const idx = Array.from(ul.children).indexOf(li);
    li.remove();
    if (ul.children.length === 0) {
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      ul.replaceWith(p);
      collapseRangeAt(root, p, true);
    } else {
      const next = ul.children[Math.min(idx, ul.children.length - 1)] as HTMLElement;
      collapseRangeAt(root, next, true);
    }
    return;
  }

  document.execCommand("outdent");
}

/**
 * Return true if the event was handled (caller should flush).
 */
function handleListBackspace(root: HTMLElement, e: ReactKeyboardEvent<HTMLDivElement>): boolean {
  if (e.key !== "Backspace" || e.defaultPrevented) return false;
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return false;

  const range = sel.getRangeAt(0);
  const li = findContainingLi(range.startContainer, root);
  if (!li) return false;

  const ul = li.parentElement;
  if (!ul || (ul.tagName !== "UL" && ul.tagName !== "OL")) return false;

  if (li.classList.contains("md-task")) {
    const tt = li.querySelector(".md-task-text") as HTMLElement | null;
    if (!tt || !rangeAtStartOfTaskText(tt, range)) return false;
    e.preventDefault();
    deleteOrOutdentListItem(root, li, ul);
    return true;
  }

  if (!rangeAtStartOfLi(li, range)) return false;
  e.preventDefault();
  deleteOrOutdentListItem(root, li, ul);
  return true;
}

const IMG_FRAME_MARKUP_PREFIX =
  '<span class="rich-img-frame" contenteditable="false" draggable="false">';
const IMG_FRAME_MARKUP_SUFFIX =
  '<button type="button" class="rich-img-resize-handle" tabindex="-1" aria-label="Drag to resize image"></button></span>';

function wrapImageHtml(imgTagInner: string): string {
  return `${IMG_FRAME_MARKUP_PREFIX}${imgTagInner}${IMG_FRAME_MARKUP_SUFFIX}`;
}

function normalizeBareImages(root: HTMLElement): void {
  root.querySelectorAll("img.rich-img").forEach((imgEl) => {
    const img = imgEl as HTMLImageElement;
    if (img.closest(".rich-img-frame")) return;
    const w = img.getAttribute("width");
    if (w && !img.style.width) img.style.width = `${parseInt(w, 10)}px`;
    const wrap = document.createElement("span");
    wrap.className = "rich-img-frame";
    wrap.setAttribute("contenteditable", "false");
    wrap.setAttribute("draggable", "false");
    img.replaceWith(wrap);
    wrap.appendChild(img);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rich-img-resize-handle";
    btn.tabIndex = -1;
    btn.setAttribute("aria-label", "Drag to resize image");
    wrap.appendChild(btn);
  });
}

/* ====================================================================
 * RichEditor — contentEditable WYSIWYG
 *
 * The DOM is the live edit surface; markdown is the persisted form.
 * - On mount: parse `initialMarkdown` to HTML and inject.
 * - On input: serialize the DOM back to markdown and call `onChange`.
 * - Toolbar commands manipulate the DOM via document.execCommand and a
 *   few custom helpers (task list, blockquote callout) before
 *   serializing.
 * - Auto-format: typing "## " (etc.) at the start of a line promotes
 *   the line to the matching block element so users never need to know
 *   what markdown is.
 * ================================================================== */

interface EditorHandle {
  run: (kind: ToolbarKind, value?: string) => void;
  scrollToHeading: (id: string) => void;
  applyLink: (url: string | null) => void;
  getLinkHrefAtCaret: () => string | null;
  /** Keep the first H1 in the editor aligned with the note title field. */
  syncTitleHeading: (title: string) => void;
  /** Insert an inline audio player for an attachment id (uses live blob/storage URL). */
  insertAudioLink: (attachmentId: string, label?: string, clipSec?: { start: number; end: number }) => void;
  insertNoteLink: (noteId: string, linkLabel: string) => void;
  /** Cancel a pending insert position from // commands if the picker was dismissed. */
  abortSlashInsert: () => void;
}

interface RichEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  onOpenLink: () => void;
  /** Resolve `audio://attachment-id` in markdown to playable URLs. */
  audioUrlById?: ReadonlyMap<string, string>;
  /** Follow `note://…` links from the editor without leaving the app shell. */
  onNavigateNote?: (noteId: string) => void;
  /** User confirmed a // shortcut — token was removed; open the note or audio picker. */
  onSlashCommand?: (kind: "notelink" | "audiolink") => void;
}

/** Estimated size for clamping `.selection-floating-toolbar` in the viewport. */
const SELECTION_BUBBLE_EST_HEIGHT = 280;
const SELECTION_BUBBLE_EST_HALF_WIDTH = 160;
const SELECTION_BUBBLE_GAP = 10;

function computeSelectionBubblePosition(rect: DOMRect): {
  top: number;
  left: number;
  placement: "above" | "below";
} {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 12;

  const toolbarEl = document.querySelector(".note-toolbar");
  const toolbarBottom = toolbarEl?.getBoundingClientRect().bottom ?? margin;

  const centerX = rect.left + rect.width / 2;
  const left = Math.min(
    Math.max(centerX, margin + SELECTION_BUBBLE_EST_HALF_WIDTH),
    vw - margin - SELECTION_BUBBLE_EST_HALF_WIDTH,
  );

  const gap = SELECTION_BUBBLE_GAP;
  const estH = SELECTION_BUBBLE_EST_HEIGHT;

  const spaceAbove = rect.top - toolbarBottom - gap;
  const spaceBelow = vh - rect.bottom - gap;

  const fitsAbove = spaceAbove >= estH;
  const fitsBelow = spaceBelow >= estH;

  let placement: "above" | "below";
  let top: number;

  if (!fitsAbove && !fitsBelow) {
    placement = spaceAbove >= spaceBelow ? "above" : "below";
  } else if (fitsAbove && fitsBelow) {
    placement = spaceAbove >= spaceBelow ? "above" : "below";
  } else if (fitsAbove) {
    placement = "above";
  } else {
    placement = "below";
  }

  top = placement === "above" ? rect.top - gap : rect.bottom + gap;
  return { top, left, placement };
}

const RichEditor = forwardRef<EditorHandle, RichEditorProps>(function RichEditor(
  { initialMarkdown, onChange, onOpenLink, audioUrlById, onNavigateNote, onSlashCommand },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const audioUrlByIdRef = useRef<Map<string, string>>(new Map());
  audioUrlByIdRef.current = mapFromMaybe(audioUrlById);
  /** Caret position after removing the // token — restored when inserting from picker. */
  const slashInsertRangeRef = useRef<Range | null>(null);
  /** Range covering the active `//…` token — deleted when the user confirms a shortcut. */
  const slashTokenRangeRef = useRef<Range | null>(null);
  const slashMenuRef = useRef<{
    top: number;
    left: number;
    placement: "above" | "below";
    options: { kind: "notelink" | "audiolink"; label: string }[];
    active: number;
  } | null>(null);
  /** Last non-collapsed range inside the editor — survives toolbar/bubble clicks. */
  const savedRangeRef = useRef<Range | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<{
    top: number;
    left: number;
    placement: "above" | "below";
  } | null>(null);
  const [slashMenu, setSlashMenu] = useState<{
    top: number;
    left: number;
    placement: "above" | "below";
    options: { kind: "notelink" | "audiolink"; label: string }[];
    active: number;
  } | null>(null);

  useEffect(() => {
    slashMenuRef.current = slashMenu;
  }, [slashMenu]);

  /* ---- initial seeding ---------------------------------------------- */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.innerHTML = markdownToHtml(initialMarkdown, {
      audioById: mapFromMaybe(audioUrlById),
    });
    normalizeBareImages(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    onChange(htmlToMarkdown(el));
  }, [onChange]);

  const updateSelectionBubble = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      savedRangeRef.current = null;
      setSelectionBubble(null);
      return;
    }
    const { anchorNode, focusNode } = sel;
    if (!anchorNode || !focusNode || !el.contains(anchorNode) || !el.contains(focusNode)) {
      savedRangeRef.current = null;
      setSelectionBubble(null);
      return;
    }
    const range = sel.getRangeAt(0);
    savedRangeRef.current = range.cloneRange();
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setSelectionBubble(null);
      return;
    }
    setSelectionBubble(computeSelectionBubblePosition(rect));
  }, []);

  const updateSlashMenu = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const st = getDoubleSlashMenuState(el);
    if (!st) {
      slashTokenRangeRef.current = null;
      setSlashMenu(null);
      return;
    }
    slashTokenRangeRef.current = st.deleteRange.cloneRange();
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const rect = caretRectOrFallback(sel.getRangeAt(0));
    const pos = computeSlashPopoverPosition(rect);
    setSlashMenu((prev) => {
      const sameOrder =
        prev &&
        prev.options.length === st.options.length &&
        prev.options.every((o, i) => o.kind === st.options[i]?.kind);
      const active = sameOrder ? Math.min(prev.active, st.options.length - 1) : 0;
      return {
        ...pos,
        options: st.options,
        active,
      };
    });
  }, []);

  const confirmSlashOption = useCallback(
    (kind: "notelink" | "audiolink") => {
      const el = rootRef.current;
      const tok = slashTokenRangeRef.current;
      if (!el || !tok) return;
      const sel = window.getSelection();
      try {
        const r = tok.cloneRange();
        sel?.removeAllRanges();
        sel?.addRange(r);
        r.deleteContents();
        if (sel?.rangeCount) slashInsertRangeRef.current = sel.getRangeAt(0).cloneRange();
        slashTokenRangeRef.current = null;
        setSlashMenu(null);
        flush();
        onSlashCommand?.(kind);
      } catch {
        slashTokenRangeRef.current = null;
        setSlashMenu(null);
      }
    },
    [flush, onSlashCommand],
  );

  useEffect(() => {
    function onSelChange(): void {
      requestAnimationFrame(() => {
        updateSlashMenu();
        updateSelectionBubble();
      });
    }
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, [updateSlashMenu, updateSelectionBubble]);

  /** Keep the bubble aligned when `.note-main` (or other ancestors) scroll or the window resizes. */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const scrollRoots = new Set<EventTarget>();
    scrollRoots.add(window);
    let n: HTMLElement | null = el;
    while (n) {
      const { overflowY, overflow } = window.getComputedStyle(n);
      if (
        overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay" ||
        overflow === "auto" ||
        overflow === "scroll"
      ) {
        scrollRoots.add(n);
      }
      n = n.parentElement;
    }

    function onScrollOrResize(): void {
      requestAnimationFrame(() => {
        updateSlashMenu();
        updateSelectionBubble();
      });
    }

    scrollRoots.forEach((t) => t.addEventListener("scroll", onScrollOrResize, { passive: true }));
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      scrollRoots.forEach((t) => t.removeEventListener("scroll", onScrollOrResize));
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [updateSlashMenu, updateSelectionBubble]);

  /** When a recording finishes, hydrate placeholders and attach playable URLs for `audio://` links. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const byId = mapFromMaybe(audioUrlById);
    let missing = root.querySelector(".rich-audio-missing[data-att-id]");
    while (missing) {
      const wrap = missing as HTMLElement;
      const id = wrap.dataset.attId;
      const url = id ? byId.get(id) : undefined;
      if (url && id) {
        const label = wrap.querySelector(".rich-audio-label")?.textContent ?? "Audio";
        const clipStr = wrap.dataset.clip;
        let clip: { start: number; end: number } | null = null;
        if (clipStr && /^(\d+)-(\d+)$/.test(clipStr)) {
          const [a, b] = clipStr.split("-");
          clip = { start: parseInt(a!, 10), end: parseInt(b!, 10) };
        }
        const html = renderRichAudioHtml(label, id, url, clip);
        const tpl = document.createElement("template");
        tpl.innerHTML = html.trim();
        const node = tpl.content.firstElementChild;
        if (node) wrap.replaceWith(node);
      }
      missing = root.querySelector(".rich-audio-missing[data-att-id]");
    }
    root.querySelectorAll<HTMLElement>(".rich-audio-inline[data-att-id]").forEach((wrap) => {
      const id = wrap.dataset.attId;
      if (!id) return;
      const url = byId.get(id);
      const audio = wrap.querySelector("audio.rich-audio-el") as HTMLAudioElement | null;
      if (!url || !audio) return;
      const clipStr = wrap.dataset.clip;
      if (clipStr && /^(\d+)-(\d+)$/.test(clipStr)) {
        const [a, b] = clipStr.split("-");
        audio.dataset.clipStart = a!;
        audio.dataset.clipEnd = b!;
        audio.src = `${url}#t=${a},${b}`;
      } else {
        delete audio.dataset.clipStart;
        delete audio.dataset.clipEnd;
        audio.src = url;
      }
    });
  }, [audioUrlById]);

  /** Pause at clip end; seek to clip start on play (quoted segment). */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const editorRoot = root;
    function onTimeUpdate(e: Event): void {
      const a = e.target as HTMLAudioElement;
      if (!a.classList.contains("rich-audio-el") || !editorRoot.contains(a)) return;
      const end = a.dataset.clipEnd;
      if (end == null || end === "") return;
      const endSec = parseFloat(end);
      if (a.currentTime >= endSec - 0.08) {
        a.pause();
        const st = a.dataset.clipStart;
        a.currentTime = st != null && st !== "" ? parseFloat(st) : 0;
      }
    }
    function onPlayMaybeSeek(e: Event): void {
      const a = e.target as HTMLAudioElement;
      if (!a.classList.contains("rich-audio-el") || !editorRoot.contains(a)) return;
      const st = a.dataset.clipStart;
      if (st != null && st !== "") {
        const startSec = parseFloat(st);
        if (!Number.isNaN(startSec) && a.currentTime < startSec - 0.05) {
          a.currentTime = startSec;
        }
      }
    }
    root.addEventListener("timeupdate", onTimeUpdate);
    root.addEventListener("play", onPlayMaybeSeek, true);
    return () => {
      root.removeEventListener("timeupdate", onTimeUpdate);
      root.removeEventListener("play", onPlayMaybeSeek, true);
    };
  }, []);

  /** Snapshot selection before toolbar/floating UI steals focus (capture phase = still intact). */
  useEffect(() => {
    function onPointerDownCapture(e: PointerEvent): void {
      const rootEl = rootRef.current;
      if (!rootEl) return;
      const target = e.target as HTMLElement | null;
      if (
        !target?.closest(".note-toolbar") &&
        !target?.closest(".selection-floating-toolbar")
      ) {
        return;
      }
      const sel = window.getSelection();
      if (!sel?.rangeCount || sel.isCollapsed) return;
      if (!rootEl.contains(sel.anchorNode)) return;
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => document.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, []);

  function restoreSavedRangeIfValid(root: HTMLElement): boolean {
    const backup = savedRangeRef.current;
    const sel = window.getSelection();
    if (!backup || !sel || !root.contains(backup.commonAncestorContainer)) return false;
    try {
      sel.removeAllRanges();
      sel.addRange(backup.cloneRange());
      return true;
    } catch {
      savedRangeRef.current = null;
      return false;
    }
  }

  function refreshSavedRangeAfterCommand(root: HTMLElement): void {
    const sel = window.getSelection();
    if (!sel?.rangeCount || sel.isCollapsed) return;
    if (!root.contains(sel.anchorNode)) return;
    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  }

  /* ---- toolbar commands --------------------------------------------- */
  const run = useCallback(
    (kind: ToolbarKind, value?: string) => {
      const el = rootRef.current;
      if (!el) return;
      el.focus();
      const restored = restoreSavedRangeIfValid(el);
      if (!restored) {
        // No remembered selection — ensure caret is in the editor for typing shortcuts.
        ensureCaretInside(el);
      }

      switch (kind) {
        case "paragraph":
          execFormatBlock("P");
          break;
        case "h1":
          execFormatBlock("H1");
          break;
        case "h2":
          execFormatBlock("H2");
          break;
        case "h3":
          execFormatBlock("H3");
          break;
        case "h4":
          execFormatBlock("H4");
          break;
        case "h5":
          execFormatBlock("H5");
          break;
        case "h6":
          execFormatBlock("H6");
          break;
        case "bold":
          document.execCommand("bold");
          break;
        case "italic":
          document.execCommand("italic");
          break;
        case "ul":
          document.execCommand("insertUnorderedList");
          break;
        case "ol":
          document.execCommand("insertOrderedList");
          break;
        case "task":
          insertTaskList(el);
          break;
        case "quote":
          execFormatBlock("BLOCKQUOTE");
          break;
        case "hilite": {
          const raw = value ?? "#fff59d";
          if (raw === "transparent") {
            clearHighlightInSelection(el);
          } else {
            document.execCommand("styleWithCSS", false, "true");
            const ok = document.execCommand("hiliteColor", false, raw);
            if (!ok) {
              document.execCommand("backColor", false, raw);
            }
          }
          break;
        }
        case "foreColor": {
          document.execCommand("styleWithCSS", false, "true");
          document.execCommand("foreColor", false, value ?? "#1a1a1a");
          break;
        }
        case "fontSize":
          document.execCommand("fontSize", false, value ?? "3");
          break;
      }
      refreshSavedRangeAfterCommand(el);
      flush();
      updateSelectionBubble();
    },
    [flush, updateSelectionBubble],
  );

  function bubbleAction(kind: ToolbarKind, value?: string): void {
    run(kind, value);
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>): void {
    const cd = e.clipboardData;
    if (!cd?.items) return;
    for (const item of Array.from(cd.items)) {
      if (!item.type.startsWith("image/")) continue;
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        if (!dataUrl) return;
        const el = rootRef.current;
        if (!el) return;
        el.focus();
        ensureCaretInside(el);
        document.execCommand(
          "insertHTML",
          false,
          wrapImageHtml(
            `<img class="rich-img" src="${escapeAttr(dataUrl)}" alt="" draggable="false" />`,
          ),
        );
        flush();
      };
      reader.readAsDataURL(file);
      return;
    }
  }

  const scrollToHeading = useCallback((id: string) => {
    const el = rootRef.current?.querySelector(`#${cssEscape(id)}`);
    if (el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const applyLink = useCallback(
    (url: string | null) => {
      const el = rootRef.current;
      if (!el) return;
      el.focus();
      restoreSavedRangeIfValid(el);
      document.execCommand("styleWithCSS", false, "true");
      const trimmed = url?.trim();
      if (!trimmed) {
        document.execCommand("unlink");
      } else if (/^note:\/\//i.test(trimmed)) {
        const sel = window.getSelection();
        const label =
          sel && !sel.isCollapsed && sel.rangeCount > 0
            ? sel.toString().trim() || "Note"
            : "Note";
        const html = `<a href="${escapeAttr(trimmed)}" class="note-internal-link">${escapeHtml(label)}</a>`;
        document.execCommand("insertHTML", false, html);
      } else if (/^audio:\/\//i.test(trimmed)) {
        const id = trimmed.replace(/^audio:\/\//i, "").split(/[?#]/)[0]!.trim();
        const sel = window.getSelection();
        const label =
          sel && !sel.isCollapsed && sel.rangeCount > 0
            ? sel.toString().trim() || "Audio"
            : "Audio";
        const blobUrl = audioUrlByIdRef.current.get(id) ?? "";
        const html = renderRichAudioHtml(label, id, blobUrl, null);
        document.execCommand("insertHTML", false, html);
      } else {
        document.execCommand("createLink", false, trimmed);
      }
      refreshSavedRangeAfterCommand(el);
      flush();
      updateSelectionBubble();
    },
    [flush, updateSelectionBubble],
  );

  const getLinkHrefAtCaret = useCallback((): string | null => {
    const el = rootRef.current;
    if (!el) return null;
    const an = window.getSelection()?.anchorNode;
    if (!an) return null;
    const start = an.nodeType === Node.ELEMENT_NODE ? (an as Element) : an.parentElement;
    const a = start?.closest("a");
    if (!a || !el.contains(a)) return null;
    return a.getAttribute("href");
  }, []);

  const syncTitleHeading = useCallback(
    (nextTitle: string) => {
      const el = rootRef.current;
      if (!el) return;
      const t = (nextTitle || "Untitled").trim().replace(/\n/g, " ");
      const hcounts = new Map<string, number>();
      const id = headingId(t, hcounts);
      const first = el.firstElementChild as HTMLElement | null;
      if (first?.tagName === "H1") {
        first.textContent = t;
        first.id = id;
      } else {
        const h1 = document.createElement("h1");
        h1.textContent = t;
        h1.id = id;
        el.insertBefore(h1, el.firstChild);
      }
      flush();
    },
    [flush],
  );

  const restoreSlashCaret = useCallback((el: HTMLElement) => {
    el.focus();
    const backup = slashInsertRangeRef.current;
    slashInsertRangeRef.current = null;
    const sel = window.getSelection();
    if (backup && el.contains(backup.commonAncestorContainer) && sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(backup);
        return;
      } catch {
        /* fall through */
      }
    }
    ensureCaretInside(el);
  }, []);

  const abortSlashInsert = useCallback(() => {
    slashInsertRangeRef.current = null;
    slashTokenRangeRef.current = null;
    setSlashMenu(null);
  }, []);

  const insertNoteLink = useCallback(
    (noteId: string, linkLabel: string) => {
      const el = rootRef.current;
      if (!el) return;
      restoreSlashCaret(el);
      const label = (linkLabel || "Note").trim() || "Note";
      const href = `note://${noteId}`;
      const html = `<a href="${escapeAttr(href)}" class="note-internal-link">${escapeHtml(label)}</a>`;
      document.execCommand("insertHTML", false, html);
      savedRangeRef.current = null;
      flush();
    },
    [flush, restoreSlashCaret],
  );

  const insertAudioLink = useCallback(
    (attachmentId: string, label = "Audio", clipSec?: { start: number; end: number }) => {
      const el = rootRef.current;
      if (!el) return;
      restoreSlashCaret(el);
      const url = audioUrlByIdRef.current.get(attachmentId) ?? "";
      const clip =
        clipSec && clipSec.end > clipSec.start
          ? { start: clipSec.start, end: clipSec.end }
          : null;
      const html = renderRichAudioHtml(label, attachmentId, url, clip);
      document.execCommand("insertHTML", false, html);
      flush();
    },
    [flush, restoreSlashCaret],
  );

  useImperativeHandle(
    ref,
    () => ({
      run,
      scrollToHeading,
      applyLink,
      getLinkHrefAtCaret,
      syncTitleHeading,
      insertAudioLink,
      insertNoteLink,
      abortSlashInsert,
    }),
    [
      run,
      scrollToHeading,
      applyLink,
      getLinkHrefAtCaret,
      syncTitleHeading,
      insertAudioLink,
      insertNoteLink,
      abortSlashInsert,
    ],
  );

  /* ---- image resize (drag handle) ----------------------------------- */
  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const resizeRoot = rootEl;

    let drag: { img: HTMLImageElement; startX: number; startW: number } | null = null;

    function onPointerMove(e: PointerEvent): void {
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const host = resizeRoot.closest(".note-main") ?? resizeRoot;
      const maxW = host.getBoundingClientRect().width - 24;
      const next = Math.round(Math.max(72, Math.min(drag.startW + dx, maxW)));
      drag.img.style.width = `${next}px`;
      drag.img.style.height = "auto";
      drag.img.dataset.w = String(next);
    }

    function endDrag(): void {
      if (!drag) return;
      drag = null;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", endDrag);
      document.removeEventListener("pointercancel", endDrag);
      resizeRoot.focus();
      flush();
    }

    function onPointerDown(e: PointerEvent): void {
      const t = e.target as HTMLElement | null;
      if (!t?.classList.contains("rich-img-resize-handle")) return;
      const frame = t.closest(".rich-img-frame");
      const img = frame?.querySelector("img.rich-img") as HTMLImageElement | undefined;
      if (!img || !resizeRoot.contains(img)) return;
      e.preventDefault();
      e.stopPropagation();
      const w = img.getBoundingClientRect().width;
      drag = { img, startX: e.clientX, startW: w };
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", endDrag);
      document.addEventListener("pointercancel", endDrag);
      try {
        t.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    resizeRoot.addEventListener("pointerdown", onPointerDown);
    return () => {
      resizeRoot.removeEventListener("pointerdown", onPointerDown);
      endDrag();
    };
  }, [flush]);

  /* ---- keyboard auto-format ---------------------------------------- */
  function onKeyUp(e: ReactKeyboardEvent<HTMLDivElement>): void {
    // Trigger after the keystroke is applied (space) to convert a
    // markdown prefix into the matching block element.
    if (e.key !== " ") return;
    const el = rootRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || !sel.focusNode) return;
    const block = closestBlock(sel.focusNode, el);
    if (!block) return;
    const text = block.textContent ?? "";
    const m = /^(#{1,6} |[-*+] |\d+\. |> |\[ \] |\[x\] )/.exec(text);
    if (!m) return;
    const prefix = m[1]!.trim();
    // Strip the prefix and remember the residual text for placement.
    const rest = text.slice(m[1]!.length);
    if (prefix === "#") {
      replaceBlockTo(block, "H1", rest);
    } else if (prefix === "##") {
      replaceBlockTo(block, "H2", rest);
    } else if (prefix === "###") {
      replaceBlockTo(block, "H3", rest);
    } else if (prefix === "####") {
      replaceBlockTo(block, "H4", rest);
    } else if (prefix === "#####") {
      replaceBlockTo(block, "H5", rest);
    } else if (prefix === "######") {
      replaceBlockTo(block, "H6", rest);
    } else if (prefix === "-" || prefix === "*" || prefix === "+") {
      // Collapse line and run insertUnorderedList for browser-native list
      block.textContent = rest;
      document.execCommand("insertUnorderedList");
    } else if (/^\d+\.$/.test(prefix)) {
      block.textContent = rest;
      document.execCommand("insertOrderedList");
    } else if (prefix === ">") {
      block.textContent = rest;
      execFormatBlock("BLOCKQUOTE");
    } else if (prefix === "[ ]" || prefix === "[x]") {
      block.textContent = rest;
      insertTaskList(el, prefix === "[x]");
    }
    flush();
  }

  /* ---- checkbox toggling + internal note links --------------------- */
  function onClick(e: ReactMouseEvent<HTMLDivElement>): void {
    const target = e.target as HTMLElement;
    const noteA = target.closest("a.note-internal-link") as HTMLAnchorElement | null;
    if (noteA && rootRef.current?.contains(noteA)) {
      e.preventDefault();
      const href = noteA.getAttribute("href") ?? "";
      const id = href.replace(/^note:\/\//i, "").trim();
      if (id) onNavigateNote?.(id);
      return;
    }
    const check = target.closest(".md-check") as HTMLElement | null;
    if (!check) return;
    e.preventDefault();
    const li = check.closest("li.md-task") as HTMLElement | null;
    if (!li) return;
    const next = li.dataset.checked === "1" ? "0" : "1";
    li.dataset.checked = next;
    li.classList.toggle("done", next === "1");
    check.classList.toggle("checked", next === "1");
    check.innerHTML = next === "1" ? CHECK_SVG : "";
    flush();
  }

  /* ---- shape ------------------------------------------------------- */
  return (
    <div
      className="note-body-col note-editor-body-wrap"
      id="note-editor-body"
      tabIndex={-1}
    >
      {selectionBubble && (
        <div
          className="selection-floating-toolbar"
          style={{
            position: "fixed",
            top: selectionBubble.top,
            left: selectionBubble.left,
            zIndex: 420,
            transform:
              selectionBubble.placement === "above"
                ? "translate(-50%, -100%)"
                : "translate(-50%, 0)",
          }}
          role="toolbar"
          aria-label="Selection formatting"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="sft-row sft-row-main">
            <button
              type="button"
              className="sft-btn"
              title="Bold"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => bubbleAction("bold")}
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className="sft-btn"
              title="Italic"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => bubbleAction("italic")}
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className="sft-btn"
              title="Link"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onOpenLink()}
            >
              <LinkGlyph width={14} height={14} />
            </button>
          </div>
          <div className="sft-row sft-row-label">Highlight</div>
          <div className="sft-row sft-swatches">
            {HIGHLIGHT_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={`sft-mini-swatch${c === "transparent" ? " sft-mini-swatch-clear" : ""}`}
                style={c === "transparent" ? undefined : { background: c }}
                aria-label={c === "transparent" ? "Clear highlight" : `Highlight ${c}`}
                title={c === "transparent" ? "Clear highlight" : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => bubbleAction("hilite", c)}
              />
            ))}
          </div>
          <div className="sft-row sft-row-label">Text color</div>
          <div className="sft-row sft-swatches">
            {TEXT_COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className="sft-mini-swatch sft-mini-swatch-ring"
                style={{ background: c }}
                aria-label={`Text color ${c}`}
                title={`Text ${c}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => bubbleAction("foreColor", c)}
              />
            ))}
          </div>
          <div className="sft-row sft-row-custom">
            <label className="sft-color-picker" title="Custom highlight">
              <span className="sft-color-picker-label">H</span>
              <input
                type="color"
                defaultValue="#fff59d"
                aria-label="Custom highlight color"
                onMouseDown={(e) => e.preventDefault()}
                onInput={(e) => bubbleAction("hilite", (e.target as HTMLInputElement).value)}
              />
            </label>
            <label className="sft-color-picker" title="Custom text color">
              <span className="sft-color-picker-label">A</span>
              <input
                type="color"
                defaultValue="#1a1a1a"
                aria-label="Custom text color"
                onMouseDown={(e) => e.preventDefault()}
                onInput={(e) => bubbleAction("foreColor", (e.target as HTMLInputElement).value)}
              />
            </label>
          </div>
        </div>
      )}
      {slashMenu && slashMenu.options.length > 0 && (
        <div
          className="slash-command-popover"
          style={{
            position: "fixed",
            top: slashMenu.top,
            left: slashMenu.left,
            zIndex: 425,
            transform:
              slashMenu.placement === "above"
                ? "translate(-50%, -100%)"
                : "translate(-50%, 0)",
          }}
          role="listbox"
          aria-label="Link shortcuts"
          onMouseDown={(e) => e.preventDefault()}
        >
          {slashMenu.options.map((opt, i) => (
            <button
              key={opt.kind}
              type="button"
              role="option"
              aria-selected={i === slashMenu.active}
              className={`slash-command-opt${i === slashMenu.active ? " active" : ""}`}
              onMouseEnter={() =>
                setSlashMenu((prev) => (prev ? { ...prev, active: i } : null))
              }
              onClick={() => confirmSlashOption(opt.kind)}
            >
              {opt.label}
            </button>
          ))}
          <span className="slash-command-hint">↑↓ Enter · Esc</span>
        </div>
      )}
      <div
        ref={rootRef}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        role="textbox"
        aria-multiline="true"
        aria-label="Note body"
        aria-describedby="note-editor-a11y-desc"
        data-placeholder="Start writing your note…"
        onInput={() => {
          flush();
          requestAnimationFrame(() => {
            updateSlashMenu();
          });
        }}
        onPaste={onPaste}
        onKeyDown={(e) => {
          const el = rootRef.current;
          if (!el) return;
          const sm = slashMenuRef.current;
          if (sm && sm.options.length > 0) {
            if (e.key === "Escape") {
              e.preventDefault();
              slashTokenRangeRef.current = null;
              setSlashMenu(null);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSlashMenu((prev) =>
                prev
                  ? {
                      ...prev,
                      active: Math.min(prev.active + 1, prev.options.length - 1),
                    }
                  : null,
              );
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSlashMenu((prev) =>
                prev ? { ...prev, active: Math.max(0, prev.active - 1) } : null,
              );
              return;
            }
            if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
              e.preventDefault();
              const choice = sm.options[sm.active];
              if (choice) confirmSlashOption(choice.kind);
              return;
            }
          }
          if (handleListBackspace(el, e)) flush();
        }}
        onKeyUp={onKeyUp}
        onMouseUp={updateSelectionBubble}
        onClick={onClick}
      />
    </div>
  );
});

const CHECK_SVG =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-11"/></svg>';

/** Wrap document.execCommand("formatBlock") with browser quirk handling. */
function execFormatBlock(tag: string): void {
  // Some Chromiums require the angle-bracket form.
  document.execCommand("formatBlock", false, `<${tag}>`);
}

function ensureCaretInside(root: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  if (sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (root.contains(r.commonAncestorContainer)) return;
  }
  const r = document.createRange();
  r.selectNodeContents(root);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** Remove inline highlight/background from elements overlapping the range (execCommand clear is unreliable). */
function stripHighlightStylesIntersectingRange(range: Range, root: HTMLElement): void {
  const top =
    range.commonAncestorContainer.nodeType === 1
      ? (range.commonAncestorContainer as HTMLElement)
      : range.commonAncestorContainer.parentElement;
  if (!top || !root.contains(top)) return;

  function walk(node: Node): void {
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    if (!range.intersectsNode(el)) return;
    const tag = el.tagName;
    if (tag === "SPAN" || tag === "FONT" || tag === "MARK") {
      el.style.removeProperty("background-color");
      el.style.removeProperty("background");
      if (tag === "FONT") el.removeAttribute("bgcolor");
      const st = el.getAttribute("style");
      if (!st || !st.trim()) el.removeAttribute("style");
    }
    for (const c of Array.from(el.childNodes)) walk(c);
  }
  walk(top);
}

function clearHighlightInSelection(root: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel?.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("hiliteColor", false, "transparent");
  document.execCommand("backColor", false, "transparent");
  stripHighlightStylesIntersectingRange(range, root);
}

function closestBlock(node: Node, root: HTMLElement): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === 1) {
      const tag = (n as HTMLElement).tagName;
      if (
        tag === "DIV" ||
        tag === "P" ||
        tag === "H1" ||
        tag === "H2" ||
        tag === "H3" ||
        tag === "H4" ||
        tag === "H5" ||
        tag === "H6" ||
        tag === "LI" ||
        tag === "BLOCKQUOTE"
      ) {
        return n as HTMLElement;
      }
    }
    n = n.parentNode;
  }
  return null;
}

/** Map character offsets within `block`'s text nodes to a DOM range [startChar, endChar). */
function rangeFromOffsetsInBlock(
  block: HTMLElement,
  startChar: number,
  endChar: number,
): Range | null {
  if (endChar < startChar) return null;
  let count = 0;
  let foundStart = false;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const len = (n.textContent ?? "").length;
    const next = count + len;
    if (!foundStart && next > startChar) {
      startNode = n;
      startOffset = startChar - count;
      foundStart = true;
    }
    if (foundStart && next >= endChar) {
      endNode = n;
      endOffset = endChar - count;
      break;
    }
    count = next;
  }
  if (!foundStart || !startNode || !endNode) return null;
  const r = document.createRange();
  const maxEnd = (endNode.textContent ?? "").length;
  r.setStart(startNode, Math.max(0, startOffset));
  r.setEnd(endNode, Math.min(maxEnd, Math.max(0, endOffset)));
  return r;
}

/** Max length for `//` … token (`//notelink` / `//audiolink` are longest useful forms). */
const SLASH_TOKEN_MAX = 14;

function findSlashTokenAtEnd(full: string): string | null {
  const maxLen = Math.min(full.length, SLASH_TOKEN_MAX);
  for (let len = maxLen; len >= 2; len--) {
    const start = full.length - len;
    const slice = full.slice(start);
    if (!slice.startsWith("//")) continue;
    if (start > 0 && !/\s/.test(full[start - 1]!)) continue;
    return slice;
  }
  return null;
}

function slashKindsForToken(token: string): ("notelink" | "audiolink")[] {
  if (!token.startsWith("//")) return [];
  const rest = token.slice(2).toLowerCase();
  if (rest === "") return ["notelink", "audiolink"];
  const noteHit = "note".startsWith(rest) || "notelink".startsWith(rest);
  const audioHit = "audio".startsWith(rest) || "audiolink".startsWith(rest);
  if (noteHit && audioHit) return ["notelink", "audiolink"];
  if (noteHit) return ["notelink"];
  if (audioHit) return ["audiolink"];
  return ["notelink", "audiolink"];
}

const SLASH_OPTION_LABEL: Record<"notelink" | "audiolink", string> = {
  notelink: "Link to note",
  audiolink: "Link to audio",
};

function getDoubleSlashMenuState(root: HTMLElement): {
  deleteRange: Range;
  options: { kind: "notelink" | "audiolink"; label: string }[];
} | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return null;
  const caret = sel.getRangeAt(0);
  const block = closestBlock(caret.startContainer, root);
  if (!block || !root.contains(block)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(block);
  pre.setEnd(caret.startContainer, caret.startOffset);
  const full = pre.toString();
  const token = findSlashTokenAtEnd(full);
  if (!token) return null;
  const kinds = slashKindsForToken(token);
  if (kinds.length === 0) return null;
  const start = full.length - token.length;
  const dr = rangeFromOffsetsInBlock(block, start, full.length);
  if (!dr) return null;
  const options = kinds.map((kind) => ({
    kind,
    label: SLASH_OPTION_LABEL[kind],
  }));
  return { deleteRange: dr, options };
}

function caretRectOrFallback(range: Range): DOMRect {
  let rect = range.getBoundingClientRect();
  if (rect.height >= 2 && rect.width >= 1) return rect;
  const crs = range.getClientRects();
  if (crs.length > 0) return crs[crs.length - 1]!;
  return rect;
}

function computeSlashPopoverPosition(rect: DOMRect): {
  top: number;
  left: number;
  placement: "above" | "below";
} {
  const gap = 8;
  const estH = 140;
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const toolbarEl = document.querySelector(".note-toolbar");
  const toolbarBottom = toolbarEl?.getBoundingClientRect().bottom ?? margin;
  const half = 100;
  const centerX = rect.left + rect.width / 2;
  const left = Math.min(Math.max(centerX, margin + half), vw - margin - half);
  const spaceAbove = rect.top - toolbarBottom - gap;
  const spaceBelow = vh - rect.bottom - gap;
  let placement: "above" | "below";
  let top: number;
  if (spaceBelow >= estH && spaceBelow >= spaceAbove) {
    placement = "below";
    top = rect.bottom + gap;
  } else if (spaceAbove >= estH) {
    placement = "above";
    top = rect.top - gap;
  } else {
    placement = spaceBelow >= spaceAbove ? "below" : "above";
    top = placement === "above" ? rect.top - gap : rect.bottom + gap;
  }
  return { top, left, placement };
}

function replaceBlockTo(block: HTMLElement, tag: string, innerText: string): void {
  const fresh = document.createElement(tag);
  fresh.textContent = innerText;
  block.replaceWith(fresh);
  // Place caret at end of new block.
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(fresh);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

function insertTaskList(root: HTMLElement, checked = false): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const block = closestBlock(sel.focusNode!, root);
  const text = block?.textContent ?? "";
  const ul = document.createElement("ul");
  ul.className = "md-tasklist";
  const li = document.createElement("li");
  li.className = `md-task${checked ? " done" : ""}`;
  li.dataset.checked = checked ? "1" : "0";
  const cb = document.createElement("span");
  cb.className = `md-check${checked ? " checked" : ""}`;
  cb.contentEditable = "false";
  cb.innerHTML = checked ? CHECK_SVG : "";
  const txt = document.createElement("span");
  txt.className = "md-task-text";
  txt.textContent = text || "Task";
  li.appendChild(cb);
  li.appendChild(txt);
  ul.appendChild(li);
  if (block) {
    block.replaceWith(ul);
  } else {
    root.appendChild(ul);
  }
  // Place caret at end of task text.
  const r = document.createRange();
  r.selectNodeContents(txt);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return s.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

/* ====================================================================
 * Markdown ⇄ HTML
 * ================================================================== */

type MarkdownInlineContext = { audioById: Map<string, string> };

function mapFromMaybe(m?: ReadonlyMap<string, string>): Map<string, string> {
  if (!m || m.size === 0) return new Map();
  return new Map(m);
}

function parseAudioClipTitle(title: string | undefined): { start: number; end: number } | null {
  if (!title?.trim()) return null;
  const m = /clip:\s*(\d+)\s*-\s*(\d+)/i.exec(title.trim());
  if (!m) return null;
  const start = parseInt(m[1]!, 10);
  const end = parseInt(m[2]!, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

/** Inline HTML for `[label](audio://id "clip:x-y")` — shared by markdown parse and insert tool. */
function renderRichAudioHtml(
  label: string,
  attId: string,
  url: string,
  clip: { start: number; end: number } | null,
): string {
  const escLabel = escapeHtml(label);
  const clipAttr =
    clip != null ? ` data-clip="${clip.start}-${clip.end}"` : "";
  const ds =
    clip != null
      ? ` data-clip-start="${clip.start}" data-clip-end="${clip.end}"`
      : "";
  if (!url) {
    return `<span class="rich-audio-inline rich-audio-missing" contenteditable="false" data-att-id="${escapeAttr(attId)}"${clipAttr}><span class="rich-audio-label">${escLabel}</span><span class="rich-audio-broken">Audio unavailable</span></span>`;
  }
  let src = url;
  if (clip != null) src = `${url}#t=${clip.start},${clip.end}`;
  const safeSrc = escapeAttr(src);
  return `<span class="rich-audio-inline" contenteditable="false" data-att-id="${escapeAttr(attId)}"${clipAttr}><span class="rich-audio-label">${escLabel}</span><audio class="rich-audio-el" controls preload="metadata" src="${safeSrc}"${ds}></audio></span>`;
}

function markdownToHtml(src: string, ctx?: MarkdownInlineContext): string {
  const mdCtx: MarkdownInlineContext = ctx ?? { audioById: new Map() };
  if (!src.trim()) return `<p><br></p>`;
  const lines = src.split("\n");
  const out: string[] = [];
  const headCtx = { hcounts: new Map<string, number>() };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (/^\s*$/.test(line)) {
      i += 1;
      continue;
    }
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      const text = h[2]!.trim();
      const id = headingId(text, headCtx.hcounts);
      out.push(`<h${level} id="${id}">${inlineHtml(text, mdCtx)}</h${level}>`);
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        buf.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      out.push(
        `<blockquote>${buf
          .filter((l) => l.trim())
          .map((l) => inlineHtml(l, mdCtx))
          .join("<br>")}</blockquote>`,
      );
      continue;
    }
    if (/^\s*[-*+]\s+\[[ xX]\]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+\[[ xX]\]\s+/.test(lines[i] ?? "")) {
        buf.push(lines[i]!);
        i += 1;
      }
      out.push(
        `<ul class="md-tasklist">${buf
          .map((l) => {
            const m = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(l)!;
            const checked = m[1] !== " ";
            const text = inlineHtml(m[2] ?? "", mdCtx);
            return `<li class="md-task${checked ? " done" : ""}" data-checked="${
              checked ? 1 : 0
            }"><span class="md-check${
              checked ? " checked" : ""
            }" contenteditable="false">${
              checked ? CHECK_SVG : ""
            }</span><span class="md-task-text">${text}</span></li>`;
          })
          .join("")}</ul>`,
      );
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf: string[] = [];
      while (
        i < lines.length &&
        /^\s*[-*+]\s+/.test(lines[i] ?? "") &&
        !/^\s*[-*+]\s+\[[ xX]\]\s+/.test(lines[i] ?? "")
      ) {
        buf.push(lines[i]!);
        i += 1;
      }
      out.push(
        `<ul>${buf
          .map((l) => `<li>${inlineHtml(l.replace(/^\s*[-*+]\s+/, ""), mdCtx)}</li>`)
          .join("")}</ul>`,
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? "")) {
        buf.push(lines[i]!);
        i += 1;
      }
      out.push(
        `<ol>${buf
          .map((l) => `<li>${inlineHtml(l.replace(/^\s*\d+\.\s+/, ""), mdCtx)}</li>`)
          .join("")}</ol>`,
      );
      continue;
    }
    // paragraph
    const buf: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !/^(#{1,6})\s+/.test(lines[i] ?? "") &&
      !/^>\s?/.test(lines[i] ?? "") &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i] ?? "")
    ) {
      buf.push(lines[i] ?? "");
      i += 1;
    }
    out.push(`<p>${inlineHtml(buf.join("<br>"), mdCtx)}</p>`);
  }
  return out.join("");
}

function headingId(text: string, hcounts: Map<string, number>): string {
  const base =
    "h-" +
    (text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "h");
  const n = (hcounts.get(base) ?? 0) + 1;
  hcounts.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

function inlineHtml(src: string, ctx?: MarkdownInlineContext): string {
  const audioById = ctx?.audioById ?? new Map<string, string>();
  let s = escapeHtml(src);
  // images with optional title "w:NNN" for width (before link-like patterns)
  s = s.replace(
    /!\[([^\]]*)\]\(\s*([^)\s]+)\s*(?:\s+"([^"]*)")?\s*\)/g,
    (_m, alt: string, url: string, title?: string) => {
      const safeUrl = escapeAttr(url);
      const safeAlt = escapeAttr(alt);
      const wm = title && /^w:(\d+)$/.exec(title);
      const extra = wm
        ? ` style="width:${wm[1]}px;max-width:100%;height:auto;" data-w="${escapeAttr(wm[1]!)}"`
        : "";
      return wrapImageHtml(
        `<img class="rich-img" src="${safeUrl}" alt="${safeAlt}" draggable="false"${extra} />`,
      );
    },
  );
  // Playable attachment: [label](audio://attachment-id "clip:0-20")
  s = s.replace(
    /\[([^\]]*)\]\(\s*audio:\/\/([^)\s]+)\s*(?:\s+"([^"]*)")?\s*\)/g,
    (_m, text: string, idRaw: string, title?: string) => {
      const id = idRaw.trim();
      const url = audioById.get(id) ?? "";
      const clip = parseAudioClipTitle(title);
      return renderRichAudioHtml(text || "Audio", id, url, clip);
    },
  );
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic (single * not adjacent to *)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  // inline code
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // links (internal note links stay in-app; external open in a new tab)
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, text: string, url: string) => {
      const u = url.trim();
      if (u.startsWith("note://")) {
        return `<a href="${escapeAttr(u)}" class="note-internal-link">${text}</a>`;
      }
      return `<a href="${escapeAttr(u)}" target="_blank" rel="noreferrer">${text}</a>`;
    },
  );
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

/** Walk an editor root and produce markdown source. */
function htmlToMarkdown(root: HTMLElement): string {
  const out: string[] = [];
  for (const child of Array.from(root.childNodes)) {
    serializeBlock(child, out);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function serializeBlock(node: Node, out: string[]): void {
  if (node.nodeType === 3) {
    const t = (node.textContent ?? "").trim();
    if (t) out.push(t);
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as HTMLElement;
  switch (el.tagName) {
    case "H1":
      out.push(`# ${serializeInline(el)}`);
      break;
    case "H2":
      out.push(`## ${serializeInline(el)}`);
      break;
    case "H3":
      out.push(`### ${serializeInline(el)}`);
      break;
    case "H4":
      out.push(`#### ${serializeInline(el)}`);
      break;
    case "H5":
      out.push(`##### ${serializeInline(el)}`);
      break;
    case "H6":
      out.push(`###### ${serializeInline(el)}`);
      break;
    case "BLOCKQUOTE": {
      const inner = serializeInline(el).split("\n");
      for (const line of inner) out.push(`> ${line}`);
      break;
    }
    case "UL":
      if (el.classList.contains("md-tasklist")) {
        for (const li of Array.from(el.children)) {
          if (li.tagName !== "LI") continue;
          const checked = (li as HTMLElement).dataset.checked === "1";
          const text = (li.querySelector(".md-task-text") as HTMLElement | null)?.innerHTML ?? "";
          out.push(`- [${checked ? "x" : " "}] ${stripTags(inlineFromHtml(text))}`);
        }
      } else {
        for (const li of Array.from(el.children)) {
          if (li.tagName !== "LI") continue;
          out.push(`- ${serializeInline(li as HTMLElement)}`);
        }
      }
      break;
    case "OL":
      Array.from(el.children).forEach((li, i) => {
        if (li.tagName !== "LI") return;
        out.push(`${i + 1}. ${serializeInline(li as HTMLElement)}`);
      });
      break;
    case "P":
    case "DIV":
      out.push(serializeInline(el));
      break;
    case "BR":
      out.push("");
      break;
    default:
      out.push(serializeInline(el));
  }
}

function serializeImageMarkdown(im: HTMLImageElement): string {
  const src = im.getAttribute("src") ?? "";
  const alt = (im.getAttribute("alt") ?? "").replace(/[[\]]/g, "");
  let w = im.dataset.w;
  if (!w && im.style.width) {
    const m = /^(\d+)px$/.exec(im.style.width);
    if (m) w = m[1];
  }
  const title = w ? ` "w:${w}"` : "";
  return `![${alt}](${src}${title})`;
}

function serializeInline(el: HTMLElement): string {
  let s = "";
  for (const c of Array.from(el.childNodes)) {
    if (c.nodeType === 3) {
      s += c.textContent ?? "";
    } else if (c.nodeType === 1) {
      const e = c as HTMLElement;
      switch (e.tagName) {
        case "STRONG":
        case "B":
          s += `**${serializeInline(e)}**`;
          break;
        case "EM":
        case "I":
          s += `*${serializeInline(e)}*`;
          break;
        case "CODE":
          s += `\`${e.textContent ?? ""}\``;
          break;
        case "A": {
          const href = e.getAttribute("href") ?? "";
          s += `[${serializeInline(e)}](${href})`;
          break;
        }
        case "IMG":
          s += serializeImageMarkdown(e as HTMLImageElement);
          break;
        case "SPAN":
          if (e.classList.contains("rich-audio-inline")) {
            const id = e.dataset.attId ?? "";
            const clip = e.dataset.clip;
            const label = (e.querySelector(".rich-audio-label")?.textContent ?? "Audio").replace(
              /[[\]]/g,
              "",
            );
            let title = "";
            if (clip && /^(\d+)-(\d+)$/.test(clip)) {
              const [a, b] = clip.split("-");
              title = ` "clip:${a}-${b}"`;
            }
            s += `[${label}](audio://${id}${title})`;
            break;
          }
          if (e.classList.contains("rich-img-frame")) {
            const im = e.querySelector("img.rich-img") as HTMLImageElement | null;
            if (im) {
              s += serializeImageMarkdown(im);
              break;
            }
          }
          s += serializeInline(e);
          break;
        case "BUTTON":
          if (e.classList.contains("rich-img-resize-handle")) break;
          s += serializeInline(e);
          break;
        case "BR":
          s += "\n";
          break;
        default:
          s += serializeInline(e);
      }
    }
  }
  return s;
}

/** Strip raw HTML to plain text by parsing through a temp element. */
function stripTags(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent ?? "";
}
function inlineFromHtml(html: string): string {
  // Reverse the inline encoding: <strong>x</strong> → **x**, <em>x</em> → *x*,
  // <a href>text</a> → [text](href), <code>x</code> → `x`.
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return serializeInline(tmp);
}

async function copyOutline(items: OutlineItem[]): Promise<void> {
  const text = items
    .map((it) => `${"  ".repeat(Math.max(0, it.level - 1))}- ${it.text}`)
    .join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

function parseTags(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  } catch {
    /* ignore */
  }
  return [];
}

function extractOutline(md: string): OutlineItem[] {
  const out: OutlineItem[] = [];
  const seen = new Map<string, number>();
  for (const raw of md.split("\n")) {
    const m = /^(#{1,6})\s+(.+)$/.exec(raw.trim());
    if (!m) continue;
    const level = m[1]!.length;
    const text = m[2]!.trim();
    out.push({ id: headingId(text, seen), text, level });
  }
  return out;
}

/* ====================================================================
 * Right panel cards
 * ================================================================== */

const AiMascotBanner: FC = () => (
  <div className="ai-mascot-banner" aria-hidden>
    <img
      src={BRAND_AI_URL}
      alt=""
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  </div>
);

interface AssistantProps {
  busy: AiAction | null;
  onAction: (a: AiAction) => void;
  onAsk: () => void;
  askOpen: boolean;
  askResult: string | null;
  onAskSubmit: (q: string) => void;
  menu: MoreMenuItem[];
}

const AiAssistantCard: FC<AssistantProps> = ({
  busy,
  onAction,
  onAsk,
  askOpen,
  askResult,
  onAskSubmit,
  menu,
}) => {
  const [question, setQuestion] = useState("");
  return (
    <div className="card ai-assistant">
      <header className="ai-head">
        <h3>AI Assistant</h3>
        <MoreMenu items={menu} label="Assistant options" />
      </header>
      <div className="ai-actions-grid">
        <AiButton
          color="rose"
          icon={<DocLineGlyph />}
          label={busy === "summarize" ? "Summarizing…" : "Summarize"}
          disabled={busy !== null}
          onClick={() => onAction("summarize")}
        />
        <AiButton
          color="green"
          icon={<CardsGlyph />}
          label={busy === "flashcards" ? "Generating…" : "Make Flashcards"}
          disabled={busy !== null}
          onClick={() => onAction("flashcards")}
        />
        <AiButton
          color="amber"
          icon={<QuestionGlyph />}
          label={busy === "quiz" ? "Generating…" : "Create Quiz"}
          disabled={busy !== null}
          onClick={() => onAction("quiz")}
        />
        <AiButton
          color="cream"
          icon={<BulbGlyph />}
          label={busy === "simple" ? "Thinking…" : "Simplify Notes"}
          disabled={busy !== null}
          onClick={() => onAction("simple")}
        />
        <AiButton
          color="orange"
          icon={<PlanGlyph />}
          label={busy === "studyPlan" ? "Adding…" : "Add to Study Plan"}
          disabled={busy !== null}
          onClick={() => onAction("studyPlan")}
        />
        <AiButton
          color="blue"
          icon={<ChatGlyph />}
          label="Ask a Question"
          disabled={busy !== null}
          onClick={onAsk}
        />
      </div>
      {askOpen && (
        <div className="ai-ask">
          <input
            className="field"
            placeholder="Ask anything about this note…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && question.trim()) {
                e.preventDefault();
                onAskSubmit(question);
              }
            }}
            disabled={busy === "ask"}
          />
          {askResult && <p className="ai-ask-result">{askResult}</p>}
        </div>
      )}
    </div>
  );
};

const AiButton: FC<{
  color: "rose" | "green" | "amber" | "cream" | "orange" | "blue";
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}> = ({ color, icon, label, disabled, onClick }) => (
  <button
    type="button"
    className={`ai-btn ai-btn-${color}`}
    onClick={onClick}
    disabled={disabled}
  >
    <span className="ai-btn-icon">{icon}</span>
    <span className="ai-btn-label">{label}</span>
  </button>
);

const SummaryCard: FC<{ summary: string }> = ({ summary }) => (
  <div className="card">
    <div className="card-header">
      <h3>Summary</h3>
    </div>
    <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13, lineHeight: 1.55 }}>
      {summary}
    </p>
  </div>
);

interface InsightsProps {
  readingMinutes: number;
  flashcards: number;
  quizCount: number;
  keyTerms: number;
  onOpenFlashcards: () => void;
  onOpenQuiz: () => void;
}

const NoteInsightsCard: FC<InsightsProps> = ({
  readingMinutes,
  flashcards,
  quizCount,
  keyTerms,
  onOpenFlashcards,
  onOpenQuiz,
}) => (
  <div className="card insights-card">
    <div className="card-header">
      <h3>Note Insights</h3>
    </div>
    <div className="insights-grid">
      <InsightTile
        icon={<ClockGlyph />}
        label="Reading time"
        suffix={`${readingMinutes} min`}
      />
      <InsightTile
        icon={<CardsGlyph />}
        label="Flashcards"
        suffix={`${flashcards}`}
        onClick={flashcards > 0 ? onOpenFlashcards : undefined}
      />
      <InsightTile
        icon={<QuestionGlyph />}
        label="Quiz"
        suffix={quizCount > 0 ? `${quizCount} ready` : "Not created"}
        onClick={quizCount > 0 ? onOpenQuiz : undefined}
      />
      <InsightTile icon={<KeyGlyph />} label="Key terms" suffix={`${keyTerms}`} />
    </div>
  </div>
);

const InsightTile: FC<{
  icon: ReactNode;
  label: string;
  suffix: string;
  onClick?: () => void;
}> = ({ icon, label, suffix, onClick }) => (
  <button
    type="button"
    className="insight-tile"
    onClick={onClick}
    disabled={!onClick}
  >
    <span className="insight-icon">{icon}</span>
    <span className="insight-text">
      <span className="insight-label">{label}</span>
      <span className="insight-suffix">{suffix}</span>
    </span>
  </button>
);

const LinkedNotesCard: FC<{
  items: NoteRow[];
  onOpen: (id: string) => void;
}> = ({ items, onOpen }) => (
  <div className="card linked-card">
    <div className="card-header">
      <h3>Linked Notes</h3>
    </div>
    <p className="linked-card-hint">
      In the note body, type <code className="linked-syntax">//</code> and pick <strong>Link to note</strong> to search
      and insert, or write <code className="linked-syntax">[title](note://note-id)</code> by hand. Use{" "}
      <code className="linked-syntax">//a</code> to narrow to audio, <code className="linked-syntax">//n</code> to
      notes. Only links you add this way are listed here.
    </p>
    {items.length === 0 ? (
      <p className="right-empty">
        No links yet. Type <code className="linked-syntax">//</code> in the note or add a{" "}
        <code className="linked-syntax">note://</code> markdown link in the editor.
      </p>
    ) : (
      <ul className="linked-list">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className="linked-row"
              onClick={() => onOpen(n.id)}
            >
              <NoteGlyph icon={n.icon} size={14} />
              <span className="linked-title">{n.title || "Untitled"}</span>
              <ArrowRightIcon size={12} />
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const SyncFooter: FC<{ status: SyncStatus; updatedAt: string }> = ({
  status,
  updatedAt,
}) => {
  const s = describeSync(status);
  return (
    <div className={`sync-footer sync-${s.tone}`}>
      <span className="sync-icon">
        {s.tone === "ok" ? <CloudCheckIcon size={14} /> : <CloudOffIcon size={14} />}
      </span>
      <div className="sync-text">
        <span className="sync-title">
          {s.tone === "ok"
            ? "All changes synced"
            : s.tone === "warn"
            ? "Saving changes…"
            : "Not synced"}
        </span>
        <span className="sync-sub">
          {s.tone === "ok" ? `Last synced ${describeAgo(updatedAt)}` : s.detail}
        </span>
      </div>
      <span className="sync-dot" />
    </div>
  );
};

function describeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

/* ====================================================================
 * Insights / linking helpers
 * ================================================================== */

/**
 * First line of the note is always `# {title}` so the body matches the title field.
 */
function ensureLeadingTitleH1(markdown: string, noteTitle: string): string {
  const title = (noteTitle || "Untitled").trim().replace(/\n/g, " ");
  const line = `# ${title}`;
  const text = markdown.trimEnd();
  if (!text) return `${line}\n\n`;
  const lines = text.split("\n");
  const top = lines[0]!.trim();
  if (/^#\s[^#]/.test(top)) {
    lines[0] = line;
    return lines.join("\n");
  }
  return `${line}\n\n${text}`;
}

function extractNoteIdsFromNoteLinks(md: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const re = /\]\(note:\/\/([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const id = m[1]!.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function computeInsights(md: string): {
  readingMinutes: number;
  keyTerms: number;
} {
  const text = md.replace(/[#*`>_-]/g, " ");
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  const readingMinutes = Math.max(1, Math.round(words / 200));
  const matches = md.match(/\*\*([^*]+)\*\*/g) ?? [];
  const seen = new Set<string>();
  for (const m of matches) {
    const key = m.replace(/\*/g, "").trim().toLowerCase();
    if (key) seen.add(key);
  }
  return { readingMinutes, keyTerms: seen.size };
}

function pickLinkedNotes(current: NoteRow | null, all: NoteRow[], markdownBody: string): NoteRow[] {
  if (!current) return [];
  const byId = new Map(all.map((n) => [n.id, n]));
  const out: NoteRow[] = [];
  for (const id of extractNoteIdsFromNoteLinks(markdownBody)) {
    if (id === current.id) continue;
    const row = byId.get(id);
    if (row) out.push(row);
  }
  return out;
}

/* ====================================================================
 * Glyphs (assistant + insight icons)
 * ================================================================== */

const DocLineGlyph: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
    <path d="M6 4h9l3 3v13H6Z" />
    <path d="M9 10h6M9 13h6M9 16h4" />
  </svg>
);
const CardsGlyph: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
    <rect x="3" y="6" width="13" height="11" rx="2" />
    <path d="M8 5h11a1 1 0 0 1 1 1v11" />
  </svg>
);
const QuestionGlyph: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7v.5" />
    <path d="M12 17h.01" />
  </svg>
);
const BulbGlyph: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
    <path d="M9 17h6M10 20h4" />
    <path d="M8 12a4 4 0 1 1 8 0c0 2-2 3-2 5h-4c0-2-2-3-2-5Z" />
  </svg>
);
const PlanGlyph: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M4 9h16M9 4v3M15 4v3" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);
const ChatGlyph: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
    <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
  </svg>
);
const ClockGlyph: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const KeyGlyph: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
    <circle cx="9" cy="14" r="4" />
    <path d="m13 12 7-7M16 8l3 3" />
  </svg>
);
