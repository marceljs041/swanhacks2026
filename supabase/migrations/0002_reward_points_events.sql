create table if not exists reward_points_events (
  id text primary key,
  user_id uuid not null,
  device_id text,
  action text not null,
  points integer not null,
  created_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create index if not exists idx_reward_points_events_user_updated
  on reward_points_events(user_id, server_updated_at);
