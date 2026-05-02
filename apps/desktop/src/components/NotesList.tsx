import type { FC } from "react";
import { useEffect } from "react";
import { listNotes, recordXp, upsertNote } from "../db/repositories.js";
import { useApp } from "../store.js";
import { XP_RULES } from "@studynest/shared";
import { PlusIcon, SearchIcon } from "./icons.js";

export const NotesList: FC = () => {
  const notes = useApp((s) => s.notes);
  const setNotes = useApp((s) => s.setNotes);
  const setView = useApp((s) => s.setView);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const selectedClassId = useApp((s) => s.selectedClassId);

  useEffect(() => {
    void listNotes(selectedClassId).then(setNotes);
  }, [selectedClassId, setNotes]);

  async function newNote(): Promise<void> {
    const note = await upsertNote({
      title: "Untitled",
      class_id: selectedClassId ?? null,
      content_markdown: "",
    });
    await recordXp("createNote", XP_RULES.createNote);
    setSelectedNote(note);
    setView({ kind: "note", noteId: note.id });
    setNotes(await listNotes(selectedClassId));
  }

  return (
    <main className="main">
      <div className="topbar">
        <label className="search">
          <span className="search-icon"><SearchIcon size={16} /></span>
          <input type="search" placeholder="Search notes..." aria-label="Search notes" />
        </label>
      </div>
      <div className="main-inner">
        <div className="page-header">
          <h1>Notes</h1>
          <span className="pill">{notes.length} total</span>
          <span className="spacer" />
          <button className="btn-primary" onClick={() => void newNote()}>
            <PlusIcon size={14} /> New note
          </button>
        </div>

        {notes.length === 0 ? (
          <div className="empty">
            <span style={{ fontSize: 16, fontWeight: 600 }}>No notes yet</span>
            <span>Press “New note” to capture your first idea.</span>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((n) => (
              <article
                key={n.id}
                className="note-card"
                onClick={() => {
                  setSelectedNote(n);
                  setView({ kind: "note", noteId: n.id });
                }}
              >
                <div className="note-title">{n.title || "Untitled"}</div>
                {n.content_markdown && (
                  <div className="note-snippet">
                    {n.content_markdown.slice(0, 140)}
                    {n.content_markdown.length > 140 ? "…" : ""}
                  </div>
                )}
                <div className="note-meta">
                  Updated {new Date(n.updated_at).toLocaleString()}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
