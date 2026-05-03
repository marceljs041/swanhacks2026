import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  audioAttachmentsMissingTranscript,
  listClasses,
  listNotes,
  noteHasFlashcards,
  noteHasQuiz,
  notesByTagLike,
  notesMissingStudyTools,
  notesNeedingSummary,
  notesNotOpenedSince,
  notesUpdatedSince,
  notesWithAttachmentType,
  recordXp,
  softDeleteNote,
  unsyncedNotesCount,
  upsertAttachment,
  upsertNote,
} from "../db/repositories.js";
import { useApp } from "../store.js";
import { XP_RULES } from "@studynest/shared";
import type { ClassRow, NoteRow } from "@studynest/shared";
import { BRAND_ATTENTION_URL, BRAND_HERO_URL } from "../lib/brand.js";
import { NoteGlyph } from "../lib/noteIcons.js";
import { Card } from "./ui/Card.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import { MoreMenu } from "./ui/MoreMenu.js";
import type { MoreMenuItem } from "./ui/MoreMenu.js";
import { AudioRecorderModal } from "./AudioRecorderModal.js";
import { HeroSearch } from "./HeroSearch.js";
import {
  ArrowRightIcon,
  BoltIcon,
  CalendarIcon,
  CameraIcon,
  ClockIcon,
  CloudOffIcon,
  EyeIcon,
  FlashcardIcon,
  MicIcon,
  NoteIcon,
  PencilIcon,
  QuizIcon,
  SparklesIcon,
  TrashIcon,
  UploadIcon,
  WarningIcon,
} from "./icons.js";

/* ================================================================== */
/* NotesList — the Notes home screen                                   */
/* ================================================================== */

type CollectionFilterKey =
  | null
  | "thisWeek"
  | "examPrep"
  | "audio"
  | "scans"
  | "needsReview"
  | "needsTools"
  | "audioPending";

interface CollectionCounts {
  thisWeek: number;
  examPrep: number;
  audio: number;
  scans: number;
  needsReview: number;
}

interface AttentionCounts {
  needsTools: number;
  audioPending: number;
  unsynced: number;
}

interface AiQueueItem {
  note: NoteRow;
  action: "summarize" | "flashcards" | "quiz";
}

