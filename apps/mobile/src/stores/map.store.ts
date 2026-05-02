import { create } from "zustand";

export type MapFilter = "hazards" | "elevators" | "entrances" | "restrooms" | "routes";

export type MapState = {
  selectedBuildingId: string | null;
  selectedFloorId: string | null;
  selectedIndoorPointId: string | null;
  activeFilters: Set<MapFilter>;
  toggleFilter: (f: MapFilter) => void;
  selectBuilding: (id: string | null) => void;
  selectFloor: (id: string | null) => void;
  selectIndoorPoint: (id: string | null) => void;
};

export const useMapStore = create<MapState>((set) => ({
  selectedBuildingId: null,
  selectedFloorId: null,
  selectedIndoorPointId: null,
  activeFilters: new Set<MapFilter>(["hazards"]),
  toggleFilter: (f) =>
    set((s) => {
      const next = new Set(s.activeFilters);
      next.has(f) ? next.delete(f) : next.add(f);
      return { activeFilters: next };
    }),
  selectBuilding: (id) => set({ selectedBuildingId: id, selectedIndoorPointId: null }),
  selectFloor: (id) => set({ selectedFloorId: id, selectedIndoorPointId: null }),
  selectIndoorPoint: (id) => set({ selectedIndoorPointId: id }),
}));
