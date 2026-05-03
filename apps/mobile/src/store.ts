import { create } from "zustand";
import type { SyncStatus } from "@studynest/shared";

interface AppState {
  syncStatus: SyncStatus;
  xpToday: number;
  streak: number;
  aiEnabled: boolean;
  setSyncStatus: (s: SyncStatus) => void;
  setXp: (xp: number, streak: number) => void;
  setAiEnabled: (v: boolean) => void;
}

export const useApp = create<AppState>((set) => ({
  syncStatus: "offline",
  xpToday: 0,
  streak: 0,
  aiEnabled: true,
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setXp: (xpToday, streak) => set({ xpToday, streak }),
  setAiEnabled: (aiEnabled) => set({ aiEnabled }),
}));
