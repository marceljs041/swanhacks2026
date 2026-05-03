/**
 * Calendar repository — CRUD and queries for `calendar_events` and
 * `checklist_items`. Mirrors the conventions in `repositories.ts`:
 * every mutation enqueues a `sync_outbox` row in the same transaction
 * unless `{ skipOutbox: true }` is passed (used by the sync worker
 * when applying rows pulled from the cloud).
 */
import {
  type CalendarEventRow,
  type CalendarEventStatus,
  type CalendarEventType,
  type ChecklistItemRow,
  nowIso,
  ulid,
} from "@studynest/shared";
import type { SyncableEntity } from "@studynest/db-schema";
import { getDb } from "./client.js";

interface WriteOpts {
  skipOutbox?: boolean;
}

async function enqueue(
  entity_type: SyncableEntity,
  entity_id: string,
  operation: "upsert" | "delete",
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  db.prepare(
    `insert into sync_outbox (
       id, entity_type, entity_id, operation, payload_json,
       client_updated_at, created_at, retry_count
     ) values (?, ?, ?, ?, ?, ?, ?, 0)`,
  ).run(
    `obx_${entity_type}_${entity_id}_${ts}`,
    entity_type,
    entity_id,
    operation,
    JSON.stringify(payload),
    ts,
    ts,
  );
}

/* ---------------- Events ---------------- */

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
export async function listEventsForRange(
  fromIso: string,
  toIso: string,
  opts: ListEventsOpts = {},
): Promise<CalendarEventRow[]> {
  const db = await getDb();
  const params: unknown[] = [toIso, fromIso];
  let where =
    "deleted_at is null and start_at < ? and end_at > ?";
  if (!opts.includeAllStatuses) {
    where += " and status in ('scheduled', 'completed')";
  }
  if (opts.classId) {
    where += " and class_id = ?";
    params.push(opts.classId);
  }
  if (opts.sourceType) {
    where += " and source_type = ?";
    params.push(opts.sourceType);
  }
  return db
    .prepare(
      `select * from calendar_events where ${where} order by start_at`,
    )
    .all(...params) as CalendarEventRow[];
}

/** Today's events (start of local day → next local midnight). */
export async function listEventsForDay(date: Date): Promise<CalendarEventRow[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return listEventsForRange(start.toISOString(), end.toISOString());
}

export async function getEvent(id: string): Promise<CalendarEventRow | null> {
  const db = await getDb();
  return (
    (db.prepare("select * from calendar_events where id = ?").get(id) as
      | CalendarEventRow
      | undefined) ?? null
  );
}

export interface UpsertEventInput
  extends Partial<Omit<CalendarEventRow, "title" | "type" | "start_at" | "end_at">> {
  title: string;
  type: CalendarEventType;
  start_at: string;
  end_at: string;
}

export async function upsertEvent(
  input: UpsertEventInput,
  opts: WriteOpts = {},
): Promise<CalendarEventRow> {
  const db = await getDb();
  const ts = nowIso();
  const row: CalendarEventRow = {
    id: input.id ?? ulid("evt"),
    title: input.title,
    type: input.type,
    class_id: input.class_id ?? null,
    note_id: input.note_id ?? null,
    quiz_id: input.quiz_id ?? null,
    flashcard_set_id: input.flashcard_set_id ?? null,
    study_plan_id: input.study_plan_id ?? null,
    description: input.description ?? null,
    location: input.location ?? null,
    start_at: input.start_at,
    end_at: input.end_at,
    all_day: input.all_day ?? 0,
    color: input.color ?? null,
    tags_json: input.tags_json ?? "[]",
    reminder_at: input.reminder_at ?? null,
    source_type: input.source_type ?? "manual",
    status: input.status ?? "scheduled",
    recurrence_json: input.recurrence_json ?? null,
    created_at: input.created_at ?? ts,
    updated_at: ts,
    deleted_at: input.deleted_at ?? null,
    sync_version: (input.sync_version ?? 0) + 1,
  };
  db.prepare(
    `insert into calendar_events
       (id, title, type, class_id, note_id, quiz_id, flashcard_set_id,
        study_plan_id, description, location, start_at, end_at, all_day,
        color, tags_json, reminder_at, source_type, status, recurrence_json,
        created_at, updated_at, deleted_at, sync_version)
     values (@id, @title, @type, @class_id, @note_id, @quiz_id, @flashcard_set_id,
             @study_plan_id, @description, @location, @start_at, @end_at, @all_day,
             @color, @tags_json, @reminder_at, @source_type, @status, @recurrence_json,
             @created_at, @updated_at, @deleted_at, @sync_version)
     on conflict(id) do update set
       title=excluded.title, type=excluded.type, class_id=excluded.class_id,
       note_id=excluded.note_id, quiz_id=excluded.quiz_id,
       flashcard_set_id=excluded.flashcard_set_id, study_plan_id=excluded.study_plan_id,
       description=excluded.description, location=excluded.location,
       start_at=excluded.start_at, end_at=excluded.end_at, all_day=excluded.all_day,
       color=excluded.color, tags_json=excluded.tags_json,
       reminder_at=excluded.reminder_at, source_type=excluded.source_type,
       status=excluded.status, recurrence_json=excluded.recurrence_json,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at,
       sync_version=excluded.sync_version`,
  ).run(row);
  if (!opts.skipOutbox) await enqueue("calendar_events", row.id, "upsert", row);
  return row;
}

