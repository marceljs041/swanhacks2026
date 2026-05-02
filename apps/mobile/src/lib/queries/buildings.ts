import { useQuery } from "@tanstack/react-query";
import type { Building, IndoorFloor, IndoorMap } from "@cyaccess/shared";
import { buildings as localBuildings, getIndoorMap } from "@cyaccess/campus-data";
import { apiFetch } from "../api";

type BuildingsResp = { buildings: Building[] };
type BuildingResp = { building: Building; indoor: IndoorMap | null };

export function useBuildings() {
  return useQuery({
    queryKey: ["buildings"],
    queryFn: async () => {
      try {
        return await apiFetch<BuildingsResp>("/buildings");
      } catch {
        // Offline / API down — fall back to bundled campus data.
        return { buildings: localBuildings };
      }
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useBuilding(id: string | null) {
  return useQuery({
    enabled: !!id,
    queryKey: ["building", id],
    queryFn: async () => {
      try {
        return await apiFetch<BuildingResp>(`/buildings/${id}`);
      } catch {
        const fallback = localBuildings.find((b) => b.id === id);
        if (!fallback) throw new Error("Building not found");
        return { building: fallback, indoor: getIndoorMap(fallback.id) ?? null };
      }
    },
  });
}

export function useIndoorFloor(buildingId: string | null, floorId: string | null) {
  return useQuery({
    enabled: !!buildingId && !!floorId,
    queryKey: ["floor", buildingId, floorId],
    queryFn: async (): Promise<{ floor: IndoorFloor } | null> => {
      try {
        return await apiFetch<{ floor: IndoorFloor }>(
          `/buildings/${buildingId}/floors/${floorId}`,
        );
      } catch {
        const indoor = buildingId ? getIndoorMap(buildingId) : undefined;
        const floor = indoor?.floors[floorId!];
        return floor ? { floor } : null;
      }
    },
  });
}
