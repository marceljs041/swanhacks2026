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

/* -------------------- Audio chunked-ingest session -------------------- */

/**
 * Multi-step "feed Gemma 4 E4B 30-second audio chunks then ask for notes"
 * pipeline. The renderer slices the recording into ≤30s WAV chunks, POSTs
 * each one to /local-ai/audio-session/{id}/chunk in order, then POSTs to
 * /local-ai/audio-session/{id}/finalize to receive the structured note.
 *
 * The model only runs once — on finalize — using all accumulated chunks
 * as a single multimodal user turn. The "fill the context window then
 * make the notes" pattern is preserved; we just spare the wall-clock cost
 * of intermediate ack generations.
 */

export interface AudioSessionCreateResponse {
  session_id: string;
  /** Max audio chunk length in seconds the sidecar will accept. */
  max_chunk_seconds: number;
  /** Required sample rate (Gemma 4 expects 16 kHz mono). */
  sample_rate: number;
  /**
   * Chosen backend for diagnostics in the UI / toasts:
   *   `gemma4`   → real audio inference via HF transformers.
   *   `stub`     → audio is recorded but the sidecar can't run Gemma 4
   *                 (no transformers / no GPU) — returns a placeholder
   *                 note so the rest of the wiring can be tested.
   */
  backend: "gemma4" | "stub";
}

export interface AudioSessionChunkResponse {
  ok: true;
  /** Total chunks accepted so far for this session. */
  chunks_received: number;
  /** Sum of audio seconds the sidecar has buffered for this session. */
  total_seconds: number;
}

export interface AudioSessionFinalizeRequest {
  /** Optional human title hint (e.g. "Voice note · Apr 12 10:14"). */
  title_hint?: string | null;
  /** Optional class context for grounding (currently unused server-side). */
  class_name?: string | null;
}

export interface AudioSessionFinalizeResponse {
  /** Concise title the model picked from the recording. */
  title: string;
  /** Markdown body the desktop app drops into the note. */
  content_markdown: string;
  /** Short summary (2-3 sentences) — also shown on the note card. */
  summary: string;
  key_terms: Array<{ term: string; definition: string }>;
  /** Reported by the sidecar so the toast can show "Used Gemma 4 E4B". */
  backend: "gemma4" | "stub";
  /** Total seconds of audio the model ingested before generating notes. */
  audio_seconds: number;
}
