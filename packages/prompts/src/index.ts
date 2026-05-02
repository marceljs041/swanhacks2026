/**
 * Prompt templates shared by the desktop sidecar and the cloud fallback.
 * Each prompt is paired with a JSON schema example so the model knows the
 * exact output shape. Both endpoints validate against zod schemas in the
 * server before returning to clients.
 */

const SYSTEM = `You are StudyNest, an AI study assistant. Always respond with VALID JSON only — no prose, no markdown fences, no commentary. The JSON must match the schema in the user's request exactly.`;

const truncate = (s: string, max = 6000) =>
  s.length <= max ? s : `${s.slice(0, max)}\n\n[truncated]`;

export interface PromptPair {
  system: string;
  user: string;
}

export function summarizePrompt(args: {
  title: string;
  content: string;
}): PromptPair {
  return {
    system: SYSTEM,
    user: `Summarize this note in 3-5 sentences and extract 5 key terms.

Title: ${args.title}

Content:
${truncate(args.content)}

Respond with JSON matching this schema:
{
  "summary": "string",
  "key_terms": [{"term": "string", "definition": "string"}]
}`,
  };
}

export function flashcardsPrompt(args: {
  title: string;
  content: string;
  count?: number;
}): PromptPair {
  const n = args.count ?? 10;
  return {
    system: SYSTEM,
    user: `Create ${n} high-quality study flashcards from this note. Front = a question or term. Back = a concise answer or definition.

Title: ${args.title}

Content:
${truncate(args.content)}

Respond with JSON matching this schema:
{
  "cards": [{"front": "string", "back": "string"}]
}`,
  };
}

export function quizPrompt(args: {
  title: string;
  content: string;
  count?: number;
  types?: Array<"multiple_choice" | "true_false">;
}): PromptPair {
  const n = args.count ?? 5;
  const types = (args.types ?? ["multiple_choice", "true_false"]).join(", ");
  return {
    system: SYSTEM,
    user: `Create a quiz of ${n} questions from this note. Allowed question types: ${types}. Always include the correct answer and a 1-sentence explanation.

Title: ${args.title}

Content:
${truncate(args.content)}

Respond with JSON matching this schema:
{
  "questions": [
    {"type": "multiple_choice", "question": "string", "options": ["a", "b", "c", "d"], "answer": "string", "explanation": "string"},
    {"type": "true_false", "question": "string", "answer": "true", "explanation": "string"}
  ]
}

For multiple_choice, "answer" MUST be one of the option strings verbatim. For true_false, "answer" must be "true" or "false".`,
  };
}

export function studyPlanPrompt(args: {
  goal: string;
  exam_date?: string | null;
  notes: Array<{ id: string; title: string; summary?: string | null }>;
  days_available?: number;
}): PromptPair {
  const noteList = args.notes
    .map((n) => `- (${n.id}) ${n.title}${n.summary ? ` — ${n.summary}` : ""}`)
    .join("\n");
  return {
    system: SYSTEM,
    user: `Create a daily study plan.

Goal: ${args.goal}
Exam date: ${args.exam_date ?? "none"}
Days available: ${args.days_available ?? 7}

Notes:
${noteList || "(no notes)"}

Distribute review/flashcards/quiz/practice tasks across the available days, building toward the exam. Use 20-45 minute task durations.

Respond with JSON matching this schema:
{
  "tasks": [
    {
      "title": "string",
      "scheduled_for": "YYYY-MM-DD",
      "duration_minutes": 30,
      "type": "review" | "flashcards" | "quiz" | "read" | "write" | "practice",
      "note_id": "string or null"
    }
  ]
}`,
  };
}

export function simpleExplainPrompt(args: {
  title: string;
  content: string;
  audience?: "child" | "highschool" | "college";
}): PromptPair {
  const audience = args.audience ?? "highschool";
  return {
    system: SYSTEM,
    user: `Explain this note in simple terms for a ${audience} audience.

Title: ${args.title}

Content:
${truncate(args.content)}

Respond with JSON matching this schema:
{
  "summary": "string (the simple explanation, 4-6 sentences)",
  "key_terms": [{"term": "string", "definition": "string in plain language"}]
}`,
  };
}

export function keyTermsPrompt(args: {
  title: string;
  content: string;
}): PromptPair {
  return {
    system: SYSTEM,
    user: `Extract the most important 8-12 key terms from this note.

Title: ${args.title}

Content:
${truncate(args.content)}

Respond with JSON matching this schema:
{
  "summary": "",
  "key_terms": [{"term": "string", "definition": "string"}]
}`,
  };
}