export const NotesList: FC = () => {
  const notes = useApp((s) => s.notes);
  const setNotes = useApp((s) => s.setNotes);
  const classes = useApp((s) => s.classes);
  const setClasses = useApp((s) => s.setClasses);
  const selectedClassId = useApp((s) => s.selectedClassId);
  const setSelectedClassFilter = useApp((s) => s.setSelectedClass);

  const [collectionFilter, setCollectionFilter] = useState<CollectionFilterKey>(null);
  const [counts, setCounts] = useState<CollectionCounts>({
    thisWeek: 0,
    examPrep: 0,
    audio: 0,
    scans: 0,
    needsReview: 0,
  });
  const [attention, setAttention] = useState<AttentionCounts>({
    needsTools: 0,
    audioPending: 0,
    unsynced: 0,
  });
  const [audioNoteIds, setAudioNoteIds] = useState<Set<string>>(new Set());
  const [scanNoteIds, setScanNoteIds] = useState<Set<string>>(new Set());
  const [pendingTranscriptIds, setPendingTranscriptIds] = useState<Set<string>>(new Set());
  const [needsToolsIds, setNeedsToolsIds] = useState<Set<string>>(new Set());
  const [aiQueue, setAiQueue] = useState<AiQueueItem[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<NoteRow | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoIso = weekAgo.toISOString();

    const [
      ns,
      cls,
      cThisWeek,
      cExam,
      cAudio,
      cScans,
      cNeedsReview,
      audioPending,
      unsynced,
      missingTools,
      needSummary,
      audioNotes,
      scanNotes,
      pendingTranscript,
    ] = await Promise.all([
      listNotes(null),
      listClasses(),
      notesUpdatedSince(weekAgoIso),
      notesByTagLike("exam"),
      notesWithAttachmentType("audio"),
      notesWithAttachmentType("image"),
      notesNotOpenedSince(weekAgoIso),
      audioAttachmentsMissingTranscript(),
      unsyncedNotesCount(),
      notesMissingStudyTools(20),
      notesNeedingSummary(20),
      noteIdsWithAttachmentType("audio"),
      noteIdsWithAttachmentType("image"),
      noteIdsWithPendingAudioTranscript(),
    ]);

    setNotes(ns);
    setClasses(cls);
    setCounts({
      thisWeek: cThisWeek,
      examPrep: cExam,
      audio: cAudio,
      scans: cScans,
      needsReview: cNeedsReview,
    });
    setAttention({
      needsTools: missingTools.length,
      audioPending,
      unsynced,
    });
    setAudioNoteIds(audioNotes);
    setScanNoteIds(scanNotes);
    setPendingTranscriptIds(pendingTranscript);
    setNeedsToolsIds(new Set(missingTools.map((n) => n.id)));
    setAiQueue(await buildAiQueue(needSummary, missingTools));
  }, [setNotes, setClasses]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const classMap = useMemo(() => {
    const m = new Map<string, ClassRow>();
    for (const c of classes) m.set(c.id, c);
    return m;
  }, [classes]);

  const filteredNotes = useMemo(() => {
    // Class focus is set when the user clicks "Open Class" from the
    // Classes screen — narrow the list before the smart-collection
    // filter runs so e.g. "Exam Prep" intersects with the class focus.
    const classScoped = selectedClassId
      ? notes.filter((n) => n.class_id === selectedClassId)
      : notes;
    if (!collectionFilter) return classScoped;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    switch (collectionFilter) {
      case "thisWeek":
        return classScoped.filter((n) => new Date(n.updated_at) >= weekAgo);
      case "examPrep":
        return classScoped.filter((n) => /exam/i.test(n.tags_json));
      case "audio":
        return classScoped.filter((n) => audioNoteIds.has(n.id));
      case "scans":
        return classScoped.filter((n) => scanNoteIds.has(n.id));
      case "needsReview":
        return classScoped.filter((n) => new Date(n.updated_at) < weekAgo);
      case "needsTools":
        return classScoped.filter((n) => needsToolsIds.has(n.id));
      case "audioPending":
        return classScoped.filter((n) => pendingTranscriptIds.has(n.id));
      default:
        return classScoped;
    }
  }, [
    notes,
    selectedClassId,
    collectionFilter,
    audioNoteIds,
    scanNoteIds,
    needsToolsIds,
    pendingTranscriptIds,
  ]);

  const activeClass = useMemo(
    () => (selectedClassId ? classMap.get(selectedClassId) ?? null : null),
    [selectedClassId, classMap],
  );

  async function handleDelete(): Promise<void> {
    if (!confirmDelete) return;
    await softDeleteNote(confirmDelete.id);
    setConfirmDelete(null);
    await reload();
  }

  const isEmpty = notes.length === 0;

  return (
    <main className="main">
      <div className="main-inner">
        <NotesHero />

        <NotesQuickActions onCreated={() => void reload()} />

        {activeClass && (
          <div className="notes-class-scope" role="status">
            <span className="notes-class-scope-label">
              Filtered to <strong>{activeClass.name}</strong>
            </span>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setSelectedClassFilter(null)}
            >
              Clear filter
            </button>
          </div>
        )}

        {isEmpty ? (
          <NotesEmptyState onCreated={() => void reload()} />
        ) : (
          <>
            <div className="notes-row notes-row-1-2">
              <ContinueWritingCard />
              <SmartCollectionsCard
                counts={counts}
                active={collectionFilter}
                onPick={(key) => {
                  setCollectionFilter((curr) => (curr === key ? null : key));
                }}
              />
            </div>

            <div className="notes-row notes-row-2-1">
              <RecentNotesCard
                notes={filteredNotes}
                classMap={classMap}
                filterLabel={filterLabel(collectionFilter)}
                onClearFilter={() => setCollectionFilter(null)}
                onDelete={(n) => setConfirmDelete(n)}
              />
              <AiReadyQueueCard queue={aiQueue} />
            </div>

            <NeedsAttentionStrip
              counts={attention}
              onPick={(key) => {
                setCollectionFilter((curr) => (curr === key ? null : key));
              }}
            />
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this note?"
          body={
            <>
              <strong>{confirmDelete.title || "Untitled"}</strong> will be moved
              to trash and removed from your study tools. You can't undo this
              from the app.
            </>
          }
          confirmLabel="Delete note"
          cancelLabel="Keep note"
          danger
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </main>
  );
};

/* ---- helpers ----------------------------------------------------- */

async function noteIdsWithAttachmentType(type: "audio" | "image"): Promise<Set<string>> {
  const { getDb } = await import("../db/client.js");
  const db = await getDb();
  const rows = db
    .prepare(
      `select distinct note_id as id from attachments
       where deleted_at is null and type = ?`,
    )
    .all(type) as Array<{ id: string }>;
  return new Set(rows.map((r) => r.id));
}

async function noteIdsWithPendingAudioTranscript(): Promise<Set<string>> {
  const { getDb } = await import("../db/client.js");
  const db = await getDb();
  const rows = db
    .prepare(
      `select distinct note_id as id from attachments
       where deleted_at is null and type = 'audio'
         and (transcript is null or transcript = '')`,
    )
    .all() as Array<{ id: string }>;
  return new Set(rows.map((r) => r.id));
}

async function buildAiQueue(
  needSummary: NoteRow[],
  missingTools: NoteRow[],
): Promise<AiQueueItem[]> {
  const out: AiQueueItem[] = [];
  const seen = new Set<string>();

  // Summarisation is the cheapest action, so it heads the queue.
  for (const n of needSummary) {
    if (out.length >= 3) break;
    if (seen.has(n.id)) continue;
    out.push({ note: n, action: "summarize" });
    seen.add(n.id);
  }

  // Then suggest the next-best study tool. We probe per-note instead of
  // joining so the queue stays accurate as tools get generated.
  for (const n of missingTools) {
    if (out.length >= 3) break;
    if (seen.has(n.id)) continue;
    const [hasFc, hasQz] = await Promise.all([
      noteHasFlashcards(n.id),
      noteHasQuiz(n.id),
    ]);
    if (!hasFc) out.push({ note: n, action: "flashcards" });
    else if (!hasQz) out.push({ note: n, action: "quiz" });
    else continue;
    seen.add(n.id);
  }

  return out;
}

function filterLabel(filter: CollectionFilterKey): string | null {
  switch (filter) {
    case "thisWeek":     return "This Week";
    case "examPrep":     return "Exam Prep";
    case "audio":        return "Audio Notes";
    case "scans":        return "Board Scans";
    case "needsReview":  return "Needs Review";
    case "needsTools":   return "Needs study tools";
    case "audioPending": return "Audio pending transcription";
    default:             return null;
  }
}

/* ---- hero -------------------------------------------------------- */

/**
 * Mirrors the Home dashboard hero (`.hero` / `.hero-main` / `.hero-illustration`)
 * so the two screens feel like the same product. The shared `<HeroSearch />`
 * lives at the top of the left column and the page title sits below it,
 * matching the greeting block used on Home.
 */
const NotesHero: FC = () => (
  <section className="hero">
    <div className="hero-main">
      <HeroSearch />
      <div className="hero-greeting">
        <h1 className="hero-headline">Notes</h1>
        <p>Your class brain, organized and ready to study.</p>
      </div>
    </div>
    <div className="hero-illustration" aria-hidden>
      <img
        className="hero-illustration-img"
        src={BRAND_HERO_URL}
        alt=""
        decoding="async"
      />
    </div>
  </section>
);

/* ---- quick actions ----------------------------------------------- */

type QuickActionVariant = "new-note" | "record-audio" | "scan-board" | "upload-file";

interface QAProps {
  variant: QuickActionVariant;
  title: string;
  sub: string;
  icon: ReactNode;
  onClick?: () => void;
}

const QuickActionTile: FC<QAProps> = ({ variant, title, sub, icon, onClick }) => (
  <button type="button" className={`quick-action quick-action--${variant}`} onClick={onClick}>
    <span className="qa-icon">{icon}</span>
    <span className="qa-text">
      <span className="qa-title">{title}</span>
      <span className="qa-sub">{sub}</span>
    </span>
  </button>
);

const NotesQuickActions: FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const setView = useApp((s) => s.setView);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const selectedClassId = useApp((s) => s.selectedClassId);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function newNote(): Promise<void> {
    const note = await upsertNote({
      title: "Untitled",
      class_id: selectedClassId ?? null,
      content_markdown: "",
    });
    await recordXp("createNote", XP_RULES.createNote);
    setSelectedNote(note);
    setView({ kind: "note", noteId: note.id });
    onCreated();
  }

  async function onScanPicked(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUri = await fileToDataUri(file);
      const title = stripExt(file.name) || "Whiteboard scan";
      const note = await upsertNote({
        title,
        class_id: selectedClassId ?? null,
        content_markdown: `![${title}](${dataUri})\n`,
      });
      await upsertAttachment({
        note_id: note.id,
        type: "image",
        local_uri: dataUri,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });
      await recordXp("createNote", XP_RULES.createNote);
      setSelectedNote(note);
      setView({ kind: "note", noteId: note.id });
      onCreated();
    } catch (err) {
      setError((err as Error).message || "Failed to save scan.");
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUri = await fileToDataUri(file);
      const title = stripExt(file.name) || "Uploaded file";
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const note = await upsertNote({
        title,
        class_id: selectedClassId ?? null,
        content_markdown: `Attached file: **${file.name}**\n`,
      });
      await upsertAttachment({
        note_id: note.id,
        type: isPdf ? "pdf" : "file",
        local_uri: dataUri,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });
      await recordXp("createNote", XP_RULES.createNote);
      setSelectedNote(note);
      setView({ kind: "note", noteId: note.id });
      onCreated();
    } catch (err) {
      setError((err as Error).message || "Failed to attach file.");
    }
  }

  async function handleAudio(blob: Blob): Promise<void> {
    try {
      const dataUri = await blobToDataUri(blob);
      const title = `Voice note · ${new Date().toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`;
      const note = await upsertNote({
        title,
        class_id: selectedClassId ?? null,
        content_markdown:
          "Recorded audio attached. Open the note to play it back or transcribe later.",
      });
      await upsertAttachment({
        note_id: note.id,
        type: "audio",
        local_uri: dataUri,
        file_name: "recording.webm",
        mime_type: blob.type || "audio/webm",
        size_bytes: blob.size,
      });
      await recordXp("createNote", XP_RULES.createNote);
      setSelectedNote(note);
      setView({ kind: "note", noteId: note.id });
      onCreated();
    } catch (err) {
      setError((err as Error).message || "Failed to save recording.");
    }
  }

  return (
    <>
      <section className="quick-actions">
        <QuickActionTile
          variant="new-note"
          title="New Note"
          sub="Start writing"
          icon={<PencilIcon size={20} />}
          onClick={() => void newNote()}
        />
        <QuickActionTile
          variant="record-audio"
          title="Record Audio"
          sub="Capture ideas"
          icon={<MicIcon size={20} />}
          onClick={() => {
            setError(null);
            setRecorderOpen(true);
          }}
        />
        <QuickActionTile
          variant="scan-board"
          title="Scan Board"
          sub="Snap whiteboard"
          icon={<CameraIcon size={20} />}
          onClick={() => imageRef.current?.click()}
        />
        <QuickActionTile
          variant="upload-file"
          title="Upload File"
          sub="Add documents"
          icon={<UploadIcon size={20} />}
          onClick={() => fileRef.current?.click()}
        />
      </section>
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => void onScanPicked(e)}
      />
      <input
        ref={fileRef}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => void onFilePicked(e)}
      />
      {recorderOpen && (
        <AudioRecorderModal
          onClose={() => setRecorderOpen(false)}
          onSave={async (b) => {
            setRecorderOpen(false);
            await handleAudio(b);
          }}
        />
      )}
      {error && (
        <div className="pill error" style={{ alignSelf: "flex-start" }}>{error}</div>
      )}
    </>
  );
};

function stripExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
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

/* ---- continue writing ------------------------------------------- */

/** Stacked papers illustration (matches dashboard mock — outline stack + ruled top sheet). */
const ContinueWritingPapersArt: FC = () => (
  <svg
    className="cw-papers-svg"
    viewBox="0 0 52 56"
    width={52}
    height={56}
    aria-hidden
  >
    <rect
      x="9"
      y="13"
      width="36"
      height="40"
      rx="3"
      fill="var(--color-surfaceMuted)"
      stroke="var(--color-border)"
      strokeWidth="1.5"
    />
    <rect
      x="5"
      y="7"
      width="38"
      height="42"
      rx="3"
      fill="var(--color-surface)"
      stroke="var(--color-borderStrong)"
      strokeWidth="1.5"
    />
    <rect
      x="1"
      y="1"
      width="40"
      height="46"
      rx="4"
      fill="var(--color-surfaceRaised)"
      stroke="var(--color-primary)"
      strokeWidth="1.75"
    />
    <line x1="9" y1="14" x2="33" y2="14" stroke="var(--color-textSubtle)" strokeWidth="1.15" strokeLinecap="round" />
    <line x1="9" y1="20" x2="31" y2="20" stroke="var(--color-textSubtle)" strokeWidth="1.15" strokeLinecap="round" />
    <line x1="9" y1="26" x2="29" y2="26" stroke="var(--color-textSubtle)" strokeWidth="1.15" strokeLinecap="round" />
    <line x1="9" y1="32" x2="27" y2="32" stroke="var(--color-textSubtle)" strokeWidth="1.15" strokeLinecap="round" />
  </svg>
);

