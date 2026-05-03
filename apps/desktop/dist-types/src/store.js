import { create } from "zustand";
import { applyTheme, getStoredTheme } from "./lib/theme.js";
import { getProfile, saveProfile } from "./lib/profile.js";
import { getRightPanelLayout, saveRightPanelLayout, } from "./lib/rightPanelLayout.js";
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
    xpToday: 0,
    streak: 0,
    theme: getStoredTheme(),
    profile: getProfile(),
    rightPanelWidgets: getRightPanelLayout().activeIds,
    focusedClassId: null,
    activeTimer: null,
    classesDetailPanelOpen: false,
    selectedDeckId: null,
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
    setSelectedDeck: (selectedDeckId) => set({ selectedDeckId }),
}));
//# sourceMappingURL=store.js.map