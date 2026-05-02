FROM node:20-alpine AS base
RUN corepack enable

WORKDIR /workspace

# ---------- install ----------
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/campus-data/package.json packages/campus-data/package.json
COPY packages/i18n/package.json packages/i18n/package.json
RUN pnpm install --frozen-lockfile || pnpm install

# ---------- build ----------
FROM deps AS build
COPY . .
RUN pnpm --filter api build

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json

EXPOSE 8787
CMD ["node", "apps/api/dist/index.js"]
