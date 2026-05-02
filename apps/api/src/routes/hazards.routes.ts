import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HAZARD_SEVERITIES, HAZARD_TYPES } from "@cyaccess/shared";
import { deviceAuth, type DeviceContext } from "../middleware/device-auth";
import { rateLimit } from "../middleware/rate-limit";
import {
  createHazard,
  getHazard,
  listHazards,
  resolveHazard,
  voteHazard,
} from "../services/hazards.service";
import { createSignedUpload } from "../services/storage.service";

const app = new Hono<DeviceContext>();

const listQuery = z.object({
  buildingId: z.string().optional(),
  floorId: z.string().optional(),
  includeResolved: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
});

app.get("/", zValidator("query", listQuery), async (c) => {
  const q = c.req.valid("query");
  const hazards = await listHazards(q);
  return c.json({ hazards });
});

app.get("/:hazardId", async (c) => {
  const hazard = await getHazard(c.req.param("hazardId"));
  if (!hazard) return c.json({ error: "Hazard not found" }, 404);
  return c.json({ hazard });
});

const createBody = z.object({
  buildingId: z.string().nullable().optional(),
  floorId: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  indoorX: z.number().min(0).max(100).nullable().optional(),
  indoorY: z.number().min(0).max(100).nullable().optional(),
  type: z.enum(HAZARD_TYPES as unknown as [string, ...string[]]),
  severity: z.enum(HAZARD_SEVERITIES as unknown as [string, ...string[]]),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  aiConfidence: z.number().min(0).max(1).nullable().optional(),
});

app.post(
  "/",
  deviceAuth,
  rateLimit({ action: "hazard_create", max: 10, windowSeconds: 60 * 15 }),
  zValidator("json", createBody),
  async (c) => {
    const body = c.req.valid("json");
    const hazard = await createHazard(c.get("deviceId"), {
      ...body,
      type: body.type as (typeof HAZARD_TYPES)[number],
      severity: body.severity as (typeof HAZARD_SEVERITIES)[number],
    });
    return c.json({ hazard }, 201);
  },
);

app.patch(
  "/:hazardId/resolve",
  deviceAuth,
  rateLimit({ action: "hazard_resolve", max: 30, windowSeconds: 60 * 15 }),
  async (c) => {
    const hazard = await resolveHazard(c.req.param("hazardId"));
    return c.json({ hazard });
  },
);

const voteBody = z.object({ vote: z.enum(["still_there", "resolved"]) });

app.post(
  "/:hazardId/vote",
  deviceAuth,
  rateLimit({ action: "hazard_vote", max: 60, windowSeconds: 60 * 15 }),
  zValidator("json", voteBody),
  async (c) => {
    const hazard = await voteHazard(
      c.req.param("hazardId"),
      c.get("deviceId"),
      c.req.valid("json").vote,
    );
    return c.json({ hazard });
  },
);

// Image upload helper — returns a signed URL the client can PUT to.
app.post(
  "/uploads",
  deviceAuth,
  rateLimit({ action: "hazard_upload", max: 20, windowSeconds: 60 * 15 }),
  async (c) => {
    const upload = await createSignedUpload("hazard", c.get("deviceId"));
    return c.json(upload);
  },
);

export default app;
