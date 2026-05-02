export type IndoorPointType =
  | "entrance"
  | "elevator"
  | "stairs"
  | "restroom"
  | "room"
  | "study"
  | "help_desk"
  | "hazard";

export type IndoorPoint = {
  id: string;
  label: string;
  type: IndoorPointType;
  x: number;
  y: number;
  accessible: boolean;
};

export type IndoorPath = {
  id: string;
  points: { x: number; y: number }[];
  accessible: boolean;
};

export type IndoorFloor = {
  name: string;
  width: number;
  height: number;
  rooms: IndoorPoint[];
  paths: IndoorPath[];
};

export type IndoorMap = {
  buildingId: string;
  floors: Record<string, IndoorFloor>;
};
