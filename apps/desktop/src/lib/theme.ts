/**
 * Applies a Note Goat theme to the document by setting CSS custom
 * properties on `:root`. Persists the choice in `localStorage` so a
 * reload picks up the same theme without a flash.
 */
import {
  DEFAULT_THEME,
  type ThemeName,
  paletteToCssVars,
  themes,
} from "@studynest/ui";

const STORAGE_KEY = "notegoat:theme";

export function getStoredTheme(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v && v in themes) return v as ThemeName;
  return DEFAULT_THEME;
}

export function applyTheme(name: ThemeName): void {
  const palette = themes[name];
  const vars = paletteToCssVars(palette);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
  root.dataset.theme = name;
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    /* private mode, ignore */
  }
}
