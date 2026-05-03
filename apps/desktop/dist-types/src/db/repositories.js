/**
 * CRUD repositories. All writes are wrapped in a transaction that also
 * inserts a sync_outbox row, so every change is durable AND replayable
 * to the cloud.
 *
 * Pass `{ skipOutbox: true }` only when applying a row that came FROM the
 * cloud (during sync pull) — otherwise we'd echo the change back.
 */
import { nowIso, ulid, } from "@studynest/shared";
import { maxIso } from "../lib/relativeTime.js";
import { getDb, getDeviceId } from "./client.js";
async function enqueue(entity_type, entity_id, operation, payload) {
    const db = await getDb();
    const ts = nowIso();
    db.prepare(`insert into sync_outbox (
       id, entity_type, entity_id, operation, payload_json,
       client_updated_at, created_at, retry_count
     ) values (?, ?, ?, ?, ?, ?, ?, 0)`).run(`obx_${entity_type}_${entity_id}_${ts}`, entity_type, entity_id, operation, JSON.stringify(payload), ts, ts);
}
// ---------------- Classes ----------------
export async function listClasses() {
    const db = await getDb();
    return db
        .prepare("select * from classes where deleted_at is null and archived_at is null order by name")
        .all();
}
/**
 * Soft-delete a class. Notes that reference it keep their `class_id`
 * pointer (filtered out by `deleted_at` joins); we leave that decision
 * to the caller because in practice users may want to re-create the
 * class with the same id, or move notes elsewhere first.
 */
export async function softDeleteClass(id) {
    const db = await getDb();
    const ts = nowIso();
    db.prepare("update classes set deleted_at = ?, updated_at = ? where id = ?").run(ts, ts, id);
    await enqueue("classes", id, "delete", { id, deleted_at: ts });
}
/**
 * Archive (deactivate) a class — hidden from active lists; notes keep class_id.
 */
export async function archiveClass(id) {
    const db = await getDb();
    const ts = nowIso();
    db.prepare("update classes set archived_at = ?, updated_at = ? where id = ?").run(ts, ts, id);
    const row = db.prepare("select * from classes where id = ?").get(id);
    if (row)
        await enqueue("classes", id, "upsert", row);
}
export async function classAggregates() {
    const db = await getDb();
    const out = new Map();
    const ensure = (id) => {
        let cur = out.get(id);
        if (!cur) {
            cur = { notes: 0, flashcards: 0, quizzes: 0, totalTasks: 0, completedTasks: 0 };
            out.set(id, cur);
        }
        return cur;
    };
    const noteRows = db
        .prepare(`select class_id as id, count(*) as c from notes
       where deleted_at is null and class_id is not null
       group by class_id`)
        .all();
    for (const r of noteRows)
        ensure(r.id).notes = r.c;
    const flashRows = db
        .prepare(`select n.class_id as id, count(fc.id) as c
       from flashcards fc
       join flashcard_sets fs on fs.id = fc.set_id and fs.deleted_at is null
       join notes n on n.id = fs.note_id and n.deleted_at is null
       where fc.deleted_at is null and n.class_id is not null
       group by n.class_id`)
        .all();
    for (const r of flashRows)
        ensure(r.id).flashcards = r.c;
    const quizRows = db
        .prepare(`select n.class_id as id, count(qz.id) as c
       from quizzes qz
       join notes n on n.id = qz.note_id and n.deleted_at is null
       where qz.deleted_at is null and n.class_id is not null
       group by n.class_id`)
        .all();
    for (const r of quizRows)
        ensure(r.id).quizzes = r.c;
    const taskRows = db
        .prepare(`select coalesce(p.class_id, n.class_id) as id,
              sum(case when st.completed_at is not null then 1 else 0 end) as done,
              count(*) as total
       from study_tasks st
       left join study_plans p on p.id = st.plan_id and p.deleted_at is null
       left join notes n on n.id = st.note_id and n.deleted_at is null
       where st.deleted_at is null
         and coalesce(p.class_id, n.class_id) is not null
       group by coalesce(p.class_id, n.class_id)`)
        .all();
    for (const r of taskRows) {
        const cur = ensure(r.id);
        cur.totalTasks = r.total;
        cur.completedTasks = r.done;
    }
    return out;
}
/**
 * Next non-completed study task per class — used by the class card
 * "Next: …" footer. Tasks are matched via plan or note class.
 */
export async function nextTaskByClass() {
    const db = await getDb();
    const rows = db
        .prepare(`select st.*, coalesce(p.class_id, n.class_id) as resolved_class_id
       from study_tasks st
       left join study_plans p on p.id = st.plan_id and p.deleted_at is null
       left join notes n on n.id = st.note_id and n.deleted_at is null
       where st.deleted_at is null and st.completed_at is null
         and st.scheduled_for >= ?
         and coalesce(p.class_id, n.class_id) is not null
       order by st.scheduled_for`)
        .all(nowIso());
    const out = new Map();
    for (const r of rows) {
        const { resolved_class_id, ...task } = r;
        if (!out.has(resolved_class_id))
            out.set(resolved_class_id, task);
    }
    return out;
}
/**
 * Days-until-next-exam per class. We treat any study_task whose title
 * mentions "exam" / "midterm" / "final" as an exam, and also fall back
 * to study_plans.exam_date when no explicit task exists.
 */
export async function nextExamByClass() {
    const db = await getDb();
    const out = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const planRows = db
        .prepare(`select class_id, exam_date from study_plans
       where deleted_at is null and class_id is not null and exam_date is not null
         and exam_date >= ?
       order by exam_date`)
        .all(today.toISOString());
    for (const r of planRows) {
        if (out.has(r.class_id))
            continue;
        out.set(r.class_id, {
            iso: r.exam_date,
            days: Math.max(0, Math.round((new Date(r.exam_date).getTime() - today.getTime()) / 86_400_000)),
        });
    }
    const taskRows = db
        .prepare(`select coalesce(p.class_id, n.class_id) as class_id, st.scheduled_for as iso
       from study_tasks st
       left join study_plans p on p.id = st.plan_id and p.deleted_at is null
       left join notes n on n.id = st.note_id and n.deleted_at is null
       where st.deleted_at is null and st.completed_at is null
         and coalesce(p.class_id, n.class_id) is not null
         and st.scheduled_for >= ?
         and (lower(st.title) like '%exam%'
              or lower(st.title) like '%midterm%'
              or lower(st.title) like '%final%')
       order by st.scheduled_for`)
        .all(today.toISOString());
    for (const r of taskRows) {
        if (out.has(r.class_id))
            continue;
        out.set(r.class_id, {
            iso: r.iso,
            days: Math.max(0, Math.round((new Date(r.iso).getTime() - today.getTime()) / 86_400_000)),
        });
    }
    return out;
}
/**
 * "Weak topic" candidates for a class — flashcard fronts the user has
 * recently rated `hard`. We trim to the first short clause so the chip
 * stays readable.
 */
export async function weakTopicsForClass(classId, limit = 3) {
    const db = await getDb();
    const rows = db
        .prepare(`select fc.front
       from flashcards fc
       join flashcard_sets fs on fs.id = fc.set_id and fs.deleted_at is null
       join notes n on n.id = fs.note_id and n.deleted_at is null
       where fc.deleted_at is null
         and n.class_id = ?
         and fc.difficulty = 'hard'
       order by fc.last_reviewed_at desc, fc.updated_at desc
       limit ?`)
        .all(classId, limit);
    return rows.map((r) => trimToTopic(r.front));
}
/**
 * Flashcard sets that belong to *any* note in `classId`. Reused by the
 * class view's Flashcards tab to render decks the user can drop into.
 */
export async function flashcardSetsForClass(classId) {
    const db = await getDb();
    return db
        .prepare(`select fs.* from flashcard_sets fs
       join notes n on n.id = fs.note_id and n.deleted_at is null
       where fs.deleted_at is null and n.class_id = ?
       order by fs.created_at desc`)
        .all(classId);
}
/** Quizzes whose parent note belongs to `classId`. */
export async function quizzesForClass(classId) {
    const db = await getDb();
    return db
        .prepare(`select qz.* from quizzes qz
       join notes n on n.id = qz.note_id and n.deleted_at is null
       where qz.deleted_at is null and n.class_id = ?
       order by qz.created_at desc`)
        .all(classId);
}
/**
 * Study tasks scoped to `classId`. A task counts when EITHER its parent
 * plan OR its parent note resolves to the class — same join used by
 * `classAggregates`. Optionally filter by an inclusive ISO date range.
 */
