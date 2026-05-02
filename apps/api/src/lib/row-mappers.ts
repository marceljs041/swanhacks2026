import type { Hazard } from "@cyaccess/shared";

export type HazardRow = {
  id: string;
  building_id: string | null;
  floor_id: string | null;
  latitude: number | null;
  longitude: number | null;
  indoor_x: number | null;
  indoor_y: number | null;
  type: Hazard["type"];
  severity: Hazard["severity"];
  description: string | null;
  image_url: string | null;
  ai_confidence: number | null;
  status: Hazard["status"];
  created_by_device_id: string;
  created_at: string;
  resolved_at: string | null;
};

export function hazardFromRow(row: HazardRow): Hazard {
  return {
    id: row.id,
    buildingId: row.building_id,
    floorId: row.floor_id,
    latitude: row.latitude,
    longitude: row.longitude,
    indoorX: row.indoor_x,
    indoorY: row.indoor_y,
    type: row.type,
    severity: row.severity,
    description: row.description,
    imageUrl: row.image_url,
    aiConfidence: row.ai_confidence,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}
