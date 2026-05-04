import { useEffect } from "react";
import { SyncWorker } from "@studynest/sync";
import { Sidebar } from "./components/Sidebar.js";
import { NotesList } from "./components/NotesList.js";
import { AllNotes } from "./components/AllNotes.js";
import { NoteEditor } from "./components/NoteEditor.js";
import { Home } from "./components/Home.js";
import { Classes } from "./components/Classes.js";
import { ClassView } from "./components/ClassView.js";
import { ClassAsk } from "./components/ClassAsk.js";
import { FlashcardsHub } from "./components/FlashcardsHub.js";
import { QuizzesHub } from "./components/QuizzesHub.js";
import { Flashcards } from "./components/Flashcards.js";
import { Quiz } from "./components/Quiz.js";
import { Calendar } from "./components/Calendar.js";
import { Points } from "./components/Points.js";
import { Settings } from "./components/Settings.js";
import { RightPanel } from "./components/RightPanel.js";
import { Onboarding } from "./components/Onboarding.js";
import { AudioJobsToast } from "./components/AudioJobsToast.js";
import { useApp } from "./store.js";
import { desktopSyncDb, desktopTransport } from "./sync/adapter.js";
import {
  registerDesktopSyncWorker,
  unregisterDesktopSyncWorker,
} from "./sync/controller.js";
import { getCloudSyncMeta } from "./db/repositories.js";
import { getDb } from "./db/client.js";
import { registerDeviceWithCloud } from "./sync/registerDevice.js";
import { refreshUserBadges } from "./lib/badgesSync.js";

/** Background sync: every 5 minutes when online; idle skips if recently synced. */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
let workerStarted = false;

function customMacTitlebar(): boolean {
  return (
    typeof window !== "undefined" && window.studynest?.platform === "darwin"
  );
}

export function App() {
  const macCustomChrome = customMacTitlebar();
  const view = useApp((s) => s.view);
  const onboardedAt = useApp((s) => s.profile.onboardedAt);
  const setSyncStatus = useApp((s) => s.setSyncStatus);
  const setSidecar = useApp((s) => s.setSidecar);
  const classesDetailPanelOpen = useApp((s) => s.classesDetailPanelOpen);
  const flashcardsDetailPanelOpen = useApp((s) => s.flashcardsDetailPanelOpen);
  const quizzesDetailPanelOpen = useApp((s) => s.quizzesDetailPanelOpen);
  const calendarDetailPanelOpen = useApp((s) => s.calendarDetailPanelOpen);

  useEffect(() => {
    if (workerStarted) return;
    workerStarted = true;
    void getDb().then(() => {
      void refreshUserBadges();
    }); // ensure migrations run on first paint
    const worker = new SyncWorker({
      db: desktopSyncDb,
      transport: desktopTransport,
      intervalMs: SYNC_INTERVAL_MS,
      onStatusChange: (s) => setSyncStatus(s),
      onLog: (m) => console.log("[sync]", m),
      afterReachable: registerDeviceWithCloud,
      shouldSkipScheduledSync: async () => {
        const meta = await getCloudSyncMeta();
        if (meta.pendingOutbox > 0) return false;
        const anchor = meta.lastActivityAt;
        if (!anchor) return false;
        return Date.now() - new Date(anchor).getTime() < SYNC_INTERVAL_MS;
      },
    });
    registerDesktopSyncWorker(worker);
    worker.start();

    const pollSidecar = async (): Promise<void> => {
      try {
        const s = await window.studynest?.sidecarStatus();
        if (s && typeof (s as { ok?: boolean }).ok === "boolean") {
          const raw = s as { loaded?: boolean; error?: unknown };
          const err =
            raw.loaded === true
              ? null
              : typeof raw.error === "string"
                ? raw.error
                : null;
          setSidecar(!!raw.loaded, err);
        } else {
          setSidecar(false, "Can't reach the local AI service.");
        }
      } catch {
        setSidecar(false, "Can't reach the local AI service.");
      }
    };
    void pollSidecar();
    const poll = setInterval(() => void pollSidecar(), 3000);

    return () => {
      worker.stop();
      unregisterDesktopSyncWorker();
      clearInterval(poll);
    };
  }, [setSyncStatus, setSidecar]);

  // The note editor, Classes, Flashcards, and Quizzes screens render their
  // own third column (detail rail vs global widgets). Calendar embeds
  // `<RightPanel calendarSwap />` when nothing is selected — same pattern
  // as Classes — so we suppress App-level RightPanel for calendar too.
  const showRightPanel =
    view.kind !== "note" &&
    view.kind !== "points" &&
    view.kind !== "classes" &&
    view.kind !== "flashcards" &&
    view.kind !== "flashcardSet" &&
    view.kind !== "quizzes" &&
    view.kind !== "quiz" &&
    view.kind !== "calendar";

  if (!onboardedAt) {
    return (
      <div className={`app-onboarding${macCustomChrome ? " with-custom-titlebar" : ""}`}>
        {macCustomChrome && <div className="app-titlebar" aria-hidden />}
        <Onboarding />
      </div>
    );
  }

  // The note editor and the Classes *detail* column need a wider third
  // track; Home / Notes / Classes (global right panel) use the default
  // 304px right column.
  const isNoteView = view.kind === "note";
  const isClassesDetailWide = view.kind === "classes" && classesDetailPanelOpen;
  const isFlashcardsDetailWide =
    view.kind === "flashcardSet" ||
    (view.kind === "flashcards" && flashcardsDetailPanelOpen);
  // Quizzes use the wider third column whenever a quiz is actively
  // being taken / reviewed, OR when a hub card is selected (rail open).
  const isQuizzesDetailWide =
    view.kind === "quiz" ||
    (view.kind === "quizzes" && quizzesDetailPanelOpen);
  // Calendar: default third column is the global widgets (304px). When an
  // event is selected, EventDetailRail swaps in with the wider note-wide grid.
  const isCalendarDetailWide =
    view.kind === "calendar" && calendarDetailPanelOpen;

  return (
    <div
      className={`app${macCustomChrome ? " with-custom-titlebar" : ""}${
        isNoteView ||
        isClassesDetailWide ||
        isFlashcardsDetailWide ||
        isQuizzesDetailWide ||
        isCalendarDetailWide
          ? " note-wide"
          : ""
      }`}
    >
      {macCustomChrome && <div className="app-titlebar" aria-hidden />}
      <Sidebar />
      {renderMain(view)}
      {showRightPanel && <RightPanel />}
      <AudioJobsToast />
    </div>
  );
}

function renderMain(view: ReturnType<typeof useApp.getState>["view"]) {
  switch (view.kind) {
    case "home":          return <Home />;
    case "notes":         return <NotesList />;
    case "points":        return <Points />;
    case "allNotes":      return <AllNotes />;
    case "note":          return <NoteEditor noteId={view.noteId} />;
    case "classes":       return <Classes />;
    case "classView":     return <ClassView classId={view.classId} />;
    case "classAsk":      return <ClassAsk classId={view.classId} />;
    case "flashcards":    return <FlashcardsHub />;
    case "flashcardSet":  return <Flashcards setId={view.setId} mode={view.mode} />;
    case "quizzes":       return <QuizzesHub />;
    case "quiz":          return <Quiz quizId={view.quizId} mode={view.mode ?? "take"} />;
    case "calendar":      return <Calendar />;
    case "settings":      return <Settings />;
  }
}
