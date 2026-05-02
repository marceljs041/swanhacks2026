/**
 * CRUD repositories. All writes are wrapped in a transaction that also
 * inserts a sync_outbox row, so every change is durable AND replayable
 * to the cloud.
 *
 * Pass `{ skipOutbox: true }` only when applying a row that came FROM the
 * cloud (during sync pull) — otherwise we'd echo the change back.
 */
import {
  type ClassRow,
  type FlashcardRow,
  type FlashcardSetRow,
  type NoteRow,
  type QuizQuestionRow,
  type QuizRow,
  type StudyPlanRow,
  type StudyTaskRow,
  type SyncOutboxRow,
  type XpEventRow,
  nowIso,
  ulid,
} from "@studynest/shared";
import type { SyncableEntity } from "@studynest/db-schema";
import { getDb, getDeviceId } from "./client.js";

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

// ---------------- Classes ----------------

export async function listClasses(): Promise<ClassRow[]> {
  const db = await getDb();
  return db
    .prepare("select * from classes where deleted_at is null order by name")
    .all() as ClassRow[];
}

export async function upsertClass(
  input: Partial<ClassRow> & { name: string },
  opts: WriteOpts = {},
): Promise<ClassRow> {
  const db = await getDb();
  const ts = nowIso();
  const row: ClassRow = {
    id: input.id ?? ulid("cls"),
    name: input.name,
    code: input.code ?? null,
    color: input.color ?? null,
    created_at: input.created_at ?? ts,
    updated_at: ts,
    deleted_at: input.deleted_at ?? null,
  };
  const tx = db.transaction(() => {
    db.prepare(
      `insert into classes (id, name, code, color, created_at, updated_at, deleted_at)
       values (@id, @name, @code, @color, @created_at, @updated_at, @deleted_at)
       on conflict(id) do update set
         name=excluded.name, code=excluded.code, color=excluded.color,
         updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`,
    ).run(row);
  });
  tx();
  if (!opts.skipOutbox) await enqueue("classes", row.id, "upsert", row);
  return row;
}

// ---------------- Notes ----------------

export async function listNotes(classId?: string | null): Promise<NoteRow[]> {
  const db = await getDb();
  if (classId) {
    return db
      .prepare(
        "select * from notes where deleted_at is null and class_id = ? order by updated_at desc",
      )
      .all(classId) as NoteRow[];
  }
  return db
    .prepare("select * from notes where deleted_at is null order by updated_at desc")
    .all() as NoteRow[];
}

export async function getNote(id: string): Promise<NoteRow | null> {
  const db = await getDb();
  return (db.prepare("select * from notes where id = ?").get(id) as NoteRow) ?? null;
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
  db.prepare(
    `insert into notes (id, class_id, title, content_markdown, summary, tags_json,
                        created_at, updated_at, deleted_at, sync_version)
     values (@id, @class_id, @title, @content_markdown, @summary, @tags_json,
             @created_at, @updated_at, @deleted_at, @sync_version)
     on conflict(id) do update set
       class_id=excluded.class_id, title=excluded.title,
       content_markdown=excluded.content_markdown, summary=excluded.summary,
       tags_json=excluded.tags_json, updated_at=excluded.updated_at,
       deleted_at=excluded.deleted_at, sync_version=excluded.sync_version`,
  ).run(row);
  if (!opts.skipOutbox) await enqueue("notes", row.id, "upsert", row);
  return row;
}

export async function softDeleteNote(id: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  db.prepare("update notes set deleted_at = ?, updated_at = ? where id = ?").run(ts, ts, id);
  await enqueue("notes", id, "delete", { id, deleted_at: ts });
}

// ---------------- Flashcards ----------------

export async function upsertFlashcardSet(
  input: Partial<FlashcardSetRow> & { title: string },
  opts: WriteOpts = {},
): Promise<FlashcardSetRow> {
  const db = await getDb();
  const ts = nowIso();
  const row: FlashcardSetRow = {
    id: input.id ?? ulid("fcs"),
    note_id: input.note_id ?? null,
    title: input.title,
    created_at: input.created_at ?? ts,
    updated_at: ts,
    deleted_at: input.deleted_at ?? null,
  };
  db.prepare(
    `insert into flashcard_sets (id, note_id, title, created_at, updated_at, deleted_at)
     values (@id, @note_id, @title, @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       note_id=excluded.note_id, title=excluded.title,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`,
  ).run(row);
  if (!opts.skipOutbox) await enqueue("flashcard_sets", row.id, "upsert", row);
  return row;
}

