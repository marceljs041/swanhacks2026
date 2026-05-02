import { useEffect } from "react";
import { SyncWorker } from "@studynest/sync";
import { Sidebar } from "./components/Sidebar.js";
import { NotesList } from "./components/NotesList.js";
import { NoteEditor } from "./components/NoteEditor.js";
import { Home } from "./components/Home.js";
import { Study } from "./components/Study.js";
import { Flashcards } from "./components/Flashcards.js";
import { Quiz } from "./components/Quiz.js";
import { Calendar } from "./components/Calendar.js";
import { Settings } from "./components/Settings.js";
import { useApp } from "./store.js";
import { desktopSyncDb, desktopTransport } from "./sync/adapter.js";
import { getDb } from "./db/client.js";

let workerStarted = false;

export function App() {
  const view = useApp((s) => s.view);
  const setSyncStatus = useApp((s) => s.setSyncStatus);
  const setSidecar = useApp((s) => s.setSidecar);

  useEffect(() => {
    if (workerStarted) return;
    workerStarted = true;
    void getDb(); // ensure migrations run on first paint
    const worker = new SyncWorker({
      db: desktopSyncDb,
      transport: desktopTransport,
      intervalMs: 8000,
      onStatusChange: (s) => setSyncStatus(s),
      onLog: (m) => console.log("[sync]", m),
    });
    worker.start();

    const pollSidecar = async (): Promise<void> => {
      try {
        const s = await window.studynest?.sidecarStatus();
        if (s) setSidecar(!!s.loaded, (s.model as string | null) ?? null);
      } catch {
        setSidecar(false, null);
      }
    };
    void pollSidecar();
    const poll = setInterval(() => void pollSidecar(), 3000);

    return () => {
      worker.stop();
      clearInterval(poll);
    };
  }, [setSyncStatus, setSidecar]);

  return (
    <div className="app">
      <Sidebar />
      {view.kind === "home" && <Home />}
      {view.kind === "notes" && <NotesList />}
      {view.kind === "note" && <NoteEditor noteId={view.noteId} />}
      {view.kind === "study" && <Study />}
      {view.kind === "flashcards" && <Flashcards setId={view.setId} />}
      {view.kind === "quiz" && <Quiz quizId={view.quizId} />}
      {view.kind === "calendar" && <Calendar />}
      {view.kind === "settings" && <Settings />}
      {(view.kind === "home" ||
        view.kind === "notes" ||
        view.kind === "study" ||
        view.kind === "flashcards" ||
        view.kind === "quiz" ||
        view.kind === "calendar" ||
        view.kind === "settings") && <RightPanelPlaceholder view={view.kind} />}
    </div>
  );
}

/**
 * For views that don't render their own right panel (notes/editor renders one),
 * we render a contextual sidebar with sync info and quick actions.
 */
function RightPanelPlaceholder({ view }: { view: string }) {
  if (view === "note") return null; // editor renders its own right panel
  const sidecarLoaded = useApp((s) => s.sidecarLoaded);
  const sidecarModel = useApp((s) => s.sidecarModel);
  const status = useApp((s) => s.syncStatus);
  return (
    <aside className="right-panel">
      <section>
        <h3>Local AI</h3>
        <div style={{ fontSize: 13 }}>
          {sidecarLoaded ? (
            <>
              <span style={{ color: "var(--success)" }}>● Loaded</span>
              <div style={{ color: "var(--muted)", marginTop: 4 }}>{sidecarModel}</div>
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>● Cloud fallback</span>
          )}
        </div>
      </section>
      <section>
        <h3>Sync</h3>
        <div className={`pill ${status}`}>
          <span className="dot" /> {status}
        </div>
      </section>
      <section>
        <h3>About</h3>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          StudyNest is offline-first. Notes save locally and sync when online.
        </div>
      </section>
    </aside>
  );
}
