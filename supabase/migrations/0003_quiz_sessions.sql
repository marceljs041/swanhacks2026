-- In-progress quiz answers (desktop). Matches SQLite quiz_sessions + sync metadata.

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

create index if not exists idx_quiz_sessions_user_updated
  on quiz_sessions(user_id, server_updated_at);
