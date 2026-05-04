/** Static assets from `apps/desktop/public/` (copied next to `index.html` in dist). */
function publicAsset(file) {
    const name = file.replace(/^\//, "");
    const b = import.meta.env.BASE_URL;
    return b.endsWith("/") ? `${b}${name}` : `${b}/${name}`;
}
export const BRAND_LOGO_URL = publicAsset("/logo.svg");
export const BRAND_HERO_URL = publicAsset("/hero.svg");
/** Feature-specific hero illustrations (same layout sizing as `BRAND_HERO_URL`). */
export const BRAND_QUIZ_HERO_URL = publicAsset("/quiz.svg");
export const BRAND_FLASHCARD_HERO_URL = publicAsset("/flashcard.svg");
export const BRAND_CLASS_HERO_URL = publicAsset("/class.svg");
export const BRAND_ASKAI_HERO_URL = publicAsset("/askai.svg");
/**
 * Notes screen "Needs Attention" mascot. The asset is delivered later;
 * components that reference it should swallow `onError` so a missing
 * file doesn't break layout in the meantime.
 */
export const BRAND_ATTENTION_URL = publicAsset("/attention.svg");
/** AI / Ask-AI mascot (note editor panel, etc.). */
export const BRAND_AI_URL = publicAsset("/askai.svg");
//# sourceMappingURL=brand.js.map