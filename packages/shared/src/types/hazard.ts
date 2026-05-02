export type HazardType =
  | "blocked_path"
  | "broken_elevator"
  | "broken_door_button"
  | "icy_sidewalk"
  | "construction"
  | "wet_floor"
  | "poor_lighting"
  | "crowded_area"
  | "other";

export type HazardSeverity = "low" | "medium" | "high" | "critical";

export type HazardStatus = "active" | "pending_resolved" | "resolved";

export type HazardVote = "still_there" | "resolved";

export type Hazard = {
  id: string;
  buildingId?: string | null;
  floorId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  indoorX?: number | null;
  indoorY?: number | null;
  type: HazardType;
  severity: HazardSeverity;
  description?: string | null;
  imageUrl?: string | null;
  aiConfidence?: number | null;
  status: HazardStatus;
  createdAt: string;
  resolvedAt?: string | null;
};

export type CreateHazardInput = {
  buildingId?: string | null;
  floorId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  indoorX?: number | null;
  indoorY?: number | null;
  type: HazardType;
  severity: HazardSeverity;
  description?: string | null;
  imageUrl?: string | null;
  aiConfidence?: number | null;
};

export type AiHazardSuggestion = {
  type: HazardType;
  severity: HazardSeverity;
  confidence: number;
  suggestedDescription: string;
};
