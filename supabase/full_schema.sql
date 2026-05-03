-- =============================================================================
-- StudyNest — full PostgreSQL schema (Supabase)
-- =============================================================================
-- Consolidates supabase/migrations/*.sql into one document. For upgrades on
-- existing databases, use the numbered migrations; use this file for reference,
-- greenfield installs, or tooling that needs a single DDL snapshot.
--
-- Local SQLite mirrors this shape in packages/db-schema/src/sql.ts (minus
-- user_id / server_updated_at etc. where client-only).
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Devices & pairing
-- -----------------------------------------------------------------------------

create table if not exists devices (
  id text primary key,
  user_id uuid not null,
  label text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists pairing_codes (
  code text primary key,
  device_id text not null references devices(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

-- -----------------------------------------------------------------------------
-- Core entities
-- -----------------------------------------------------------------------------

create table if not exists classes (
  id text primary key,
  user_id uuid not null,
  device_id text,
  name text not null,
  code text,
  color text,
  overview_text text,
  archived_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists notes (
  id text primary key,
  user_id uuid not null,
  device_id text,
  class_id text references classes(id),
  title text not null,
  content_markdown text not null default '',
  summary text,
  tags_json text not null default '[]',
  icon text not null default 'note',
  sync_version integer not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists attachments (
  id text primary key,
  user_id uuid not null,
  device_id text,
  note_id text not null references notes(id) on delete cascade,
  type text not null,
  local_uri text not null,
  remote_url text,
  file_name text,
  mime_type text,
  size_bytes integer,
  transcript text,
  extracted_text text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists flashcard_sets (
  id text primary key,
  user_id uuid not null,
  device_id text,
  note_id text references notes(id) on delete set null,
  title text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists flashcards (
  id text primary key,
  user_id uuid not null,
  device_id text,
  set_id text not null references flashcard_sets(id) on delete cascade,
  front text not null,
  back text not null,
  difficulty text not null default 'new',
  due_at timestamptz,
  last_reviewed_at timestamptz,
  review_count integer not null default 0,
  ease real not null default 2.5,
  interval_days integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists quizzes (
  id text primary key,
  user_id uuid not null,
  device_id text,
  note_id text references notes(id) on delete set null,
  class_id text references classes(id),
  title text not null,
  description text,
  difficulty text not null default 'medium',
  status text not null default 'new',
  source_type text not null default 'note',
  source_ids_json text,
  weak_topics_json text,
  tags_json text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists quiz_questions (
  id text primary key,
  user_id uuid not null,
  device_id text,
  quiz_id text not null references quizzes(id) on delete cascade,
  type text not null,
  question text not null,
  options_json text,
  correct_answer text not null,
  explanation text,
  topic text,
  hint text,
  source_note_id text,
  position integer,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists quiz_attempts (
  id text primary key,
  user_id uuid not null,
  device_id text,
  quiz_id text not null references quizzes(id) on delete cascade,
  score integer not null,
  total integer not null,
  answers_json text not null,
  started_at timestamptz,
  finished_at timestamptz,
  completed integer not null default 1,
  weak_topics_json text,
  time_spent_seconds integer,
  created_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table if not exists quiz_sessions (
  quiz_id text primary key references quizzes(id) on delete cascade,
  user_id uuid not null,
  device_id text,
  current_index integer not null default 0,
  answers_json text not null default '{}',
  started_at timestamptz not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table if not exists study_plans (
  id text primary key,
  user_id uuid not null,
  device_id text,
  title text not null,
  class_id text references classes(id),
  exam_date timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists study_tasks (
  id text primary key,
  user_id uuid not null,
  device_id text,
  plan_id text references study_plans(id) on delete set null,
  note_id text references notes(id) on delete set null,
  title text not null,
  type text not null,
  scheduled_for timestamptz not null,
  duration_minutes integer not null default 20,
  completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists xp_events (
  id text primary key,
  user_id uuid not null,
  device_id text,
  action text not null,
  points integer not null,
  created_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Calendar
-- -----------------------------------------------------------------------------

create table if not exists calendar_events (
  id text primary key,
  user_id uuid not null,
  device_id text,
  title text not null,
  type text not null,
  class_id text references classes(id),
  note_id text references notes(id) on delete set null,
  quiz_id text references quizzes(id) on delete set null,
  flashcard_set_id text references flashcard_sets(id) on delete set null,
  study_plan_id text references study_plans(id) on delete set null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day integer not null default 0,
  color text,
  tags_json text not null default '[]',
  reminder_at timestamptz,
  source_type text not null default 'manual',
  status text not null default 'scheduled',
  recurrence_json text,
  sync_version integer not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists checklist_items (
  id text primary key,
  user_id uuid not null,
  device_id text,
  event_id text not null references calendar_events(id) on delete cascade,
  label text not null,
  completed integer not null default 0,
  position integer,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists idx_notes_user_updated on notes(user_id, server_updated_at);
create index if not exists idx_classes_user_updated on classes(user_id, server_updated_at);
create index if not exists idx_attachments_user_updated on attachments(user_id, server_updated_at);
create index if not exists idx_flashcard_sets_user_updated on flashcard_sets(user_id, server_updated_at);
create index if not exists idx_flashcards_user_updated on flashcards(user_id, server_updated_at);
create index if not exists idx_quizzes_user_updated on quizzes(user_id, server_updated_at);
create index if not exists idx_quiz_questions_user_updated on quiz_questions(user_id, server_updated_at);
create index if not exists idx_quiz_attempts_user_updated on quiz_attempts(user_id, server_updated_at);
create index if not exists idx_quiz_sessions_user_updated on quiz_sessions(user_id, server_updated_at);
create index if not exists idx_study_plans_user_updated on study_plans(user_id, server_updated_at);
create index if not exists idx_study_tasks_user_updated on study_tasks(user_id, server_updated_at);
create index if not exists idx_xp_events_user_updated on xp_events(user_id, server_updated_at);
create index if not exists idx_pairing_codes_expires on pairing_codes(expires_at);

create index if not exists idx_calendar_events_user_start
  on calendar_events(user_id, start_at);
create index if not exists idx_calendar_events_user_class
  on calendar_events(user_id, class_id);
create index if not exists idx_calendar_events_user_updated
  on calendar_events(user_id, server_updated_at);
create index if not exists idx_checklist_items_user_event
  on checklist_items(user_id, event_id);
create index if not exists idx_checklist_items_user_updated
  on checklist_items(user_id, server_updated_at);

-- -----------------------------------------------------------------------------
-- Storage (Supabase) — run once if bucket missing:
-- insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);
-- -----------------------------------------------------------------------------
