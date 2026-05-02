import type { LatLng } from "./building";

export type RouteSegment = {
  instruction: string;
  distanceMeters?: number;
  durationSeconds?: number;
};

export type OutdoorRoute = {
  id: string;
  from: string;
  to: string;
  accessible: boolean;
  coords: LatLng[];
  segments: RouteSegment[];
};
