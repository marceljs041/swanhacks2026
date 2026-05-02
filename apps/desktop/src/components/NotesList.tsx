import type { FC } from "react";
import { useEffect } from "react";
import { listNotes, upsertNote } from "../db/repositories.js";
import { useApp } from "../store.js";
import { recordXp } from "../db/repositories.js";
import { XP_RULES } from "@studynest/shared";

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
    <div className="main">
      <div className="toolbar">
        <button className="primary" onClick={() => void newNote()}>
          + New note
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ color: "var(--muted)" }}>{notes.length} notes</span>
      </div>
      {notes.length === 0 ? (
        <div className="empty">
          <div style={{ fontSize: 18 }}>No notes yet</div>
          <div>Press + to capture your first note.</div>
        </div>
      ) : (
        <div className="notes-list">
          {notes.map((n) => (
            <div
              key={n.id}
              className="note-card"
              onClick={() => {
                setSelectedNote(n);
                setView({ kind: "note", noteId: n.id });
              }}
            >
              <div className="note-card-title">{n.title || "Untitled"}</div>
              {n.content_markdown && (
                <div className="note-card-snippet">
                  {n.content_markdown.slice(0, 140)}
                  {n.content_markdown.length > 140 ? "…" : ""}
                </div>
              )}
              <div className="note-card-meta">
                Updated {new Date(n.updated_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
