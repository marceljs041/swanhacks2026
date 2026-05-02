import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { allowedOrigins, env } from "./lib/env";
import health from "./routes/health.routes";
import buildings from "./routes/buildings.routes";
import hazards from "./routes/hazards.routes";
import ai from "./routes/ai.routes";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (allowedOrigins.includes("*")) return origin ?? "*";
      if (origin && allowedOrigins.includes(origin)) return origin;
      return "";
    },
    allowHeaders: ["Content-Type", "Authorization", "x-device-id"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.route("/health", health);
app.route("/buildings", buildings);
app.route("/hazards", hazards);
app.route("/ai", ai);

app.onError((err, c) => {
  // eslint-disable-next-line no-console
  console.error(err);
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  return c.json({ error: err.message ?? "Internal error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" });
  // eslint-disable-next-line no-console
  console.log(`CyAccess API listening on http://0.0.0.0:${env.PORT}`);
}

export default app;
