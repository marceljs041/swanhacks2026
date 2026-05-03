/**
 * Two-step modal that turns AI study plan output into real
 * `calendar_events` rows.
 *
 *  Step 1 — Configure  : pick a class, optional source decks/notes/quiz,
 *                        exam date, daily availability, strategy, and
 *                        which deliverables to include. Inputs flow
 *                        into the existing `ai.studyPlan` request.
 *  Step 2 — Preview    : render the proposed task list grouped by day.
 *                        Per-row remove + edit before accepting.
 *
 * On accept we upsert a new `study_plans` row to anchor the bundle,
 * then create one `calendar_events` row per surviving task with
 * `source_type='ai_generated'`.
 */
import type { FC } from "react";
export declare const StudyPlanGeneratorModal: FC;
//# sourceMappingURL=StudyPlanGeneratorModal.d.ts.map