/**
 * Single source of truth for the StudyNest local SQLite schema.
 *
 * The Postgres mirror lives in supabase/migrations/0001_init.sql and adds
 * user_id / device_id / server_updated_at columns. Keep both in sync.
 */

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = /* sql */ `
create table if not exists classes (
  id text primary key,
  name text not null,
  code text,
  color text,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists notes (
  id text primary key,
  class_id text,
  title text not null,
  content_markdown text not null default '',
  summary text,
  tags_json text not null default '[]',
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  sync_version integer not null default 1,
  foreign key (class_id) references classes(id)
);

create table if not exists attachments (
  id text primary key,
  note_id text not null,
  type text not null,
  local_uri text not null,
  remote_url text,
  file_name text,
  mime_type text,
  size_bytes integer,
  transcript text,
  extracted_text text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  foreign key (note_id) references notes(id)
);

create table if not exists flashcard_sets (
  id text primary key,
  note_id text,
  title text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  foreign key (note_id) references notes(id)
);

create table if not exists flashcards (
  id text primary key,
  set_id text not null,
  front text not null,
  back text not null,
  difficulty text not null default 'new',
  due_at text,
  last_reviewed_at text,
  review_count integer not null default 0,
  ease real not null default 2.5,
  interval_days integer not null default 0,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  foreign key (set_id) references flashcard_sets(id)
);

create table if not exists quizzes (
  id text primary key,
  note_id text,
  title text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  foreign key (note_id) references notes(id)
);

create table if not exists quiz_questions (
  id text primary key,
  quiz_id text not null,
  type text not null,
  question text not null,
  options_json text,
  correct_answer text not null,
  explanation text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  foreign key (quiz_id) references quizzes(id)
);

create table if not exists quiz_attempts (
  id text primary key,
  quiz_id text not null,
  score integer not null,
  total integer not null,
  answers_json text not null,
  created_at text not null,
  foreign key (quiz_id) references quizzes(id)
);

create table if not exists study_plans (
  id text primary key,
  title text not null,
  class_id text,
  exam_date text,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);

create table if not exists study_tasks (
  id text primary key,
  plan_id text,
  note_id text,
  title text not null,
  type text not null,
  scheduled_for text not null,
  duration_minutes integer not null default 20,
  completed_at text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  foreign key (plan_id) references study_plans(id),
  foreign key (note_id) references notes(id)
);

create table if not exists xp_events (
  id text primary key,
  action text not null,
  points integer not null,
  created_at text not null
);

create table if not exists sync_outbox (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  operation text not null,
  payload_json text not null,
  client_updated_at text not null,
  created_at text not null,
  synced_at text,
  retry_count integer not null default 0,
  last_error text
);

create table if not exists sync_state (
  id integer primary key check (id = 1),
  device_id text not null,
  last_pulled_at text,
  last_pushed_at text,
  user_id text
);

create table if not exists settings (
  key text primary key,
  value_json text not null,
  updated_at text not null
);
`;

export const CREATE_INDEXES_SQL = /* sql */ `
create index if not exists idx_notes_class_id on notes(class_id) where deleted_at is null;
create index if not exists idx_notes_updated_at on notes(updated_at);
create index if not exists idx_attachments_note_id on attachments(note_id) where deleted_at is null;
create index if not exists idx_flashcards_set_id on flashcards(set_id) where deleted_at is null;
create index if not exists idx_flashcards_due_at on flashcards(due_at) where deleted_at is null;
create index if not exists idx_quiz_questions_quiz_id on quiz_questions(quiz_id) where deleted_at is null;
create index if not exists idx_study_tasks_scheduled_for on study_tasks(scheduled_for) where deleted_at is null;
create index if not exists idx_xp_events_created_at on xp_events(created_at);
create index if not exists idx_sync_outbox_unsynced on sync_outbox(created_at) where synced_at is null;
`;

export const SEED_SYNC_STATE_SQL = /* sql */ `
insert or ignore into sync_state (id, device_id) values (1, ?);
`;

/**
 * Logical entity types used in sync envelopes. The order does NOT
 * imply dependency order (sync respects FK ordering at apply time).
 */
export const SYNCABLE_ENTITIES = [
  "classes",
  "notes",
  "attachments",
  "flashcard_sets",
  "flashcards",
  "quizzes",
  "quiz_questions",
  "quiz_attempts",
  "study_plans",
  "study_tasks",
  "xp_events",
] as const;

export type SyncableEntity = (typeof SYNCABLE_ENTITIES)[number];

/**
 * FK-safe apply order when inserting pulled rows. Parents before children.
 */
export const APPLY_ORDER: SyncableEntity[] = [
  "classes",
  "notes",
  "attachments",
  "flashcard_sets",
  "flashcards",
  "quizzes",
  "quiz_questions",
  "quiz_attempts",
  "study_plans",
  "study_tasks",
  "xp_events",
];
