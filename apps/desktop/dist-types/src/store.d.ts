import type { ClassRow, FlashcardRow, FlashcardSetRow, NoteRow, QuizRow, StudyTaskRow, SyncStatus } from "@studynest/shared";
import type { ThemeName } from "@studynest/ui";
import { type Profile } from "./lib/profile.js";
import { type WidgetId } from "./lib/rightPanelLayout.js";
export type View = {
    kind: "home";
} | {
    kind: "notes";
} | {
    kind: "allNotes";
} | {
    kind: "note";
    noteId: string;
} | {
    kind: "classes";
} | {
    kind: "classView";
    classId: string;
} | {
    kind: "classAsk";
    classId: string;
} | {
    kind: "flashcards";
} | {
    kind: "flashcardSet";
    setId: string;
    mode?: ReviewMode;
} | {
    kind: "quizzes";
} | {
    kind: "quiz";
    quizId: string;
} | {
    kind: "calendar";
} | {
    kind: "settings";
};
interface AppState {
    view: View;
    classes: ClassRow[];
    notes: NoteRow[];
    selectedClassId: string | null;
    selectedNote: NoteRow | null;
    flashcardSets: FlashcardSetRow[];
    dueCards: FlashcardRow[];
    quizzes: QuizRow[];
    weekTasks: StudyTaskRow[];
    syncStatus: SyncStatus;
    sidecarLoaded: boolean;
    xpToday: number;
    streak: number;
    theme: ThemeName;
    profile: Profile;
    rightPanelWidgets: WidgetId[];
    /** Right-panel "Focus class" filter — when set, deadlines/calendar/today
     * widgets scope themselves to tasks tied to notes in this class. */
    focusedClassId: string | null;
    /** Active study-timer session, or null when idle. Lives in the store so
     * the timer keeps running across view changes. */
    activeTimer: TimerSession | null;
    /**
     * Classes screen only: when a class is previewed in the right column,
     * the app grid uses a wider third column (matches note editor). When
     * false, the global RightPanel uses the default 304px width like Home.
     */
    classesDetailPanelOpen: boolean;
    /**
     * Flashcards screens only: which deck powers the right-hand
     * `DeckDetailRail`. Persists across hub ↔ review so opening a deck on
     * the hub keeps it pinned when you start a review session.
     */
    selectedDeckId: string | null;
    setView: (v: View) => void;
    setClasses: (c: ClassRow[]) => void;
    setNotes: (n: NoteRow[]) => void;
    setSelectedClass: (id: string | null) => void;
    setSelectedNote: (n: NoteRow | null) => void;
    setFlashcardSets: (s: FlashcardSetRow[]) => void;
    setDueCards: (c: FlashcardRow[]) => void;
    setQuizzes: (q: QuizRow[]) => void;
    setWeekTasks: (t: StudyTaskRow[]) => void;
    setSyncStatus: (s: SyncStatus) => void;
    setSidecar: (loaded: boolean) => void;
    setXp: (xp: number, streak: number) => void;
    setTheme: (t: ThemeName) => void;
    setProfile: (p: Profile) => void;
    setRightPanelWidgets: (ids: WidgetId[]) => void;
    setFocusedClass: (id: string | null) => void;
    setActiveTimer: (t: TimerSession | null) => void;
    setClassesDetailPanelOpen: (open: boolean) => void;
    setSelectedDeck: (id: string | null) => void;
}
export type ReviewMode = "due" | "cram" | "weak" | "audio";
export type TimerMode = "focus" | "shortBreak" | "longBreak";
export interface TimerSession {
    mode: TimerMode;
    /** ms epoch — when the timer is scheduled to finish. Drives countdown. */
    endsAt: number;
    /** Original requested duration so the progress ring has a reference. */
    durationMs: number;
    /** When paused, remaining ms at the moment of pause; null while running. */
    pausedRemainingMs: number | null;
    /** Optional task this session is "for" — kept loose so users can switch. */
    taskId: string | null;
}
export declare const useApp: import("zustand").UseBoundStore<import("zustand").StoreApi<AppState>>;
export {};
//# sourceMappingURL=store.d.ts.map