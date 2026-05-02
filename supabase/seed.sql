-- Optional: seed a demo user/device so cross-device sync works without auth.
-- Use the same DEMO_USER_ID in apps/api/.env (DEMO_USER_ID).

insert into devices (id, user_id, label, created_at)
values
  ('dev_demo_desktop', '00000000-0000-0000-0000-000000000001', 'Demo Desktop', now()),
  ('dev_demo_mobile',  '00000000-0000-0000-0000-000000000001', 'Demo Mobile',  now())
on conflict (id) do nothing;
