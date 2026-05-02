import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { SUPPORTED_LANGUAGE_CODES, type SupportedLanguage } from "@cyaccess/shared";
import { deviceAuth, type DeviceContext } from "../middleware/device-auth";
import { rateLimit } from "../middleware/rate-limit";
import {
  askCompanion,
  classifyHazardImage,
  extractBoardText,
  translateText,
} from "../services/ai.service";
import { createSignedUpload } from "../services/storage.service";

const app = new Hono<DeviceContext>();

const classifyBody = z.object({
  imageUrl: z.string().url(),
  buildingId: z.string().nullable().optional(),
  floorId: z.string().nullable().optional(),
});

app.post(
  "/classify-hazard",
  deviceAuth,
  rateLimit({ action: "ai_classify", max: 20, windowSeconds: 60 * 15 }),
  zValidator("json", classifyBody),
  async (c) => {
    const body = c.req.valid("json");
    const suggestion = await classifyHazardImage(body);
    return c.json({ suggestion });
  },
);

const extractBody = z.object({ imageUrl: z.string().url() });

app.post(
  "/extract-board-text",
  deviceAuth,
  rateLimit({ action: "ai_board", max: 15, windowSeconds: 60 * 15 }),
  zValidator("json", extractBody),
  async (c) => {
    const body = c.req.valid("json");
    const result = await extractBoardText(body.imageUrl);
    return c.json({ result });
  },
);

const languageEnum = z.enum(SUPPORTED_LANGUAGE_CODES as [SupportedLanguage, ...SupportedLanguage[]]);

const companionBody = z.object({
  language: languageEnum,
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
  context: z.string().max(4000).optional(),
});

app.post(
  "/companion",
  deviceAuth,
  rateLimit({ action: "ai_companion", max: 60, windowSeconds: 60 * 15 }),
  zValidator("json", companionBody),
  async (c) => {
    const body = c.req.valid("json");
    const reply = await askCompanion(body);
    return c.json({ reply });
  },
);

const translateBody = z.object({
  text: z.string().min(1).max(8000),
  targetLanguage: languageEnum,
});

app.post(
  "/translate",
  deviceAuth,
  rateLimit({ action: "ai_translate", max: 40, windowSeconds: 60 * 15 }),
  zValidator("json", translateBody),
  async (c) => {
    const body = c.req.valid("json");
    const translated = await translateText(body);
    return c.json({ translated });
  },
);

app.post(
  "/board-uploads",
  deviceAuth,
  rateLimit({ action: "board_upload", max: 20, windowSeconds: 60 * 15 }),
  async (c) => {
    const upload = await createSignedUpload("board", c.get("deviceId"));
    return c.json(upload);
  },
);

export default app;
