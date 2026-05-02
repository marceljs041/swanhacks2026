export const darkTheme = {
  bg: "#0F1117",
  panel: "#171A21",
  panelSoft: "#1F2430",
  border: "#2A2F3A",
  text: "#F5F7FA",
  muted: "#9CA3AF",
  accent: "#8B5CF6",
  accentSoft: "#5B21B6",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
} as const;

export const lightTheme = {
  bg: "#FAFAF7",
  panel: "#FFFFFF",
  panelSoft: "#F3F4F6",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  accent: "#7C3AED",
  accentSoft: "#C4B5FD",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
} as const;

export type Theme = typeof darkTheme;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: "700" as const, lineHeight: 34 },
  h1: { fontSize: 22, fontWeight: "700" as const, lineHeight: 28 },
  h2: { fontSize: 18, fontWeight: "600" as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: "500" as const, lineHeight: 16 },
};
