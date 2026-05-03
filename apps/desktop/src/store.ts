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
import { getProfile, saveProfile, type Profile } from "./lib/profile.js";
import {
  getRightPanelLayout,
  saveRightPanelLayout,
  type WidgetId,
} from "./lib/rightPanelLayout.js";
import {
  getStoredCalendarCursor,
  getStoredCalendarView,
  saveCalendarCursor,
  saveCalendarView,
  type CalendarView,
} from "./lib/calendarPrefs.js";

export type View =
  | { kind: "home" }
  | { kind: "notes" }
  | { kind: "allNotes" }
  | { kind: "note"; noteId: string }
  | { kind: "classes" }
  | { kind: "classView"; classId: string }
  | { kind: "classAsk"; classId: string }
  | { kind: "flashcards" } // hub: list of decks + due cards
  | { kind: "flashcardSet"; setId: string; mode?: ReviewMode } // single-deck review
  | { kind: "quizzes" } // hub: list of quizzes
  | { kind: "quiz"; quizId: string; mode?: QuizMode }
  | { kind: "calendar" }
  | { kind: "settings" };

export type QuizMode = "take" | "results" | "review";

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
   * Flashcards hub / review: when the deck detail column is visible in the
   * third track (vs the global widget RightPanel). Same width behavior as
   * `classesDetailPanelOpen`.
   */
  flashcardsDetailPanelOpen: boolean;
  /**
   * Flashcards screens only: which deck powers the right-hand
   * `DeckDetailRail`. Persists across hub ↔ review so opening a deck on
   * the hub keeps it pinned when you start a review session.
   */
  selectedDeckId: string | null;
  /**
   * Quizzes hub: when a quiz is selected the third column shows
   * `QuizDetailRail` (wider third track, like Flashcards / Classes).
   */
  quizzesDetailPanelOpen: boolean;
  /** Currently selected quiz on the hub / session screen. */
  selectedQuizId: string | null;

  /**
   * Calendar feature state.
   *
   * `calendarDetailPanelOpen` is true while an event is selected so the
   * app grid widens for `EventDetailRail`. When false, Calendar shows the
   * same global `RightPanel` as Home (via `RightPanel calendarSwap`).
   */
  calendarView: CalendarView;
  /** `YYYY-MM-DD` of the day currently in focus. Drives the visible range. */
  calendarCursor: string;
  calendarSelectedEventId: string | null;
  calendarDetailPanelOpen: boolean;
  /** When set, the AddEditEventDrawer opens prefilled with these fields. */
  calendarComposer:
    | null
    | {
        mode: "create" | "edit";
        eventId?: string;
        prefill?: Partial<{
          title: string;
          type:
            | "class"
            | "exam"
            | "study_block"
            | "quiz"
            | "flashcards"
            | "assignment"
            | "reading"
            | "reminder"
            | "custom";
          class_id: string | null;
          note_id: string | null;
          quiz_id: string | null;
          flashcard_set_id: string | null;
          start_at: string;
          end_at: string;
          all_day: boolean;
          location: string;
          description: string;
        }>;
      };
  /** When true, Calendar renders the StudyPlanGeneratorModal as an overlay. */
  calendarPlanGeneratorOpen: boolean;

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
  setFlashcardsDetailPanelOpen: (open: boolean) => void;
  setSelectedDeck: (id: string | null) => void;
  setQuizzesDetailPanelOpen: (open: boolean) => void;
  setSelectedQuiz: (id: string | null) => void;
  setCalendarView: (view: CalendarView) => void;
  setCalendarCursor: (iso: string) => void;
  setCalendarSelectedEvent: (id: string | null) => void;
  setCalendarDetailPanelOpen: (open: boolean) => void;
  setCalendarComposer: (c: AppState["calendarComposer"]) => void;
  setCalendarPlanGeneratorOpen: (open: boolean) => void;
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
  xpToday: 0,
  streak: 0,
  theme: getStoredTheme(),
  profile: getProfile(),
  rightPanelWidgets: getRightPanelLayout().activeIds,
  focusedClassId: null,
  activeTimer: null,
  classesDetailPanelOpen: false,
  flashcardsDetailPanelOpen: false,
  selectedDeckId: null,
  quizzesDetailPanelOpen: false,
  selectedQuizId: null,

  calendarView: getStoredCalendarView(),
  calendarCursor: getStoredCalendarCursor(),
  calendarSelectedEventId: null,
  calendarDetailPanelOpen: false,
  calendarComposer: null,
  calendarPlanGeneratorOpen: false,

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
  setSidecar: (sidecarLoaded) => set({ sidecarLoaded }),
  setXp: (xpToday, streak) => set({ xpToday, streak }),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  setProfile: (profile) => {
    saveProfile(profile);
    set({ profile });
  },
  setRightPanelWidgets: (rightPanelWidgets) => {
    saveRightPanelLayout({ activeIds: rightPanelWidgets });
    set({ rightPanelWidgets });
  },
  setFocusedClass: (focusedClassId) => set({ focusedClassId }),
  setActiveTimer: (activeTimer) => set({ activeTimer }),
  setClassesDetailPanelOpen: (classesDetailPanelOpen) => set({ classesDetailPanelOpen }),
  setFlashcardsDetailPanelOpen: (flashcardsDetailPanelOpen) =>
    set({ flashcardsDetailPanelOpen }),
  setSelectedDeck: (selectedDeckId) => set({ selectedDeckId }),
  setQuizzesDetailPanelOpen: (quizzesDetailPanelOpen) => set({ quizzesDetailPanelOpen }),
  setSelectedQuiz: (selectedQuizId) => set({ selectedQuizId }),
  setCalendarView: (calendarView) => {
    saveCalendarView(calendarView);
    set({ calendarView });
  },
  setCalendarCursor: (calendarCursor) => {
    saveCalendarCursor(calendarCursor);
    set({ calendarCursor });
  },
  setCalendarSelectedEvent: (calendarSelectedEventId) =>
    set({
      calendarSelectedEventId,
      // Wider third track + detail rail only while an event is selected;
      // null restores the global RightPanel (same pattern as Classes).
      calendarDetailPanelOpen: calendarSelectedEventId !== null,
    }),
  setCalendarDetailPanelOpen: (calendarDetailPanelOpen) =>
    set((s) => ({
      calendarDetailPanelOpen,
      // Closing the rail also clears the current selection so re-opening
      // it from a stat/toolbar action shows the friendly empty state
      // rather than whichever event was last viewed.
      calendarSelectedEventId: calendarDetailPanelOpen
        ? s.calendarSelectedEventId
        : null,
    })),
  setCalendarComposer: (calendarComposer) => set({ calendarComposer }),
  setCalendarPlanGeneratorOpen: (calendarPlanGeneratorOpen) =>
    set({ calendarPlanGeneratorOpen }),
}));
