import { create } from "zustand";
import type {
  ClassRow,
  FlashcardRow,
  FlashcardSetRow,
  NoteRow,
  QuizRow,
  StudyTaskRow,
  SyncStatus,
} from "@studynest/shared";
import type { ThemeName } from "@studynest/ui";
import { applyTheme, getStoredTheme } from "./lib/theme.js";

export type View =
  | { kind: "home" }
  | { kind: "notes" }
  | { kind: "note"; noteId: string }
  | { kind: "classes" }
  | { kind: "flashcards" } // hub: list of decks + due cards
  | { kind: "flashcardSet"; setId: string } // single-deck review
  | { kind: "quizzes" } // hub: list of quizzes
  | { kind: "quiz"; quizId: string }
  | { kind: "calendar" }
  | { kind: "settings" };

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
  sidecarModel: string | null;
  xpToday: number;
  streak: number;
  theme: ThemeName;

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
  setSidecar: (loaded: boolean, model: string | null) => void;
  setXp: (xp: number, streak: number) => void;
  setTheme: (t: ThemeName) => void;
}

export const useApp = create<AppState>((set) => ({
  view: { kind: "home" },
  classes: [],
  notes: [],
  selectedClassId: null,
  selectedNote: null,
  flashcardSets: [],
  dueCards: [],
  quizzes: [],
  weekTasks: [],
  syncStatus: "offline",
  sidecarLoaded: false,
  sidecarModel: null,
  xpToday: 0,
  streak: 0,
  theme: getStoredTheme(),

  setView: (view) => set({ view }),
  setClasses: (classes) => set({ classes }),
  setNotes: (notes) => set({ notes }),
  setSelectedClass: (id) => set({ selectedClassId: id }),
  setSelectedNote: (n) => set({ selectedNote: n }),
  setFlashcardSets: (flashcardSets) => set({ flashcardSets }),
  setDueCards: (dueCards) => set({ dueCards }),
  setQuizzes: (quizzes) => set({ quizzes }),
  setWeekTasks: (weekTasks) => set({ weekTasks }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setSidecar: (sidecarLoaded, sidecarModel) => set({ sidecarLoaded, sidecarModel }),
  setXp: (xpToday, streak) => set({ xpToday, streak }),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