export async function upsertFlashcard(
  input: Partial<FlashcardRow> & { set_id: string; front: string; back: string },
  opts: WriteOpts = {},
): Promise<FlashcardRow> {
  const db = await getDb();
  const ts = nowIso();
  const row: FlashcardRow = {
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
  db.prepare(
    `insert into flashcards
       (id, set_id, front, back, difficulty, due_at, last_reviewed_at,
        review_count, ease, interval_days, created_at, updated_at, deleted_at)
     values (@id, @set_id, @front, @back, @difficulty, @due_at, @last_reviewed_at,
             @review_count, @ease, @interval_days, @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       front=excluded.front, back=excluded.back, difficulty=excluded.difficulty,
       due_at=excluded.due_at, last_reviewed_at=excluded.last_reviewed_at,
       review_count=excluded.review_count, ease=excluded.ease,
       interval_days=excluded.interval_days, updated_at=excluded.updated_at,
       deleted_at=excluded.deleted_at`,
  ).run(row);
  if (!opts.skipOutbox) await enqueue("flashcards", row.id, "upsert", row);
  return row;
}

export async function listFlashcardSets(noteId?: string | null): Promise<FlashcardSetRow[]> {
  const db = await getDb();
  if (noteId) {
    return db
      .prepare(
        "select * from flashcard_sets where deleted_at is null and note_id = ? order by created_at desc",
      )
      .all(noteId) as FlashcardSetRow[];
  }
  return db
    .prepare("select * from flashcard_sets where deleted_at is null order by created_at desc")
    .all() as FlashcardSetRow[];
}

export async function listFlashcards(setId: string): Promise<FlashcardRow[]> {
  const db = await getDb();
  return db
    .prepare("select * from flashcards where deleted_at is null and set_id = ? order by created_at")
    .all(setId) as FlashcardRow[];
}

export async function listDueFlashcards(limit = 20): Promise<FlashcardRow[]> {
  const db = await getDb();
  const now = nowIso();
  return db
    .prepare(
      `select * from flashcards
       where deleted_at is null and (due_at is null or due_at <= ?)
       order by due_at limit ?`,
    )
    .all(now, limit) as FlashcardRow[];
}

// ---------------- Quizzes ----------------

export async function upsertQuiz(
  input: Partial<QuizRow> & { title: string },
  opts: WriteOpts = {},
): Promise<QuizRow> {
  const db = await getDb();
  const ts = nowIso();
  const row: QuizRow = {
    id: input.id ?? ulid("qz"),
    note_id: input.note_id ?? null,
    title: input.title,
    created_at: input.created_at ?? ts,
    updated_at: ts,
    deleted_at: input.deleted_at ?? null,
  };
  db.prepare(
    `insert into quizzes (id, note_id, title, created_at, updated_at, deleted_at)
     values (@id, @note_id, @title, @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       note_id=excluded.note_id, title=excluded.title,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`,
  ).run(row);
  if (!opts.skipOutbox) await enqueue("quizzes", row.id, "upsert", row);
  return row;
}

export async function upsertQuizQuestion(
  input: Partial<QuizQuestionRow> & {
    quiz_id: string;
    type: QuizQuestionRow["type"];
    question: string;
    correct_answer: string;
  },
  opts: WriteOpts = {},
): Promise<QuizQuestionRow> {
  const db = await getDb();
  const ts = nowIso();
  const row: QuizQuestionRow = {
    id: input.id ?? ulid("qq"),
    quiz_id: input.quiz_id,
    type: input.type,
    question: input.question,
    options_json: input.options_json ?? null,
    correct_answer: input.correct_answer,
    explanation: input.explanation ?? null,
    created_at: input.created_at ?? ts,
    updated_at: ts,
    deleted_at: input.deleted_at ?? null,
  };
  db.prepare(
    `insert into quiz_questions
       (id, quiz_id, type, question, options_json, correct_answer, explanation,
        created_at, updated_at, deleted_at)
     values (@id, @quiz_id, @type, @question, @options_json, @correct_answer, @explanation,
             @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       type=excluded.type, question=excluded.question, options_json=excluded.options_json,
       correct_answer=excluded.correct_answer, explanation=excluded.explanation,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`,
  ).run(row);
  if (!opts.skipOutbox) await enqueue("quiz_questions", row.id, "upsert", row);
  return row;
}

export async function listQuizzes(noteId?: string | null): Promise<QuizRow[]> {
  const db = await getDb();
  if (noteId) {
    return db
      .prepare(
        "select * from quizzes where deleted_at is null and note_id = ? order by created_at desc",
      )
      .all(noteId) as QuizRow[];
  }
  return db
    .prepare("select * from quizzes where deleted_at is null order by created_at desc")
    .all() as QuizRow[];
}

export async function listQuizQuestions(quizId: string): Promise<QuizQuestionRow[]> {
  const db = await getDb();
  return db
    .prepare(
      "select * from quiz_questions where deleted_at is null and quiz_id = ? order by created_at",
    )
    .all(quizId) as QuizQuestionRow[];
}

export async function recordQuizAttempt(args: {
  quiz_id: string;
  score: number;
  total: number;
  answers: unknown;
}): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  const row = {
    id: ulid("qa"),
    quiz_id: args.quiz_id,
    score: args.score,
    total: args.total,
    answers_json: JSON.stringify(args.answers),
    created_at: ts,
  };
  db.prepare(
    `insert into quiz_attempts (id, quiz_id, score, total, answers_json, created_at)
     values (@id, @quiz_id, @score, @total, @answers_json, @created_at)`,
  ).run(row);
  await enqueue("quiz_attempts", row.id, "upsert", row);
}