const ContinueWritingCard: FC = () => {
  const notes = useApp((s) => s.notes);
  const classes = useApp((s) => s.classes);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const setView = useApp((s) => s.setView);
  const last = notes[0];

  const classLabel = useMemo(() => {
    if (!last?.class_id) return "Unfiled";
    return classes.find((c) => c.id === last.class_id)?.name ?? "Unfiled";
  }, [last, classes]);

  return (
    <Card className="continue-writing-card" title="Continue Writing" icon={<ClockIcon size={18} />}>
      {last ? (
        <div className="continue-writing">
          <div className="cw-main">
            <span className="cw-papers" aria-hidden>
              <ContinueWritingPapersArt />
            </span>
            <div className="cw-meta">
              <span className="cw-title">{last.title || "Untitled"}</span>
              <span className="cw-sub">{classLabel}</span>
              <span className="cw-when">
                <ClockIcon size={12} />
                Edited {fmtRelative(new Date(last.updated_at))}
              </span>
            </div>
          </div>
          <div className="cw-footer">
            <button
              type="button"
              className="cw-open"
              onClick={() => {
                setSelectedNote(last);
                setView({ kind: "note", noteId: last.id });
              }}
            >
              Open Note <ArrowRightIcon size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ color: "var(--color-textMuted)", fontSize: 13 }}>
          No notes yet — your most recent draft will live here.
        </div>
      )}
    </Card>
  );
};

