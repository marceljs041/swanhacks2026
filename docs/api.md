# CyAccess API

All requests must include `x-device-id: <uuid>` (anonymous device identifier).
JSON bodies only. Rate-limited per device.

## Health

`GET /health` → `{ ok: true }`

## Buildings (bundled from `@cyaccess/campus-data`)

- `GET /buildings`
- `GET /buildings/:buildingId`
- `GET /buildings/:buildingId/floors/:floorId`

## Hazards

- `GET /hazards?buildingId=&floorId=&includeResolved=`
- `GET /hazards/:hazardId`
- `POST /hazards` — create
- `PATCH /hazards/:hazardId/resolve` — force-resolve
- `POST /hazards/:hazardId/vote` — `{ vote: "still_there" | "resolved" }`
- `POST /hazards/uploads` — signed upload URL for hazard image

Hazard payload:

```json
{
  "buildingId": "parks-library",
  "floorId": "1",
  "latitude": 42.028,
  "longitude": -93.648,
  "indoorX": 55,
  "indoorY": 52,
  "type": "blocked_path",
  "severity": "medium",
  "description": "Chairs in the walkway.",
  "imageUrl": "https://...",
  "aiConfidence": 0.87
}
```

## AI

- `POST /ai/classify-hazard` — `{ imageUrl, buildingId?, floorId? }` → `{ suggestion }`
- `POST /ai/extract-board-text` — `{ imageUrl }` → `{ result: { text, language, confidence } }`
- `POST /ai/companion` — `{ language, messages, context? }` → `{ reply }`
- `POST /ai/translate` — `{ text, targetLanguage }` → `{ translated }`
- `POST /ai/board-uploads` — signed upload URL for board image

## Errors

Standard shape:

```json
{ "error": "human message" }
```

- `401` missing/invalid `x-device-id`
- `429` rate limit exceeded
- `400` Zod validation error
- `404` not found
- `5xx` upstream (OpenAI / Supabase)