export async function softDeleteEvent(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  db.prepare(
    "update calendar_events set deleted_at = ?, updated_at = ? where id = ?",
  ).run(ts, ts, id);
  await enqueue("calendar_events", id, "delete", { id, deleted_at: ts });
  // Also tombstone any remaining checklist rows so the cloud mirrors the deletion.
  const items = db
    .prepare(
      "select id from checklist_items where event_id = ? and deleted_at is null",
    )
    .all(id) as Array<{ id: string }>;
  for (const it of items) await softDeleteChecklistItem(it.id);
}

/**
 * Update event status without touching anything else. Setting a
 * `completed` status records `completed_at`-like behavior on
 * `updated_at` only — we keep status as the source of truth.
 */
export async function setEventStatus(
  id: string,
  status: CalendarEventStatus,
): Promise<CalendarEventRow | null> {
  const ev = await getEvent(id);
  if (!ev) return null;
  return upsertEvent({ ...ev, status });
}

export async function duplicateEvent(id: string): Promise<CalendarEventRow | null> {
  const ev = await getEvent(id);
  if (!ev) return null;
  const copy = await upsertEvent({
    ...ev,
    id: ulid("evt"),
    title: `${ev.title} (copy)`,
    created_at: undefined,
    updated_at: undefined,
    sync_version: 0,
  });
  // Duplicate checklist items as well so the new event is genuinely usable.
  const items = await listChecklist(id);
  for (const it of items) {
    await upsertChecklistItem({
      event_id: copy.id,
      label: it.label,
      completed: 0,
      position: it.position,
    });
  }
  return copy;
}

