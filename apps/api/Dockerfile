# syntax=docker/dockerfile:1
# Build context: repository root (docker build -f apps/api/Dockerfile .)

FROM node:24-alpine AS build
RUN npm install -g pnpm@12.8.1
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Every workspace manifest, so the frozen lockfile matches; only the API's graph is installed.
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/catalog/package.json packages/catalog/
COPY packages/domain/package.json packages/domain/
COPY packages/engine/package.json packages/engine/
COPY packages/i18n/package.json packages/i18n/
COPY packages/tokens/package.json packages/tokens/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @sipclock/api...
COPY packages/domain ./packages/domain
COPY packages/catalog ./packages/catalog
COPY packages/engine ./packages/engine
COPY apps/api ./apps/api
RUN pnpm --filter @sipclock/api build

# Runtime: the bundle, SQL migrations and the catalog files. No node_modules.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    CATALOG_DIR=/app/catalog \
    MIGRATIONS_DIR=/app/drizzle \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/drizzle ./drizzle
COPY --from=build --chown=node:node /repo/packages/catalog/generated ./catalog
USER node
EXPOSE 8787
LABEL org.opencontainers.image.source="https://github.com/4emp1ON/sipclock" \
      org.opencontainers.image.description="Sipclock API"
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-8787}/health || exit 1
CMD ["node", "dist/server.js"]
