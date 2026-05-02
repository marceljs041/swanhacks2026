# StudyNest sync protocol

## Sync envelope

```ts
{
  entity_type: "notes" | "classes" | ...,
  entity_id: "ulid",
  operation: "upsert" | "delete",
  payload: { /* full row */ },
  client_updated_at: "2026-05-02T20:15:00Z",
  device_id: "dev_..."
}
```

## Write path (client → local)

```
UI action
  └── repository.upsert()
        └── BEGIN TRANSACTION
              upsert into <entity>
              insert into sync_outbox (...)
        └── COMMIT
```

## Push path (client → server)

```
worker.tick()
  └── batch = listOutbox(100)
  └── POST /sync/push { device_id, user_id, envelopes }
  └── for each applied: outbox.markSynced(id)
  └── for each conflict: outbox.recordOutboxFailure(id, reason)
```

## Pull path (server → client)

```
worker.tick()
  └── since = sync_state.last_pulled_at
  └── POST /sync/pull { device_id, user_id, since }
  └── apply each envelope in APPLY_ORDER (parents first)
  └── sync_state.last_pulled_at = res.server_now
```

## Conflict policy

Server side (`apps/api/app/services/sync_service.py`):

- **Stale write**: server's `updated_at` is newer than `client_updated_at`, *and* the existing row was last touched by a different `device_id` → conflict.
- **Append-only entities** (`xp_events`, `quiz_attempts`) never conflict — they're merged by id.

Client side, on a pulled row that conflicts with an unsynced local row:

- Keep the remote version as the canonical row.
- Write the local version as a "Conflict copy from <device_label>" sibling note (only for `notes`).
- Surface a `conflict` sync status to the UI; user can dismiss.

## Status state machine

```
                  ┌─────────┐
                  │ offline │
                  └────┬────┘
              network reachable
                       │
                       ▼
                  ┌─────────┐
                  │ syncing │ ──── on uncaught error ──▶ ┌───────┐
                  └────┬────┘                            │ error │
                       │                                 └───────┘
                  push + pull ok
                       │
                       ▼
                  ┌─────────┐ ── conflicts > 0 ──▶ ┌──────────┐
                  │ synced  │                      │ conflict │
                  └─────────┘                      └──────────┘
```
