import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8787),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().optional(),

  SUPABASE_HAZARD_BUCKET: z.string().default("hazard-images"),
  SUPABASE_BOARD_BUCKET: z.string().default("board-images"),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o"),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("whisper-1"),

  ALLOWED_ORIGINS: z.string().default("*"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid env:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid env. See .env.example.");
}

export const env = parsed.data;

export const allowedOrigins =
  env.ALLOWED_ORIGINS === "*"
    ? ["*"]
    : env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
