/**
 * Third-column detail for flashcards: same grid cell as the global
 * `RightPanel`, swapped in by the Flashcards hub / review routes when a
 * deck is focused (`useApp.selectedDeckId`).
 *
 * Two variants:
 *  - `hub`     — adds a "Preview (3)" list of upcoming cards.
 *  - `review`  — replaces the preview with a "Current Card" snapshot
 *                tied to the card the user is on.
 */
import type { FC } from "react";
import type { FlashcardRow } from "@studynest/shared";
interface Props {
    variant: "hub" | "review";
    /** When provided in `review` variant, drives the "Current Card" panel. */
    currentCard?: FlashcardRow | null;
    /** Whether the back of the current card is currently visible. */
    currentCardRevealed?: boolean;
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