/* ---- smart collections ------------------------------------------ */

interface CollectionChipDef {
  key: Exclude<CollectionFilterKey, null | "needsTools" | "audioPending">;
  label: string;
  icon: ReactNode;
  fg: string;
  bg: string;
}

const COLLECTION_CHIPS: CollectionChipDef[] = [
  {
    key: "thisWeek",
    label: "This Week",
    icon: <CalendarIcon size={24} />,
    fg: "var(--color-accentSky)",
    bg: "var(--color-accentSkySoft)",
  },
  {
    key: "examPrep",
    label: "Exam Prep",
    icon: <SparklesIcon size={24} />,
    fg: "var(--color-accentRose)",
    bg: "var(--color-accentRoseSoft)",
  },
  {
    key: "audio",
    label: "Audio Notes",
    icon: <MicIcon size={24} />,
    fg: "var(--color-accentAmber)",
    bg: "var(--color-accentAmberSoft)",
  },
  {
    key: "scans",
    label: "Board Scans",
    icon: <CameraIcon size={24} />,
    fg: "var(--color-accentSage)",
    bg: "var(--color-accentSageSoft, var(--color-accentSkySoft))",
  },
  {
    key: "needsReview",
    label: "Needs Review",
    icon: <EyeIcon size={24} />,
    fg: "var(--color-accentPeach)",
    bg: "var(--color-accentPeachSoft)",
  },
];

const SmartCollectionsCard: FC<{
  counts: CollectionCounts;
  active: CollectionFilterKey;
  onPick: (key: CollectionChipDef["key"]) => void;
}> = ({ counts, active, onPick }) => (
  <Card title="Smart Collections" icon={<BoltIcon size={18} />}>
    <div className="collection-chips">
      {COLLECTION_CHIPS.map((c) => {
        const value = counts[c.key];
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            className={`collection-chip${isActive ? " active" : ""}`}
            style={{ background: c.bg }}
            onClick={() => onPick(c.key)}
          >
            <span className="chip-icon" style={{ color: c.fg }}>
              {c.icon}
            </span>
            <span className="chip-label">{c.label}</span>
            <span className="chip-count">{value}</span>
          </button>
        );
      })}
    </div>
  </Card>
);

