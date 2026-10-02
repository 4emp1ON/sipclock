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
COPY packages/i18n ./packages/i18n
COPY apps/api ./apps/api
RUN pnpm --filter @sipclock/api build

# Country database for AI provider routing (docs/adr/0007): DB-IP Lite, CC BY 4.0, https://db-ip.com.
# Monthly files; fall back to last month's early in a month. Refreshed on every image build.
FROM node:24-alpine AS geoip
WORKDIR /geoip
RUN set -e; \
    for month in $(node -e "const d=new Date(),f=(x)=>x.toISOString().slice(0,7);console.log(f(d),f(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1))))"); do \
      wget -qO country.mmdb.gz "https://download.db-ip.com/free/dbip-country-lite-$month.mmdb.gz" && break; \
    done; \
    gunzip country.mmdb.gz; \
    test -s country.mmdb

# Runtime: the bundle, SQL migrations, the catalog files and the country database. No node_modules.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    CATALOG_DIR=/app/catalog \
    MIGRATIONS_DIR=/app/drizzle \
    GEOIP_DB_PATH=/app/geoip/country.mmdb \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/drizzle ./drizzle
COPY --from=build --chown=node:node /repo/packages/catalog/generated ./catalog
COPY --from=geoip --chown=node:node /geoip/country.mmdb ./geoip/country.mmdb
USER node
EXPOSE 8787
LABEL org.opencontainers.image.source="https://github.com/4emp1ON/sipclock" \
      org.opencontainers.image.description="Sipclock API"
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-8787}/health || exit 1
CMD ["node", "dist/server.js"]
