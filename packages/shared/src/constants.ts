export const APP_NAME = "StudyNest";
export const APP_TAGLINE = "Your offline-first AI study workspace.";

export const LOCAL_AI_BASE_URL =
  (typeof process !== "undefined" && process.env?.STUDYNEST_LOCAL_AI_URL) ||
  "http://127.0.0.1:8765";

export const CLOUD_API_BASE_URL =
  (typeof process !== "undefined" && process.env?.STUDYNEST_API_URL) ||
  "http://127.0.0.1:8000";

export const XP_RULES = {
  createNote: 10,
  generateFlashcards: 15,
  reviewFlashcards: 20,
  reviewTenCards: 20,
  completeQuiz: 25,
  dailyStreak: 10,
  perfectQuizBonus: 15,
  studyTaskComplete: 10,
} as const;

export type XpAction = keyof typeof XP_RULES;

/** Redeemable-style points ledger (separate from XP). */
export const POINTS_RULES = {
  completeQuiz: 10,
  scoreEightyPlus: 15,
  reviewTenFlashcards: 8,
  finishStudyTask: 5,
  threeDayStreak: 20,
} as const;
