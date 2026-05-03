/**
 * Generates a context-aware greeting for the home hero.
 *
 * Resolution order (most specific wins):
 *   1. Holiday on this calendar date (US/observed — fixed and floating).
 *   2. Special day-of-week vibes (Friday afternoon, Sunday evening, etc.).
 *   3. Time-of-day buckets (early morning, morning, midday, afternoon,
 *      evening, night, late-night).
 *
 * Each bucket has a small pool of phrases — we pick a deterministic one
 * based on `date.toDateString() + bucket` so the greeting stays stable
 * across re-renders within the same day but rotates day-to-day.
 *
 * Phrases use `{name}` as the placeholder for the user's first name.
 * Empty `name` falls back to a no-name variant when one is provided.
 */
export interface GreetingResult {
    /** Big headline e.g. "Good morning, Marcel". Already interpolated. */
    headline: string;
    /** Smaller subline e.g. "Ready to learn something great today?". */
    subline: string;
    /** Decorative emoji shown next to the headline. */
    emoji: string;
    /** Bucket key — useful for debugging or future analytics. */
    bucket: string;
}
export declare function getGreeting(name: string, now?: Date): GreetingResult;
//# sourceMappingURL=greeting.d.ts.map