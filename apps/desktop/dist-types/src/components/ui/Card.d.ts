import type { FC, ReactNode } from "react";
import { type MoreMenuItem } from "./MoreMenu.js";
interface Props {
    title?: string;
    icon?: ReactNode;
    /**
     * Header action slot. Use:
     *  - `"more"` to render an inert `…` button (kept for cards that
     *    don't have a menu yet).
     *  - A `MoreMenuItem[]` to render a real dropdown.
     *  - Any ReactNode for a custom action.
     */
    action?: ReactNode | "more" | MoreMenuItem[];
    className?: string;
    bodyClassName?: string;
    children?: ReactNode;
}
/** Generic dashboard card with optional header (icon + title + action). */
export declare const Card: FC<Props>;
export {};
//# sourceMappingURL=Card.d.ts.map