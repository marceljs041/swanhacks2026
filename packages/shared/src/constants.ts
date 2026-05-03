export const APP_NAME = "StudyNest";
export const APP_TAGLINE = "Your offline-first AI study workspace.";

export const LOCAL_AI_BASE_URL =
  (typeof (process as any)?.env?.STUDYNEST_LOCAL_AI_URL !== "undefined"
    ? (process as any).env.STUDYNEST_LOCAL_AI_URL
    : "http://127.0.0.1:8765");

export const CLOUD_API_BASE_URL =
  (typeof (process as any)?.env?.STUDYNEST_API_URL !== "undefined"
    ? (process as any).env.STUDYNEST_API_URL
    : "http://127.0.0.1:8000");

export const XP_RULES = {
  createNote: 5,
  generateFlashcards: 10,
  reviewTenCards: 20,
  completeQuiz: 25,
  perfectQuizBonus: 15,
  studyTaskComplete: 15,
} as const;

export type XpAction = keyof typeof XP_RULES;
