import type { FC } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ClassRow, NoteRow } from "@studynest/shared";
import { searchNotes } from "../db/repositories.js";
import { useApp } from "../store.js";
import { NoteIcon, SearchIcon } from "./icons.js";

/**
 * Shared hero typeahead used by both the Home dashboard and the Notes
 * screen. Matching note titles + content come from `searchNotes`;
 * matching classes are filtered locally because the class list is tiny
 * and already in the store. Selecting a result navigates via the
 * global view store so this component is purely presentational.
 */
export const HeroSearch: FC = () => {
  const setView = useApp((s) => s.setView);
  const setSelectedNote = useApp((s) => s.setSelectedNote);
  const setSelectedClass = useApp((s) => s.setSelectedClass);
  const classes = useApp((s) => s.classes);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<NoteRow[]>([]);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Used to discard stale async query results when typing fast.
  const reqId = useRef(0);

  // Live class matches are computed on every keystroke — trivial set size.
  const classMatches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [] as ClassRow[];
    return classes
      .filter((c) => c.name.toLowerCase().includes(t) || (c.code ?? "").toLowerCase().includes(t))
      .slice(0, 4);
  }, [q, classes]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const myReq = ++reqId.current;
    const t = setTimeout(async () => {
      const rows = await searchNotes(q, 6);
      if (myReq === reqId.current) {
        setResults(rows);
        setActive(0);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent): void {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const totalRows = results.length + classMatches.length;
  const showDropdown = open && q.trim().length > 0;

  function openNote(n: NoteRow): void {
    setSelectedNote(n);
    setView({ kind: "note", noteId: n.id });
    setQ("");
    setOpen(false);
  }
  function openClass(c: ClassRow): void {
    setSelectedClass(c.id);
    setView({ kind: "notes" });
    setQ("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!showDropdown || totalRows === 0) {
      if (e.key === "Enter") {
        // No results — jump to the notes list so the user can keep browsing.
        setView({ kind: "notes" });
        setOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % totalRows);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + totalRows) % totalRows);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < results.length) {
        const n = results[active];
        if (n) openNote(n);
      } else {
        const c = classMatches[active - results.length];
        if (c) openClass(c);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="search-wrap" ref={wrapRef}>
      <label className="search">
        <span className="search-icon"><SearchIcon size={16} /></span>
        <input
          type="search"
          placeholder="Search notes, classes, or topics..."
          aria-label="Search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </label>
      {showDropdown && (
        <div className="search-results" role="listbox">
          {totalRows === 0 ? (
            <div className="search-empty">
              No matches. Press <kbd>Enter</kbd> to browse all notes.
            </div>
          ) : (
            <>
              {results.length > 0 && (
                <div className="search-group">
                  <div className="search-group-label">Notes</div>
                  {results.map((n, i) => (
                    <button
                      key={n.id}
                      type="button"
                      role="option"
                      aria-selected={active === i}
                      className={`search-item${active === i ? " active" : ""}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => openNote(n)}
                    >
                      <NoteIcon size={14} />
                      <span className="search-item-title">{n.title || "Untitled"}</span>
                      <span className="search-item-sub">
                        {snippet(n.content_markdown, q)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {classMatches.length > 0 && (
                <div className="search-group">
                  <div className="search-group-label">Classes</div>
                  {classMatches.map((c, i) => {
                    const idx = results.length + i;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={active === idx}
                        className={`search-item${active === idx ? " active" : ""}`}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => openClass(c)}
                      >
                        <span
                          className="search-item-swatch"
                          style={{ background: c.color ?? "var(--color-primary)" }}
                          aria-hidden
                        />
                        <span className="search-item-title">{c.name}</span>
                        <span className="search-item-sub">{c.code ?? ""}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

function snippet(content: string, query: string): string {
  if (!content) return "";
  const t = query.trim();
  if (!t) return content.slice(0, 80);
  const i = content.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return content.slice(0, 80);
  const start = Math.max(0, i - 24);
  const out = content.slice(start, start + 80).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + out + (start + 80 < content.length ? "…" : "");
}
