import { create } from "zustand";
import { applyTheme, getStoredTheme } from "./lib/theme.js";
import { getProfile, saveProfile } from "./lib/profile.js";
import { getRightPanelLayout, saveRightPanelLayout, } from "./lib/rightPanelLayout.js";
import { getStoredCalendarCursor, getStoredCalendarView, saveCalendarCursor, saveCalendarView, } from "./lib/calendarPrefs.js";
export const useApp = create((set) => ({
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
    sidecarError: null,
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
    setSidecar: (sidecarLoaded, sidecarError) => set({ sidecarLoaded, sidecarError }),
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
    setFlashcardsDetailPanelOpen: (flashcardsDetailPanelOpen) => set({ flashcardsDetailPanelOpen }),
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
    setCalendarSelectedEvent: (calendarSelectedEventId) => set({
        calendarSelectedEventId,
        // Wider third track + detail rail only while an event is selected;
        // null restores the global RightPanel (same pattern as Classes).
        calendarDetailPanelOpen: calendarSelectedEventId !== null,
    }),
    setCalendarDetailPanelOpen: (calendarDetailPanelOpen) => set((s) => ({
        calendarDetailPanelOpen,
        // Closing the rail also clears the current selection so re-opening
        // it from a stat/toolbar action shows the friendly empty state
        // rather than whichever event was last viewed.
        calendarSelectedEventId: calendarDetailPanelOpen
            ? s.calendarSelectedEventId
            : null,
    })),
    setCalendarComposer: (calendarComposer) => set({ calendarComposer }),
    setCalendarPlanGeneratorOpen: (calendarPlanGeneratorOpen) => set({ calendarPlanGeneratorOpen }),
}));
//# sourceMappingURL=store.js.map