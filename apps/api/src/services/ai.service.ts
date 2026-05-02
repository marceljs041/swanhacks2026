import type { AiHazardSuggestion, SupportedLanguage } from "@cyaccess/shared";
import { HAZARD_SEVERITIES, HAZARD_TYPES } from "@cyaccess/shared";
import { requireOpenAI } from "../lib/openai";
import { env } from "../lib/env";

const HAZARD_SYSTEM_PROMPT = `You are Cy, an accessibility-aware campus assistant for Iowa State.
Given a photo of a potential campus accessibility hazard, classify it.

Return JSON matching exactly this schema:
{
  "type": one of ${HAZARD_TYPES.map((t) => `"${t}"`).join(", ")},
  "severity": one of ${HAZARD_SEVERITIES.map((s) => `"${s}"`).join(", ")},
  "confidence": number between 0 and 1,
  "suggestedDescription": 1-2 short sentences describing what you see in neutral language
}

Rules:
- If the image is unclear, default type="other", severity="medium", confidence<=0.4.
- Never invent personal details about people visible.
- Prefer "blocked_path" when aisles/walkways are obstructed.
- Prefer "construction" for orange cones/barrels/equipment.
- Prefer "wet_floor" for visible liquid or caution signs.
- Prefer "icy_sidewalk" for snow/ice outdoors.`;

export async function classifyHazardImage(input: {
  imageUrl: string;
  buildingId?: string | null;
  floorId?: string | null;
}): Promise<AiHazardSuggestion> {
  const client = requireOpenAI();
  const contextLine = [
    input.buildingId ? `Building: ${input.buildingId}` : null,
    input.floorId ? `Floor: ${input.floorId}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: HAZARD_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: contextLine || "No additional context." },
          { type: "image_url", image_url: { url: input.imageUrl } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<AiHazardSuggestion>;
  return {
    type: (HAZARD_TYPES as readonly string[]).includes(parsed.type ?? "")
      ? (parsed.type as AiHazardSuggestion["type"])
      : "other",
    severity: (HAZARD_SEVERITIES as readonly string[]).includes(parsed.severity ?? "")
      ? (parsed.severity as AiHazardSuggestion["severity"])
      : "medium",
    confidence: clamp01(parsed.confidence ?? 0.5),
    suggestedDescription:
      parsed.suggestedDescription ?? "A possible accessibility issue was detected.",
  };
}

const BOARD_SYSTEM_PROMPT = `You extract text from classroom whiteboards/chalkboards.
Return JSON: { "text": string, "language": ISO code, "confidence": 0..1 }.
- Preserve line breaks.
- Clean obvious typos but never invent content.
- If unreadable, return empty text with confidence < 0.3.`;

export type BoardExtraction = { text: string; language: string; confidence: number };

export async function extractBoardText(imageUrl: string): Promise<BoardExtraction> {
  const client = requireOpenAI();
  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: BOARD_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract the board text." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });
  const raw = completion.choices[0]?.message.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<BoardExtraction>;
  return {
    text: parsed.text ?? "",
    language: parsed.language ?? "en",
    confidence: clamp01(parsed.confidence ?? 0.5),
  };
}

const COMPANION_SYSTEM_PROMPT = `You are Cy, a calm, concise accessibility companion for Iowa State students.
- Keep answers short (1-3 sentences).
- Never joke during safety/hazard flows.
- If the student asks for a route, mention elevator/accessible entrance when relevant.
- You can reference buildings listed in context; do not invent others.`;

export type CompanionMessage = { role: "user" | "assistant"; content: string };

export async function askCompanion(input: {
  language: SupportedLanguage;
  messages: CompanionMessage[];
  context?: string;
}): Promise<string> {
  const client = requireOpenAI();
  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: `${COMPANION_SYSTEM_PROMPT}\nRespond in language code: ${input.language}.\n${
          input.context ? `Context:\n${input.context}` : ""
        }`,
      },
      ...input.messages,
    ],
  });
  return completion.choices[0]?.message.content ?? "";
}

export async function translateText(input: {
  text: string;
  targetLanguage: SupportedLanguage;
}): Promise<string> {
  const client = requireOpenAI();
  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You translate text naturally. Preserve line breaks. Return only the translated text, no preface.",
      },
      {
        role: "user",
        content: `Translate the following to ${input.targetLanguage}:\n\n${input.text}`,
      },
    ],
  });
  return completion.choices[0]?.message.content ?? input.text;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
