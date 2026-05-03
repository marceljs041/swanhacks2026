/**
 * Calendar repository — CRUD and queries for `calendar_events` and
 * `checklist_items`. Mirrors the conventions in `repositories.ts`:
 * every mutation enqueues a `sync_outbox` row in the same transaction
 * unless `{ skipOutbox: true }` is passed (used by the sync worker
 * when applying rows pulled from the cloud).
 */
import { type CalendarEventRow, type CalendarEventStatus, type CalendarEventType, type ChecklistItemRow } from "@studynest/shared";
interface WriteOpts {
    skipOutbox?: boolean;
}
export interface ListEventsOpts {
    classId?: string | null;
    /** When true, also return rows whose status is "cancelled" or "skipped". */
    includeAllStatuses?: boolean;
    /** When set, restricts to a specific source (e.g. only ai_generated). */
    sourceType?: CalendarEventRow["source_type"];
}
/**
 * Events overlapping a half-open `[fromIso, toIso)` window. We use
 * overlap rather than start-only so a 3 PM → 5 PM event is included
 * when the window starts at 4 PM. Soft-deleted rows are excluded.
 */
export declare function listEventsForRange(fromIso: string, toIso: string, opts?: ListEventsOpts): Promise<CalendarEventRow[]>;
/** Today's events (start of local day → next local midnight). */
export declare function listEventsForDay(date: Date): Promise<CalendarEventRow[]>;
export declare function getEvent(id: string): Promise<CalendarEventRow | null>;
export interface UpsertEventInput extends Partial<Omit<CalendarEventRow, "title" | "type" | "start_at" | "end_at">> {
    title: string;
    type: CalendarEventType;
    start_at: string;
    end_at: string;
}
export declare function upsertEvent(input: UpsertEventInput, opts?: WriteOpts): Promise<CalendarEventRow>;
export declare function softDeleteEvent(id: string): Promise<void>;
/**
 * Update event status without touching anything else. Setting a
 * `completed` status records `completed_at`-like behavior on
 * `updated_at` only — we keep status as the source of truth.
 */
export declare function setEventStatus(id: string, status: CalendarEventStatus): Promise<CalendarEventRow | null>;
export declare function duplicateEvent(id: string): Promise<CalendarEventRow | null>;
/** Lightweight LIKE search over event title + description + location. */
export declare function searchEvents(query: string, limit?: number): Promise<CalendarEventRow[]>;
export declare function listChecklist(eventId: string): Promise<ChecklistItemRow[]>;
export interface UpsertChecklistInput {
    id?: string;
    event_id: string;
    label: string;
    completed?: number;
    position?: number | null;
    created_at?: string;
}
export declare function upsertChecklistItem(input: UpsertChecklistInput, opts?: WriteOpts): Promise<ChecklistItemRow>;
export declare function toggleChecklistItem(id: string): Promise<void>;
export declare function softDeleteChecklistItem(id: string): Promise<void>;
export interface CalendarStats {
    /** Events scheduled for today that are not yet completed. */
    todaysTasks: number;
    /** Distinct exam-type events in the next 7 days. */
    upcomingExams: number;
    /** Days the user has consecutively earned XP — proxy for "study streak". */
    studyStreak: number;
    /** Events marked completed within the current ISO week. */
    tasksCompletedThisWeek: number;
}
export declare function calendarStats(): Promise<CalendarStats>;
/**
 * One-time copy of legacy `study_tasks` rows into `calendar_events` so
 * the new Calendar UI shows everything the user already has scheduled.
 * Runs idempotently using a flag in the `settings` table — re-running
 * after the flag is set is a no-op. Existing legacy rows are not
 * removed; both tables continue to exist in parallel until other
 * widgets are migrated to read from `calendar_events` directly.
 */
export declare function ensureCalendarBackfill(): Promise<void>;
export {};
//# sourceMappingURL=calendar.d.ts.map