export async function tasksForClass(classId, fromIso, toIso) {
    const db = await getDb();
    const params = [classId, classId];
    let where = "(p.class_id = ? or n.class_id = ?) and st.deleted_at is null";
    if (fromIso) {
        where += " and st.scheduled_for >= ?";
        params.push(fromIso);
    }
    if (toIso) {
        where += " and st.scheduled_for < ?";
        params.push(toIso);
    }
    return db
        .prepare(`select st.*
       from study_tasks st
       left join study_plans p on p.id = st.plan_id and p.deleted_at is null
       left join notes n on n.id = st.note_id and n.deleted_at is null
       where ${where}
       order by st.scheduled_for`)
        .all(...params);
}
/**
 * Class-scoped quiz stats. Same shape as `quizStats` but only counts
 * attempts against quizzes whose note belongs to `classId`.
 */
export async function quizStatsForClass(classId) {
    const db = await getDb();
    const rows = db
        .prepare(`select qa.score, qa.total
       from quiz_attempts qa
       join quizzes qz on qz.id = qa.quiz_id and qz.deleted_at is null
       join notes n on n.id = qz.note_id and n.deleted_at is null
       where qa.total > 0 and n.class_id = ?`)
        .all(classId);
    if (rows.length === 0)
        return { taken: 0, avgPct: 0, best: 0 };
    let pctSum = 0;
    let best = 0;
    for (const r of rows) {
        const pct = (r.score / r.total) * 100;
        pctSum += pct;
        if (pct > best)
            best = pct;
    }
    return {
        taken: rows.length,
        avgPct: Math.round(pctSum / rows.length),
        best: Math.round(best),
    };
}
/**
 * 7-day activity histogram for a single class. Drives the "Class
 * Activity" bar chart in the class view. We compute one day at a time
 * client-side instead of grouping in SQL because there are at most
 * seven buckets and the joins keep readability higher.
 */
