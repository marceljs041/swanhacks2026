import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
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
export const HeroSearch = () => {
    const setView = useApp((s) => s.setView);
    const setSelectedNote = useApp((s) => s.setSelectedNote);
    const setSelectedClass = useApp((s) => s.setSelectedClass);
    const classes = useApp((s) => s.classes);
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [active, setActive] = useState(0);
    const wrapRef = useRef(null);
    // Used to discard stale async query results when typing fast.
    const reqId = useRef(0);
    // Live class matches are computed on every keystroke — trivial set size.
    const classMatches = useMemo(() => {
        const t = q.trim().toLowerCase();
        if (!t)
            return [];
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
        if (!open)
            return;
        function onDoc(e) {
            if (!wrapRef.current?.contains(e.target))
                setOpen(false);
        }
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);
    const totalRows = results.length + classMatches.length;
    const showDropdown = open && q.trim().length > 0;
    function openNote(n) {
        setSelectedNote(n);
        setView({ kind: "note", noteId: n.id });
        setQ("");
        setOpen(false);
    }
    function openClass(c) {
        setSelectedClass(c.id);
        setView({ kind: "notes" });
        setQ("");
        setOpen(false);
    }
    function onKeyDown(e) {
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
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + totalRows) % totalRows);
        }
        else if (e.key === "Enter") {
            e.preventDefault();
            if (active < results.length) {
                const n = results[active];
                if (n)
                    openNote(n);
            }
            else {
                const c = classMatches[active - results.length];
                if (c)
                    openClass(c);
            }
        }
        else if (e.key === "Escape") {
            setOpen(false);
        }
    }
    return (_jsxs("div", { className: "search-wrap", ref: wrapRef, children: [_jsxs("label", { className: "search", children: [_jsx("span", { className: "search-icon", children: _jsx(SearchIcon, { size: 16 }) }), _jsx("input", { type: "search", placeholder: "Search notes, classes, or topics...", "aria-label": "Search", value: q, onChange: (e) => {
                            setQ(e.target.value);
                            setOpen(true);
                        }, onFocus: () => setOpen(true), onKeyDown: onKeyDown })] }), showDropdown && (_jsx("div", { className: "search-results", role: "listbox", children: totalRows === 0 ? (_jsxs("div", { className: "search-empty", children: ["No matches. Press ", _jsx("kbd", { children: "Enter" }), " to browse all notes."] })) : (_jsxs(_Fragment, { children: [results.length > 0 && (_jsxs("div", { className: "search-group", children: [_jsx("div", { className: "search-group-label", children: "Notes" }), results.map((n, i) => (_jsxs("button", { type: "button", role: "option", "aria-selected": active === i, className: `search-item${active === i ? " active" : ""}`, onMouseEnter: () => setActive(i), onClick: () => openNote(n), children: [_jsx(NoteIcon, { size: 14 }), _jsx("span", { className: "search-item-title", children: n.title || "Untitled" }), _jsx("span", { className: "search-item-sub", children: snippet(n.content_markdown, q) })] }, n.id)))] })), classMatches.length > 0 && (_jsxs("div", { className: "search-group", children: [_jsx("div", { className: "search-group-label", children: "Classes" }), classMatches.map((c, i) => {
                                    const idx = results.length + i;
                                    return (_jsxs("button", { type: "button", role: "option", "aria-selected": active === idx, className: `search-item${active === idx ? " active" : ""}`, onMouseEnter: () => setActive(idx), onClick: () => openClass(c), children: [_jsx("span", { className: "search-item-swatch", style: { background: c.color ?? "var(--color-primary)" }, "aria-hidden": true }), _jsx("span", { className: "search-item-title", children: c.name }), _jsx("span", { className: "search-item-sub", children: c.code ?? "" })] }, c.id));
                                })] }))] })) }))] }));
};
function snippet(content, query) {
    if (!content)
        return "";
    const t = query.trim();
    if (!t)
        return content.slice(0, 80);
    const i = content.toLowerCase().indexOf(t.toLowerCase());
    if (i < 0)
        return content.slice(0, 80);
    const start = Math.max(0, i - 24);
    const out = content.slice(start, start + 80).replace(/\s+/g, " ").trim();
    return (start > 0 ? "…" : "") + out + (start + 80 < content.length ? "…" : "");
}
//# sourceMappingURL=HeroSearch.js.map