import type { IndoorMap } from "@cyaccess/shared";
import { parksLibraryMap } from "./parks-library";
import { gerdinMap } from "./gerdin";

export const indoorMaps: Record<string, IndoorMap> = {
  "parks-library": parksLibraryMap,
  gerdin: gerdinMap,
};

export function getIndoorMap(buildingId: string): IndoorMap | undefined {
  return indoorMaps[buildingId];
}
