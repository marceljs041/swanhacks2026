/**
 * Applies a Note Goat theme to the document by setting CSS custom
 * properties on `:root`. Persists the choice in `localStorage` so a
 * reload picks up the same theme without a flash.
 */
import { type ThemeName } from "@studynest/ui";
export declare function getStoredTheme(): ThemeName;
export declare function applyTheme(name: ThemeName): void;
//# sourceMappingURL=theme.d.ts.map