/**
 * Calendar page — top-level orchestrator for the calendar feature.
 *
 * Layout:
 *   ┌──────────────────────────────────────┬──────────┐
 *   │ header  (title + search + mascot)    │          │
 *   │ stat row (today / exams / streak)    │  Event   │
 *   │ toolbar (today, prev/next, view)     │  Detail  │
 *   │ grid    (day | week | month)         │  Rail    │
 *   └──────────────────────────────────────┴──────────┘
 *
 * The right rail collapses when no event is selected; the third grid
 * track returns to the global default width via `calendarDetailPanelOpen`.
 */
import type { FC } from "react";
export declare const Calendar: FC;
//# sourceMappingURL=Calendar.d.ts.map