/**
 * Modal that turns existing app content (a note, a whole class, or a
 * flashcard set) into a fresh quiz via the local AI sidecar. Used by
 * the Quizzes hub, NoteEditor, ClassView, and the deck rail.
 *
 * The shell mirrors `ModalShell` from `FlashcardsHub.tsx` (same look +
 * keyboard handling), but it lives here because the quiz flow has its
 * own three-section layout (Source / Configuration / Generate).
 */
import type { FC } from "react";
import type { QuizRow } from "@studynest/shared";
export type QuizGenSourceKind = "note" | "class" | "flashcards";
export interface QuizGenInitialSource {
    kind: QuizGenSourceKind;
    /** Note id, class id, or flashcard set id depending on `kind`. */
    id: string;
}
interface Props {
    /** Optional initial source — when present the picker is preselected. */
    initialSource?: QuizGenInitialSource | null;
    onClose: () => void;
    /** Fired with the new quiz id once persisted. */
    onGenerated: (quizId: string) => void;
}
export declare const QuizGenerationModal: FC<Props>;
export type { QuizRow };
//# sourceMappingURL=QuizGenerationModal.d.ts.map