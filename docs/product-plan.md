# StudyNest product plan

## What it is

A local-first AI study workspace. Students capture notes, audio, and images
during class — with or without internet — then turn them into summaries,
flashcards, quizzes, and daily calendar-based study plans. Desktop runs
the AI locally; mobile is capture-first and falls back to the cloud when
online.

## Why it's different

Every other AI study app dies when the Wi-Fi dies. StudyNest is built
for the opposite. The desktop app ships a local Gemma 4 E4B model, the
mobile app captures everything offline, and a SQLite-first sync layer
keeps the two in lockstep when you reconnect.

## What ships in MVP

- Mobile (Expo): notes, image/audio/file capture, AI summarize via cloud.
- Desktop (Electron): notes editor, full AI suite (summarize, flashcards,
  quiz, study plan, simple explain) via local sidecar.
- Cloud (FastAPI + Supabase): sync, attachment uploads, cloud AI fallback,
  device pairing.
- Cross-device sync via outbox + last-pulled-at cursor.
- Daily streak, XP, calendar week view, flashcard SM-2-lite scheduling.

## What does NOT ship in MVP

- Mobile-side local AI (device-side Gemma 1B is a stretch goal).
- Realtime collaborative editing.
- 3-way merge — conflicts produce a "Conflict copy" sibling.
- Web app.
- PDF and link capture (skeleton only).

## Stack one-pager

| Layer       | Choice                                                        |
| ----------- | ------------------------------------------------------------- |
| Monorepo    | pnpm workspaces + Turborepo                                   |
| Mobile      | Expo Router, expo-sqlite, expo-av, expo-image-picker, Zustand |
| Desktop     | Electron + Vite + React, better-sqlite3, contextBridge IPC    |
| Local AI    | transformers sidecar, Gemma 4 E4B (HF snapshot, text + audio) |
| Cloud API   | FastAPI, Pydantic, Supabase (Postgres + Storage)              |
| Cloud AI    | Gemini → OpenAI → deterministic templates (graceful fallback) |
| Identity    | Anonymous demo user; device pairing via 6-digit code          |

See [`architecture.md`](architecture.md), [`sync.md`](sync.md), [`api.md`](api.md), and [`demo-script.md`](demo-script.md).
