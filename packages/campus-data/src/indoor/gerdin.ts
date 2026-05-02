import type { IndoorMap } from "@cyaccess/shared";

export const gerdinMap: IndoorMap = {
  buildingId: "gerdin",
  floors: {
    "1": {
      name: "Floor 1",
      width: 100,
      height: 100,
      rooms: [
        { id: "gerdin-entrance", label: "Main Entrance", type: "entrance", x: 50, y: 92, accessible: true },
        { id: "gerdin-elevator", label: "Elevator", type: "elevator", x: 52, y: 50, accessible: true },
        { id: "gerdin-stairs", label: "Central Stairs", type: "stairs", x: 42, y: 50, accessible: false },
        { id: "gerdin-restroom", label: "Accessible Restroom", type: "restroom", x: 72, y: 40, accessible: true },
        { id: "gerdin-study", label: "Student Lounge", type: "study", x: 25, y: 30, accessible: true },
        { id: "gerdin-help", label: "Info Desk", type: "help_desk", x: 50, y: 72, accessible: true },
        { id: "gerdin-room-1020", label: "Room 1020", type: "room", x: 80, y: 70, accessible: true }
      ],
      paths: [
        {
          id: "gerdin-entrance-elevator",
          accessible: true,
          points: [
            { x: 50, y: 92 },
            { x: 50, y: 72 },
            { x: 52, y: 50 }
          ]
        }
      ]
    }
  }
};
