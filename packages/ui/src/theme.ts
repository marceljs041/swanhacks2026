/**
 * Design tokens for StudyNest / Note Goat.
 *
 * The app reads colours through CSS custom properties (`var(--color-...)`),
 * so adding a new theme is a matter of:
 *   1. defining a `Palette` (the same shape as `warmTheme`)
 *   2. registering it in `themes`
 *   3. calling `applyTheme(name)` from the renderer
 *
 * Components should NEVER hardcode hex values — always reach for a token.
 */

/** Every theme exposes the same set of semantic tokens. */
export interface Palette {
  // Surfaces
  bg: string;            // app background (behind everything)
  surface: string;       // cards, panels
  surfaceMuted: string;  // tinted card / soft pill background
  surfaceRaised: string; // popovers, hover states
  sidebar: string;       // left rail background
  sidebarItemHover: string;
  sidebarItemActive: string;
  sidebarItemActiveText: string;

  // Lines
  border: string;
  borderStrong: string;
  divider: string;

  // Text
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;

  // Brand / accents (the goat is friendly + warm)
  primary: string;       // main CTA (terracotta in warm, violet in dark/light)
  primarySoft: string;   // tinted primary background
  primaryStrong: string; // hover / pressed
  onPrimary: string;     // text on primary

  // Semantic state
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;

  // Category accents (used by quick action tiles, class chips, etc.)
  accentRose: string;     accentRoseSoft: string;
  accentAmber: string;    accentAmberSoft: string;
  accentSky: string;      accentSkySoft: string;
  accentSage: string;     accentSageSoft: string;
  accentLilac: string;    accentLilacSoft: string;
  accentPeach: string;    accentPeachSoft: string;

  // Effects
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  ring: string;          // focus ring
}

/* ------------------------------------------------------------------ */
/* Themes                                                             */
/* ------------------------------------------------------------------ */

/** Default — the warm "Note Goat" theme from the reference design. */
export const warmTheme: Palette = {
  bg: "#FBF5EC",
  surface: "#FFFFFF",
  surfaceMuted: "#F5EDE0",
  surfaceRaised: "#FFFCF6",
  sidebar: "#F4EBDC",
  sidebarItemHover: "#EBDFC9",
  sidebarItemActive: "#F8DFC8",
  sidebarItemActiveText: "#7A3E1F",

  border: "#ECDFC8",
  borderStrong: "#D9C7A8",
  divider: "#F1E6D2",

  text: "#2A2017",
  textMuted: "#7A6A57",
  textSubtle: "#A89880",
  textInverse: "#FFFFFF",

  primary: "#E08A5B",
  primarySoft: "#FBE3D2",
  primaryStrong: "#C66E3F",
  onPrimary: "#FFFFFF",

  success: "#5BA968",
  successSoft: "#E1F0DE",
  warning: "#E1A93B",
  warningSoft: "#FBEFD1",
  danger: "#D26257",
  dangerSoft: "#F7DBD6",
  info: "#5C8DC8",
  infoSoft: "#DEE8F4",

  accentRose:  "#D26257",  accentRoseSoft:  "#F8D9D4",
  accentAmber: "#D9A14B",  accentAmberSoft: "#FBEACA",
  accentSky:   "#5C8DC8",  accentSkySoft:   "#DCE7F2",
  accentSage:  "#7BAE7E",  accentSageSoft:  "#DDEDDA",
  accentLilac: "#9B7BC4",  accentLilacSoft: "#E5DCF1",
  accentPeach: "#E08A5B",  accentPeachSoft: "#FBE3D2",

  shadowSm: "0 1px 2px rgba(86, 56, 24, 0.06)",
  shadowMd: "0 4px 14px rgba(86, 56, 24, 0.08)",
  shadowLg: "0 12px 32px rgba(86, 56, 24, 0.12)",
  ring: "rgba(224, 138, 91, 0.35)",
};

