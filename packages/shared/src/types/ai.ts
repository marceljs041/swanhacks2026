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

export interface AiHealthResponse {
  ok: boolean;
  model: string | null;
  loaded: boolean;
  context_size: number;
}