/* ---- recent notes ----------------------------------------------- */

const RecentNotesCard: FC<{
  notes: NoteRow[];
  classMap: Map<string, ClassRow>;
  filterLabel: string | null;
  onClearFilter: () => void;
  onDelete: (n: NoteRow) => void;
}> = ({ notes, classMap, filterLabel, onClearFilter, onDelete }) => {
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const setView = useApp((s) => s.setView);

  // The home Notes screen always shows the 5 most recent — the full
  // browseable list lives on the dedicated All Notes view.
  const visible = notes.slice(0, 5);

  function open(n: NoteRow): void {
    setSelectedNote(n);
    setView({ kind: "note", noteId: n.id });
  }

  return (
    <Card
      className="recent-notes-card"
      title="Recent Notes"
      icon={<NoteIcon size={18} />}
      action={
        notes.length > 0 ? (
          <button
            type="button"
            className="recent-notes-header-action"
            onClick={() => setView({ kind: "allNotes" })}
          >
            View all notes
            <ArrowRightIcon size={12} />
          </button>
        ) : undefined
      }
    >
      {filterLabel && (
        <div className="recent-filter-bar">
          <span className="pill">{filterLabel} · {notes.length}</span>
          <button type="button" className="btn-ghost" onClick={onClearFilter}>
            Clear filter
          </button>
        </div>
      )}
      {notes.length === 0 ? (
        <div style={{ color: "var(--color-textMuted)", fontSize: 13, padding: "8px 0" }}>
          No notes match this view yet.
        </div>
      ) : (
        <div className="recent-table">
          {visible.map((n) => {
            const cls = n.class_id ? classMap.get(n.class_id) : null;
            const items: MoreMenuItem[] = [
              { label: "Open", icon: <NoteIcon size={14} />, onClick: () => open(n) },
              {
                label: "Delete note…",
                icon: <TrashIcon size={14} />,
                danger: true,
                onClick: () => onDelete(n),
              },
            ];
            return (
              <div
                key={n.id}
                className="recent-table-row"
                role="button"
                tabIndex={0}
                onClick={() => open(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open(n);
                  }
                }}
              >
                <span className="row-glyph" aria-hidden>
                  <NoteGlyph icon={n.icon} size={16} />
                </span>
                <span className="row-title">{n.title || "Untitled"}</span>
                <span className="row-class">{cls?.name ?? "Unfiled"}</span>
                <span className="row-when">{fmtShortDate(new Date(n.updated_at))}</span>
                <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <MoreMenu items={items} label={`More actions for ${n.title || "Untitled"}`} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

/* ---- ai ready queue --------------------------------------------- */

const AI_ACTION_META: Record<
  AiQueueItem["action"],
  { label: string; sub: string; icon: ReactNode; bg: string; fg: string }
> = {
  summarize: {
    label: "Summarize",
    sub: "Ready to summarize",
    icon: <SparklesIcon size={14} />,
    bg: "var(--color-accentSkySoft)",
    fg: "var(--color-accentSky)",
  },
  flashcards: {
    label: "Flashcards",
    sub: "Ready to create flashcards",
    icon: <FlashcardIcon size={14} />,
    bg: "var(--color-accentRoseSoft)",
    fg: "var(--color-accentRose)",
  },
  quiz: {
    label: "Quiz",
    sub: "Ready to create quiz",
    icon: <QuizIcon size={14} />,
    bg: "var(--color-accentAmberSoft)",
    fg: "var(--color-accentAmber)",
  },
};

const AiReadyQueueCard: FC<{ queue: AiQueueItem[] }> = ({ queue }) => {
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const setView = useApp((s) => s.setView);

  return (
    <Card title="AI Ready Queue" icon={<SparklesIcon size={18} />}>
      {queue.length === 0 ? (
        <div style={{ color: "var(--color-textMuted)", fontSize: 13, padding: "8px 0" }}>
          You're all caught up — every note has its study tools and summary.
        </div>
      ) : (
        <div className="ai-queue">
          {queue.map(({ note, action }) => {
            const meta = AI_ACTION_META[action];
            return (
              <div key={`${note.id}-${action}`} className="ai-queue-row">
                <span className="aiq-glyph" aria-hidden>
                  <NoteGlyph icon={note.icon} size={16} />
                </span>
                <div className="aiq-meta">
                  <span className="aiq-title">{note.title || "Untitled"}</span>
                  <span className="aiq-sub">{meta.sub}</span>
                </div>
                <button
                  type="button"
                  className="aiq-action"
                  style={{ background: meta.bg, color: meta.fg }}
                  onClick={() => {
                    setSelectedNote(note);
                    setView({ kind: "note", noteId: note.id });
                  }}
                >
                  {meta.icon}
                  <span>{meta.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

/* ---- needs attention -------------------------------------------- */

const NeedsAttentionStrip: FC<{
  counts: AttentionCounts;
  onPick: (key: Extract<CollectionFilterKey, "needsTools" | "audioPending">) => void;
}> = ({ counts, onPick }) => {
  const setView = useApp((s) => s.setView);
  const [artBroken, setArtBroken] = useState(false);

  return (
    <section className="attention-strip">
      <Card title="Needs Attention" icon={<WarningIcon size={18} />}>
        <div className="attention-grid">
          <button
            type="button"
            className="attention-tile"
            onClick={() => onPick("needsTools")}
          >
            <span
              className="att-icon"
              style={{
                background: "var(--color-accentRoseSoft)",
                color: "var(--color-accentRose)",
              }}
            >
              <NoteIcon size={18} />
            </span>
            <span className="att-text">
              <span className="att-title">
                {counts.needsTools} {pluralize(counts.needsTools, "note", "notes")} need study tools
              </span>
              <span className="att-sub">Add flashcards, quizzes, or summaries</span>
            </span>
          </button>
          <button
            type="button"
            className="attention-tile"
            onClick={() => onPick("audioPending")}
          >
            <span
              className="att-icon"
              style={{
                background: "var(--color-accentAmberSoft)",
                color: "var(--color-accentAmber)",
              }}
            >
              <MicIcon size={18} />
            </span>
            <span className="att-text">
              <span className="att-title">
                {counts.audioPending} audio {pluralize(counts.audioPending, "recording", "recordings")}
              </span>
              <span className="att-sub">
                {counts.audioPending === 1 ? "Needs transcription" : "Need transcription"}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="attention-tile"
            onClick={() => setView({ kind: "settings" })}
          >
            <span
              className="att-icon"
              style={{
                background: "var(--color-accentSkySoft)",
                color: "var(--color-accentSky)",
              }}
            >
              <CloudOffIcon size={18} />
            </span>
            <span className="att-text">
              <span className="att-title">
                {counts.unsynced} {pluralize(counts.unsynced, "note has", "notes have")}
              </span>
              <span className="att-sub">
                {counts.unsynced > 0 ? "Unsynced changes" : "Synced changes"}
              </span>
            </span>
          </button>
        </div>
        {!artBroken && (
          <img
            src={BRAND_ATTENTION_URL}
            alt=""
            className="attention-art"
            decoding="async"
            onError={() => setArtBroken(true)}
          />
        )}
      </Card>
    </section>
  );
};

/* ---- empty state ------------------------------------------------ */

const NotesEmptyState: FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const setView = useApp((s) => s.setView);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  async function go(): Promise<void> {
    const note = await upsertNote({ title: "Untitled" });
    await recordXp("createNote", XP_RULES.createNote);
    setSelectedNote(note);
    setView({ kind: "note", noteId: note.id });
    onCreated();
  }
  return (
    <Card>
      <div className="empty">
        <span style={{ fontSize: 16, fontWeight: 600 }}>No notes yet</span>
        <span>Create your first note or capture audio with the actions above.</span>
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => void go()}>
          <PencilIcon size={14} /> New note
        </button>
      </div>
    </Card>
  );
};

/* ---- formatting helpers ----------------------------------------- */

function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

function fmtRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

function fmtShortDate(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dt.getTime()) / 86_400_000);
  if (diff === 0) return `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
