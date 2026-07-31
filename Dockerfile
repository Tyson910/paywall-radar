# syntax=docker/dockerfile:1.7

# ---- base -------------------------------------------------------------------
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app


# ---- deps (full install, including devDeps needed for the build) ------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile


# ---- prod deps (runtime deps only) ------------------------------------------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod


# ---- build ------------------------------------------------------------------
FROM deps AS build
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
COPY tsconfig.json tsconfig.typecheck.json ./
# Server (tsc -b) + migrations copy, then Vite client build
RUN pnpm build && pnpm build:client


# ---- litestream (copy static binary only) ------------------------------------
FROM litestream/litestream:0.5.14-scratch AS litestream


# ---- production database clone ----------------------------------------------
FROM alpine:3.22 AS clone-db
RUN apk add --no-cache bash ca-certificates
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream
WORKDIR /backup
CMD ["bash", "-euo", "pipefail", "-c", ": \"${LITESTREAM_REPLICA_URL:?LITESTREAM_REPLICA_URL is required}\"; : \"${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}\"; : \"${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}\"; : \"${OUTPUT_FILE:?OUTPUT_FILE is required}\"; litestream restore -integrity-check full -o \"/backup/${OUTPUT_FILE}\" \"${LITESTREAM_REPLICA_URL}\""]


# ---- runtime ----------------------------------------------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=4100 \
    DB_PATH=/app/data/paywall-radar.db \
    CLIENT_DIR=/app/dist/client
WORKDIR /app

RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser \
 && mkdir -p /app/data && chown appuser:appuser /app/data

COPY --from=prod-deps --chown=appuser:appuser /app/node_modules ./node_modules
COPY --chown=appuser:appuser package.json ./
COPY --from=build --chown=appuser:appuser /app/dist ./dist
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream
COPY --chown=appuser:appuser litestream.yml /etc/litestream.yml
COPY --chown=appuser:appuser server/src/docker-entrypoint.sh /app/docker-entrypoint.sh

EXPOSE 4100

ENTRYPOINT ["/app/docker-entrypoint.sh"]
