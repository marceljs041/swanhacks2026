/**
 * StudyNest user badges — earned from local learning activity (notes, quizzes,
 * flashcards, streaks, XP). Definitions are shared so mobile can reuse them later.
 */

export const BADGE_IDS = [
  "welcome_aboard",
  "organizer",
  "semester_ready",
  "first_note",
  "note_collector",
  "deep_thinker",
  "quiz_starter",
  "quiz_star",
  "card_buff",
  "memory_athlete",
  "streak_starter",
  "week_warrior",
  "xp_spark",
  "xp_champion",
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export interface BadgeDefinition {
  id: BadgeId;
  title: string;
  description: string;
  emoji: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "welcome_aboard",
    title: "Welcome aboard",
    description: "Finished onboarding and joined the nest.",
    emoji: "🪺",
  },
  {
    id: "organizer",
    title: "Organizer",
    description: "Created your first class.",
    emoji: "📚",
  },
  {
    id: "semester_ready",
    title: "Semester ready",
    description: "Track three or more classes.",
    emoji: "🗂️",
  },
  {
    id: "first_note",
    title: "First note",
    description: "Captured your first note.",
    emoji: "✏️",
  },
  {
    id: "note_collector",
    title: "Note collector",
    description: "Ten notes in your library.",
    emoji: "📓",
  },
  {
    id: "deep_thinker",
    title: "Deep thinker",
    description: "Fifty notes — serious study mode.",
    emoji: "🧠",
  },
  {
    id: "quiz_starter",
    title: "Quiz starter",
    description: "Completed a quiz attempt.",
    emoji: "❓",
  },
  {
    id: "quiz_star",
    title: "Quiz star",
    description: "Scored 90% or higher on at least one quiz.",
    emoji: "⭐",
  },
  {
    id: "card_buff",
    title: "Card buff",
    description: "100 flashcard reviews logged.",
    emoji: "🃏",
  },
  {
    id: "memory_athlete",
    title: "Memory athlete",
    description: "500 flashcard reviews — spaced repetition wins.",
    emoji: "🏆",
  },
  {
    id: "streak_starter",
    title: "Streak starter",
    description: "A three-day study streak.",
    emoji: "🔥",
  },
  {
    id: "week_warrior",
    title: "Week warrior",
    description: "Seven days in a row with study XP.",
    emoji: "⚡",
  },
  {
    id: "xp_spark",
    title: "XP spark",
    description: "Earned 50 lifetime XP.",
    emoji: "✨",
  },
  {
    id: "xp_champion",
    title: "XP champion",
    description: "500 lifetime XP — keep going.",
    emoji: "🌟",
  },
];

/** Progress inputs used to decide which badges are currently earned. */
export interface UserBadgeProgress {
  onboarded: boolean;
  noteCount: number;
  classCount: number;
  quizAttempts: number;
  quizBestPct: number;
  flashcardReviews: number;
  streak: number;
  totalXp: number;
}

function qualifies(id: BadgeId, p: UserBadgeProgress): boolean {
  switch (id) {
    case "welcome_aboard":
      return p.onboarded;
    case "organizer":
      return p.classCount >= 1;
    case "semester_ready":
      return p.classCount >= 3;
    case "first_note":
      return p.noteCount >= 1;
    case "note_collector":
      return p.noteCount >= 10;
    case "deep_thinker":
      return p.noteCount >= 50;
    case "quiz_starter":
      return p.quizAttempts >= 1;
    case "quiz_star":
      return p.quizAttempts >= 1 && p.quizBestPct >= 90;
    case "card_buff":
      return p.flashcardReviews >= 100;
    case "memory_athlete":
      return p.flashcardReviews >= 500;
    case "streak_starter":
      return p.streak >= 3;
    case "week_warrior":
      return p.streak >= 7;
    case "xp_spark":
      return p.totalXp >= 50;
    case "xp_champion":
      return p.totalXp >= 500;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

/** Returns every badge id the user currently meets the criteria for. */
export function badgeIdsEarned(p: UserBadgeProgress): BadgeId[] {
  return BADGE_IDS.filter((id) => qualifies(id, p));
}

export function isBadgeId(value: string): value is BadgeId {
  return (BADGE_IDS as readonly string[]).includes(value);
}
