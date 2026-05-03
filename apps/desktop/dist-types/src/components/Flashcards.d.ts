/**
 * Per-deck flashcard review. Drives the SM-2-ish scheduler in
 * `schedule()`, exposes the four-button Again / Hard / Good / Easy
 * grading bar, and tracks per-session XP / correct / streak / time via
 * `lib/flashcardSession`. The right rail (`DeckDetailRail`) is shared
 * with the hub so both screens stay visually consistent.
 */
import type { FC } from "react";
import { type ReviewMode } from "../db/repositories.js";
interface Props {
    setId: string;
    /** Review mode passed via the route (`flashcardSet` view kind). */
    mode?: ReviewMode;
}
export declare const Flashcards: FC<Props>;
export {};
//# sourceMappingURL=Flashcards.d.ts.map