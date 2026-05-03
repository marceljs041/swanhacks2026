/** Static assets from `apps/desktop/public/` (served at `/…` in dev and prod). */
export const BRAND_LOGO_URL = "/logo.svg";
export const BRAND_HERO_URL = "/hero.svg";
/**
 * Notes screen "Needs Attention" mascot. The asset is delivered later;
 * components that reference it should swallow `onError` so a missing
 * file doesn't break layout in the meantime.
 */
export const BRAND_ATTENTION_URL = "/attention.svg";