/** Classic dark — kept for users who prefer night mode. */
export const darkTheme: Palette = {
  bg: "#0F1117",
  surface: "#171A21",
  surfaceMuted: "#1F2430",
  surfaceRaised: "#222836",
  sidebar: "#13161D",
  sidebarItemHover: "#1F2430",
  sidebarItemActive: "#2A1F4A",
  sidebarItemActiveText: "#E9DDFF",

  border: "#2A2F3A",
  borderStrong: "#3A4150",
  divider: "#23283336",

  text: "#F5F7FA",
  textMuted: "#9CA3AF",
  textSubtle: "#6B7280",
  textInverse: "#0F1117",

  primary: "#8B5CF6",
  primarySoft: "#2A1F4A",
  primaryStrong: "#7C3AED",
  onPrimary: "#FFFFFF",

  success: "#22C55E",
  successSoft: "#0F2F1A",
  warning: "#F59E0B",
  warningSoft: "#3A2A0A",
  danger: "#EF4444",
  dangerSoft: "#3A1414",
  info: "#3B82F6",
  infoSoft: "#0E223F",

  accentRose:  "#F472B6", accentRoseSoft:  "#3B1F2E",
  accentAmber: "#F59E0B", accentAmberSoft: "#3A2A0A",
  accentSky:   "#38BDF8", accentSkySoft:   "#0E2A3A",
  accentSage:  "#34D399", accentSageSoft:  "#0F2F26",
  accentLilac: "#A78BFA", accentLilacSoft: "#241B3F",
  accentPeach: "#FB923C", accentPeachSoft: "#3A1F0A",

  shadowSm: "0 1px 2px rgba(0,0,0,0.3)",
  shadowMd: "0 4px 14px rgba(0,0,0,0.4)",
  shadowLg: "0 12px 32px rgba(0,0,0,0.55)",
  ring: "rgba(139, 92, 246, 0.45)",
};

/** Cool, neutral light — sibling to warm theme for users who want plain white. */
export const lightTheme: Palette = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  surfaceMuted: "#F3F4F6",
  surfaceRaised: "#FFFFFF",
  sidebar: "#F5F5F2",
  sidebarItemHover: "#ECECE8",
  sidebarItemActive: "#E5DEFD",
  sidebarItemActiveText: "#4C1D95",

  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  divider: "#EEF0F3",

  text: "#111827",
  textMuted: "#6B7280",
  textSubtle: "#9CA3AF",
  textInverse: "#FFFFFF",

  primary: "#7C3AED",
  primarySoft: "#EDE4FE",
  primaryStrong: "#6D28D9",
  onPrimary: "#FFFFFF",

  success: "#16A34A",
  successSoft: "#DCFCE7",
  warning: "#D97706",
  warningSoft: "#FEF3C7",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  info: "#2563EB",
  infoSoft: "#DBEAFE",

  accentRose:  "#E11D48", accentRoseSoft:  "#FFE4E6",
  accentAmber: "#D97706", accentAmberSoft: "#FEF3C7",
  accentSky:   "#0284C7", accentSkySoft:   "#E0F2FE",
  accentSage:  "#16A34A", accentSageSoft:  "#DCFCE7",
  accentLilac: "#7C3AED", accentLilacSoft: "#EDE4FE",
  accentPeach: "#EA580C", accentPeachSoft: "#FFEDD5",

  shadowSm: "0 1px 2px rgba(15, 23, 42, 0.04)",
  shadowMd: "0 4px 14px rgba(15, 23, 42, 0.08)",
  shadowLg: "0 12px 32px rgba(15, 23, 42, 0.12)",
  ring: "rgba(124, 58, 237, 0.35)",
};

export const themes = {
  warm: warmTheme,
  dark: darkTheme,
  light: lightTheme,
} as const;

export type ThemeName = keyof typeof themes;
export const DEFAULT_THEME: ThemeName = "warm";

/* ------------------------------------------------------------------ */
/* Shape, type, motion                                                */
/* ------------------------------------------------------------------ */

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.02 },
  h1:      { fontSize: 22, fontWeight: 700, lineHeight: 1.25, letterSpacing: -0.01 },
  h2:      { fontSize: 17, fontWeight: 600, lineHeight: 1.3 },
  h3:      { fontSize: 14, fontWeight: 600, lineHeight: 1.35 },
  body:    { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  small:   { fontSize: 12, fontWeight: 500, lineHeight: 1.5 },
  micro:   { fontSize: 11, fontWeight: 500, lineHeight: 1.4 },
} as const;

export const motion = {
  fast: "120ms cubic-bezier(0.2, 0, 0, 1)",
  base: "180ms cubic-bezier(0.2, 0, 0, 1)",
  slow: "320ms cubic-bezier(0.2, 0, 0, 1)",
} as const;

/* ------------------------------------------------------------------ */
/* CSS variable wiring                                                */
/* ------------------------------------------------------------------ */

/** Convert a camelCase token name into a `--color-foo-bar` CSS variable. */
function cssVarName(token: string): string {
  return `--color-${token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}

/** Returns a `key: value` map of the CSS variables for a palette. */
export function paletteToCssVars(palette: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(palette)) {
    if (k.startsWith("shadow")) {
      out[`--shadow-${k.replace("shadow", "").toLowerCase()}`] = v;
    } else if (k === "ring") {
      out["--ring"] = v;
    } else {
      out[cssVarName(k)] = v;
    }
  }
  // shape tokens
  for (const [k, v] of Object.entries(radius)) out[`--radius-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(spacing)) out[`--space-${k}`] = `${v}px`;
  // motion
  for (const [k, v] of Object.entries(motion)) out[`--motion-${k}`] = v;
  return out;
}
