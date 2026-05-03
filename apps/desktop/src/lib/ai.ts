import {
  LOCAL_AI_BASE_URL,
  type AskMessage,
  type AskNoteSummary,
  type AskResponse,
  type ClassOverviewRequest,
  type ClassOverviewResponse,
  type FlashcardsResponse,
  type QuizResponse,
  type StudyPlanResponse,
  type SummaryResponse,
} from "@studynest/shared";

let _localBase: string | null = null;

async function localBase(): Promise<string> {
  if (_localBase) return _localBase;
  if (typeof window !== "undefined" && window.studynest?.sidecarBaseUrl) {
    _localBase = await window.studynest.sidecarBaseUrl();
    return _localBase;
  }
  _localBase = LOCAL_AI_BASE_URL;
  return _localBase;
}

/** Desktop uses only the bundled local assistant — no remote AI fallback. */
async function localOnly<T>(path: string, body: unknown): Promise<T> {
  const base = await localBase();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`local ${path} ${res.status}`);
  return (await res.json()) as T;
}

export const ai = {
  async summarize(args: { note_id: string; title: string; content: string }) {
    return localOnly<SummaryResponse>("/local-ai/summarize", args);
  },
  async flashcards(args: {
    note_id: string;
    title: string;
    content: string;
    count?: number;
  }) {
    return localOnly<FlashcardsResponse>("/local-ai/flashcards", {
      count: 8,
      ...args,
    });
  },
  async quiz(args: {
    note_id: string;
    title: string;
    content: string;
    count?: number;
    /** Restricts question types — server may ignore unknown values. */
    types?: Array<"multiple_choice" | "true_false" | "short_answer">;
  }) {
    return localOnly<QuizResponse>("/local-ai/quiz", { count: 5, ...args });
  },
  async studyPlan(args: {
    goal: string;
    exam_date?: string | null;
    notes: Array<{ id: string; title: string; summary?: string | null }>;
    days_available?: number;
  }) {
    return localOnly<StudyPlanResponse>("/local-ai/study-plan", args);
  },
  async simpleExplain(args: { note_id: string; title: string; content: string }) {
    return localOnly<SummaryResponse>("/local-ai/simple-explain", args);
  },
  async ask(args: {
    class_name: string;
    class_subtitle?: string | null;
    recent_notes: AskNoteSummary[];
    weak_topics: string[];
    history: AskMessage[];
    question: string;
  }) {
    return localOnly<AskResponse>("/local-ai/ask", args);
  },
  async classOverview(args: ClassOverviewRequest) {
    return localOnly<ClassOverviewResponse>("/local-ai/class-overview", args);
  },
};
