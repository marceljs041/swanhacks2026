import type { FC } from "react";
interface RightPanelProps {
    /** Participates in View Transitions when swapped with `ClassDetailPanel` on Classes. */
    classesSwap?: boolean;
    /** Participates in View Transitions when swapped with `DeckDetailRail` on Flashcards. */
    flashcardsSwap?: boolean;
    /** Participates in View Transitions when swapped with `EventDetailRail` on Calendar. */
    calendarSwap?: boolean;
}
export declare const RightPanel: FC<RightPanelProps>;
export {};
//# sourceMappingURL=RightPanel.d.ts.map