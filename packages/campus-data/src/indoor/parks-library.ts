import type { IndoorMap } from "@cyaccess/shared";

export const parksLibraryMap: IndoorMap = {
  buildingId: "parks-library",
  floors: {
    "1": {
      name: "Floor 1",
      width: 100,
      height: 100,
      rooms: [
        { id: "main-entrance", label: "Accessible Entrance", type: "entrance", x: 12, y: 88, accessible: true },
        { id: "south-entrance", label: "South Entrance", type: "entrance", x: 52, y: 95, accessible: false },
        { id: "help-desk", label: "Help Desk", type: "help_desk", x: 30, y: 70, accessible: true },
        { id: "elevator-a", label: "Elevator A", type: "elevator", x: 45, y: 52, accessible: true },
        { id: "stairs-a", label: "North Stairs", type: "stairs", x: 55, y: 52, accessible: false },
        { id: "restroom-a", label: "Accessible Restroom", type: "restroom", x: 67, y: 48, accessible: true },
        { id: "study-a", label: "Quiet Study", type: "study", x: 20, y: 30, accessible: true },
        { id: "study-b", label: "Group Study", type: "study", x: 80, y: 28, accessible: true },
        { id: "room-101", label: "Room 101", type: "room", x: 75, y: 70, accessible: true },
        { id: "room-105", label: "Room 105", type: "room", x: 85, y: 80, accessible: true }
      ],
      paths: [
        {
          id: "path-entrance-elevator-accessible",
          accessible: true,
          points: [
            { x: 12, y: 88 },
            { x: 25, y: 75 },
            { x: 35, y: 62 },
            { x: 45, y: 52 }
          ]
        },
        {
          id: "path-entrance-restroom-accessible",
          accessible: true,
          points: [
            { x: 12, y: 88 },
            { x: 30, y: 70 },
            { x: 50, y: 58 },
            { x: 67, y: 48 }
          ]
        },
        {
          id: "path-entrance-stairs",
          accessible: false,
          points: [
            { x: 12, y: 88 },
            { x: 35, y: 65 },
            { x: 55, y: 52 }
          ]
        }
      ]
    },
    "2": {
      name: "Floor 2",
      width: 100,
      height: 100,
      rooms: [
        { id: "elevator-a-2", label: "Elevator A", type: "elevator", x: 45, y: 52, accessible: true },
        { id: "stairs-a-2", label: "North Stairs", type: "stairs", x: 55, y: 52, accessible: false },
        { id: "restroom-b", label: "Accessible Restroom", type: "restroom", x: 67, y: 48, accessible: true },
        { id: "study-c", label: "Quiet Study Loft", type: "study", x: 22, y: 32, accessible: true },
        { id: "room-201", label: "Room 201", type: "room", x: 75, y: 72, accessible: true },
        { id: "room-210", label: "Room 210", type: "room", x: 18, y: 70, accessible: true },
        { id: "room-225", label: "Room 225", type: "room", x: 85, y: 25, accessible: true }
      ],
      paths: [
        {
          id: "path-elevator-restroom-2",
          accessible: true,
          points: [
            { x: 45, y: 52 },
            { x: 56, y: 50 },
            { x: 67, y: 48 }
          ]
        },
        {
          id: "path-elevator-room201",
          accessible: true,
          points: [
            { x: 45, y: 52 },
            { x: 60, y: 62 },
            { x: 75, y: 72 }
          ]
        }
      ]
    }
  }
};
