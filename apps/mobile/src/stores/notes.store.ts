import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type BoardNote = {
  id: string;
  createdAt: string;
  imageUri: string | null;
  text: string;
  language: string;
  translatedText?: string;
  translationLanguage?: string;
};

type NotesState = {
  notes: BoardNote[];
  add: (note: BoardNote) => void;
  update: (id: string, patch: Partial<BoardNote>) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useNotes = create<NotesState>()(
  persist(
    (set) => ({
      notes: [],
      add: (note) => set((s) => ({ notes: [note, ...s.notes] })),
      update: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        })),
      remove: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      clear: () => set({ notes: [] }),
    }),
    {
      name: "cyaccess.notes",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
