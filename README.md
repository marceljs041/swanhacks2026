# StudyNest

> Your offline-first AI study workspace.

StudyNest is a local-first note-taking and study planning app for students. Capture notes, audio, and images during class — with or without internet — then turn them into summaries, flashcards, quizzes, and daily calendar-based study plans powered by an offline AI model. When you're online, your work syncs across mobile and desktop.

## What's in this monorepo

```
studynest/
  apps/
    mobile/    Expo (React Native) — capture-first
    desktop/   Electron + React + Vite — deep study + offline AI
    api/       FastAPI cloud backend + local llama-cpp-python sidecar
  packages/
    shared/    TypeScript types shared across apps
    db-schema/ SQLite + Postgres DDL (single source of truth)
    sync/      Outbox sync worker (used by both clients)
    prompts/   AI prompt templates
    ui/        Design tokens / theme
    i18n/      Translations (en, es, ar, zh)
  supabase/
    migrations/  Cloud schema (mirrors local)
  docs/        Architecture, sync, API, demo script
```

## Architecture

- **Local SQLite** is the source of truth on each device.
- Every mutation writes locally **and** appends to a `sync_outbox` row in the same transaction.
- A background sync worker drains the outbox to `/sync/push` and pulls remote deltas via `/sync/pull`.
- The desktop app spawns a Python sidecar (`apps/api/local_sidecar`) that runs Gemma 3 4B locally via `llama-cpp-python` and exposes it on `http://127.0.0.1:8765`.
- The mobile app falls back to the cloud API for AI when online.

See [`docs/architecture.md`](docs/architecture.md) and [`docs/sync.md`](docs/sync.md).

## Quick start

```bash
pnpm install

# Backend
cd apps/api && python -m venv .venv && source .venv/bin/activate && pip install -e .
uvicorn app.main:app --reload

# Local AI sidecar (separate terminal)
python -m local_sidecar.main

# Desktop
pnpm desktop dev

# Mobile
pnpm mobile dev
```

### Desktop: `Electron failed to install correctly`

The Electron **binary** is downloaded by a postinstall script; pnpm sometimes skips it or it fails silently. After `pnpm install`, run:

```bash
pnpm electron:download
```

Or rely on the root **`postinstall`** hook (`scripts/ensure-electron.cjs`), which runs automatically on install when `path.txt` / the binary is missing.

Use **Node 20 or 22 LTS** if downloads still fail (**Node 25** is often unsupported by Electron’s installer).

See `.env.example` for required environment variables.

## Hackathon demo

Run `pnpm --filter @studynest/desktop seed` to populate a class, notes, and study plan, then follow [`docs/demo-script.md`](docs/demo-script.md).
