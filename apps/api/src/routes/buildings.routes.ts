import { Hono } from "hono";
import { buildings, getBuildingById, getIndoorMap } from "@cyaccess/campus-data";

const app = new Hono();

app.get("/", (c) => c.json({ buildings }));

app.get("/:buildingId", (c) => {
  const building = getBuildingById(c.req.param("buildingId"));
  if (!building) return c.json({ error: "Building not found" }, 404);
  const indoor = getIndoorMap(building.id);
  return c.json({ building, indoor: indoor ?? null });
});

app.get("/:buildingId/floors/:floorId", (c) => {
  const { buildingId, floorId } = c.req.param();
  const indoor = getIndoorMap(buildingId);
  if (!indoor) return c.json({ error: "Indoor map not available" }, 404);
  const floor = indoor.floors[floorId];
  if (!floor) return c.json({ error: "Floor not found" }, 404);
  return c.json({ buildingId, floorId, floor });
});

export default app;
