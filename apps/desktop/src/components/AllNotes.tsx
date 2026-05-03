import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  attachmentCountsByNote,
  listClasses,
  listNotes,
  noteIdsWithStudyTools,
  notesNeedingSummary,
  recordXp,
  softDeleteNote,
  unsyncedNoteIds,
  upsertAttachment,
  upsertNote,
} from "../db/repositories.js";
import { useApp } from "../store.js";
import { XP_RULES } from "@studynest/shared";
import type { ClassRow, NoteRow } from "@studynest/shared";
import { BRAND_HERO_URL } from "../lib/brand.js";
import { NoteGlyph } from "../lib/noteIcons.js";
import { Card } from "./ui/Card.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import { MoreMenu, type MoreMenuItem } from "./ui/MoreMenu.js";
import { AudioRecorderModal } from "./AudioRecorderModal.js";
import { HeroSearch } from "./HeroSearch.js";
import {
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  ChevDownIcon,
  ChevLeftIcon,
  ChevRightIcon,
  ClockIcon,
  CloudCheckIcon,
  CloudOffIcon,
  EyeIcon,
  FlameIcon,
  ImageIcon,
  MicIcon,
  MoreIcon,
  NoteIcon,
  PencilIcon,
  SparklesIcon,
  TrashIcon,
  UploadIcon,
} from "./icons.js";

/* ================================================================== */
/* AllNotes — full browseable list reached from "View all notes"      */
/* ================================================================== */

type DateFilter = "all" | "today" | "week" | "month";
type TypeFilter = "all" | "audio" | "image" | "pdf" | "file" | "none";
type SortKey = "lastEdited" | "created" | "title" | "favorite";
type AiStatus = "summarized" | "ready" | "needsReview";
type SyncRowStatus = "synced" | "offline" | "needsReview";

const PAGE_SIZE = 10;

interface AttCounts {
  audio: number;
  image: number;
  pdf: number;
  file: number;
  total: number;
}

