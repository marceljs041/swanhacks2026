# StudyNest architecture

## Three runtimes, one logical schema

```
┌─────────────────┐    ┌───────────────────────────┐    ┌──────────────────────┐
│   Mobile (Expo) │    │   Desktop (Electron)      │    │  Cloud (FastAPI)     │
│                 │    │                           │    │                      │
│ React Native UI │    │ React UI (Vite)           │    │ /sync/push           │
│ expo-sqlite     │    │ better-sqlite3            │    │ /sync/pull           │
│ Outbox          │    │ Outbox                    │    │ /ai/* (cloud fallback)│
│                 │    │                           │    │ /attachments/*       │
│       │         │    │       │         ▲        │    │ /devices/pair/*      │
│       └────HTTP─┼────┼───────┘         │        │    │                      │
│                 │    │                 │        │    │  Supabase (Postgres  │
│                 │    │  127.0.0.1:8765 │        │    │  + Storage + Auth)   │
│                 │    │  Python sidecar │        │    │                      │
│                 │    │  Gemma 4 E4B    │        │    │                      │
│                 │    │  transformers           │    │                      │
└─────────────────┘    └───────────────────────────┘    └──────────────────────┘
```

## Data flow rules

1. **Local first, always.** Every UI action writes to local SQLite *first*, then enqueues a `sync_outbox` row in the same transaction.
2. **Sync second.** A background worker (`packages/sync`) drains the outbox to `/sync/push` and pulls remote deltas via `/sync/pull` using the `last_pulled_at` cursor stored in `sync_state`.
3. **AI graceful degradation.** Desktop calls the local sidecar (`http://127.0.0.1:8765`). If the sidecar isn't loaded, it transparently falls back to the cloud API. Mobile calls the cloud API directly when online; otherwise it uses rule-based fallbacks (study plan) or queues the request for when desktop sync delivers a generated output.
4. **Soft deletes propagate.** Every entity has `deleted_at`. Sync envelopes with `operation: "delete"` set `deleted_at` server-side; pulls echo tombstones so other devices catch up.

## Process model (desktop)

- Electron main starts the Python sidecar as a child process with `STUDYNEST_GEMMA4_MODEL_PATH` pointing at the Gemma 4 E4B HF snapshot directory.
- Renderer talks to the sidecar via plain HTTP (no IPC needed for AI calls).
- IPC via `contextBridge` is reserved for filesystem operations, sync triggers, and "open file" dialogs.

## Identity

- For the demo: a single shared anonymous `user_id` (`DEMO_USER_ID` env var) is implied. Each device generates a ULID `device_id` on first launch and stores it in `sync_state.device_id`.
- Device pairing: desktop calls `/devices/pair/start`, gets a 6-digit code, displays a QR. Mobile scans, calls `/devices/pair/confirm`, receives the same `user_id`. Both devices now sync against the same logical user.
