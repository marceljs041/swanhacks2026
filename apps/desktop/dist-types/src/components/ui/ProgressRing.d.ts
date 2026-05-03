import type { FC, ReactNode } from "react";
interface Props {
    /** 0–1 */
    value: number;
    size?: number;
    thickness?: number;
    trackColor?: string;
    color?: string;
    children?: ReactNode;
}
/**
 * Donut progress ring rendered as two concentric circles. Uses
 * `stroke-dasharray` to display the filled arc — works at any size and
 * inherits theme colours by default.
 */
export declare const ProgressRing: FC<Props>;
interface DonutProps {
    /** Each slice's value (any units) — angles computed proportionally. */
    segments: {
        value: number;
        color: string;
    }[];
    size?: number;
    thickness?: number;
    trackColor?: string;
    children?: ReactNode;
}
/** Multi-segment donut for breakdowns like flashcard deck distribution. */
export declare const Donut: FC<DonutProps>;
export {};
//# sourceMappingURL=ProgressRing.d.ts.map