import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_USER_PREFERENCES,
  type AccessibilityPreferences,
  type SupportedLanguage,
  type UserPreferences,
} from "@cyaccess/shared";

export type PreferencesState = UserPreferences & {
  setLanguage: (language: SupportedLanguage) => void;
  setAccessibility: (patch: Partial<AccessibilityPreferences>) => void;
  setVoiceRate: (rate: number) => void;
  completeOnboarding: () => void;
  reset: () => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_USER_PREFERENCES,
      setLanguage: (language) => set({ language }),
      setAccessibility: (patch) =>
        set((s) => ({ accessibility: { ...s.accessibility, ...patch } })),
      setVoiceRate: (voiceRate) => set({ voiceRate }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      reset: () => set({ ...DEFAULT_USER_PREFERENCES }),
    }),
    {
      name: "cyaccess.preferences",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        language: s.language,
        hasCompletedOnboarding: s.hasCompletedOnboarding,
        accessibility: s.accessibility,
        voiceRate: s.voiceRate,
      }),
    },
  ),
);
