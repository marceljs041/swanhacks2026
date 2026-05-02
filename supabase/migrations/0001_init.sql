-- StudyNest cloud schema. Mirrors the local SQLite schema in
-- packages/db-schema/src/sql.ts but adds user_id, device_id, and
-- server_updated_at columns. Keep both in sync.

create extension if not exists "uuid-ossp";

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

create table if not exists classes (
  id text primary key,
  user_id uuid not null,
  device_id text,
  name text not null,
  code text,
  color text,
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
  title text not null,
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
  created_at timestamptz not null,
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

create index if not exists idx_notes_user_updated on notes(user_id, server_updated_at);
create index if not exists idx_classes_user_updated on classes(user_id, server_updated_at);
create index if not exists idx_attachments_user_updated on attachments(user_id, server_updated_at);
create index if not exists idx_flashcard_sets_user_updated on flashcard_sets(user_id, server_updated_at);
create index if not exists idx_flashcards_user_updated on flashcards(user_id, server_updated_at);
create index if not exists idx_quizzes_user_updated on quizzes(user_id, server_updated_at);
create index if not exists idx_quiz_questions_user_updated on quiz_questions(user_id, server_updated_at);
create index if not exists idx_quiz_attempts_user_updated on quiz_attempts(user_id, server_updated_at);
create index if not exists idx_study_plans_user_updated on study_plans(user_id, server_updated_at);
create index if not exists idx_study_tasks_user_updated on study_tasks(user_id, server_updated_at);
create index if not exists idx_xp_events_user_updated on xp_events(user_id, server_updated_at);
create index if not exists idx_pairing_codes_expires on pairing_codes(expires_at);

-- Storage bucket for note attachments. Run once via SQL editor or CLI:
-- insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);
