-- CyAccess initial schema
-- Run in the Supabase SQL editor (or supabase db push).

create extension if not exists "pgcrypto";

-- ==========================================
-- hazards
-- ==========================================
create table if not exists public.hazards (
  id uuid primary key default gen_random_uuid(),
  building_id text,
  floor_id text,
  latitude double precision,
  longitude double precision,
  indoor_x double precision,
  indoor_y double precision,
  type text not null,
  severity text not null default 'medium',
  description text,
  image_url text,
  ai_confidence double precision,
  status text not null default 'active',
  created_by_device_id text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint hazards_type_check check (type in (
    'blocked_path','broken_elevator','broken_door_button','icy_sidewalk',
    'construction','wet_floor','poor_lighting','crowded_area','other'
  )),
  constraint hazards_severity_check check (severity in ('low','medium','high','critical')),
  constraint hazards_status_check check (status in ('active','pending_resolved','resolved'))
);

create index if not exists hazards_status_created_at_idx
  on public.hazards (status, created_at desc);
create index if not exists hazards_building_floor_idx
  on public.hazards (building_id, floor_id, status);
create index if not exists hazards_latlng_idx on public.hazards (latitude, longitude);

-- ==========================================
-- hazard_votes
-- ==========================================
create table if not exists public.hazard_votes (
  id uuid primary key default gen_random_uuid(),
  hazard_id uuid not null references public.hazards(id) on delete cascade,
  device_id text not null,
  vote text not null,
  created_at timestamptz not null default now(),
  constraint hazard_votes_vote_check check (vote in ('still_there','resolved')),
  unique (hazard_id, device_id)
);

-- ==========================================
-- device_rate_limits
-- ==========================================
create table if not exists public.device_rate_limits (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  action text not null,
  count int not null default 1,
  window_start timestamptz not null default now(),
  unique (device_id, action, window_start)
);

create index if not exists device_rate_limits_device_action_idx
  on public.device_rate_limits (device_id, action, window_start desc);

-- ==========================================
-- Row Level Security
-- ==========================================
alter table public.hazards enable row level security;
alter table public.hazard_votes enable row level security;
alter table public.device_rate_limits enable row level security;

drop policy if exists "hazards public read non resolved" on public.hazards;
create policy "hazards public read non resolved"
  on public.hazards
  for select
  using (status in ('active','pending_resolved'));

-- All writes must go through the API (service role bypasses RLS).

-- ==========================================
-- Storage buckets (idempotent)
-- ==========================================
insert into storage.buckets (id, name, public)
  values ('hazard-images', 'hazard-images', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('board-images', 'board-images', false)
  on conflict (id) do nothing;
