import {
  CLOUD_API_BASE_URL,
  type FlashcardsResponse,
  type QuizResponse,
  type StudyPlanResponse,
  type SummaryResponse,
} from "@studynest/shared";

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${CLOUD_API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

export const ai = {
  summarize: (b: { note_id: string; title: string; content: string }) =>
    call<SummaryResponse>("/ai/summarize", b),
  flashcards: (b: { note_id: string; title: string; content: string; count?: number }) =>
    call<FlashcardsResponse>("/ai/flashcards", { count: 8, ...b }),
  quiz: (b: { note_id: string; title: string; content: string; count?: number }) =>
    call<QuizResponse>("/ai/quiz", { count: 5, ...b }),
  studyPlan: (b: {
    goal: string;
    exam_date?: string | null;
    notes: Array<{ id: string; title: string; summary?: string | null }>;
    days_available?: number;
  }) => call<StudyPlanResponse>("/ai/study-plan", b),
};
