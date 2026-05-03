/**
 * Mobile equivalent of the desktop repositories. Same shape, async
 * expo-sqlite under the hood. Every write enqueues a sync_outbox row.
 */
import {
  type AttachmentRow,
  type AttachmentType,
  type ClassRow,
  type NoteRow,
  type StudyTaskRow,
  type SyncOutboxRow,
  type RewardPointsEventRow,
  type XpEventRow,
  nowIso,
  ulid,
} from "@studynest/shared";
import type { SyncableEntity } from "@studynest/db-schema";
import { getDb } from "./client";

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
  await db.runAsync(
    `insert into sync_outbox (
       id, entity_type, entity_id, operation, payload_json,
       client_updated_at, created_at, retry_count
     ) values (?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      `obx_${entity_type}_${entity_id}_${ts}`,
      entity_type,
      entity_id,
      operation,
      JSON.stringify(payload),
      ts,
      ts,
    ],
  );
}

// ---------------- Classes ----------------

export async function listClasses(): Promise<ClassRow[]> {
  const db = await getDb();
  return (await db.getAllAsync(
    "select * from classes where deleted_at is null and archived_at is null order by name",
  )) as ClassRow[];
}

export async function upsertClass(
  input: Partial<ClassRow> & { name: string },
  opts: WriteOpts = {},
): Promise<ClassRow> {
  const db = await getDb();
  const ts = nowIso();
  const id = input.id ?? ulid("cls");
  let overviewText: string | null = null;
  if (input.overview_text !== undefined) {
    overviewText = input.overview_text;
  } else if (input.id) {
    const ex = (await db.getFirstAsync(
      "select overview_text from classes where id = ?",
      [input.id],
    )) as { overview_text: string | null } | null;
    overviewText = ex?.overview_text ?? null;
  }
  const row: ClassRow = {
    id,
    name: input.name,
    code: input.code ?? null,
    color: input.color ?? null,
    created_at: input.created_at ?? ts,
    updated_at: ts,
    deleted_at: input.deleted_at ?? null,
    archived_at: input.archived_at ?? null,
    overview_text: overviewText,
  };
  await db.runAsync(
    `insert into classes (id, name, code, color, created_at, updated_at, deleted_at, archived_at, overview_text)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(id) do update set
       name=excluded.name, code=excluded.code, color=excluded.color,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at,
       archived_at=excluded.archived_at, overview_text=excluded.overview_text`,
    [
      row.id,
      row.name,
      row.code,
      row.color,
      row.created_at,
      row.updated_at,
      row.deleted_at,
      row.archived_at,
      row.overview_text,
    ],
  );
  if (!opts.skipOutbox) await enqueue("classes", row.id, "upsert", row);
  return row;
}

// ---------------- Notes ----------------

export async function listNotes(classId?: string | null): Promise<NoteRow[]> {
  const db = await getDb();
  if (classId) {
    return (await db.getAllAsync(
      "select * from notes where deleted_at is null and class_id = ? order by updated_at desc",
      [classId],
    )) as NoteRow[];
  }
  return (await db.getAllAsync(
    "select * from notes where deleted_at is null order by updated_at desc",
  )) as NoteRow[];
}

export async function getNote(id: string): Promise<NoteRow | null> {
  const db = await getDb();
  return ((await db.getFirstAsync("select * from notes where id = ?", [id])) as NoteRow) ?? null;
}

export async function upsertNote(
  input: Partial<NoteRow> & { title: string },
  opts: WriteOpts = {},
): Promise<NoteRow> {
  const db = await getDb();
  const ts = nowIso();
  const row: NoteRow = {
    id: input.id ?? ulid("nt"),
    class_id: input.class_id ?? null,
    title: input.title,
    content_markdown: input.content_markdown ?? "",
    summary: input.summary ?? null,
    tags_json: input.tags_json ?? "[]",
    created_at: input.created_at ?? ts,
    updated_at: ts,
    deleted_at: input.deleted_at ?? null,
    sync_version: (input.sync_version ?? 0) + 1,
  };
  await db.runAsync(
    `insert into notes (id, class_id, title, content_markdown, summary, tags_json,
                        created_at, updated_at, deleted_at, sync_version)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(id) do update set
       class_id=excluded.class_id, title=excluded.title,
       content_markdown=excluded.content_markdown, summary=excluded.summary,
       tags_json=excluded.tags_json, updated_at=excluded.updated_at,
       deleted_at=excluded.deleted_at, sync_version=excluded.sync_version`,
    [
      row.id,
      row.class_id,
      row.title,
      row.content_markdown,
      row.summary,
      row.tags_json,
      row.created_at,
      row.updated_at,
      row.deleted_at,
      row.sync_version,
    ],
  );
  if (!opts.skipOutbox) await enqueue("notes", row.id, "upsert", row);
  return row;
}

export async function softDeleteNote(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  await db.runAsync("update notes set deleted_at = ?, updated_at = ? where id = ?", [ts, ts, id]);
  await enqueue("notes", id, "delete", { id, deleted_at: ts });
}

// ---------------- Attachments ----------------

export async function upsertAttachment(
  input: Partial<AttachmentRow> & {
    note_id: string;
    type: AttachmentType;
    local_uri: string;
  },
  opts: WriteOpts = {},
): Promise<AttachmentRow> {
  const db = await getDb();
  const ts = nowIso();
  const row: AttachmentRow = {
    id: input.id ?? ulid("att"),
    note_id: input.note_id,
    type: input.type,
    local_uri: input.local_uri,
    remote_url: input.remote_url ?? null,
    file_name: input.file_name ?? null,
    mime_type: input.mime_type ?? null,
    size_bytes: input.size_bytes ?? null,
    transcript: input.transcript ?? null,
    extracted_text: input.extracted_text ?? null,
    created_at: input.created_at ?? ts,
    updated_at: ts,
    deleted_at: input.deleted_at ?? null,
  };
  await db.runAsync(
    `insert into attachments
       (id, note_id, type, local_uri, remote_url, file_name, mime_type, size_bytes,
        transcript, extracted_text, created_at, updated_at, deleted_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(id) do update set
       type=excluded.type, local_uri=excluded.local_uri, remote_url=excluded.remote_url,
       file_name=excluded.file_name, mime_type=excluded.mime_type,
       size_bytes=excluded.size_bytes, transcript=excluded.transcript,
       extracted_text=excluded.extracted_text, updated_at=excluded.updated_at,
       deleted_at=excluded.deleted_at`,
    [
      row.id,
      row.note_id,
      row.type,
      row.local_uri,
      row.remote_url,
      row.file_name,
      row.mime_type,
      row.size_bytes,
      row.transcript,
      row.extracted_text,
      row.created_at,
      row.updated_at,
      row.deleted_at,
    ],
  );
  if (!opts.skipOutbox) await enqueue("attachments", row.id, "upsert", row);
  return row;
}

export async function listAttachments(noteId: string): Promise<AttachmentRow[]> {
  const db = await getDb();
  return (await db.getAllAsync(
    "select * from attachments where deleted_at is null and note_id = ? order by created_at",
    [noteId],
  )) as AttachmentRow[];
}

// ---------------- XP / Tasks ----------------

export async function recordXp(action: string, points: number): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  const row: XpEventRow = { id: ulid("xp"), action, points, created_at: ts };
  await db.runAsync(
    "insert into xp_events (id, action, points, created_at) values (?, ?, ?, ?)",
    [row.id, row.action, row.points, row.created_at],
  );
  await enqueue("xp_events", row.id, "upsert", row);
}

export async function upsertRewardPointsEvent(
  input: Partial<RewardPointsEventRow> & { id: string },
  opts: { skipOutbox?: boolean } = {},
): Promise<RewardPointsEventRow> {
  const db = await getDb();
  const row: RewardPointsEventRow = {
    id: input.id,
    action: input.action ?? "unknown",
    points: input.points ?? 0,
    created_at: input.created_at ?? nowIso(),
  };
  await db.runAsync(
    `insert into reward_points_events (id, action, points, created_at) values (?, ?, ?, ?)
     on conflict(id) do update set action=excluded.action, points=excluded.points, created_at=excluded.created_at`,
    [row.id, row.action, row.points, row.created_at],
  );
  if (!opts.skipOutbox) await enqueue("reward_points_events", row.id, "upsert", row);
  return row;
}

export async function recordRewardPoints(action: string, points: number): Promise<void> {
  if (points <= 0) return;
  await upsertRewardPointsEvent({
    id: ulid("rp"),
    action,
    points,
    created_at: nowIso(),
  });
}

export async function totalRewardPoints(): Promise<number> {
  const db = await getDb();
  const row = (await db.getFirstAsync(
    "select coalesce(sum(points), 0) as t from reward_points_events",
  )) as { t: number };
  return row.t;
}

export async function totalXpToday(): Promise<number> {
  const db = await getDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const row = (await db.getFirstAsync(
    "select coalesce(sum(points), 0) as t from xp_events where created_at >= ?",
    [start.toISOString()],
  )) as { t: number };
  return row.t;
}

export async function currentStreak(): Promise<number> {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    "select date(created_at) as d from xp_events group by date(created_at) order by d desc",
  )) as { d: string }[];
  if (rows.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    if (rows[i]!.d === expected.toISOString().slice(0, 10)) streak += 1;
    else break;
  }
  return streak;
}

export async function listTasksForRange(fromIso: string, toIso: string): Promise<StudyTaskRow[]> {
  const db = await getDb();
  return (await db.getAllAsync(
    `select * from study_tasks where deleted_at is null
     and scheduled_for >= ? and scheduled_for < ? order by scheduled_for`,
    [fromIso, toIso],
  )) as StudyTaskRow[];
}

// ---------------- Outbox helpers ----------------

export async function listOutbox(limit: number): Promise<SyncOutboxRow[]> {
  const db = await getDb();
  return (await db.getAllAsync(
    `select * from sync_outbox where synced_at is null order by created_at limit ?`,
    [limit],
  )) as SyncOutboxRow[];
}

export async function markOutboxSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const ts = nowIso();
  for (const id of ids) {
    await db.runAsync("update sync_outbox set synced_at = ? where id = ?", [ts, id]);
  }
  await db.runAsync("update sync_state set last_pushed_at = ? where id = 1", [ts]);
}

export async function recordOutboxFailure(id: string, error: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "update sync_outbox set retry_count = retry_count + 1, last_error = ? where id = ?",
    [error, id],
  );
}
