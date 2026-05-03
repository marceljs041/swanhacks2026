/**
 * Color/icon resolution for `CalendarEventRow` cards.
 *
 * Every event maps to an `EventTone` (sage / sky / lilac / amber /
 * peach / rose) — a pure visual concept that the styles.css cal-event
 * blocks turn into theme-token CSS variables. We never hardcode hex
 * here: callers either set `data-tone="…"` or read the tone via JS to
 * apply existing class chips.
 *
 * Resolution order:
 *   1. Explicit `event.color` (set during AI plan generation or by the
 *      Add/Edit drawer). Recognized values match `Palette` accent
 *      names ("accentSage", "accentSky", …) for forward-compat.
 *   2. Linked class color — keeps biology events green, chemistry
 *      blue, etc.
 *   3. Class-name heuristic.
 *   4. Type-based default — exam → rose, study_block → lilac, etc.
 */
import type { ReactNode } from "react";
import type { CalendarEventRow, CalendarEventType, ClassRow } from "@studynest/shared";
export type EventTone = "sage" | "sky" | "lilac" | "amber" | "peach" | "rose";
export declare function toneForEvent(event: Pick<CalendarEventRow, "color" | "type" | "class_id">, cls?: ClassRow | null): EventTone;
export declare function iconForEvent(event: Pick<CalendarEventRow, "type" | "source_type">, size?: number): ReactNode;
export declare function labelForType(t: CalendarEventType): string;
export declare function startOfWeek(d: Date): Date;
export declare function startOfDay(d: Date): Date;
export declare function startOfMonth(d: Date): Date;
export declare function isoDate(d: Date): string;
export declare function fromIsoDate(iso: string): Date;
export declare function fmtTime(iso: string): string;
export declare function fmtTimeRange(startIso: string, endIso: string, allDay?: boolean): string;
export declare function fmtRangeLabel(start: Date, end: Date): string;
//# sourceMappingURL=eventVisuals.d.ts.map