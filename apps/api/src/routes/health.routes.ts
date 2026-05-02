import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) =>
  c.json({
    ok: true,
    service: "cyaccess-api",
    time: new Date().toISOString(),
  }),
);

export default app;