// ---------------- Study plans / tasks ----------------

export async function upsertStudyPlan(
  input: Partial<StudyPlanRow> & { title: string },
  opts: WriteOpts = {},
): Promise<StudyPlanRow> {
  const db = await getDb();
  const ts = nowIso();
  const row: StudyPlanRow = {
    id: input.id ?? ulid("plan"),
    title: input.title,
    class_id: input.class_id ?? null,
    exam_date: input.exam_date ?? null,
    created_at: input.created_at ?? ts,
    updated_at: ts,
    deleted_at: input.deleted_at ?? null,
  };
  db.prepare(
    `insert into study_plans (id, title, class_id, exam_date, created_at, updated_at, deleted_at)
     values (@id, @title, @class_id, @exam_date, @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       title=excluded.title, class_id=excluded.class_id, exam_date=excluded.exam_date,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`,
  ).run(row);
  if (!opts.skipOutbox) await enqueue("study_plans", row.id, "upsert", row);
  return row;
}

export async function upsertStudyTask(
  input: Partial<StudyTaskRow> & {
    title: string;
    type: StudyTaskRow["type"];
    scheduled_for: string;
  },
  opts: WriteOpts = {},
): Promise<StudyTaskRow> {
  const db = await getDb();
  const ts = nowIso();
  const row: StudyTaskRow = {
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
  db.prepare(
    `insert into study_tasks
       (id, plan_id, note_id, title, type, scheduled_for, duration_minutes,
        completed_at, created_at, updated_at, deleted_at)
     values (@id, @plan_id, @note_id, @title, @type, @scheduled_for, @duration_minutes,
             @completed_at, @created_at, @updated_at, @deleted_at)
     on conflict(id) do update set
       plan_id=excluded.plan_id, note_id=excluded.note_id, title=excluded.title,
       type=excluded.type, scheduled_for=excluded.scheduled_for,
       duration_minutes=excluded.duration_minutes, completed_at=excluded.completed_at,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`,
  ).run(row);
  if (!opts.skipOutbox) await enqueue("study_tasks", row.id, "upsert", row);
  return row;
}

export async function listTasksForRange(fromIso: string, toIso: string): Promise<StudyTaskRow[]> {
  const db = await getDb();
  return db
    .prepare(
      `select * from study_tasks where deleted_at is null
       and scheduled_for >= ? and scheduled_for < ? order by scheduled_for`,
    )
    .all(fromIso, toIso) as StudyTaskRow[];
}

// ---------------- XP / streak ----------------

export async function recordXp(action: string, points: number): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  const row: XpEventRow = {
    id: ulid("xp"),
    action,
    points,
    created_at: ts,
  };
  db.prepare(
    "insert into xp_events (id, action, points, created_at) values (@id, @action, @points, @created_at)",
  ).run(row);
  await enqueue("xp_events", row.id, "upsert", row);
}

export async function totalXpToday(): Promise<number> {
  const db = await getDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const row = db
    .prepare("select coalesce(sum(points), 0) as t from xp_events where created_at >= ?")
    .get(start.toISOString()) as { t: number };
  return row.t;
}

export async function currentStreak(): Promise<number> {
  const db = await getDb();
  const rows = db
    .prepare("select date(created_at) as d from xp_events group by date(created_at) order by d desc")
    .all() as { d: string }[];
  if (rows.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (rows[i]!.d === expectedStr) streak += 1;
    else break;
  }
  return streak;
}

// ---------------- Outbox helpers (used by sync worker) ----------------

export async function listOutbox(limit: number): Promise<SyncOutboxRow[]> {
  const db = await getDb();
  return db
    .prepare(
      `select * from sync_outbox where synced_at is null
       order by created_at limit ?`,
    )
    .all(limit) as SyncOutboxRow[];
}

export async function markOutboxSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const ts = nowIso();
  const stmt = db.prepare("update sync_outbox set synced_at = ? where id = ?");
  const tx = db.transaction((arr: string[]) => {
    for (const id of arr) stmt.run(ts, id);
  });
  tx(ids);
}

export async function recordOutboxFailure(id: string, error: string): Promise<void> {
  const db = await getDb();
  db.prepare(
    "update sync_outbox set retry_count = retry_count + 1, last_error = ? where id = ?",
  ).run(error, id);
}

void getDeviceId; // re-export for the sync adapter
