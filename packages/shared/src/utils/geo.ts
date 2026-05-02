import type { LatLng } from "../types/building";

export const ISU_CENTER: LatLng = {
  latitude: 42.0266,
  longitude: -93.6465,
};

/** Haversine distance in meters between two lat/lngs. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function polygonCentroid(polygon: LatLng[]): LatLng {
  if (polygon.length === 0) return { latitude: 0, longitude: 0 };
  let lat = 0;
  let lng = 0;
  for (const p of polygon) {
    lat += p.latitude;
    lng += p.longitude;
  }
  return { latitude: lat / polygon.length, longitude: lng / polygon.length };
}
