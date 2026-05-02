import OpenAI from "openai";
import { env } from "./env";

export const openai = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;

export function requireOpenAI(): OpenAI {
  if (!openai) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY.");
  }
  return openai;
}
