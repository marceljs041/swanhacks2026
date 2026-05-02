import { useEffect } from "react";
import { SyncWorker } from "@studynest/sync";
import { Sidebar } from "./components/Sidebar.js";
import { NotesList } from "./components/NotesList.js";
import { NoteEditor } from "./components/NoteEditor.js";
import { Home } from "./components/Home.js";
import { Classes } from "./components/Classes.js";
import { FlashcardsHub } from "./components/FlashcardsHub.js";
import { QuizzesHub } from "./components/QuizzesHub.js";
import { Flashcards } from "./components/Flashcards.js";
import { Quiz } from "./components/Quiz.js";
import { Calendar } from "./components/Calendar.js";
import { Settings } from "./components/Settings.js";
import { RightPanel } from "./components/RightPanel.js";
import { useApp } from "./store.js";
import { desktopSyncDb, desktopTransport } from "./sync/adapter.js";
import { getDb } from "./db/client.js";

let workerStarted = false;

function customMacTitlebar(): boolean {
  return (
    typeof window !== "undefined" && window.studynest?.platform === "darwin"
  );
}

export function App() {
  const macCustomChrome = customMacTitlebar();
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

  // The note editor renders its own right panel (AI actions + summary),
  // so we suppress the global one for that view.
  const showRightPanel = view.kind !== "note";

  return (
    <div className={`app${macCustomChrome ? " with-custom-titlebar" : ""}`}>
      {macCustomChrome && <div className="app-titlebar" aria-hidden />}
      <Sidebar />
      {renderMain(view)}
      {showRightPanel && <RightPanel />}
    </div>
  );
}

function renderMain(view: ReturnType<typeof useApp.getState>["view"]) {
  switch (view.kind) {
    case "home":          return <Home />;
    case "notes":         return <NotesList />;
    case "note":          return <NoteEditor noteId={view.noteId} />;
    case "classes":       return <Classes />;
    case "flashcards":    return <FlashcardsHub />;
    case "flashcardSet":  return <Flashcards setId={view.setId} />;
    case "quizzes":       return <QuizzesHub />;
    case "quiz":          return <Quiz quizId={view.quizId} />;
    case "calendar":      return <Calendar />;
    case "settings":      return <Settings />;
  }
}
