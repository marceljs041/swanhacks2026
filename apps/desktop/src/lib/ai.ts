import {
  CLOUD_API_BASE_URL,
  LOCAL_AI_BASE_URL,
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

async function tryLocal<T>(path: string, body: unknown): Promise<T> {
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

async function tryCloud<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${CLOUD_API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`cloud ${path} ${res.status}`);
  return (await res.json()) as T;
}

async function preferLocal<T>(localPath: string, cloudPath: string, body: unknown): Promise<T> {
  try {
    return await tryLocal<T>(localPath, body);
  } catch {
    return await tryCloud<T>(cloudPath, body);
  }
}

export const ai = {
  async summarize(args: { note_id: string; title: string; content: string }) {
    return preferLocal<SummaryResponse>("/local-ai/summarize", "/ai/summarize", args);
  },
  async flashcards(args: {
    note_id: string;
    title: string;
    content: string;
    count?: number;
  }) {
    return preferLocal<FlashcardsResponse>("/local-ai/flashcards", "/ai/flashcards", {
      count: 8,
      ...args,
    });
  },
  async quiz(args: { note_id: string; title: string; content: string; count?: number }) {
    return preferLocal<QuizResponse>("/local-ai/quiz", "/ai/quiz", { count: 5, ...args });
  },
  async studyPlan(args: {
    goal: string;
    exam_date?: string | null;
    notes: Array<{ id: string; title: string; summary?: string | null }>;
    days_available?: number;
  }) {
    return preferLocal<StudyPlanResponse>("/local-ai/study-plan", "/ai/study-plan", args);
  },
  async simpleExplain(args: { note_id: string; title: string; content: string }) {
    return preferLocal<SummaryResponse>(
      "/local-ai/simple-explain",
      "/ai/explain-simple",
      args,
    );
  },
};
