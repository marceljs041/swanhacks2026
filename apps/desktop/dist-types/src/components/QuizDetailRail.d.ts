/**
 * Third-column detail rail for quizzes — same grid cell as the global
 * `RightPanel`, swapped in by the Quizzes hub / take / results screens.
 *
 * Three variants:
 *  - `hub`     — quiz overview, recent scores, AI tools (matches the
 *                first reference image's right panel).
 *  - `session` — active take view: questions / completed / remaining /
 *                accuracy stats + Explain This Question (image #2).
 *  - `results` — post-submit summary, weak topics, linked notes,
 *                follow-up actions.
 */
import type { FC } from "react";
import type { QuizQuestionRow } from "@studynest/shared";
export type QuizRailVariant = "hub" | "session" | "results";
interface SessionStats {
    /** Total questions in the quiz. */
    total: number;
    /** Number answered (length of `answers`). */
    completed: number;
    /** Total minus completed. */
    remaining: number;
    /** 0–100 accuracy of answers given so far. */
    accuracy: number;
    /** Topics for the questions still being worked on; chips. */
    currentFocus: string[];
}
interface ResultsStats {
    score: number;
    total: number;
    pct: number;
    timeSpentSeconds: number;
    weakTopics: string[];
}
interface Props {
    variant: QuizRailVariant;
    /** Required when `variant !== "hub"`. */
    quizId?: string;
    /** Session-only: live quiz stats so the rail updates with each answer. */
    sessionStats?: SessionStats;
    /** The active question (for the "Explain This Question" tool). */
    currentQuestion?: QuizQuestionRow | null;
    /** Results-only: post-submit summary. */
    resultsStats?: ResultsStats;
    /** Optional handlers wired by the parent (Quiz / QuizzesHub). */
    onExplainQuestion?: () => void;
    onSummarizeWeakTopics?: () => void;
    onMakeReviewSet?: () => void;
    onAskQuiz?: () => void;
}
export declare const QuizDetailRail: FC<Props>;
export {};
//# sourceMappingURL=QuizDetailRail.d.ts.map