export async function classActivityWeek(classId) {
    const db = await getDb();
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const noteRows = db
        .prepare(`select date(updated_at) as d, count(*) as c
       from notes where deleted_at is null and class_id = ?
       group by date(updated_at)`)
        .all(classId);
    const noteMap = new Map(noteRows.map((r) => [r.d, r.c]));
    const fcRows = db
        .prepare(`select date(fc.last_reviewed_at) as d, count(*) as c
       from flashcards fc
       join flashcard_sets fs on fs.id = fc.set_id and fs.deleted_at is null
       join notes n on n.id = fs.note_id and n.deleted_at is null
       where fc.deleted_at is null and fc.last_reviewed_at is not null
         and n.class_id = ?
       group by date(fc.last_reviewed_at)`)
        .all(classId);
    const fcMap = new Map(fcRows.map((r) => [r.d, r.c]));
    const qaRows = db
        .prepare(`select date(qa.created_at) as d, count(*) as c
       from quiz_attempts qa
       join quizzes qz on qz.id = qa.quiz_id and qz.deleted_at is null
       join notes n on n.id = qz.note_id and n.deleted_at is null
       where n.class_id = ?
       group by date(qa.created_at)`)
        .all(classId);
    const qaMap = new Map(qaRows.map((r) => [r.d, r.c]));
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const notesUpdated = noteMap.get(key) ?? 0;
        const flashcardsReviewed = fcMap.get(key) ?? 0;
        const quizAttempts = qaMap.get(key) ?? 0;
        days.push({
            date: key,
            notesUpdated,
            flashcardsReviewed,
            quizAttempts,
            total: notesUpdated + flashcardsReviewed + quizAttempts,
        });
    }
    return days;
}
function trimToTopic(front) {
    const cleaned = front.trim().replace(/[?.!:;]+$/g, "");
    if (cleaned.length <= 28)
        return cleaned;
    const cut = cleaned.slice(0, 28);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 12 ? cut.slice(0, lastSpace) : cut) + "…";
}
export async function upsertClass(input, opts = {}) {
    const db = await getDb();
    const ts = nowIso();
    const id = input.id ?? ulid("cls");
    let overviewText = null;
    if (input.overview_text !== undefined) {
        overviewText = input.overview_text;
    }
    else if (input.id) {
        const ex = db
            .prepare("select overview_text from classes where id = ?")
            .get(input.id);
        overviewText = ex?.overview_text ?? null;
    }
    const row = {
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
    const tx = db.transaction(() => {
        db.prepare(`insert into classes (id, name, code, color, created_at, updated_at, deleted_at, archived_at, overview_text)
       values (@id, @name, @code, @color, @created_at, @updated_at, @deleted_at, @archived_at, @overview_text)
       on conflict(id) do update set
         name=excluded.name, code=excluded.code, color=excluded.color,
         updated_at=excluded.updated_at, deleted_at=excluded.deleted_at,
         archived_at=excluded.archived_at, overview_text=excluded.overview_text`).run(row);
    });
    tx();
    if (!opts.skipOutbox)
        await enqueue("classes", row.id, "upsert", row);
    return row;
}
// ---------------- Notes ----------------
export async function listNotes(classId) {
    const db = await getDb();
    if (classId) {
        return db
            .prepare("select * from notes where deleted_at is null and class_id = ? order by updated_at desc")
            .all(classId);
    }
    return db
        .prepare("select * from notes where deleted_at is null order by updated_at desc")
        .all();
}
export async function getNote(id) {
    const db = await getDb();
    return db.prepare("select * from notes where id = ?").get(id) ?? null;
}
export async function upsertNote(input, opts = {}) {
    const db = await getDb();
    const ts = nowIso();
    const row = {
        id: input.id ?? ulid("nt"),
        class_id: input.class_id ?? null,
        title: input.title,
        content_markdown: input.content_markdown ?? "",
        summary: input.summary ?? null,
        tags_json: input.tags_json ?? "[]",
        icon: input.icon ?? "note",
        created_at: input.created_at ?? ts,
        updated_at: ts,
        deleted_at: input.deleted_at ?? null,
        sync_version: (input.sync_version ?? 0) + 1,
    };
    db.prepare(`insert into notes (id, class_id, title, content_markdown, summary, tags_json,
                        icon, created_at, updated_at, deleted_at, sync_version)
     values (@id, @class_id, @title, @content_markdown, @summary, @tags_json,
             @icon, @created_at, @updated_at, @deleted_at, @sync_version)
     on conflict(id) do update set
       class_id=excluded.class_id, title=excluded.title,
       content_markdown=excluded.content_markdown, summary=excluded.summary,
       tags_json=excluded.tags_json, icon=excluded.icon, updated_at=excluded.updated_at,
       deleted_at=excluded.deleted_at, sync_version=excluded.sync_version`).run(row);
    if (!opts.skipOutbox)
        await enqueue("notes", row.id, "upsert", row);
    return row;
}
export async function softDeleteNote(id) {
    const db = await getDb();
    const ts = nowIso();
    db.prepare("update notes set deleted_at = ?, updated_at = ? where id = ?").run(ts, ts, id);
    await enqueue("notes", id, "delete", { id, deleted_at: ts });
}
/**
 * Counts of notes updated at or after `iso`. Used for the "This Week"
 * smart collection — `iso` is typically `now - 7d` truncated to midnight.
 */
export async function notesUpdatedSince(iso) {
    const db = await getDb();
    const row = db
        .prepare("select count(*) as c from notes where deleted_at is null and updated_at >= ?")
        .get(iso);
    return row.c;
}
/**
 * Counts notes whose JSON tag array contains `tag` (case-insensitive
 * substring match — `tags_json` is a tiny TEXT blob, fine for hundreds
 * of notes). Powers the "Exam Prep" chip.
 */
export async function notesByTagLike(tag) {
    const db = await getDb();
    const like = `%${tag.toLowerCase()}%`;
    const row = db
        .prepare("select count(*) as c from notes where deleted_at is null and lower(tags_json) like ?")
        .get(like);
    return row.c;
}
/**
 * Counts distinct notes that have at least one non-deleted attachment of
 * the given type. Drives the "Audio Notes" / "Board Scans" chips.
 */
export async function notesWithAttachmentType(type) {
    const db = await getDb();
    const row = db
        .prepare(`select count(distinct n.id) as c
       from notes n
       join attachments a on a.note_id = n.id
       where n.deleted_at is null and a.deleted_at is null and a.type = ?`)
        .get(type);
    return row.c;
}
/**
 * Notes whose `updated_at` is older than `iso`. Stand-in for "Needs
 * Review" until we record an explicit "last opened" timestamp.
 */
export async function notesNotOpenedSince(iso) {
    const db = await getDb();
    const row = db
        .prepare("select count(*) as c from notes where deleted_at is null and updated_at < ?")
        .get(iso);
    return row.c;
}
/**
 * Recent notes that have neither a flashcard set nor a quiz attached.
 * Drives the "needs study tools" tile and seeds the AI Ready Queue.
 */
export async function notesMissingStudyTools(limit = 10) {
    const db = await getDb();
    return db
        .prepare(`select n.* from notes n
       where n.deleted_at is null
         and not exists (
           select 1 from flashcard_sets fs
           where fs.note_id = n.id and fs.deleted_at is null
         )
         and not exists (
           select 1 from quizzes qz
           where qz.note_id = n.id and qz.deleted_at is null
         )
       order by n.updated_at desc
       limit ?`)
        .all(limit);
}
/**
 * Notes whose AI summary hasn't been generated yet but which have
 * enough body to make summarisation worthwhile. Powers the "Summarize"
 * action in the AI Ready Queue.
 */
export async function notesNeedingSummary(limit = 10) {
    const db = await getDb();
    return db
        .prepare(`select * from notes
       where deleted_at is null
         and (summary is null or summary = '')
         and length(content_markdown) > 200
       order by updated_at desc
       limit ?`)
        .all(limit);
}
/**
 * Audio attachments whose transcript hasn't been generated yet — the
 * "needs transcription" tile counts these.
 */
export async function audioAttachmentsMissingTranscript() {
    const db = await getDb();
    const row = db
        .prepare(`select count(*) as c from attachments
       where deleted_at is null and type = 'audio'
         and (transcript is null or transcript = '')`)
        .get();
    return row.c;
}
/**
 * Notes (distinct entity_ids) with pending writes in the sync outbox.
 * Drives the "unsynced changes" tile.
 */
export async function unsyncedNotesCount() {
    const db = await getDb();
    const row = db
        .prepare(`select count(distinct entity_id) as c from sync_outbox
       where entity_type = 'notes' and synced_at is null`)
        .get();
    return row.c;
}
/**
 * Cloud sync progress for the sidebar: combine pull cursor, last successful
 * upload, and outbox backpressure. `lastActivityAt` is the more recent of pull
 * vs push so “just now” reflects a real round-trip, not only an empty pull.
 *
 * Also includes the most recent outbox error so the UI can show why uploads
 * are stuck instead of just a count.
 */
export async function getCloudSyncMeta() {
    const db = await getDb();
    const row = db
        .prepare("select last_pulled_at, last_pushed_at from sync_state where id = 1")
        .get();
    const pending = db
        .prepare("select count(*) as c from sync_outbox where synced_at is null")
        .get();
    const errRow = db
        .prepare(`select entity_type, last_error from sync_outbox
       where synced_at is null and last_error is not null
       order by retry_count desc, created_at desc limit 1`)
        .get();
    const lastPulledAt = row?.last_pulled_at ?? null;
    const lastPushedAt = row?.last_pushed_at ?? null;
    return {
        lastPulledAt,
        lastPushedAt,
        lastActivityAt: maxIso(lastPulledAt, lastPushedAt),
        pendingOutbox: pending.c,
        lastOutboxError: errRow
            ? { entity_type: errRow.entity_type, reason: errRow.last_error }
            : null,
    };
}
/** Outbox rows that have failed at least once; surfaced in Settings/diagnostics. */
export async function listOutboxErrors(limit = 20) {
    const db = await getDb();
    return db
        .prepare(`select id, entity_type, entity_id, retry_count, last_error, created_at
       from sync_outbox
       where synced_at is null and last_error is not null
       order by retry_count desc, created_at desc
       limit ?`)
        .all(limit);
}
/**
 * Existence checks for the AI Ready Queue heuristic — lets the UI pick
 * the next-best AI action per note (summarise → flashcards → quiz).
 */
export async function noteHasFlashcards(noteId) {
    const db = await getDb();
    const row = db
        .prepare("select 1 as x from flashcard_sets where note_id = ? and deleted_at is null limit 1")
        .get(noteId);
    return !!row;
}
export async function noteHasQuiz(noteId) {
    const db = await getDb();
    const row = db
        .prepare("select 1 as x from quizzes where note_id = ? and deleted_at is null limit 1")
        .get(noteId);
    return !!row;
}
/**
 * Lightweight LIKE search across note title + body. Good enough for the
 * home hero typeahead — we keep it bounded so a long-running query never
 * blocks paint.
 */
export async function searchNotes(query, limit = 8) {
    const trimmed = query.trim();
    if (!trimmed)
        return [];
    const db = await getDb();
    const like = `%${trimmed.replace(/[%_]/g, (c) => `\\${c}`)}%`;
    return db
        .prepare(`select * from notes
       where deleted_at is null
         and (title like ? escape '\\' or content_markdown like ? escape '\\')
       order by updated_at desc
       limit ?`)
        .all(like, like, limit);
}
/**
 * Per-note attachment summary used by the "All Notes" table — returns one
 * row per note that has at least one non-deleted attachment, with counts
 * keyed by attachment type.
 */
export async function attachmentCountsByNote() {
    const db = await getDb();
    const rows = db
        .prepare(`select note_id as id, type, count(*) as c
       from attachments where deleted_at is null
       group by note_id, type`)
        .all();
    const out = new Map();
    for (const r of rows) {
        const cur = out.get(r.id) ?? { audio: 0, image: 0, pdf: 0, file: 0, total: 0 };
        if (r.type === "audio")
            cur.audio += r.c;
        else if (r.type === "image")
            cur.image += r.c;
        else if (r.type === "pdf")
            cur.pdf += r.c;
        else
            cur.file += r.c;
        cur.total += r.c;
        out.set(r.id, cur);
    }
    return out;
}
/**
 * Set of note ids that currently have unsynced writes pending in the
 * outbox. Drives the per-row "sync status" pill on the All Notes page.
 */
export async function unsyncedNoteIds() {
    const db = await getDb();
    const rows = db
        .prepare(`select distinct entity_id as id from sync_outbox
       where entity_type = 'notes' and synced_at is null`)
        .all();
    return new Set(rows.map((r) => r.id));
}
/**
 * Set of note ids that have at least one flashcard set OR quiz attached.
 * Used to flag rows as "Ready" in the AI status column.
 */
export async function noteIdsWithStudyTools() {
    const db = await getDb();
    const rows = db
        .prepare(`select distinct n.id as id
       from notes n
       where n.deleted_at is null
         and (
           exists (select 1 from flashcard_sets fs where fs.note_id = n.id and fs.deleted_at is null)
           or exists (select 1 from quizzes qz where qz.note_id = n.id and qz.deleted_at is null)
         )`)
        .all();
    return new Set(rows.map((r) => r.id));
}
// ---------------- Attachments ----------------
export async function upsertAttachment(input, opts = {}) {
    const db = await getDb();
    const ts = nowIso();
    const row = {
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
    db.prepare(`insert into attachments
       (id, note_id, type, local_uri, remote_url, file_name, mime_type,
        size_bytes, transcript, extracted_text, created_at, updated_at, deleted_at)
     values (@id, @note_id, @type, @local_uri, @remote_url, @file_name, @mime_type,
             @size_bytes, @transcript, @extracted_text, @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       type=excluded.type, local_uri=excluded.local_uri, remote_url=excluded.remote_url,
       file_name=excluded.file_name, mime_type=excluded.mime_type, size_bytes=excluded.size_bytes,
       transcript=excluded.transcript, extracted_text=excluded.extracted_text,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`).run(row);
    if (!opts.skipOutbox)
        await enqueue("attachments", row.id, "upsert", row);
    return row;
}
// ---------------- Flashcards ----------------
export async function upsertFlashcardSet(input, opts = {}) {
    const db = await getDb();
    const ts = nowIso();
    const row = {
        id: input.id ?? ulid("fcs"),
        note_id: input.note_id ?? null,
        title: input.title,
        created_at: input.created_at ?? ts,
        updated_at: ts,
        deleted_at: input.deleted_at ?? null,
    };
    db.prepare(`insert into flashcard_sets (id, note_id, title, created_at, updated_at, deleted_at)
     values (@id, @note_id, @title, @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       note_id=excluded.note_id, title=excluded.title,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`).run(row);
    if (!opts.skipOutbox)
        await enqueue("flashcard_sets", row.id, "upsert", row);
    return row;
}
export async function upsertFlashcard(input, opts = {}) {
    const db = await getDb();
    const ts = nowIso();
    const row = {
        id: input.id ?? ulid("fc"),
        set_id: input.set_id,
        front: input.front,
        back: input.back,
        difficulty: input.difficulty ?? "new",
        due_at: input.due_at ?? ts,
        last_reviewed_at: input.last_reviewed_at ?? null,
        review_count: input.review_count ?? 0,
        ease: input.ease ?? 2.5,
        interval_days: input.interval_days ?? 0,
        created_at: input.created_at ?? ts,
        updated_at: ts,
        deleted_at: input.deleted_at ?? null,
    };
    db.prepare(`insert into flashcards
       (id, set_id, front, back, difficulty, due_at, last_reviewed_at,
        review_count, ease, interval_days, created_at, updated_at, deleted_at)
     values (@id, @set_id, @front, @back, @difficulty, @due_at, @last_reviewed_at,
             @review_count, @ease, @interval_days, @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       front=excluded.front, back=excluded.back, difficulty=excluded.difficulty,
       due_at=excluded.due_at, last_reviewed_at=excluded.last_reviewed_at,
       review_count=excluded.review_count, ease=excluded.ease,
       interval_days=excluded.interval_days, updated_at=excluded.updated_at,
       deleted_at=excluded.deleted_at`).run(row);
    if (!opts.skipOutbox)
        await enqueue("flashcards", row.id, "upsert", row);
    return row;
}
export async function listFlashcardSets(noteId) {
    const db = await getDb();
    if (noteId) {
        return db
            .prepare("select * from flashcard_sets where deleted_at is null and note_id = ? order by created_at desc")
            .all(noteId);
    }
    return db
        .prepare("select * from flashcard_sets where deleted_at is null order by created_at desc")
        .all();
}
export async function listFlashcards(setId) {
    const db = await getDb();
    return db
        .prepare("select * from flashcards where deleted_at is null and set_id = ? order by created_at")
        .all(setId);
}
export async function listDueFlashcards(limit = 20) {
    const db = await getDb();
    const now = nowIso();
    return db
        .prepare(`select * from flashcards
       where deleted_at is null and (due_at is null or due_at <= ?)
       order by due_at limit ?`)
        .all(now, limit);
}
/**
 * Mastery / weakness thresholds reused across hub stats, deck cards,
 * and the deck-detail rail. Tuned to feel right with the SM-2-ish
 * scheduler in `Flashcards.tsx`: a card that's been pushed out three
 * weeks counts as "mastered", and any card the user explicitly rated
 * `hard` is "weak" until it's promoted again.
 */
export const FC_MASTERED_INTERVAL_DAYS = 21;
const EMPTY_DECK_STATS = {
    total: 0,
    due: 0,
    mastered: 0,
    weak: 0,
    mastery_pct: 0,
};
/** Per-deck rollup used by the deck grid + deck-detail rail. */
export async function deckStats(setId) {
    const db = await getDb();
    const now = nowIso();
    const row = db
        .prepare(`select
         count(*) as total,
         sum(case when (due_at is null or due_at <= ?) then 1 else 0 end) as due,
         sum(case when interval_days >= ? then 1 else 0 end) as mastered,
         sum(case when difficulty = 'hard' then 1 else 0 end) as weak
       from flashcards
       where deleted_at is null and set_id = ?`)
        .get(now, FC_MASTERED_INTERVAL_DAYS, setId);
    if (!row || !row.total)
        return EMPTY_DECK_STATS;
    return {
        total: row.total,
        due: row.due,
        mastered: row.mastered,
        weak: row.weak,
        mastery_pct: row.total > 0 ? row.mastered / row.total : 0,
    };
}
/**
 * Aggregate stats for the four hero tiles on the Flashcards hub. Done in
 * a single round-trip so the hub paint doesn't wait on N small queries.
 */
export async function flashcardsHubStats() {
    const db = await getDb();
    const now = nowIso();
    const due = db
        .prepare(`select count(*) as c from flashcards
       where deleted_at is null and (due_at is null or due_at <= ?)`)
        .get(now);
    const totalDecks = db
        .prepare(`select count(*) as c from flashcard_sets where deleted_at is null`)
        .get();
    const mastered = db
        .prepare(`select count(*) as c from flashcards
       where deleted_at is null and interval_days >= ?`)
        .get(FC_MASTERED_INTERVAL_DAYS);
    const streak = await currentStreak();
    return {
        dueToday: due.c,
        totalDecks: totalDecks.c,
        mastered: mastered.c,
        studyStreakDays: streak,
    };
}
/**
 * One row per non-deleted deck, joined with its parent note + class id
 * and a precomputed stats blob. Drives the hub deck grid and the
 * deck-detail rail's class header.
 */
export async function listDeckSummaries() {
    const db = await getDb();
    const now = nowIso();
    const sets = db
        .prepare(`select * from flashcard_sets where deleted_at is null
       order by updated_at desc, created_at desc`)
        .all();
    if (sets.length === 0)
        return [];
    const noteIds = Array.from(new Set(sets.map((s) => s.note_id).filter((v) => !!v)));
    const notes = noteIds.length
        ? db
            .prepare(`select * from notes where id in (${noteIds.map(() => "?").join(",")})`)
            .all(...noteIds)
        : [];
    const noteById = new Map(notes.map((n) => [n.id, n]));
    const summaries = [];
    for (const set of sets) {
        const stats = await deckStats(set.id);
        const next = db
            .prepare(`select due_at from flashcards
         where deleted_at is null and set_id = ?
           and due_at is not null and due_at > ?
         order by due_at limit 1`)
            .get(set.id, now);
        const note = set.note_id ? noteById.get(set.note_id) ?? null : null;
        summaries.push({
            set,
            note,
            classId: note?.class_id ?? null,
            stats,
            nextDueAt: next?.due_at ?? null,
        });
    }
    return summaries;
}
/**
 * Cards filtered by review mode for the active deck:
 *  - `due`   — only cards whose `due_at` is now-or-earlier (SM-2 schedule).
 *  - `cram`  — every card in the deck, scheduling ignored. Order by
 *              creation so a fresh review doesn't surprise the user.
 *  - `weak`  — anything currently rated `hard`, regardless of schedule.
 *  - `audio` — same set as `due`; the review screen layers on speech.
 */
export async function listFlashcardsByMode(setId, mode) {
    const db = await getDb();
    const now = nowIso();
    if (mode === "weak") {
        return db
            .prepare(`select * from flashcards
         where deleted_at is null and set_id = ? and difficulty = 'hard'
         order by last_reviewed_at desc, created_at`)
            .all(setId);
    }
    if (mode === "cram") {
        return db
            .prepare(`select * from flashcards
         where deleted_at is null and set_id = ?
         order by created_at`)
            .all(setId);
    }
    return db
        .prepare(`select * from flashcards
       where deleted_at is null and set_id = ?
         and (due_at is null or due_at <= ?)
       order by due_at`)
        .all(setId, now);
}
/**
 * Mark a single card "weak" so it surfaces in the Weak Cards deck. We
 * also reset `due_at` to now so the next due-cycle picks it up.
 */
export async function markCardForReview(cardId) {
    const db = await getDb();
    const ts = nowIso();
    const row = db
        .prepare("select * from flashcards where id = ?")
        .get(cardId);
    if (!row)
        return;
    await upsertFlashcard({
        ...row,
        difficulty: "hard",
        due_at: ts,
        updated_at: ts,
    });
}
/** Earliest future due timestamp for a deck, or null when nothing scheduled. */
export async function nextReviewDateForDeck(setId) {
    const db = await getDb();
    const now = nowIso();
    const row = db
        .prepare(`select due_at from flashcards
       where deleted_at is null and set_id = ?
         and due_at is not null and due_at > ?
       order by due_at limit 1`)
        .get(setId, now);
    return row?.due_at ?? null;
}
/**
 * Decks topically similar to the given card. We tokenize the card's
 * front into 4+ char keywords and rank other (non-deleted) decks by how
 * many of those tokens appear in any of their cards. Cheap O(N×k) scan
 * over typically <100 decks — fine for the side rail.
 */
export async function relatedDecksForCard(cardId, limit = 3) {
    const db = await getDb();
    const card = db
        .prepare("select * from flashcards where id = ?")
        .get(cardId);
    if (!card)
        return [];
    const tokens = new Set(card.front
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 3));
    if (tokens.size === 0)
        return [];
    const summaries = await listDeckSummaries();
    const others = summaries.filter((s) => s.set.id !== card.set_id);
    if (others.length === 0)
        return [];
    const scored = others.map((s) => {
        const fronts = db
            .prepare(`select lower(front || ' ' || back) as t from flashcards
         where deleted_at is null and set_id = ?`)
            .all(s.set.id);
        let score = 0;
        for (const row of fronts) {
            for (const tok of tokens)
                if (row.t.includes(tok))
                    score += 1;
        }
        return { summary: s, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored
        .filter((x) => x.score > 0)
        .slice(0, limit)
        .map((x) => x.summary);
}
/**
 * Decks whose newest review is older than `cutoffIso`. Drives the
 * "Decks not reviewed in 5+ days" row in the Needs Attention card.
 */
export async function decksNotReviewedSince(cutoffIso) {
    const db = await getDb();
    const row = db
        .prepare(`select count(*) as c from flashcard_sets fs
       where fs.deleted_at is null
         and (
           select max(coalesce(fc.last_reviewed_at, fc.created_at))
           from flashcards fc
           where fc.set_id = fs.id and fc.deleted_at is null
         ) < ?`)
        .get(cutoffIso);
    return row.c;
}
/**
 * Decks whose parent note doesn't yet have any quiz attached. Powers
 * the "Decks ready for quiz generation" row in Needs Attention.
 */
export async function decksMissingQuiz() {
    const db = await getDb();
    const row = db
        .prepare(`select count(*) as c from flashcard_sets fs
       where fs.deleted_at is null and fs.note_id is not null
         and not exists (
           select 1 from quizzes qz
           where qz.note_id = fs.note_id and qz.deleted_at is null
         )`)
        .get();
    return row.c;
}
/** Count of all currently weak (hard-rated) cards across every deck. */
export async function totalWeakCards() {
    const db = await getDb();
    const row = db
        .prepare(`select count(*) as c from flashcards
       where deleted_at is null and difficulty = 'hard'`)
        .get();
    return row.c;
}
// ---------------- Quizzes ----------------
export async function upsertQuiz(input, opts = {}) {
    const db = await getDb();
    const ts = nowIso();
    const row = {
        id: input.id ?? ulid("qz"),
        note_id: input.note_id ?? null,
        class_id: input.class_id ?? null,
        title: input.title,
        description: input.description ?? null,
        difficulty: input.difficulty ?? "medium",
        status: input.status ?? "new",
        source_type: input.source_type ?? "note",
        source_ids_json: input.source_ids_json ?? null,
        weak_topics_json: input.weak_topics_json ?? null,
        tags_json: input.tags_json ?? null,
        created_at: input.created_at ?? ts,
        updated_at: ts,
        deleted_at: input.deleted_at ?? null,
    };
    db.prepare(`insert into quizzes
       (id, note_id, class_id, title, description, difficulty, status,
        source_type, source_ids_json, weak_topics_json, tags_json,
        created_at, updated_at, deleted_at)
     values (@id, @note_id, @class_id, @title, @description, @difficulty, @status,
             @source_type, @source_ids_json, @weak_topics_json, @tags_json,
             @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       note_id=excluded.note_id, class_id=excluded.class_id, title=excluded.title,
       description=excluded.description, difficulty=excluded.difficulty,
       status=excluded.status, source_type=excluded.source_type,
       source_ids_json=excluded.source_ids_json,
       weak_topics_json=excluded.weak_topics_json, tags_json=excluded.tags_json,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`).run(row);
    if (!opts.skipOutbox)
        await enqueue("quizzes", row.id, "upsert", row);
    return row;
}
export async function upsertQuizQuestion(input, opts = {}) {
    const db = await getDb();
    const ts = nowIso();
    const row = {
        id: input.id ?? ulid("qq"),
        quiz_id: input.quiz_id,
        type: input.type,
        question: input.question,
        options_json: input.options_json ?? null,
        correct_answer: input.correct_answer,
        explanation: input.explanation ?? null,
        topic: input.topic ?? null,
        hint: input.hint ?? null,
        source_note_id: input.source_note_id ?? null,
        position: input.position ?? null,
        created_at: input.created_at ?? ts,
        updated_at: ts,
        deleted_at: input.deleted_at ?? null,
    };
    db.prepare(`insert into quiz_questions
       (id, quiz_id, type, question, options_json, correct_answer, explanation,
        topic, hint, source_note_id, position,
        created_at, updated_at, deleted_at)
     values (@id, @quiz_id, @type, @question, @options_json, @correct_answer, @explanation,
             @topic, @hint, @source_note_id, @position,
             @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       type=excluded.type, question=excluded.question, options_json=excluded.options_json,
       correct_answer=excluded.correct_answer, explanation=excluded.explanation,
       topic=excluded.topic, hint=excluded.hint,
       source_note_id=excluded.source_note_id, position=excluded.position,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`).run(row);
    if (!opts.skipOutbox)
        await enqueue("quiz_questions", row.id, "upsert", row);
    return row;
}
export async function softDeleteQuiz(id) {
    const db = await getDb();
    const ts = nowIso();
    db.prepare("update quizzes set deleted_at = ?, updated_at = ? where id = ?").run(ts, ts, id);
    await enqueue("quizzes", id, "delete", { id, deleted_at: ts });
}
export async function listQuizzes(noteId) {
    const db = await getDb();
    if (noteId) {
        return db
            .prepare("select * from quizzes where deleted_at is null and note_id = ? order by created_at desc")
            .all(noteId);
    }
    return db
        .prepare("select * from quizzes where deleted_at is null order by created_at desc")
        .all();
}
export async function getQuiz(id) {
    const db = await getDb();
    return (db.prepare("select * from quizzes where id = ?").get(id) ?? null);
}
export async function listQuizQuestions(quizId) {
    const db = await getDb();
    return db
        .prepare(`select * from quiz_questions
       where deleted_at is null and quiz_id = ?
       order by coalesce(position, 9999), created_at`)
        .all(quizId);
}
/**
 * Aggregates over all `quiz_attempts` rows. We average per-attempt
 * percentages so a single 100/100 attempt isn't drowned out by a long
 * 70/100 attempt.
 */
export async function quizStats() {
    const db = await getDb();
    const rows = db
        .prepare("select score, total from quiz_attempts where total > 0 and completed = 1")
        .all();
    if (rows.length === 0)
        return { taken: 0, avgPct: 0, best: 0 };
    let pctSum = 0;
    let best = 0;
    for (const r of rows) {
        const pct = (r.score / r.total) * 100;
        pctSum += pct;
        if (pct > best)
            best = pct;
    }
    return {
        taken: rows.length,
        avgPct: Math.round(pctSum / rows.length),
        best: Math.round(best),
    };
}
export async function fetchBadgeProgressMetrics() {
    const db = await getDb();
    const noteRow = db
        .prepare("select count(*) as c from notes where deleted_at is null")
        .get();
    const classRow = db
        .prepare("select count(*) as c from classes where deleted_at is null")
        .get();
    const fcRow = db
        .prepare("select coalesce(sum(review_count), 0) as s from flashcards where deleted_at is null")
        .get();
    const [qs, streak, xp] = await Promise.all([
        quizStats(),
        currentStreak(),
        totalXp(),
    ]);
    return {
        noteCount: noteRow.c,
        classCount: classRow.c,
        quizAttempts: qs.taken,
        quizBestPct: qs.best,
        flashcardReviews: fcRow.s,
        streak,
        totalXp: xp,
    };
}
/**
 * One row per non-deleted quiz with computed last/best score and a
 * resolved class id. We do the joins in SQL but compute percentages
 * client-side because the existing `quiz_attempts.total` can be 0 for
 * abandoned attempts.
 */
export async function quizSummaries() {
    const db = await getDb();
    const quizzes = db
        .prepare(`select qz.*, n.class_id as note_class_id, n.title as note_title
       from quizzes qz
       left join notes n on n.id = qz.note_id and n.deleted_at is null
       where qz.deleted_at is null
       order by qz.updated_at desc, qz.created_at desc`)
        .all();
    if (quizzes.length === 0)
        return [];
    const ids = quizzes.map((q) => q.id);
    const placeholders = ids.map(() => "?").join(",");
    const counts = db
        .prepare(`select quiz_id, count(*) as c from quiz_questions
       where deleted_at is null and quiz_id in (${placeholders})
       group by quiz_id`)
        .all(...ids);
    const countByQuiz = new Map(counts.map((r) => [r.quiz_id, r.c]));
    const attempts = db
        .prepare(`select quiz_id, score, total, created_at, finished_at, completed
       from quiz_attempts where quiz_id in (${placeholders})
       order by created_at desc`)
        .all(...ids);
    const sessions = db
        .prepare(`select quiz_id from quiz_sessions where quiz_id in (${placeholders})`)
        .all(...ids);
    const sessionSet = new Set(sessions.map((s) => s.quiz_id));
    const unsynced = db
        .prepare(`select distinct entity_id as id from sync_outbox
       where entity_type = 'quizzes' and synced_at is null
         and entity_id in (${placeholders})`)
        .all(...ids);
    const unsyncedSet = new Set(unsynced.map((u) => u.id));
    const out = [];
    for (const q of quizzes) {
        const my = attempts.filter((a) => a.quiz_id === q.id && a.completed === 1 && a.total > 0);
        let lastPct = null;
        let bestPct = null;
        let lastAt = null;
        for (const a of my) {
            const pct = Math.round((a.score / a.total) * 100);
            const at = a.finished_at ?? a.created_at;
            if (lastAt === null || at > lastAt) {
                lastAt = at;
                lastPct = pct;
            }
            if (bestPct === null || pct > bestPct)
                bestPct = pct;
        }
        const inProgress = sessionSet.has(q.id);
        const status = inProgress
            ? "in_progress"
            : my.length > 0
                ? "completed"
                : "new";
        out.push({
            quiz: q,
            classId: q.class_id ?? q.note_class_id ?? null,
            noteTitle: q.note_title,
            questionCount: countByQuiz.get(q.id) ?? 0,
            attempts: my.length,
            lastScorePct: lastPct,
            bestScorePct: bestPct,
            lastAttemptAt: lastAt,
            status,
            needsReview: lastPct !== null && lastPct < 70,
            unsynced: unsyncedSet.has(q.id),
        });
    }
    return out;
}
export async function quizzesHubStats() {
    const db = await getDb();
    const baseStats = await quizStats();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueRow = db
        .prepare(`select count(*) as c from study_tasks
       where deleted_at is null and type = 'quiz'
         and scheduled_for >= ? and scheduled_for < ?
         and completed_at is null`)
        .get(today.toISOString(), tomorrow.toISOString());
    const topicSet = new Set();
    const recent = db
        .prepare(`select weak_topics_json from quiz_attempts
       where weak_topics_json is not null and completed = 1
       order by created_at desc limit 25`)
        .all();
    for (const r of recent) {
        if (!r.weak_topics_json)
            continue;
        try {
            const arr = JSON.parse(r.weak_topics_json);
            if (Array.isArray(arr))
                for (const t of arr)
                    if (typeof t === "string" && t.trim())
                        topicSet.add(t.trim());
        }
        catch {
            /* drop */
        }
    }
    return {
        taken: baseStats.taken,
        avgPct: baseStats.avgPct,
        weakTopicCount: topicSet.size,
        dueToday: dueRow.c,
    };
}
/** Topic labels surfaced by aggregating recent attempts' weak_topics_json. */
export async function recentWeakTopics(limit = 8) {
    const db = await getDb();
    const rows = db
        .prepare(`select weak_topics_json from quiz_attempts
       where weak_topics_json is not null and completed = 1
       order by created_at desc limit 50`)
        .all();
    const counts = new Map();
    for (const r of rows) {
        if (!r.weak_topics_json)
            continue;
        try {
            const arr = JSON.parse(r.weak_topics_json);
            if (!Array.isArray(arr))
                continue;
            for (const t of arr) {
                if (typeof t !== "string")
                    continue;
                const k = t.trim();
                if (!k)
                    continue;
                counts.set(k, (counts.get(k) ?? 0) + 1);
            }
        }
        catch {
            /* drop */
        }
    }
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([k]) => k);
}
export async function quizAttemptsForQuiz(quizId) {
    const db = await getDb();
    return db
        .prepare(`select * from quiz_attempts where quiz_id = ?
       order by created_at desc`)
        .all(quizId);
}
/**
 * For the most recent completed attempt on a quiz, group questions by
 * `topic` and report correct / total counts. Used by the results screen.
 */
export async function topicPerformance(quizId, attemptId) {
    const db = await getDb();
    const attempt = attemptId
        ? db.prepare("select * from quiz_attempts where id = ?").get(attemptId)
        : db
            .prepare(`select * from quiz_attempts where quiz_id = ? and completed = 1
           order by created_at desc limit 1`)
            .get(quizId);
    if (!attempt)
        return [];
    let answers = {};
    try {
        const parsed = JSON.parse(attempt.answers_json);
        if (parsed && typeof parsed === "object") {
            answers = parsed;
        }
    }
    catch {
        /* drop */
    }
    const questions = await listQuizQuestions(quizId);
    const buckets = new Map();
    for (const q of questions) {
        const topic = (q.topic ?? "General").trim() || "General";
        const cur = buckets.get(topic) ?? { total: 0, correct: 0 };
        cur.total += 1;
        const a = (answers[q.id] ?? "").trim().toLowerCase();
        const correct = q.correct_answer.trim().toLowerCase();
        if (a && a === correct)
            cur.correct += 1;
        buckets.set(topic, cur);
    }
    return Array.from(buckets.entries())
        .map(([topic, v]) => ({
        topic,
        total: v.total,
        correct: v.correct,
        pct: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    }))
        .sort((a, b) => a.pct - b.pct);
}
export async function recordQuizAttempt(args) {
    const db = await getDb();
    const ts = nowIso();
    const row = {
        id: ulid("qa"),
        quiz_id: args.quiz_id,
        score: args.score,
        total: args.total,
        answers_json: JSON.stringify(args.answers),
        started_at: args.started_at,
        finished_at: args.finished_at,
        completed: args.completed === false ? 0 : 1,
        weak_topics_json: JSON.stringify(args.weak_topics),
        time_spent_seconds: args.time_spent_seconds,
        created_at: ts,
    };
    db.prepare(`insert into quiz_attempts
       (id, quiz_id, score, total, answers_json, started_at, finished_at,
        completed, weak_topics_json, time_spent_seconds, created_at)
     values (@id, @quiz_id, @score, @total, @answers_json, @started_at, @finished_at,
             @completed, @weak_topics_json, @time_spent_seconds, @created_at)`).run(row);
    await enqueue("quiz_attempts", row.id, "upsert", row);
    if (row.completed === 1) {
        const quiz = await getQuiz(args.quiz_id);
        if (quiz) {
            await upsertQuiz({
                ...quiz,
                status: "completed",
                weak_topics_json: JSON.stringify(args.weak_topics),
            });
        }
    }
    return row;
}
// ---------------- Quiz sessions (resume) ----------------
export async function getQuizSession(quizId) {
    const db = await getDb();
    return (db.prepare("select * from quiz_sessions where quiz_id = ?").get(quizId) ?? null);
}
export async function saveQuizSession(input, opts = {}) {
    const db = await getDb();
    const ts = nowIso();
    const existing = await getQuizSession(input.quiz_id);
    const row = {
        quiz_id: input.quiz_id,
        current_index: Math.max(0, input.current_index | 0),
        answers_json: JSON.stringify(input.answers ?? {}),
        started_at: existing?.started_at ?? input.started_at ?? ts,
        updated_at: ts,
    };
    db.prepare(`insert into quiz_sessions (quiz_id, current_index, answers_json, started_at, updated_at)
     values (@quiz_id, @current_index, @answers_json, @started_at, @updated_at)
     on conflict(quiz_id) do update set
       current_index=excluded.current_index, answers_json=excluded.answers_json,
       updated_at=excluded.updated_at`).run(row);
    if (!existing) {
        const quiz = await getQuiz(input.quiz_id);
        if (quiz && quiz.status !== "in_progress") {
            await upsertQuiz({ ...quiz, status: "in_progress" });
        }
    }
    if (!opts.skipOutbox) {
        await enqueue("quiz_sessions", input.quiz_id, "upsert", row);
    }
    return row;
}
export async function clearQuizSession(quizId) {
    const db = await getDb();
    db.prepare("delete from quiz_sessions where quiz_id = ?").run(quizId);
    await enqueue("quiz_sessions", quizId, "delete", { quiz_id: quizId });
}
// ---------------- Study plans / tasks ----------------
export async function upsertStudyPlan(input, opts = {}) {
    const db = await getDb();
    const ts = nowIso();
    const row = {
        id: input.id ?? ulid("plan"),
        title: input.title,
        class_id: input.class_id ?? null,
        exam_date: input.exam_date ?? null,
        created_at: input.created_at ?? ts,
        updated_at: ts,
        deleted_at: input.deleted_at ?? null,
    };
    db.prepare(`insert into study_plans (id, title, class_id, exam_date, created_at, updated_at, deleted_at)
     values (@id, @title, @class_id, @exam_date, @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       title=excluded.title, class_id=excluded.class_id, exam_date=excluded.exam_date,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`).run(row);
    if (!opts.skipOutbox)
        await enqueue("study_plans", row.id, "upsert", row);
    return row;
}
export async function upsertStudyTask(input, opts = {}) {
    const db = await getDb();
    const ts = nowIso();
    // Forward writes that originated from a synthesized calendar_event
    // (id prefixed `evt_`) onto the calendar_events table so widget
    // toggles like "mark complete" reflect on the new Calendar without
    // creating a phantom study_tasks row alongside the event.
    if (input.id && input.id.startsWith("evt_") && !opts.skipOutbox) {
        const ev = db
            .prepare("select * from calendar_events where id = ?")
            .get(input.id);
        if (ev) {
            const isCompleted = !!input.completed_at;
            db.prepare(`update calendar_events
         set status = ?, updated_at = ?, sync_version = sync_version + 1
         where id = ?`).run(isCompleted ? "completed" : "scheduled", ts, input.id);
            const refreshed = db
                .prepare("select * from calendar_events where id = ?")
                .get(input.id);
            await enqueue("calendar_events", input.id, "upsert", refreshed);
            return {
                id: input.id,
                plan_id: input.plan_id ?? null,
                note_id: input.note_id ?? null,
                title: input.title,
                type: input.type,
                scheduled_for: input.scheduled_for,
                duration_minutes: input.duration_minutes ?? 20,
                completed_at: input.completed_at ?? null,
                created_at: input.created_at ?? ts,
                updated_at: ts,
                deleted_at: input.deleted_at ?? null,
            };
        }
    }
    const row = {
        id: input.id ?? ulid("tsk"),
        plan_id: input.plan_id ?? null,
        note_id: input.note_id ?? null,
        title: input.title,
        type: input.type,
        scheduled_for: input.scheduled_for,
        duration_minutes: input.duration_minutes ?? 20,
        completed_at: input.completed_at ?? null,
        created_at: input.created_at ?? ts,
        updated_at: ts,
        deleted_at: input.deleted_at ?? null,
    };
    db.prepare(`insert into study_tasks
       (id, plan_id, note_id, title, type, scheduled_for, duration_minutes,
        completed_at, created_at, updated_at, deleted_at)
     values (@id, @plan_id, @note_id, @title, @type, @scheduled_for, @duration_minutes,
             @completed_at, @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       plan_id=excluded.plan_id, note_id=excluded.note_id, title=excluded.title,
       type=excluded.type, scheduled_for=excluded.scheduled_for,
       duration_minutes=excluded.duration_minutes, completed_at=excluded.completed_at,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`).run(row);
    if (!opts.skipOutbox)
        await enqueue("study_tasks", row.id, "upsert", row);
    return row;
}
/**
 * Returns scheduled study tasks in `[fromIso, toIso)` from the legacy
 * `study_tasks` table joined with the newer `calendar_events` table,
 * adapted to the same `StudyTaskRow` shape so existing widgets
 * (Home, RightPanel) keep working without modification while we
 * migrate them to read calendar_events directly.
 *
 * Dedup rule: events whose id is `evt_legacy_<x>` were created by
 * `ensureCalendarBackfill` and represent the same entity as the
 * `study_tasks` row with id `<x>`. We hide those mirrors so the user
 * doesn't see double rows. New events created via the Calendar UI
 * (regular `evt_…` ids) flow through as synthetic study tasks.
 */
export async function listTasksForRange(fromIso, toIso) {
    const db = await getDb();
    const tasks = db
        .prepare(`select * from study_tasks where deleted_at is null
       and scheduled_for >= ? and scheduled_for < ? order by scheduled_for`)
        .all(fromIso, toIso);
    const events = db
        .prepare(`select id, title, type, note_id, study_plan_id, start_at, end_at,
              status, created_at, updated_at
       from calendar_events
       where deleted_at is null
         and id not like 'evt_legacy_%'
         and start_at >= ? and start_at < ?
       order by start_at`)
        .all(fromIso, toIso);
    const synthesized = events.map((e) => ({
        id: e.id,
        plan_id: e.study_plan_id,
        note_id: e.note_id,
        title: e.title,
        type: mapEventTypeToTaskType(e.type),
        scheduled_for: e.start_at,
        duration_minutes: Math.max(5, Math.round((new Date(e.end_at).getTime() - new Date(e.start_at).getTime()) / 60_000)),
        completed_at: e.status === "completed" ? e.updated_at : null,
        created_at: e.created_at,
        updated_at: e.updated_at,
        deleted_at: null,
    }));
    return [...tasks, ...synthesized].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
}
function mapEventTypeToTaskType(t) {
    switch (t) {
        case "flashcards":
            return "flashcards";
        case "quiz":
            return "quiz";
        case "reading":
            return "read";
        case "assignment":
            return "write";
        case "exam":
        case "study_block":
        case "reminder":
        case "class":
        case "custom":
        default:
            return "review";
    }
}
// ---------------- XP / streak ----------------
export async function recordXp(action, points) {
    const db = await getDb();
    const ts = nowIso();
    const row = {
        id: ulid("xp"),
        action,
        points,
        created_at: ts,
    };
    db.prepare("insert into xp_events (id, action, points, created_at) values (@id, @action, @points, @created_at)").run(row);
    await enqueue("xp_events", row.id, "upsert", row);
}
export async function upsertRewardPointsEvent(input, opts = {}) {
    const db = await getDb();
    const row = {
        id: input.id,
        action: input.action ?? "unknown",
        points: input.points ?? 0,
        created_at: input.created_at ?? nowIso(),
    };
    db.prepare(`insert into reward_points_events (id, action, points, created_at)
     values (@id, @action, @points, @created_at)
     on conflict(id) do update set
       action=excluded.action, points=excluded.points, created_at=excluded.created_at`).run(row);
    if (!opts.skipOutbox)
        await enqueue("reward_points_events", row.id, "upsert", row);
    return row;
}
export async function recordRewardPoints(action, points) {
    if (points <= 0)
        return;
    await upsertRewardPointsEvent({
        id: ulid("rp"),
        action,
        points,
        created_at: nowIso(),
    });
}
export async function totalXpToday() {
    const db = await getDb();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const row = db
        .prepare("select coalesce(sum(points), 0) as t from xp_events where created_at >= ?")
        .get(start.toISOString());
    return row.t;
}
export async function totalXp() {
    const db = await getDb();
    const row = db
        .prepare("select coalesce(sum(points), 0) as t from xp_events")
        .get();
    return row.t;
}
export async function totalRewardPoints() {
    const db = await getDb();
    const row = db
        .prepare("select coalesce(sum(points), 0) as t from reward_points_events")
        .get();
    return row.t;
}
export async function spendRewardPoints(action, cost) {
    if (cost <= 0)
        return false;
    const available = await totalRewardPoints();
    if (available < cost)
        return false;
    await upsertRewardPointsEvent({
        id: ulid("rp"),
        action,
        points: -Math.abs(cost),
        created_at: nowIso(),
    });
    return true;
}
export async function goatUpgradePurchases() {
    const db = await getDb();
    const rows = db
        .prepare(`select action from reward_points_events
       where action like 'goatUpgrade:%' and points < 0`)
        .all();
    const out = new Set();
    for (const r of rows) {
        const id = r.action.slice("goatUpgrade:".length).trim();
        if (id)
            out.add(id);
    }
    return out;
}
/**
 * Returns daily XP totals for the last `days` days (most recent first).
 * Used by the activity heatmap so we don't ship the full event log.
 */
export async function xpByDay(days) {
    const db = await getDb();
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    const rows = db
        .prepare(`select date(created_at) as date, coalesce(sum(points), 0) as points
       from xp_events where created_at >= ?
       group by date(created_at)
       order by date desc`)
        .all(since.toISOString());
    return rows;
}
export async function currentStreak() {
    const db = await getDb();
    const rows = db
        .prepare("select date(created_at) as d from xp_events group by date(created_at) order by d desc")
        .all();
    if (rows.length === 0)
        return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    for (let i = 0; i < rows.length; i++) {
        const expected = new Date(today);
        expected.setDate(today.getDate() - i);
        const expectedStr = expected.toISOString().slice(0, 10);
        if (rows[i].d === expectedStr)
            streak += 1;
        else
            break;
    }
    return streak;
}
// ---------------- Outbox helpers (used by sync worker) ----------------
export async function listOutbox(limit) {
    const db = await getDb();
    return db
        .prepare(`select * from sync_outbox where synced_at is null
       order by created_at limit ?`)
        .all(limit);
}
export async function markOutboxSynced(ids) {
    if (ids.length === 0)
        return;
    const db = await getDb();
    const ts = nowIso();
    const stmt = db.prepare("update sync_outbox set synced_at = ? where id = ?");
    const pushState = db.prepare("update sync_state set last_pushed_at = ? where id = 1");
    const tx = db.transaction((arr) => {
        for (const id of arr)
            stmt.run(ts, id);
        pushState.run(ts);
    });
    tx(ids);
}
export async function recordOutboxFailure(id, error) {
    const db = await getDb();
    db.prepare("update sync_outbox set retry_count = retry_count + 1, last_error = ? where id = ?").run(error, id);
}
/**
 * Clears `last_error` and resets `retry_count` so failed rows are retried as
 * if fresh — useful after the cloud schema is fixed and we want sync to
 * re-attempt previously stuck pushes immediately.
 */
export async function resetOutboxErrors() {
    const db = await getDb();
    const before = db
        .prepare("select count(*) as c from sync_outbox where synced_at is null and last_error is not null")
        .get().c;
    db.prepare(`update sync_outbox set retry_count = 0, last_error = null
     where synced_at is null and last_error is not null`).run();
    return before;
}
/**
 * Re-enqueues every existing local row into `sync_outbox` so the next push
 * uploads them. Used when the outbox got out of sync with reality (e.g. rows
 * created via `skipOutbox`, dev tooling, or a previous app version that
 * marked things synced incorrectly).
 *
 * Strategy: delete any pending (un-synced) outbox row whose `(entity_type,
 * entity_id)` matches a live local row, then insert a fresh "upsert"
 * envelope per live row. Already-synced outbox history is left intact.
 */
export async function reenqueueAllLocalRows() {
    const db = await getDb();
    const ts = nowIso();
    let total = 0;
    // Order matters for FK safety on the cloud. Mirrors APPLY_ORDER.
    // We intentionally include soft-deleted rows: Postgres FKs don't care
    // about `deleted_at`, and a child row (e.g. flashcard_set) may still
    // point at a soft-deleted parent (note). The cloud stores the parent
    // as a soft-deleted record and the FK is satisfied.
    const SPECS = [
        { entity_type: "classes", table: "classes", pk: "id" },
        {
            entity_type: "notes",
            table: "notes",
            pk: "id",
            fks: [{ column: "class_id", parentTable: "classes", nullable: true }],
        },
        {
            entity_type: "attachments",
            table: "attachments",
            pk: "id",
            fks: [{ column: "note_id", parentTable: "notes", nullable: true }],
        },
        {
            entity_type: "flashcard_sets",
            table: "flashcard_sets",
            pk: "id",
            fks: [{ column: "note_id", parentTable: "notes", nullable: false }],
        },
        {
            entity_type: "flashcards",
            table: "flashcards",
            pk: "id",
            fks: [
                { column: "set_id", parentTable: "flashcard_sets", nullable: false },
            ],
        },
        {
            entity_type: "quizzes",
            table: "quizzes",
            pk: "id",
            fks: [{ column: "note_id", parentTable: "notes", nullable: false }],
        },
        {
            entity_type: "quiz_questions",
            table: "quiz_questions",
            pk: "id",
            fks: [{ column: "quiz_id", parentTable: "quizzes", nullable: false }],
        },
        {
            entity_type: "quiz_attempts",
            table: "quiz_attempts",
            pk: "id",
            fks: [{ column: "quiz_id", parentTable: "quizzes", nullable: false }],
        },
        {
            entity_type: "quiz_sessions",
            table: "quiz_sessions",
            pk: "quiz_id",
            fks: [{ column: "quiz_id", parentTable: "quizzes", nullable: false }],
        },
        { entity_type: "study_plans", table: "study_plans", pk: "id" },
        {
            entity_type: "study_tasks",
            table: "study_tasks",
            pk: "id",
            fks: [
                { column: "plan_id", parentTable: "study_plans", nullable: true },
                { column: "note_id", parentTable: "notes", nullable: true },
            ],
        },
        {
            entity_type: "calendar_events",
            table: "calendar_events",
            pk: "id",
            fks: [{ column: "class_id", parentTable: "classes", nullable: true }],
        },
        {
            entity_type: "checklist_items",
            table: "checklist_items",
            pk: "id",
            fks: [
                {
                    column: "event_id",
                    parentTable: "calendar_events",
                    nullable: false,
                },
            ],
        },
        { entity_type: "xp_events", table: "xp_events", pk: "id" },
    ];
    // Pre-load every parent table's IDs so FK checks are O(1) lookups.
    // Includes soft-deleted rows on purpose: those parents will be uploaded
    // by an earlier SPEC iteration so the cloud row exists.
    const liveIds = {};
    for (const spec of SPECS) {
        try {
            const rows = db
                .prepare(`select ${spec.pk} as id from ${spec.table}`)
                .all();
            liveIds[spec.table] = new Set(rows.map((r) => String(r.id ?? "")).filter(Boolean));
        }
        catch {
            liveIds[spec.table] = new Set();
        }
    }
    const insertOutbox = db.prepare(`insert into sync_outbox (
       id, entity_type, entity_id, operation, payload_json,
       client_updated_at, created_at, retry_count
     ) values (?, ?, ?, 'upsert', ?, ?, ?, 0)`);
    const deletePending = db.prepare(`delete from sync_outbox
     where entity_type = ? and entity_id = ? and synced_at is null`);
    let orphansSkipped = 0;
    for (const spec of SPECS) {
        let exists = true;
        try {
            db.prepare(`select 1 from ${spec.table} limit 0`).all();
        }
        catch {
            exists = false; // table missing on this device (older schema)
        }
        if (!exists)
            continue;
        const rows = db
            .prepare(`select * from ${spec.table}`)
            .all();
        const tx = db.transaction((batch) => {
            for (const row of batch) {
                const id = String(row[spec.pk] ?? "");
                if (!id)
                    continue;
                // Skip dangling rows whose required FK doesn't resolve locally —
                // pushing them would just reproduce the FK violation on Supabase.
                let orphan = false;
                for (const fk of spec.fks ?? []) {
                    const raw = row[fk.column];
                    const fkVal = raw === null || raw === undefined || raw === "" ? null : String(raw);
                    if (fkVal === null) {
                        if (!fk.nullable) {
                            orphan = true;
                            break;
                        }
                        continue;
                    }
                    if (!liveIds[fk.parentTable]?.has(fkVal)) {
                        orphan = true;
                        break;
                    }
                }
                if (orphan) {
                    // Drop any stale envelope so it stops blocking sync status.
                    deletePending.run(spec.entity_type, id);
                    orphansSkipped += 1;
                    continue;
                }
                deletePending.run(spec.entity_type, id);
                insertOutbox.run(`obx_${spec.entity_type}_${id}_${ts}_${total + 1}`, spec.entity_type, id, JSON.stringify(row), ts, ts);
                total += 1;
            }
        });
        if (rows.length)
            tx(rows);
    }
    if (orphansSkipped > 0) {
        console.warn(`[sync] skipped ${orphansSkipped} orphaned local rows (missing parent FK)`);
    }
    return total;
}
void getDeviceId; // re-export for the sync adapter
//# sourceMappingURL=repositories.js.map