/** Lightweight LIKE search over event title + description + location. */
export async function searchEvents(
  query: string,
  limit = 12,
): Promise<CalendarEventRow[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const db = await getDb();
  const like = `%${trimmed.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  return db
    .prepare(
      `select * from calendar_events where deleted_at is null
         and (title like ? escape '\\'
              or description like ? escape '\\'
              or location like ? escape '\\')
       order by start_at desc limit ?`,
    )
    .all(like, like, like, limit) as CalendarEventRow[];
}

/* ---------------- Checklist ---------------- */

export async function listChecklist(eventId: string): Promise<ChecklistItemRow[]> {
  const db = await getDb();
  return db
    .prepare(
      `select * from checklist_items where deleted_at is null and event_id = ?
       order by coalesce(position, 9999), created_at`,
    )
    .all(eventId) as ChecklistItemRow[];
}

export interface UpsertChecklistInput {
  id?: string;
  event_id: string;
  label: string;
  completed?: number;
  position?: number | null;
  created_at?: string;
}

export async function upsertChecklistItem(
  input: UpsertChecklistInput,
  opts: WriteOpts = {},
): Promise<ChecklistItemRow> {
  const db = await getDb();
  const ts = nowIso();
  const row: ChecklistItemRow = {
    id: input.id ?? ulid("chk"),
    event_id: input.event_id,
    label: input.label,
    completed: input.completed ?? 0,
    position: input.position ?? null,
    created_at: input.created_at ?? ts,
    updated_at: ts,
    deleted_at: null,
  };
  db.prepare(
    `insert into checklist_items
       (id, event_id, label, completed, position, created_at, updated_at, deleted_at)
     values (@id, @event_id, @label, @completed, @position, @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       label=excluded.label, completed=excluded.completed, position=excluded.position,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`,
  ).run(row);
  if (!opts.skipOutbox) await enqueue("checklist_items", row.id, "upsert", row);
  return row;
}

export async function toggleChecklistItem(id: string): Promise<void> {
  const db = await getDb();
  const row = db
    .prepare("select * from checklist_items where id = ?")
    .get(id) as ChecklistItemRow | undefined;
  if (!row) return;
  await upsertChecklistItem({
    ...row,
    completed: row.completed ? 0 : 1,
  });
}

export async function softDeleteChecklistItem(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  db.prepare(
    "update checklist_items set deleted_at = ?, updated_at = ? where id = ?",
  ).run(ts, ts, id);
  await enqueue("checklist_items", id, "delete", { id, deleted_at: ts });
}

/* ---------------- Stats ---------------- */

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

export async function calendarStats(): Promise<CalendarStats> {
  const db = await getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const inAWeek = new Date(today);
  inAWeek.setDate(inAWeek.getDate() + 7);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const todaysTasks = (
    db
      .prepare(
        `select count(*) as c from calendar_events
         where deleted_at is null
           and status = 'scheduled'
           and start_at >= ? and start_at < ?`,
      )
      .get(today.toISOString(), tomorrow.toISOString()) as { c: number }
  ).c;

  const upcomingExams = (
    db
      .prepare(
        `select count(*) as c from calendar_events
         where deleted_at is null and type = 'exam'
           and start_at >= ? and start_at < ?`,
      )
      .get(today.toISOString(), inAWeek.toISOString()) as { c: number }
  ).c;

  const tasksCompletedThisWeek = (
    db
      .prepare(
        `select count(*) as c from calendar_events
         where deleted_at is null and status = 'completed'
           and updated_at >= ?`,
      )
      .get(weekStart.toISOString()) as { c: number }
  ).c;

  // Reuse the existing "consecutive days with XP events" streak logic
  // by querying xp_events directly — keeping calendar.ts free of a
  // dependency cycle into repositories.ts.
  const streakRows = db
    .prepare(
      "select date(created_at) as d from xp_events group by date(created_at) order by d desc",
    )
    .all() as Array<{ d: string }>;
  let studyStreak = 0;
  for (let i = 0; i < streakRows.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (streakRows[i]!.d === expectedStr) studyStreak += 1;
    else break;
  }

  return { todaysTasks, upcomingExams, studyStreak, tasksCompletedThisWeek };
}

/* ---------------- Backfill from study_tasks ---------------- */

const BACKFILL_SETTING_KEY = "calendar.backfill.v1";

/**
 * One-time copy of legacy `study_tasks` rows into `calendar_events` so
 * the new Calendar UI shows everything the user already has scheduled.
 * Runs idempotently using a flag in the `settings` table — re-running
 * after the flag is set is a no-op. Existing legacy rows are not
 * removed; both tables continue to exist in parallel until other
 * widgets are migrated to read from `calendar_events` directly.
 */
export async function ensureCalendarBackfill(): Promise<void> {
  const db = await getDb();
  const flag = db
    .prepare("select value_json from settings where key = ?")
    .get(BACKFILL_SETTING_KEY) as { value_json: string } | undefined;
  if (flag?.value_json === "true") return;

  type LegacyTask = {
    id: string;
    plan_id: string | null;
    note_id: string | null;
    title: string;
    type: string;
    scheduled_for: string;
    duration_minutes: number;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
  };
  const tasks = db
    .prepare(
      "select id, plan_id, note_id, title, type, scheduled_for, duration_minutes, completed_at, created_at, updated_at from study_tasks where deleted_at is null",
    )
    .all() as LegacyTask[];

  for (const t of tasks) {
    const startMs = new Date(t.scheduled_for).getTime();
    const endIso = new Date(
      startMs + Math.max(15, t.duration_minutes) * 60_000,
    ).toISOString();
    // Map legacy task types onto the richer CalendarEventType enum.
    const type: CalendarEventType =
      t.type === "quiz"
        ? "quiz"
        : t.type === "flashcards"
        ? "flashcards"
        : t.type === "read"
        ? "reading"
        : t.type === "write" || t.type === "practice"
        ? "assignment"
        : "study_block";
    await upsertEvent(
      {
        id: `evt_legacy_${t.id}`,
        title: t.title,
        type,
        note_id: t.note_id,
        study_plan_id: t.plan_id,
        start_at: t.scheduled_for,
        end_at: endIso,
        source_type: "system_generated",
        status: t.completed_at ? "completed" : "scheduled",
        created_at: t.created_at,
      },
      // Backfill writes shouldn't echo to the cloud — the cloud keeps
      // the original `study_tasks` rows, so duplicating these would
      // double-count. The next genuine edit will sync properly.
      { skipOutbox: true },
    );
  }

  const ts = nowIso();
  db.prepare(
    `insert into settings (key, value_json, updated_at) values (?, 'true', ?)
     on conflict(key) do update set value_json='true', updated_at=excluded.updated_at`,
  ).run(BACKFILL_SETTING_KEY, ts);
}
