export type LatLng = {
  latitude: number;
  longitude: number;
};

export type Building = {
  id: string;
  name: string;
  shortName: string;
  center: LatLng;
  polygon: LatLng[];
  hasIndoorMap: boolean;
  floors: string[];
  badges: string[];
  accessibilityScore?: number;
};
