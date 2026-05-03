/**
 * Wire formats for AI generation. Both the desktop sidecar and the cloud
 * API return JSON matching these shapes.
 */

export interface SummaryResponse {
  summary: string;
  key_terms: Array<{ term: string; definition: string }>;
}

export interface FlashcardsResponse {
  cards: Array<{ front: string; back: string }>;
}

export interface QuizResponse {
  questions: Array<
    | {
        type: "multiple_choice";
        question: string;
        options: string[];
        answer: string;
        explanation?: string;
      }
    | {
        type: "true_false";
        question: string;
        answer: "true" | "false";
        explanation?: string;
      }
  >;
}

export interface StudyPlanResponse {
  tasks: Array<{
    title: string;
    scheduled_for: string; // ISO date
    duration_minutes: number;
    type: "review" | "flashcards" | "quiz" | "read" | "write" | "practice";
    note_id?: string | null;
  }>;
}

export interface NoteContext {
  note_id: string;
  title: string;
  content: string;
  class_name?: string | null;
}

export interface SummarizeRequest extends NoteContext {}
export interface FlashcardsRequest extends NoteContext {
  count?: number;
}
export interface QuizRequest extends NoteContext {
  count?: number;
  types?: Array<"multiple_choice" | "true_false">;
}
export interface StudyPlanRequest {
  goal: string;
  exam_date?: string | null;
  notes: Array<{ id: string; title: string; summary?: string | null }>;
  days_available?: number;
}
export interface SimpleExplainRequest extends NoteContext {
  audience?: "child" | "highschool" | "college";
}

export interface AskMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AskNoteSummary {
  note_id: string;
  title: string;
  summary?: string | null;
  /**
   * The actual note body (markdown). Sent in addition to `summary` so
   * the model can ground answers in the user's own words even when the
   * summary is missing or stale. Callers should truncate to a few
   * thousand characters before sending.
   */
  content?: string | null;
}

/** Class-scoped chat request used by the "Ask AI" screen. */
export interface AskRequest {
  class_name: string;
  class_subtitle?: string | null;
  recent_notes: AskNoteSummary[];
  weak_topics: string[];
  history: AskMessage[];
  question: string;
}

export interface AskResponse {
  /** Plain-text reply (markdown-light) shown in the assistant bubble. */
  answer: string;
  /** Optional one-line "memory trick" / mnemonic to render as a callout. */
  memory_trick?: string | null;
  /** Subset of the supplied `recent_notes` that informed the answer. */
  related_note_ids?: string[];
}

export interface AiHealthResponse {
  ok: boolean;
  model: string | null;
  loaded: boolean;
  context_size: number;
}

/** One class note for `/ai/class-overview` (body truncated client-side). */
export interface ClassOverviewNoteInput {
  note_id: string;
  title: string;
  summary?: string | null;
  content: string;
}

export interface ClassOverviewRequest {
  class_name: string;
  class_subtitle?: string | null;
  notes: ClassOverviewNoteInput[];
}

export interface ClassOverviewResponse {
  /** Single short paragraph, plain text. */
  overview: string;
}
