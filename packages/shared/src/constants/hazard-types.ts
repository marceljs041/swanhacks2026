import type { HazardSeverity, HazardType } from "../types/hazard";

export const HAZARD_TYPES: readonly HazardType[] = [
  "blocked_path",
  "broken_elevator",
  "broken_door_button",
  "icy_sidewalk",
  "construction",
  "wet_floor",
  "poor_lighting",
  "crowded_area",
  "other",
] as const;

export const HAZARD_SEVERITIES: readonly HazardSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const HAZARD_TYPE_LABEL_KEYS: Record<HazardType, string> = {
  blocked_path: "hazard.types.blocked_path",
  broken_elevator: "hazard.types.broken_elevator",
  broken_door_button: "hazard.types.broken_door_button",
  icy_sidewalk: "hazard.types.icy_sidewalk",
  construction: "hazard.types.construction",
  wet_floor: "hazard.types.wet_floor",
  poor_lighting: "hazard.types.poor_lighting",
  crowded_area: "hazard.types.crowded_area",
  other: "hazard.types.other",
};

export const HAZARD_TYPE_ICONS: Record<HazardType, string> = {
  blocked_path: "ban",
  broken_elevator: "arrow-up-down",
  broken_door_button: "door-open",
  icy_sidewalk: "snowflake",
  construction: "hard-hat",
  wet_floor: "droplets",
  poor_lighting: "lightbulb-off",
  crowded_area: "users",
  other: "triangle-alert",
};

export const SEVERITY_COLOR: Record<HazardSeverity, string> = {
  low: "#F59E0B",
  medium: "#F59E0B",
  high: "#EA580C",
  critical: "#DC2626",
};
