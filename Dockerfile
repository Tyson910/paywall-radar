# syntax=docker/dockerfile:1.7

# ---- base (debian slim — glibc, matches distroless runtime) -----------------
FROM node:22-slim AS base
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


# ---- fs prep (distroless has no shell, so set up data dir here) -------------
FROM alpine:3 AS fs
RUN mkdir -p /fs/data \
 && touch /fs/data/.keep \
 && chown -R 65532:65532 /fs


# ---- runtime (distroless — no shell, no npm, no package manager) ------------
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
ENV NODE_ENV=production \
    PORT=4100 \
    DB_PATH=/app/data/paywall-radar.db \
    CLIENT_DIR=/app/dist/client
WORKDIR /app

COPY --from=prod-deps --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --chown=nonroot:nonroot package.json ./
COPY --from=build --chown=nonroot:nonroot /app/dist ./dist
COPY --from=fs --chown=nonroot:nonroot /fs/data ./data

USER nonroot:nonroot
EXPOSE 4100
VOLUME ["/app/data"]

CMD ["dist/server/index.js"]
