# syntax=docker/dockerfile:1.7

# ---- base -------------------------------------------------------------------
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app


# ---- deps (full install, including devDeps needed for the build) ------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile


# ---- prod deps (runtime deps only) ------------------------------------------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod


# ---- build ------------------------------------------------------------------
FROM deps AS build
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
COPY tsconfig.json tsconfig.typecheck.json ./
# Server (tsc -b) + migrations copy, then Vite client build
RUN pnpm build && pnpm build:client


# ---- runtime (plain node:alpine, no pnpm/corepack/yarn) ---------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4100 \
    DB_PATH=/app/data/paywall-radar.db \
    CLIENT_DIR=/app/dist/client
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /app/data \
 && chown app:app /app/data
USER app

COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --chown=app:app package.json ./
COPY --from=build --chown=app:app /app/dist ./dist

EXPOSE 4100
VOLUME ["/app/data"]

CMD ["node", "dist/server/index.js"]
