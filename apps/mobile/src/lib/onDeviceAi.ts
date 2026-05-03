/**
 * On-device inference for Gemma 4 E4B–class workloads.
 *
 * Production path: plug a native LiteRT / MediaPipe module that exposes
 * `NativeModules.StudyNestGemma.complete(prompt)` returning model text.
 * This Expo 51 build ships a deterministic local engine so the app stays
 * fully offline without a dev client.
 */
import { NativeModules } from "react-native";
import type {
  StudyPlanRequest,
  StudyPlanResponse,
  SummaryResponse,
} from "@studynest/shared";

export type GemmaRuntime = "native-gemma-4-e4b" | "embedded-fallback";

export interface GemmaStatus {
  runtime: GemmaRuntime;
  label: string;
  ready: boolean;
}

const MODEL_LABEL = "Gemma 4 E4B (on-device)";

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text: string, max = 6): string[] {
  const t = stripMarkdown(text);
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, max);
}

function bulletTerms(md: string): Array<{ term: string; definition: string }> {
  const lines = md.split(/\r?\n/);
  const out: Array<{ term: string; definition: string }> = [];
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s*(.+)$/);
    if (!m) continue;
    const raw = m[1]!.trim();
    const colon = raw.indexOf(":");
    if (colon > 0) {
      out.push({
        term: raw.slice(0, colon).trim(),
        definition: raw.slice(colon + 1).trim(),
      });
    } else if (raw.length > 2) {
      out.push({ term: raw.slice(0, 48), definition: raw });
    }
    if (out.length >= 8) break;
  }
  return out;
}

async function nativeComplete(prompt: string): Promise<string | null> {
  const mod =
    (NativeModules as Record<string, { complete?: (p: string) => Promise<string> }>)
      .StudyNestGemma;
  if (mod?.complete) {
    try {
      const text = await mod.complete(prompt);
      if (text && typeof text === "string") return text;
    } catch {
      return null;
    }
  }
  return null;
}

export function getGemmaStatus(): GemmaStatus {
  const mod = (NativeModules as Record<string, unknown>).StudyNestGemma;
  if (mod && typeof (mod as { complete?: unknown }).complete === "function") {
    return { runtime: "native-gemma-4-e4b", label: MODEL_LABEL, ready: true };
  }
  return {
    runtime: "embedded-fallback",
    label: `${MODEL_LABEL} · embedded engine`,
    ready: true,
  };
}

export async function summarizeNote(input: {
  title: string;
  content: string;
}): Promise<SummaryResponse> {
  const nativePrompt = `Summarize this study note in JSON with keys summary (string) and key_terms (array of {term, definition}).\nTitle: ${input.title}\n\n${input.content.slice(0, 8000)}`;
  const raw = await nativeComplete(nativePrompt);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SummaryResponse;
      if (parsed.summary) return parsed;
    } catch {
      /* fall through */
    }
  }
  const sents = sentences(input.content, 4);
  const summary =
    sents.length > 0
      ? sents.join(" ")
      : stripMarkdown(input.content).slice(0, 280) || `Key ideas from “${input.title}”.`;
  const key_terms = bulletTerms(input.content);
  return { summary, key_terms };
}

function addHours(base: Date, h: number): string {
  const d = new Date(base);
  d.setHours(d.getHours() + h, d.getMinutes(), 0, 0);
  return d.toISOString();
}

export async function gamifiedStudyPlan(req: StudyPlanRequest): Promise<StudyPlanResponse> {
  const nativePrompt = `You output JSON only: {"tasks":[{"title","scheduled_for":"ISO","duration_minutes",type one of review flashcards quiz read write practice,"note_id"}]}\nGoal: ${req.goal}\nExam: ${req.exam_date ?? "none"}\nNotes: ${JSON.stringify(req.notes).slice(0, 6000)}`;
  const raw = await nativeComplete(nativePrompt);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StudyPlanResponse;
      if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) return parsed;
    } catch {
      /* fall through */
    }
  }

  const notes = req.notes.filter((n) => n.id);
  if (notes.length === 0) {
    return {
      tasks: [
        {
          title: "🎯 Create your first note, then regenerate this plan",
          scheduled_for: addHours(new Date(), 1),
          duration_minutes: 15,
          type: "write",
          note_id: null,
        },
      ],
    };
  }

  const goal = req.goal.trim() || "Master your material";
  let days = req.days_available ?? 7;
  days = Math.min(14, Math.max(3, days));
  const today = new Date();
  today.setHours(9, 0, 0, 0);

  const types: StudyPlanResponse["tasks"][number]["type"][] = [
    "read",
    "review",
    "flashcards",
    "quiz",
    "practice",
    "write",
  ];
  const quests: StudyPlanResponse["tasks"] = [];
  const tierXp = ["⭐", "⭐⭐", "🔥"];

  for (let d = 0; d < days; d++) {
    const dayBase = new Date(today);
    dayBase.setDate(today.getDate() + d);
    const note = notes[d % notes.length]!;
    const tier = tierXp[Math.min(2, Math.floor(d / 4))]!;
    const isBoss = d === days - 1;

    const slots = isBoss
      ? [
          { h: 0, type: "review" as const, label: `Boss review · ${goal}` },
          { h: 5, type: "quiz" as const, label: `Timed check · ${note.title}` },
        ]
      : [
          { h: 0, type: "read" as const, label: `Quest · Skim ${note.title}` },
          { h: 4, type: "review" as const, label: `Quest · Active recall · ${note.title}` },
          { h: 9, type: types[(d + 2) % types.length]!, label: `Side quest · Apply “${goal.slice(0, 40)}”` },
        ];

    for (const slot of slots) {
      quests.push({
        title: `${tier} ${slot.label}`,
        scheduled_for: addHours(dayBase, slot.h),
        duration_minutes: isBoss ? 35 : 20 + (d % 3) * 5,
        type: slot.type,
        note_id: note.id,
      });
    }
  }

  return { tasks: quests };
}
