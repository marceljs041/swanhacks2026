/**
 * Active quiz screen — three modes:
 *
 *   take    — single-question flow with progress bar, action bar, and
 *             persistent session state for resume.
 *   results — post-submit summary, topic performance, wrong-answer
 *             list, and follow-up actions (flashcards / study plan).
 *   review  — step-through of only missed questions, with explanations
 *             and per-question "turn into flashcard".
 *
 * The third column is the `QuizDetailRail` in `session` / `results`
 * variant.  All three modes share the same outer chrome.
 */
import type { FC } from "react";
import { type QuizMode } from "../store.js";
interface Props {
    quizId: string;
    mode: QuizMode;
}
export declare const Quiz: FC<Props>;
export {};
//# sourceMappingURL=Quiz.d.ts.map