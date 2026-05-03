/**
 * Shared visual helpers for anywhere a class is rendered (hero icon /
 * accent tone / friendly subtitle). Lives here so the Classes index,
 * Class detail view, and Ask AI screen all derive identical visuals.
 */
import type { ReactNode } from "react";
import type { ClassRow } from "@studynest/shared";
export type AccentTone = "sage" | "sky" | "lilac" | "amber" | "peach";
/** Map a class's stored colour (or fall back to a stable hash) to a tone. */
export declare function toneFor(cls: ClassRow): AccentTone;
/** Pick a subject-aware glyph based on the class name. */
export declare function iconFor(cls: ClassRow, size?: number): ReactNode;
/** Subtitle is derived from `code` when present (matches our seed convention). */
export declare function deriveSubtitle(cls: ClassRow): string | null;
/**
 * 0-100 progress from completed/total tasks; falls back to a coarse
 * "study tools coverage" heuristic when no plan exists yet.
 */
export declare function computeProgress(agg: {
    notes: number;
    flashcards: number;
    quizzes: number;
    totalTasks: number;
    completedTasks: number;
}): number;
export declare function progressLabel(progress: number, agg: {
    totalTasks: number;
    notes: number;
}): string;
export declare function progressTone(progress: number, agg: {
    totalTasks: number;
}): "success" | "warning";
/** "May 6", "Today", "Yesterday", or weekday for last-week ISO timestamps. */
export declare function shortDate(iso: string): string;
//# sourceMappingURL=classDisplay.d.ts.map