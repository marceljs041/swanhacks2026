export const colors = {
  cardinal: "#C8102E",
  cycloneDark: "#3A0B12",
  cycloneRed: "#A71930",
  gold: "#F1BE48",
  warmGold: "#D6A329",
  cream: "#FFF8EA",
  offWhite: "#FAFAF7",
  slate: "#1F2937",
  muted: "#6B7280",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#2563EB",
} as const;

export type ColorName = keyof typeof colors;
