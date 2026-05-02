import type { FC } from "react";
import { useEffect } from "react";
import { listClasses } from "../db/repositories.js";
import { useApp } from "../store.js";
import { Card } from "./ui/Card.js";
import { Placeholder } from "./ui/Placeholder.js";
import { ClassIcon, PlusIcon, SearchIcon } from "./icons.js";

export const Classes: FC = () => {
  const classes = useApp((s) => s.classes);
  const setClasses = useApp((s) => s.setClasses);
  const setSelectedClass = useApp((s) => s.setSelectedClass);
  const setView = useApp((s) => s.setView);

  useEffect(() => {
    void listClasses().then(setClasses);
  }, [setClasses]);

  return (
    <main className="main">
      <div className="topbar">
        <label className="search">
          <span className="search-icon"><SearchIcon size={16} /></span>
          <input type="search" placeholder="Search classes..." aria-label="Search classes" />
        </label>
      </div>
      <div className="main-inner">
        <div className="page-header">
          <h1>Classes</h1>
          <span className="pill">{classes.length} total</span>
          <span className="spacer" />
          <button className="btn-primary" disabled title="Coming soon">
            <PlusIcon size={14} /> New class
          </button>
        </div>

        {classes.length === 0 ? (
          <Placeholder
            icon={<ClassIcon size={22} />}
            title="Class management not yet implemented"
            description="Once enabled, classes group your notes, flashcards, and quizzes by subject. We'll seed your demo classes from the seed script in the meantime."
          />
        ) : (
          <div className="notes-grid">
            {classes.map((c) => (
              <Card key={c.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: c.color ?? "var(--color-primarySoft)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-onPrimary)",
                    }}
                  >
                    <ClassIcon size={16} />
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                    {c.code && (
                      <span style={{ fontSize: 12, color: "var(--color-textMuted)" }}>{c.code}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setSelectedClass(c.id);
                    setView({ kind: "notes" });
                  }}
                >
                  View notes
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
