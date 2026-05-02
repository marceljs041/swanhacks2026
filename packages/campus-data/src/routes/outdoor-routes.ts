import type { OutdoorRoute } from "@cyaccess/shared";

export const outdoorRoutes: OutdoorRoute[] = [
  {
    id: "mu-to-parks",
    from: "memorial-union",
    to: "parks-library",
    accessible: true,
    coords: [
      { latitude: 42.02515, longitude: -93.64492 },
      { latitude: 42.02580, longitude: -93.64600 },
      { latitude: 42.02650, longitude: -93.64720 },
      { latitude: 42.02720, longitude: -93.64810 },
      { latitude: 42.02800, longitude: -93.64810 }
    ],
    segments: [
      { instruction: "Head north from Memorial Union plaza.", distanceMeters: 90 },
      { instruction: "Cross the central path — curb cuts available.", distanceMeters: 120 },
      { instruction: "Continue to Parks Library accessible entrance.", distanceMeters: 140 }
    ]
  },
  {
    id: "sic-to-parks",
    from: "student-innovation-center",
    to: "parks-library",
    accessible: true,
    coords: [
      { latitude: 42.0266, longitude: -93.6493 },
      { latitude: 42.0273, longitude: -93.6489 },
      { latitude: 42.0280, longitude: -93.6481 }
    ],
    segments: [
      { instruction: "Exit SIC east side and head north.", distanceMeters: 100 },
      { instruction: "Arrive at Parks Library accessible entrance.", distanceMeters: 60 }
    ]
  },
  {
    id: "gerdin-to-parks",
    from: "gerdin",
    to: "parks-library",
    accessible: true,
    coords: [
      { latitude: 42.02572, longitude: -93.64238 },
      { latitude: 42.02640, longitude: -93.64350 },
      { latitude: 42.02720, longitude: -93.64460 },
      { latitude: 42.02780, longitude: -93.64600 },
      { latitude: 42.02800, longitude: -93.64810 }
    ],
    segments: [
      { instruction: "Exit Gerdin and head west.", distanceMeters: 140 },
      { instruction: "Cross diagonally toward Parks Library.", distanceMeters: 220 }
    ]
  }
];