export const AllNotes: FC = () => {
  const setView = useApp((s) => s.setView);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const notes = useApp((s) => s.notes);
  const setNotes = useApp((s) => s.setNotes);
  const classes = useApp((s) => s.classes);
  const setClasses = useApp((s) => s.setClasses);

  const [attMap, setAttMap] = useState<Map<string, AttCounts>>(new Map());
  const [unsynced, setUnsynced] = useState<Set<string>>(new Set());
  const [studyTools, setStudyTools] = useState<Set<string>>(new Set());
  const [needSummary, setNeedSummary] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<NoteRow | null>(null);

  const [classFilter, setClassFilter] = useState<string | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastEdited");
  const [view, setLocalView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);

  const reload = useCallback(async (): Promise<void> => {
    const [ns, cls, atts, uns, tools, summary] = await Promise.all([
      listNotes(null),
      listClasses(),
      attachmentCountsByNote(),
      unsyncedNoteIds(),
      noteIdsWithStudyTools(),
      notesNeedingSummary(500),
    ]);
    setNotes(ns);
    setClasses(cls);
    setAttMap(atts);
    setUnsynced(uns);
    setStudyTools(tools);
    setNeedSummary(new Set(summary.map((n) => n.id)));
  }, [setNotes, setClasses]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const classMap = useMemo(() => {
    const m = new Map<string, ClassRow>();
    for (const c of classes) m.set(c.id, c);
    return m;
  }, [classes]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      for (const t of parseTags(n.tags_json)) set.add(t);
    }
    return Array.from(set).sort();
  }, [notes]);

  const filtered = useMemo(() => {
    const today = startOfToday();
    const weekAgo = addDays(today, -7);
    const monthAgo = addDays(today, -30);

    let out = notes.slice();

    if (classFilter !== "all") {
      out = out.filter((n) => n.class_id === classFilter);
    }
    if (tagFilter !== "all") {
      const want = tagFilter.toLowerCase();
      out = out.filter((n) =>
        parseTags(n.tags_json).some((t) => t.toLowerCase() === want),
      );
    }
    if (typeFilter !== "all") {
      out = out.filter((n) => {
        const a = attMap.get(n.id);
        if (typeFilter === "none") return !a || a.total === 0;
        if (!a) return false;
        return a[typeFilter] > 0;
      });
    }
    if (dateFilter !== "all") {
      const cutoff =
        dateFilter === "today"
          ? today
          : dateFilter === "week"
            ? weekAgo
            : monthAgo;
      out = out.filter((n) => new Date(n.updated_at) >= cutoff);
    }

    out.sort((a, b) => {
      switch (sortKey) {
        case "title":
          return (a.title || "").localeCompare(b.title || "");
        case "created":
          return b.created_at.localeCompare(a.created_at);
        case "favorite": {
          const af = isFavorite(a) ? 1 : 0;
          const bf = isFavorite(b) ? 1 : 0;
          if (af !== bf) return bf - af;
          return b.updated_at.localeCompare(a.updated_at);
        }
        case "lastEdited":
        default:
          return b.updated_at.localeCompare(a.updated_at);
      }
    });
    return out;
  }, [notes, classFilter, tagFilter, typeFilter, dateFilter, sortKey, attMap]);

  // Reset to page 1 whenever the filter/sort changes shape so the user
  // never lands on an empty page after narrowing the result set.
  useEffect(() => {
    setPage(1);
  }, [classFilter, tagFilter, typeFilter, dateFilter, sortKey, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function open(n: NoteRow): void {
    setSelectedNote(n);
    setView({ kind: "note", noteId: n.id });
  }

  async function handleDelete(): Promise<void> {
    if (!confirmDelete) return;
    await softDeleteNote(confirmDelete.id);
    setConfirmDelete(null);
    await reload();
  }

  return (
    <main className="main">
      <div className="main-inner">
        <AllNotesHero onBack={() => setView({ kind: "notes" })} />

        <FilterToolbar
          classes={classes}
          tags={allTags}
          classFilter={classFilter}
          tagFilter={tagFilter}
          typeFilter={typeFilter}
          dateFilter={dateFilter}
          sortKey={sortKey}
          view={view}
          onClass={setClassFilter}
          onTag={setTagFilter}
          onType={setTypeFilter}
          onDate={setDateFilter}
          onSort={setSortKey}
          onView={setLocalView}
        />

        <AllNotesQuickActions onCreated={() => void reload()} />

        <Card
          className="all-notes-card"
          title={`Showing ${filtered.length === 0 ? 0 : pageStart + 1}–${Math.min(
            pageStart + PAGE_SIZE,
            filtered.length,
          )} of ${filtered.length} notes`}
          icon={<NoteIcon size={18} />}
        >
          {filtered.length === 0 ? (
            <div className="all-notes-empty">
              No notes match these filters yet. Try clearing a filter or
              creating a new note above.
            </div>
          ) : view === "list" ? (
            <AllNotesTable
              rows={pageRows}
              classMap={classMap}
              attMap={attMap}
              studyTools={studyTools}
              needSummary={needSummary}
              unsynced={unsynced}
              onOpen={open}
              onDelete={(n) => setConfirmDelete(n)}
              onToggleFavorite={async (n) => {
                await toggleFavorite(n);
                await reload();
              }}
            />
          ) : (
            <AllNotesGrid
              rows={pageRows}
              classMap={classMap}
              attMap={attMap}
              studyTools={studyTools}
              needSummary={needSummary}
              unsynced={unsynced}
              onOpen={open}
            />
          )}

          {filtered.length > 0 && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={filtered.length}
              onPick={setPage}
            />
          )}
        </Card>
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

/* ---- hero -------------------------------------------------------- */

const AllNotesHero: FC<{ onBack: () => void }> = ({ onBack }) => (
  <section className="hero">
    <div className="hero-main">
      <HeroSearch />
      <div className="hero-greeting all-notes-greeting">
        <nav className="all-notes-breadcrumb" aria-label="Breadcrumb">
          <button type="button" className="bc-link" onClick={onBack}>Notes</button>
          <span className="bc-sep" aria-hidden>/</span>
          <span className="bc-current">All Notes</span>
        </nav>
        <h1 className="hero-headline">All Notes</h1>
        <p>Browse, filter, and organize every note in one place.</p>
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

/* ---- filter toolbar --------------------------------------------- */

interface ToolbarProps {
  classes: ClassRow[];
  tags: string[];
  classFilter: string | "all";
  tagFilter: string | "all";
  typeFilter: TypeFilter;
  dateFilter: DateFilter;
  sortKey: SortKey;
  view: "list" | "grid";
  onClass: (v: string | "all") => void;
  onTag: (v: string | "all") => void;
  onType: (v: TypeFilter) => void;
  onDate: (v: DateFilter) => void;
  onSort: (v: SortKey) => void;
  onView: (v: "list" | "grid") => void;
}

const FilterToolbar: FC<ToolbarProps> = ({
  classes,
  tags,
  classFilter,
  tagFilter,
  typeFilter,
  dateFilter,
  sortKey,
  view,
  onClass,
  onTag,
  onType,
  onDate,
  onSort,
  onView,
}) => {
  return (
    <section className="all-notes-toolbar">
      <div className="toolbar-filters">
        <FilterDropdown
          icon={<ClassIconShim />}
          label="Class"
          value={classFilter}
          onChange={(v) => onClass(v as string | "all")}
          options={[
            { value: "all", label: "All classes" },
            ...classes.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <FilterDropdown
          icon={<TagShim />}
          label="Tag"
          value={tagFilter}
          onChange={(v) => onTag(v as string | "all")}
          options={[
            { value: "all", label: "All tags" },
            ...tags.map((t) => ({ value: t, label: t })),
          ]}
        />
        <FilterDropdown
          icon={<NoteIcon size={14} />}
          label="Type"
          value={typeFilter}
          onChange={(v) => onType(v as TypeFilter)}
          options={[
            { value: "all", label: "All types" },
            { value: "audio", label: "Has audio" },
            { value: "image", label: "Has images" },
            { value: "pdf", label: "Has PDF" },
            { value: "file", label: "Has file" },
            { value: "none", label: "Text only" },
          ]}
        />
        <FilterDropdown
          icon={<CalendarIcon size={14} />}
          label="Date"
          value={dateFilter}
          onChange={(v) => onDate(v as DateFilter)}
          options={[
            { value: "all", label: "Any time" },
            { value: "today", label: "Today" },
            { value: "week", label: "This week" },
            { value: "month", label: "This month" },
          ]}
        />
        <FilterDropdown
          icon={<ClockIcon size={14} />}
          label="Sort by"
          value={sortKey}
          onChange={(v) => onSort(v as SortKey)}
          options={[
            { value: "lastEdited", label: "Last edited" },
            { value: "created", label: "Date created" },
            { value: "title", label: "Title (A–Z)" },
            { value: "favorite", label: "Favorites first" },
          ]}
        />
      </div>
      <div className="toolbar-view-toggle" role="tablist" aria-label="View mode">
        <button
          type="button"
          className={`view-toggle ${view === "list" ? "active" : ""}`}
          onClick={() => onView("list")}
          aria-pressed={view === "list"}
        >
          <ListGlyph /> <span>List</span>
        </button>
        <button
          type="button"
          className={`view-toggle ${view === "grid" ? "active" : ""}`}
          onClick={() => onView("grid")}
          aria-pressed={view === "grid"}
        >
          <GridGlyph /> <span>Grid</span>
        </button>
      </div>
    </section>
  );
};

interface DropdownOption {
  value: string;
  label: string;
}

const FilterDropdown: FC<{
  icon: ReactNode;
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
}> = ({ icon, label, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent): void {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const isActive = value !== "all" && value !== "lastEdited";

  return (
    <div className="filter-dropdown" ref={wrapRef}>
      <button
        type="button"
        className={`filter-trigger${isActive ? " active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="filter-icon">{icon}</span>
        <span className="filter-label">{label}</span>
        {current && current.value !== "all" && current.value !== "lastEdited" && (
          <>
            <span className="filter-sep" aria-hidden>·</span>
            <span className="filter-value">{current.label}</span>
          </>
        )}
        <ChevDownIcon size={14} />
      </button>
      {open && (
        <div className="filter-menu" role="listbox">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`filter-option${opt.value === value ? " active" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <span>{opt.label}</span>
              {opt.value === value && <CheckIcon size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ListGlyph: FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const GridGlyph: FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);
const ClassIconShim: FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4Z" />
    <path d="M4 5v14" />
  </svg>
);
const TagShim: FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12V4h8l10 10-8 8L3 12Z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </svg>
);

/* ---- quick actions ---------------------------------------------- */

const AllNotesQuickActions: FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const setView = useApp((s) => s.setView);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function newNote(): Promise<void> {
    const note = await upsertNote({ title: "Untitled", content_markdown: "" });
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
        <button type="button" className="quick-action quick-action--new-note" onClick={() => void newNote()}>
          <span className="qa-icon"><PencilIcon size={20} /></span>
          <span className="qa-text">
            <span className="qa-title">New Note</span>
            <span className="qa-sub">Start writing</span>
          </span>
        </button>
        <button
          type="button"
          className="quick-action quick-action--record-audio"
          onClick={() => {
            setError(null);
            setRecorderOpen(true);
          }}
        >
          <span className="qa-icon"><MicIcon size={20} /></span>
          <span className="qa-text">
            <span className="qa-title">Record Audio</span>
            <span className="qa-sub">Capture ideas</span>
          </span>
        </button>
        <button
          type="button"
          className="quick-action quick-action--scan-board"
          onClick={() => imageRef.current?.click()}
        >
          <span className="qa-icon"><CameraIcon size={20} /></span>
          <span className="qa-text">
            <span className="qa-title">Scan Board</span>
            <span className="qa-sub">Snap whiteboard</span>
          </span>
        </button>
        <button
          type="button"
          className="quick-action quick-action--upload-file"
          onClick={() => fileRef.current?.click()}
        >
          <span className="qa-icon"><UploadIcon size={20} /></span>
          <span className="qa-text">
            <span className="qa-title">Upload File</span>
            <span className="qa-sub">Add documents</span>
          </span>
        </button>
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

/* ---- table ------------------------------------------------------ */

interface TableProps {
  rows: NoteRow[];
  classMap: Map<string, ClassRow>;
  attMap: Map<string, AttCounts>;
  studyTools: Set<string>;
  needSummary: Set<string>;
  unsynced: Set<string>;
  onOpen: (n: NoteRow) => void;
  onDelete: (n: NoteRow) => void;
  onToggleFavorite: (n: NoteRow) => void;
}

const AllNotesTable: FC<TableProps> = ({
  rows,
  classMap,
  attMap,
  studyTools,
  needSummary,
  unsynced,
  onOpen,
  onDelete,
  onToggleFavorite,
}) => (
  <div className="all-notes-table">
    <div className="ant-head">
      <span>Note</span>
      <span>Class</span>
      <span>Tags</span>
      <span>Last edited</span>
      <span>Type / Attachments</span>
      <span>AI Status</span>
      <span>Sync Status</span>
      <span aria-hidden />
    </div>
    {rows.map((n) => {
      const cls = n.class_id ? classMap.get(n.class_id) : null;
      const tags = parseTags(n.tags_json);
      const att = attMap.get(n.id);
      const ai = aiStatusFor(n, studyTools, needSummary);
      const sync = syncStatusFor(n, unsynced);
      const fav = isFavorite(n);
      const items: MoreMenuItem[] = [
        { label: "Open", icon: <NoteIcon size={14} />, onClick: () => onOpen(n) },
        {
          label: fav ? "Remove from favorites" : "Mark as favorite",
          icon: <FlameIcon size={14} />,
          onClick: () => onToggleFavorite(n),
        },
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
          className="ant-row"
          role="button"
          tabIndex={0}
          onClick={() => onOpen(n)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(n);
            }
          }}
        >
          <span className="ant-title-cell">
            <button
              type="button"
              className={`ant-fav${fav ? " active" : ""}`}
              aria-label={fav ? "Remove from favorites" : "Mark as favorite"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(n);
              }}
            >
              <Star filled={fav} />
            </button>
            <span className="ant-glyph" aria-hidden>
              <NoteGlyph icon={n.icon} size={16} />
            </span>
            <span className="ant-title">{n.title || "Untitled"}</span>
          </span>
          <span className="ant-class">
            {cls ? <span className="class-pill">{cls.name}</span> : <span className="muted">—</span>}
          </span>
          <span className="ant-tags">
            {tags.length === 0 ? (
              <span className="muted">—</span>
            ) : (
              tags.slice(0, 2).map((t) => (
                <span key={t} className={`tag-pill tag-${tagPalette(t)}`}>{t}</span>
              ))
            )}
            {tags.length > 2 && <span className="tag-pill tag-more">+{tags.length - 2}</span>}
          </span>
          <span className="ant-when">{fmtShortDate(new Date(n.updated_at))}</span>
          <span className="ant-att">
            {!att || att.total === 0 ? (
              <span className="muted">—</span>
            ) : (
              <span className="att-stack">
                {att.audio > 0 && <AttBadge icon={<MicIcon size={11} />} label={`${att.audio} audio`} />}
                {att.image > 0 && <AttBadge icon={<ImageIcon size={11} />} label={`${att.image} image${att.image === 1 ? "" : "s"}`} />}
                {att.pdf > 0 && <AttBadge icon={<NoteIcon size={11} />} label={`${att.pdf} PDF`} />}
                {att.file > 0 && <AttBadge icon={<UploadIcon size={11} />} label={`${att.file} file${att.file === 1 ? "" : "s"}`} />}
              </span>
            )}
          </span>
          <span className="ant-ai">
            <AiStatusPill status={ai} />
          </span>
          <span className="ant-sync">
            <SyncStatusPill status={sync} />
          </span>
          <span className="ant-actions" onClick={(e) => e.stopPropagation()}>
            <MoreMenu items={items} label={`More actions for ${n.title || "Untitled"}`} />
          </span>
        </div>
      );
    })}
  </div>
);

const AttBadge: FC<{ icon: ReactNode; label: string }> = ({ icon, label }) => (
  <span className="att-badge">
    {icon}
    <span>{label}</span>
  </span>
);

const AiStatusPill: FC<{ status: AiStatus }> = ({ status }) => {
  const meta: Record<AiStatus, { label: string; cls: string; icon: ReactNode }> = {
    summarized: { label: "Summarized", cls: "ai-summarized", icon: <SparklesIcon size={11} /> },
    ready:      { label: "Ready",      cls: "ai-ready",      icon: <CheckIcon size={11} /> },
    needsReview:{ label: "Needs Review", cls: "ai-review",   icon: <EyeIcon size={11} /> },
  };
  const m = meta[status];
  return (
    <span className={`status-pill ${m.cls}`}>
      {m.icon}
      <span>{m.label}</span>
    </span>
  );
};

const SyncStatusPill: FC<{ status: SyncRowStatus }> = ({ status }) => {
  const meta: Record<SyncRowStatus, { label: string; cls: string; icon: ReactNode }> = {
    synced:      { label: "Synced",       cls: "sync-synced",  icon: <CloudCheckIcon size={11} /> },
    offline:     { label: "Offline",      cls: "sync-offline", icon: <CloudOffIcon size={11} /> },
    needsReview: { label: "Needs Review", cls: "sync-review",  icon: <EyeIcon size={11} /> },
  };
  const m = meta[status];
  return (
    <span className={`status-pill ${m.cls}`}>
      {m.icon}
      <span>{m.label}</span>
    </span>
  );
};

/* ---- grid view -------------------------------------------------- */

const AllNotesGrid: FC<Omit<TableProps, "onDelete" | "onToggleFavorite">> = ({
  rows,
  classMap,
  attMap,
  studyTools,
  needSummary,
  unsynced,
  onOpen,
}) => (
  <div className="all-notes-grid">
    {rows.map((n) => {
      const cls = n.class_id ? classMap.get(n.class_id) : null;
      const tags = parseTags(n.tags_json);
      const att = attMap.get(n.id);
      const ai = aiStatusFor(n, studyTools, needSummary);
      const sync = syncStatusFor(n, unsynced);
      return (
        <button
          key={n.id}
          type="button"
          className="grid-card"
          onClick={() => onOpen(n)}
        >
          <span className="grid-card-head">
            <span className="ant-glyph" aria-hidden>
              <NoteGlyph icon={n.icon} size={16} />
            </span>
            <span className="grid-card-title">{n.title || "Untitled"}</span>
            <span className="grid-card-more" aria-hidden>
              <MoreIcon size={14} />
            </span>
          </span>
          {cls && <span className="class-pill">{cls.name}</span>}
          <p className="grid-card-snippet">
            {snippetOf(n.content_markdown) || "No preview yet."}
          </p>
          <span className="grid-card-tags">
            {tags.slice(0, 3).map((t) => (
              <span key={t} className={`tag-pill tag-${tagPalette(t)}`}>{t}</span>
            ))}
          </span>
          <span className="grid-card-foot">
            <AiStatusPill status={ai} />
            <SyncStatusPill status={sync} />
          </span>
          <span className="grid-card-meta">
            <ClockIcon size={11} />
            <span>{fmtShortDate(new Date(n.updated_at))}</span>
            {att && att.total > 0 && (
              <span className="grid-card-att">· {att.total} attachment{att.total === 1 ? "" : "s"}</span>
            )}
          </span>
        </button>
      );
    })}
  </div>
);

/* ---- pagination ------------------------------------------------- */

const Pagination: FC<{
  page: number;
  totalPages: number;
  total: number;
  onPick: (p: number) => void;
}> = ({ page, totalPages, onPick }) => {
  const pages = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);
  return (
    <div className="all-notes-pagination">
      <button
        type="button"
        className="page-btn"
        onClick={() => onPick(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="Previous page"
      >
        <ChevLeftIcon size={14} />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="page-gap">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`page-btn${p === page ? " active" : ""}`}
            onClick={() => onPick(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className="page-btn"
        onClick={() => onPick(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        <ChevRightIcon size={14} />
      </button>
      <span className="page-size-hint">{PAGE_SIZE} per page</span>
    </div>
  );
};

function buildPageList(page: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "…"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

/* ---- helpers ---------------------------------------------------- */

function parseTags(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  } catch {
    /* tolerate stray non-JSON tag blobs from older rows */
  }
  return [];
}

function isFavorite(n: NoteRow): boolean {
  return parseTags(n.tags_json).some((t) => t.toLowerCase() === "favorite");
}

async function toggleFavorite(n: NoteRow): Promise<void> {
  const tags = parseTags(n.tags_json);
  const has = tags.some((t) => t.toLowerCase() === "favorite");
  const next = has
    ? tags.filter((t) => t.toLowerCase() !== "favorite")
    : [...tags, "favorite"];
  await upsertNote({ ...n, tags_json: JSON.stringify(next) });
}

function aiStatusFor(
  n: NoteRow,
  studyTools: Set<string>,
  needSummary: Set<string>,
): AiStatus {
  const summarized = !!n.summary && n.summary.trim().length > 0;
  if (summarized) return "summarized";
  if (studyTools.has(n.id)) return "ready";
  if (needSummary.has(n.id)) return "needsReview";
  return "ready";
}

function syncStatusFor(n: NoteRow, unsynced: Set<string>): SyncRowStatus {
  if (unsynced.has(n.id)) return "offline";
  return "synced";
}

function tagPalette(tag: string): string {
  const t = tag.toLowerCase();
  if (t.includes("exam")) return "rose";
  if (t.includes("important") || t.includes("favorite")) return "amber";
  if (t.includes("review")) return "sky";
  if (t.includes("lab")) return "sage";
  return "neutral";
}

function snippetOf(md: string | null | undefined): string {
  if (!md) return "";
  return md.replace(/[#*`>_\-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 110);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function fmtShortDate(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dt.getTime()) / 86_400_000);
  if (diff === 0) return `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (diff === 1) return `Yesterday, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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

const Star: FC<{ filled: boolean }> = ({ filled }) => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9L12 3Z" />
  </svg>
);
