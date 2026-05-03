export type Iso8601 = string;

export interface ClassRow {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  created_at: Iso8601;
  updated_at: Iso8601;
  deleted_at: Iso8601 | null;
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

export interface QuizRow {
  id: string;
  note_id: string | null;
  title: string;
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
  created_at: Iso8601;
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
