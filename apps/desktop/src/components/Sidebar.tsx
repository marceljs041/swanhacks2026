import type { FC } from "react";
import { useEffect } from "react";
import { listClasses } from "../db/repositories.js";
import { useApp } from "../store.js";

const items: Array<{ key: string; label: string; view: ReturnType<typeof viewFor> }> = [
  { key: "home", label: "Home", view: viewFor("home") },
  { key: "notes", label: "All notes", view: viewFor("notes") },
  { key: "study", label: "Study", view: viewFor("study") },
  { key: "calendar", label: "Calendar", view: viewFor("calendar") },
  { key: "settings", label: "Settings", view: viewFor("settings") },
];

function viewFor(kind: "home" | "notes" | "study" | "calendar" | "settings") {
  return { kind } as const;
}

export const Sidebar: FC = () => {
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const classes = useApp((s) => s.classes);
  const setClasses = useApp((s) => s.setClasses);
  const selectedClassId = useApp((s) => s.selectedClassId);
  const setSelectedClass = useApp((s) => s.setSelectedClass);

  useEffect(() => {
    void listClasses().then(setClasses);
  }, [setClasses]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">StudyNest</div>
      <div className="sidebar-section">
        {items.map((it) => (
          <div
            key={it.key}
            className={`nav-item ${view.kind === it.view.kind ? "active" : ""}`}
            onClick={() => setView(it.view)}
          >
            {it.label}
          </div>
        ))}
      </div>

      <div className="sidebar-section" style={{ flex: 1 }}>
        <div className="sidebar-section-title">Classes</div>
        <div
          className={`nav-item ${selectedClassId === null ? "active" : ""}`}
          onClick={() => {
            setSelectedClass(null);
            setView({ kind: "notes" });
          }}
        >
          All
        </div>
        {classes.map((c) => (
          <div
            key={c.id}
            className={`nav-item ${selectedClassId === c.id ? "active" : ""}`}
            onClick={() => {
              setSelectedClass(c.id);
              setView({ kind: "notes" });
            }}
          >
            <span style={{ color: c.color ?? "var(--accent)" }}>●</span>
            {c.name}
          </div>
        ))}
      </div>

      <SyncPill />
    </aside>
  );
};

const SyncPill: FC = () => {
  const status = useApp((s) => s.syncStatus);
  const sidecarLoaded = useApp((s) => s.sidecarLoaded);
  const sidecarModel = useApp((s) => s.sidecarModel);
  return (
    <div className="sidebar-section" style={{ borderTop: "1px solid var(--border)" }}>
      <div style={{ padding: "4px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
        <span className={`pill ${status}`}>
          <span className="dot" /> {status}
        </span>
        <span className="pill" title={sidecarModel ?? "no model loaded"}>
          <span
            className="dot"
            style={{ background: sidecarLoaded ? "var(--success)" : "var(--muted)" }}
          />
          {sidecarLoaded ? "AI ready" : "AI offline"}
        </span>
      </div>
    </div>
  );
};
