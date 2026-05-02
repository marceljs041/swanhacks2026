export type CommandIntent =
  | { kind: "find"; target: "elevator" | "restroom" | "entrance" | "stairs" }
  | { kind: "route"; to?: string | null }
  | { kind: "report" }
  | { kind: "read_directions" }
  | { kind: "unknown" };

const KEYWORDS = {
  elevator: ["elevator", "ascensor", "lift", "مصعد", "电梯"],
  restroom: ["restroom", "bathroom", "baño", "toilet", "washroom", "حمام", "洗手间"],
  entrance: ["entrance", "entry", "door", "entrada", "مدخل", "入口"],
  stairs: ["stairs", "stair", "escalera", "درج", "楼梯"],
  route: ["route", "directions", "navigate", "ruta", "مسار", "路线", "how do i get"],
  report: ["report", "hazard", "reportar", "peligro", "خطر", "危险"],
  read: ["read", "speak", "say", "leer", "اقرأ", "朗读"],
};

function hasAny(msg: string, words: string[]): boolean {
  return words.some((w) => msg.includes(w));
}

export function routeCommand(input: string): CommandIntent {
  const msg = input.toLowerCase().trim();
  if (!msg) return { kind: "unknown" };

  if (hasAny(msg, KEYWORDS.read) && (hasAny(msg, KEYWORDS.route) || msg.includes("direction"))) {
    return { kind: "read_directions" };
  }
  if (hasAny(msg, KEYWORDS.report)) return { kind: "report" };
  if (hasAny(msg, KEYWORDS.elevator)) return { kind: "find", target: "elevator" };
  if (hasAny(msg, KEYWORDS.restroom)) return { kind: "find", target: "restroom" };
  if (hasAny(msg, KEYWORDS.entrance)) return { kind: "find", target: "entrance" };
  if (hasAny(msg, KEYWORDS.stairs)) return { kind: "find", target: "stairs" };
  if (hasAny(msg, KEYWORDS.route)) {
    // Try to extract "to X"
    const m = msg.match(/to ([\w\s-]+)/);
    return { kind: "route", to: m?.[1]?.trim() ?? null };
  }
  return { kind: "unknown" };
}
