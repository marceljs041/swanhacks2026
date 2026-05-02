# CyAccess

**Navigate Iowa State with confidence.**

CyAccess is a multilingual accessibility companion for Iowa State students that combines
campus maps, indoor building navigation, AI hazard reporting, voice guidance, and
classroom board-to-text tools.

## Monorepo layout

```
apps/
  mobile/        # Expo (Expo Router) mobile app
  api/           # Hono API deployed to Fly.io, Supabase + OpenAI
packages/
  shared/        # cross-cutting TS types, constants, utils
  i18n/          # en / es / ar / zh locales
  campus-data/   # ISU building polygons + Parks Library indoor data
docs/            # product plan, api, data-model, demo-script
```

## Requirements

- Node >= 20
- pnpm 9+
- Expo CLI (via `npx expo`)
- Supabase CLI (optional, for running migrations locally)
- Fly.io CLI (for API deployment)

## Getting started

```bash
pnpm install
cp .env.example .env
# populate Supabase + OpenAI secrets

# Start everything (api + mobile) in parallel:
pnpm dev

# Or individually:
pnpm dev:api
pnpm dev:mobile
```

Scan the Expo QR code with Expo Go (iOS) or the dev build to launch the app. The
mobile app reads `EXPO_PUBLIC_API_URL` for the API endpoint.

## Build phases

See [docs/product-plan.md](docs/product-plan.md) for the 11-phase build plan.

## License

MIT
