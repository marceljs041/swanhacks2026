import type { FC, ReactNode } from "react";
export interface MoreMenuItem {
    label: string;
    onClick: () => void;
    /** Optional leading icon. Inherits text colour. */
    icon?: ReactNode;
    /** When true, renders in the danger style and a divider above. */
    danger?: boolean;
}
interface Props {
    items: MoreMenuItem[];
    /** Accessible label for the trigger button. Defaults to "More actions". */
    label?: string;
}
/**
 * A small dropdown menu hung off the standard `…` (more) button used in
 * card headers. Closes on outside click and Esc, and traps focus only
 * loosely — the list is short enough that arrow-key navigation isn't
 * worth the complexity here.
 */
export declare const MoreMenu: FC<Props>;
export {};
//# sourceMappingURL=MoreMenu.d.ts.map