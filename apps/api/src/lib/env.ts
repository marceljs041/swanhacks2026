import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

/**
 * `import "dotenv/config"` only reads `.env` from `process.cwd()`. When you run
 * `pnpm dev:api`, cwd is `apps/api`, so a monorepo-root `.env` is ignored.
 * Load root first, then `apps/api/.env` so local overrides still work.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, "../..");
const repoRoot = path.join(__dirname, "../../../..");

for (const p of [
  path.join(repoRoot, ".env"),
  path.join(repoRoot, ".env.local"),
  path.join(apiRoot, ".env"),
  path.join(apiRoot, ".env.local"),
]) {
  dotenv.config({ path: p, override: true });
}

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
