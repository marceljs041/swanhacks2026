# StudyNest API reference

Base URL: `http://127.0.0.1:8000` (dev). Mobile/desktop clients hit the
cloud API for sync + cloud AI fallback. Desktop additionally talks to
`http://127.0.0.1:8765` (the local sidecar) for offline AI.

## Health

`GET /health` — returns service + Supabase status.

## Sync

`POST /sync/push` — accept a batch of outbox envelopes. Returns `applied` and `conflicts`.
`POST /sync/pull` — return all envelopes with `server_updated_at > since`.

## AI (cloud fallback — same shapes as local sidecar)

```
POST /ai/summarize        { note_id, title, content }
POST /ai/flashcards       { note_id, title, content, count? }
POST /ai/quiz             { note_id, title, content, count?, types? }
POST /ai/study-plan       { goal, exam_date?, notes[], days_available? }
POST /ai/explain-simple   { note_id, title, content, audience? }
```

Provider order: Gemini → OpenAI → deterministic template (so the demo never blows up).

## Local sidecar (desktop only, `127.0.0.1:8765`)

Identical request shapes, prefixed with `/local-ai/`:

```
POST /local-ai/summarize
POST /local-ai/flashcards
POST /local-ai/quiz
POST /local-ai/study-plan
POST /local-ai/simple-explain
POST /local-ai/key-terms
GET  /health
```

## Attachments

`POST /attachments/upload-url` — request a Supabase Storage presigned upload URL for an attachment. Returns `{ upload_url, public_url, storage_path, expires_in }`.

## Devices / pairing

`POST /devices/pair/start` — desktop calls this, gets a 6-digit `code` valid for 10 minutes.
`POST /devices/pair/confirm` — mobile scans the code (or types it), submits with its own `device_id`. Server returns the shared `user_id`.
