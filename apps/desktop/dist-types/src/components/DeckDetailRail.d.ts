/**
 * Right-hand rail shown on both the Flashcards hub and the per-deck
 * review screen. Pinned to `useApp.selectedDeckId` and rendered inside
 * the main `.flashcards-shell` so the global `RightPanel` widgets are
 * untouched.
 *
 * Two variants:
 *  - `hub`     — adds a "Preview (3)" list of upcoming cards.
 *  - `review`  — replaces the preview with a "Current Card" snapshot
 *                tied to the card the user is on.
 */
import type { FC } from "react";
import { type DeckSummary } from "../db/repositories.js";
import type { FlashcardRow } from "@studynest/shared";
interface Props {
    variant: "hub" | "review";
    /** When provided in `review` variant, drives the "Current Card" panel. */
    currentCard?: FlashcardRow | null;
    /** Whether the back of the current card is currently visible. */
    currentCardRevealed?: boolean;
    /** Hub variant: optional preloaded deck summaries to avoid a refetch. */
    summaries?: DeckSummary[];
    /** Called when the user toggles the favorite chip. */
    onToggleFavorite?: () => void;
    /** Whether the deck is currently a favorite. */
    isFavorite?: boolean;
    /** Trigger Read Aloud / Audio review on the current card or deck. */
    onAudio?: () => void;
    /** Open the Ask AI surface for the deck (review variant only). */
    onAskAI?: () => void;
}
export declare const DeckDetailRail: FC<Props>;
export {};
//# sourceMappingURL=DeckDetailRail.d.ts.map