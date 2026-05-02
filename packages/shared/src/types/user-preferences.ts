export type SupportedLanguage = "en" | "es" | "ar" | "zh";

export type AccessibilityPreferences = {
  avoidStairs: boolean;
  preferElevators: boolean;
  voiceGuidance: boolean;
  largeText: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  preferAccessibleEntrances: boolean;
};

export type UserPreferences = {
  language: SupportedLanguage;
  hasCompletedOnboarding: boolean;
  accessibility: AccessibilityPreferences;
  voiceRate: number;
};

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  avoidStairs: false,
  preferElevators: false,
  voiceGuidance: false,
  largeText: false,
  highContrast: false,
  reduceMotion: false,
  preferAccessibleEntrances: false,
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  language: "en",
  hasCompletedOnboarding: false,
  accessibility: DEFAULT_ACCESSIBILITY_PREFERENCES,
  voiceRate: 0.95,
};
