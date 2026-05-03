-- Calendar feature: cloud mirror of the local SQLite tables defined in
-- packages/db-schema/src/sql.ts. Adds user_id / device_id /
-- server_updated_at columns, matching the conventions of 0001_init.sql.

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
