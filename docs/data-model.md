# Data Model

Supabase Postgres. Full SQL lives in
`apps/api/src/db/migrations/0001_init.sql`.

## `hazards`

| Column               | Type         | Notes                                      |
| -------------------- | ------------ | ------------------------------------------ |
| id                   | uuid PK      | `gen_random_uuid()`                        |
| building_id          | text         | matches `@cyaccess/campus-data.buildings.id` |
| floor_id             | text         |                                            |
| latitude / longitude | double       | outdoor hazards                            |
| indoor_x / indoor_y  | double       | 0–100 coord space                           |
| type                 | text         | one of `HAZARD_TYPES`                       |
| severity             | text         | `low` / `medium` / `high` / `critical`     |
| description          | text         | optional                                   |
| image_url            | text         | public Supabase Storage URL                |
| ai_confidence        | double       | 0–1                                        |
| status               | text         | `active` / `pending_resolved` / `resolved` |
| created_by_device_id | text         | anonymous UUID                              |
| created_at           | timestamptz  |                                            |
| resolved_at          | timestamptz  |                                            |

Indexes: `(status, created_at desc)`, `(building_id, floor_id, status)`, `(latitude, longitude)`.

## `hazard_votes`

| Column   | Type     | Notes                                  |
| -------- | -------- | -------------------------------------- |
| hazard_id | uuid FK | references `hazards(id)`              |
| device_id | text    | anonymous UUID                         |
| vote      | text    | `still_there` / `resolved`             |

`unique(hazard_id, device_id)` — one vote per device per hazard.

## `device_rate_limits`

Fixed-window counter: `(device_id, action, window_start)` unique.

## RLS

- `hazards`: public `select` only on `status in ('active','pending_resolved')`.
- Writes bypass RLS via the service role used by the API.

## Storage

- `hazard-images/{deviceId}/{timestamp}-{uuid}.jpg`
- `board-images/{deviceId}/{timestamp}-{uuid}.jpg`

Both buckets created private; mobile uses a signed PUT URL from the API.
