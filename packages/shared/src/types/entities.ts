export type Iso8601 = string;

export interface ClassRow {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
  /** When set, the class is hidden from active lists but notes keep their link. */
  archived_at: Iso8601 | null;
  /** AI-generated class overview from all notes; optional short paragraph. */
  overview_text: string | null;
}

export interface NoteRow {
  id: string;
  class_id: string | null;
  title: string;
  content_markdown: string;
  summary: string | null;
  tags_json: string;
  /** Icon key (see apps/desktop/src/lib/noteIcons.tsx). Defaults to "note". */
  icon: string;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
  sync_version: number;
}

export type AttachmentType = "image" | "audio" | "pdf" | "file";

export interface AttachmentRow {
  id: string;
  note_id: string;
  type: AttachmentType;
  local_uri: string;
  remote_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  transcript: string | null;
  extracted_text: string | null;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
}

export interface FlashcardSetRow {
  id: string;
  note_id: string | null;
  title: string;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
}

export type Difficulty = "new" | "easy" | "medium" | "hard";

export interface FlashcardRow {
  id: string;
  set_id: string;
  front: string;
  back: string;
  difficulty: Difficulty;
  due_at: Iso8601 | null;
  last_reviewed_at: Iso8601 | null;
  review_count: number;
  ease: number;
  interval_days: number;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
}

export type QuizDifficulty = "easy" | "medium" | "hard";
export type QuizStatus = "new" | "in_progress" | "completed";
export type QuizSourceType = "note" | "class" | "mixed" | "flashcards";

export interface QuizRow {
  id: string;
  note_id: string | null;
  class_id: string | null;
  title: string;
  description: string | null;
  difficulty: QuizDifficulty;
  status: QuizStatus;
  source_type: QuizSourceType;
  /** JSON-encoded `string[]` of source ids (note ids / set ids / class ids). */
  source_ids_json: string | null;
  /** JSON-encoded `string[]` of weak-topic labels for chip rendering. */
  weak_topics_json: string | null;
  /** JSON-encoded `string[]` of free-form tags ("Lecture", "Exam 1", …). */
  tags_json: string | null;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
}

export type QuizQuestionType = "multiple_choice" | "true_false" | "short_answer";

export interface QuizQuestionRow {
  id: string;
  quiz_id: string;
  type: QuizQuestionType;
  question: string;
  options_json: string | null;
  correct_answer: string;
  explanation: string | null;
  topic: string | null;
  hint: string | null;
  source_note_id: string | null;
  /** Stable display order; null falls back to created_at order. */
  position: number | null;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
}

export interface QuizAttemptRow {
  id: string;
  quiz_id: string;
  score: number;
  total: number;
  answers_json: string;
  started_at: Iso8601 | null;
  finished_at: Iso8601 | null;
  /** 0/1 — incomplete attempts are kept around for analytics. */
  completed: number;
  weak_topics_json: string | null;
  time_spent_seconds: number | null;
  created_at: Iso8601;
}

/**
 * Resume-state for an in-progress quiz. One row per quiz, replaced as
 * the user progresses; cleared on successful submit.
 */
export interface QuizSessionRow {
  quiz_id: string;
  current_index: number;
  /** JSON `Record<questionId, answer>` of answers given so far. */
  answers_json: string;
  started_at: Iso8601;
  updated_at: Iso8601;
}

export interface StudyPlanRow {
  id: string;
  title: string;
  class_id: string | null;
  exam_date: Iso8601 | null;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
}

export type StudyTaskType =
  | "review"
  | "flashcards"
  | "quiz"
  | "read"
  | "write"
  | "practice";

export interface StudyTaskRow {
  id: string;
  plan_id: string | null;
  note_id: string | null;
  title: string;
  type: StudyTaskType;
  scheduled_for: Iso8601;
  duration_minutes: number;
  completed_at: Iso8601 | null;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
}

export interface XpEventRow {
  id: string;
  action: string;
  points: number;
  created_at: Iso8601;
}

/**
 * Calendar feature.
 *
 * `calendar_events` is the unified store for everything that lands on
 * the Calendar grid: class lectures, exams, AI study blocks, quiz
 * practice sessions, flashcard reviews, deadlines, and free-form
 * reminders. It supersedes `study_tasks` for the new UI but legacy
 * widgets continue to read `study_tasks` until they are migrated.
 */
export type CalendarEventType =
  | "class"
  | "exam"
  | "study_block"
  | "quiz"
  | "flashcards"
  | "assignment"
  | "reading"
  | "reminder"
  | "custom";

export type CalendarEventSource = "manual" | "ai_generated" | "system_generated";

export type CalendarEventStatus =
  | "scheduled"
  | "completed"
  | "skipped"
  | "cancelled";

export interface CalendarEventRow {
  id: string;
  title: string;
  type: CalendarEventType;
  class_id: string | null;
  note_id: string | null;
  quiz_id: string | null;
  flashcard_set_id: string | null;
  study_plan_id: string | null;
  description: string | null;
  location: string | null;
  /** ISO timestamp; for all-day events the date portion is what matters. */
  start_at: Iso8601;
  /** ISO timestamp end (exclusive). For all-day, conventionally start+24h. */
  end_at: Iso8601;
  /** 0/1 — stored as integer in SQLite. */
  all_day: number;
  /** Theme accent token name (e.g. "accentSage", "accentSky") or null. */
  color: string | null;
  /** JSON-encoded `string[]` of free-form tags ("Important", "Weekly"). */
  tags_json: string;
  reminder_at: Iso8601 | null;
  source_type: CalendarEventSource;
  status: CalendarEventStatus;
  /** JSON-encoded `{ freq: "weekly"; until?: string; byDay?: string[] }` or null. */
  recurrence_json: string | null;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
  sync_version: number;
}

export interface ChecklistItemRow {
  id: string;
  event_id: string;
  label: string;
  /** 0/1 — stored as integer in SQLite. */
  completed: number;
  position: number | null;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
}
