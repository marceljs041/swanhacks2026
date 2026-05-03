import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { Settings } from "./components/Settings.js";
import { RightPanel } from "./components/RightPanel.js";
import { Onboarding } from "./components/Onboarding.js";
import { useApp } from "./store.js";
import { desktopSyncDb, desktopTransport } from "./sync/adapter.js";
import { getDb } from "./db/client.js";
let workerStarted = false;
function customMacTitlebar() {
    return (typeof window !== "undefined" && window.studynest?.platform === "darwin");
}
export function App() {
    const macCustomChrome = customMacTitlebar();
    const view = useApp((s) => s.view);
    const onboardedAt = useApp((s) => s.profile.onboardedAt);
    const setSyncStatus = useApp((s) => s.setSyncStatus);
    const setSidecar = useApp((s) => s.setSidecar);
    const classesDetailPanelOpen = useApp((s) => s.classesDetailPanelOpen);
    useEffect(() => {
        if (workerStarted)
            return;
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
        const pollSidecar = async () => {
            try {
                const s = await window.studynest?.sidecarStatus();
                if (s)
                    setSidecar(!!s.loaded);
            }
            catch {
                setSidecar(false);
            }
        };
        void pollSidecar();
        const poll = setInterval(() => void pollSidecar(), 3000);
        return () => {
            worker.stop();
            clearInterval(poll);
        };
    }, [setSyncStatus, setSidecar]);
    // The note editor and the classes screen render their own right
    // panels (AI actions / class detail), so we suppress the global one
    // for those views.
    const showRightPanel = view.kind !== "note" && view.kind !== "classes";
    if (!onboardedAt) {
        return (_jsxs("div", { className: `app-onboarding${macCustomChrome ? " with-custom-titlebar" : ""}`, children: [macCustomChrome && _jsx("div", { className: "app-titlebar", "aria-hidden": true }), _jsx(Onboarding, {})] }));
    }
    // The note editor and the Classes *detail* column need a wider third
    // track; Home / Notes / Classes (global right panel) use the default
    // 304px right column.
    const isNoteView = view.kind === "note";
    const isClassesDetailWide = view.kind === "classes" && classesDetailPanelOpen;
    return (_jsxs("div", { className: `app${macCustomChrome ? " with-custom-titlebar" : ""}${isNoteView || isClassesDetailWide ? " note-wide" : ""}`, children: [macCustomChrome && _jsx("div", { className: "app-titlebar", "aria-hidden": true }), _jsx(Sidebar, {}), renderMain(view), showRightPanel && _jsx(RightPanel, {})] }));
}
function renderMain(view) {
    switch (view.kind) {
        case "home": return _jsx(Home, {});
        case "notes": return _jsx(NotesList, {});
        case "allNotes": return _jsx(AllNotes, {});
        case "note": return _jsx(NoteEditor, { noteId: view.noteId });
        case "classes": return _jsx(Classes, {});
        case "classView": return _jsx(ClassView, { classId: view.classId });
        case "classAsk": return _jsx(ClassAsk, { classId: view.classId });
        case "flashcards": return _jsx(FlashcardsHub, {});
        case "flashcardSet": return _jsx(Flashcards, { setId: view.setId, mode: view.mode });
        case "quizzes": return _jsx(QuizzesHub, {});
        case "quiz": return _jsx(Quiz, { quizId: view.quizId });
        case "calendar": return _jsx(Calendar, {});
        case "settings": return _jsx(Settings, {});
    }
}
//# sourceMappingURL=App.js.map