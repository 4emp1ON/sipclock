# syntax=docker/dockerfile:1
# Build context: repository root (docker build -f apps/api/Dockerfile .)

FROM node:24-alpine AS base
RUN npm install -g pnpm@12.8.1
WORKDIR /repo

FROM base AS build
# Layer-cache friendly: fetch dependencies from the lockfile only.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --prod
COPY package.json turbo.json tsconfig.base.json ./
COPY apps/api ./apps/api
RUN pnpm install --offline --prod --frozen-lockfile --filter @sipclock/api... \
 && pnpm deploy --filter @sipclock/api --prod /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-8787}/health || exit 1
CMD ["node", "src/server.ts"]
