# CyAccess — Product Plan

## One-liner

CyAccess is a multilingual accessibility companion for Iowa State students that
combines campus maps, indoor building navigation, AI hazard reporting, voice
guidance, and classroom board-to-text tools.

## MVP scope

- Language onboarding (English, Spanish, Arabic, Simplified Chinese)
- Campus map with 12 real ISU buildings
- Indoor map for Parks Library (2 floors) and Gerdin (1 floor)
- Hazard reporting with AI image classification (OpenAI GPT-4o vision)
- Hazard vote/resolve system with abuse-resistant anonymous device IDs
- Ask Cy companion: local command router + LLM fallback + TTS
- Classroom whiteboard OCR + translation
- Supabase Postgres + Storage, Hono API on Fly.io

## Build order (11 phases)

1. pnpm monorepo scaffold
2. Shared TypeScript packages (types, i18n, campus data)
3. Supabase migrations (hazards, hazard_votes, device_rate_limits) + RLS
4. Hono API with device-auth + rate limits + Zod validation
5. Expo mobile foundation (Expo Router, NativeWind, zustand, TanStack Query)
6. Onboarding (language + a11y preferences)
7. Bottom tabs + campus map
8. Indoor SVG renderer + floor selector
9. Hazard reporting flow with camera + AI classification
10. Ask Cy + TTS
11. Classroom OCR + translate + polish + demo script

## Key engineering decisions

- **Anonymous auth only.** `expo-secure-store` UUID → `x-device-id` header →
  Hono middleware. No personal data, no sign-in friction.
- **Service-role backend.** RLS on for `select`-only public reads; all writes
  go through the API.
- **Shared packages over copy-paste.** `@cyaccess/shared` exports types and
  constants used by both mobile and api. Campus data is a separate package so
  it can be swapped to the DB later without touching the UI.
- **Offline-ish.** `useBuildings()` falls back to bundled campus data when the
  API is unreachable so the map still renders.
- **Cyclone theme.** `colors.ts` is the single source of truth for both
  NativeWind's Tailwind preset and the native SVG renderer.

## Versions beyond MVP

- v1: AI enhancements (board-to-text, full STT, more translations, more buildings)
- v2: Indoor + outdoor routing graph with live hazard-avoidance
- v3: Campus intelligence dashboard, heatmaps, admin verification
- v4: AR indoor guidance, CyRide integrations, calendar awareness
