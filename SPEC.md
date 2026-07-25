# Paywall Radar — Specification

A Bluesky AT Protocol labeler that warns users when posts contain links to paywalled content.

## Overview

Subscribes to the AT Protocol Jetstream WebSocket, watches for `app.bsky.feed.post` events, extracts links from post facets and embeds, checks them against a maintained list of paywalled domains, and emits labels via the AT Protocol labeler protocol. Users subscribe to the labeler in Bluesky settings and see paywall warnings on posts in their native feed.

A public-facing dashboard shows live stats and labeler health.

## Decisions Log

### Identity & Network

- **Account:** Dedicated Bluesky account `@paywall-radar.bsky.social`
- **Domain:** `paywall-radar` domain owned, available for custom handle migration later
- **Setup:** Create account and run `npx @skyware/labeler setup` locally before writing application code. Capture signing key, test label emission with a throwaway script, confirm labels appear in Bluesky.

### Label Semantics

- **Label value:** Single label `paywall`
- **Behavior:** `inform` — shows a subtle indicator on posts, does not blur or hide
- **Rationale:** The value is in awareness, not censorship. Additional labels (`soft-paywall`, `hard-paywall`) can be added in v2 based on real usage patterns.

### Firehose Ingestion

- **Source:** Jetstream WebSocket (`wss://jetstream.atproto.com/subscribe`)
- **Filter:** `wantedCollections=app.bsky.feed.post` — only receive post create/update events
- **Connection:** Server-side only. The Node.js backend maintains the persistent WebSocket connection. The frontend never touches Jetstream.
- **Cursor:** Persist to SQLite every 5 seconds. Resume from cursor on reconnect. Events available for ~72 hours on Jetstream.
- **Posts scanned counter:** Persisted alongside cursor in the same row/flush cycle.

### Domain List

- **Format:** Seed file in the repo (`domains.json`), synced into SQLite on startup. Runtime additions/removals possible without redeploy.
- **Scope:** Curated small list (~20-50 domains) for MVP. The obvious paywalled publications.
- **Matching:** Subdomain-aware with explicit wildcard support:
  - `nytimes.com` — matches exactly `nytimes.com`
  - `*.nytimes.com` — matches any subdomain of `nytimes.com`
  - `cooking.nytimes.com` — matches exactly that subdomain
- **Resolution:** Extract hostname via `new URL()`. Exact match: `hostname === pattern`. Wildcard `*.example.com`: `hostname.endsWith('.example.com') || hostname === 'example.com'`. No public suffix list needed — domain list is curated.

### Link Extraction & Post Processing

- **Sources:** Facets (`app.bsky.richtext.facet` with `uri` feature type) and embeds (`app.bsky.embed.external`). Deduplicate by resolved domain before checking.
- **Shortened URLs:** Skip for MVP. Add a `// TODO: resolve shortened URLs (t.co, bit.ly)` comment.
- **Pipeline:** Pure function `processPost(post, domainSet): LabelAction | null` handles the full flow — extract links from facets/embeds, match against domains, return a label instruction or null. The WebSocket handler calls it; tests call it directly with fixture data.
- **Validation:** Incoming Jetstream events are validated with Zod schemas (`safeParse`) at the IO boundary. Malformed events are logged and skipped, never crash the process. Types for post records, facets, and embeds are derived from the Zod schemas — no `@atproto/api` dependency needed.

### Label Emission

- **Library:** `@skyware/labeler` — handles labeler declaration, label signing, `subscribeLabels` WebSocket endpoint, and label persistence.
- **API:** `labeler.createLabel({ uri: postUri, val: "paywall" })`
- **Database:** Single SQLite database shared with the labeler. Pass `dbPath` to `@skyware/labeler`, and add app tables (domains, cursor) to the same file. One DB, one driver (`@libsql/client`).

### Server Architecture

- **Process model:** Single Node.js process. WebSocket consumer, label emitter, and HTTP server all run in one process.
- **HTTP framework:** Fastify — `@skyware/labeler` exposes its internal Fastify instance as a public `app` property. Dashboard API routes and static file serving are registered directly on it. One server, one port, no proxy.
- **Port strategy:** Single port. The labeler's Fastify server handles both ATProto endpoints (`/xrpc/*`) and dashboard API routes.

### Frontend

- **Framework:** Vite + React SPA (TypeScript)
- **Pages:**
  - `/` — Landing page. Hero with tagline, "subscribe to this labeler" CTA, stats summary. Real HTML content for SEO (crawlers get meaningful content before React hydrates).
  - `/dashboard` — Stats cards, volume-over-time chart, top paywalled domains breakdown.
- **Data fetching:** SSE for real-time stats updates (posts scanned, labels emitted, volume). TanStack Query manages the SSE connection and provides caching/loading states.
- **Charts:** Recharts — line/bar chart for hourly volume (last 24h), horizontal bar chart for top domains.
- **Styling:** Tailwind CSS, dark mode via system preference (`darkMode: 'media'`, `dark:` variants). No manual toggle.
- **API types:** Shared types in `shared/types.ts`, imported by both server and client.

### Live Feed (Post-MVP)

- Scrolling feed of individual recently labeled posts on the dashboard
- Per-item: author handle, matched domain, relative timestamp, link to post on Bluesky
- Deprioritized — real-time aggregate stats are sufficient for MVP

### Data Model (shared SQLite database with labeler)

```text
domains
├── id          INTEGER PRIMARY KEY
├── pattern     TEXT NOT NULL UNIQUE   -- "nytimes.com", "*.nytimes.com", "cooking.nytimes.com"
├── type        TEXT NOT NULL          -- "exact", "wildcard"
└── added_at    TEXT NOT NULL          -- ISO 8601

labels_log
├── id          INTEGER PRIMARY KEY
├── post_uri    TEXT NOT NULL
├── author_did  TEXT NOT NULL
├── domain      TEXT NOT NULL          -- the matched domain
└── labeled_at  TEXT NOT NULL          -- ISO 8601

cursor
├── id          INTEGER PRIMARY KEY CHECK (id = 1)  -- single-row table
├── cursor_us   INTEGER NOT NULL       -- Jetstream cursor (Unix microseconds)
└── posts_scanned INTEGER NOT NULL DEFAULT 0
```

### Deploy

- **Target:** Railway
- **Build:** `tsc` (server) + `vite build` (client)
- **Run:** `node dist/server/index.js`
- **Persistence:** Railway volume for SQLite files
- **Custom domain:** Configure after initial deploy

### Tooling

- **Package manager:** pnpm
- **Linting:** oxlint with JS plugins (`@tanstack/eslint-plugin-query`, `eslint-plugin-react-hooks`)
- **Formatting:** oxfmt
- **TypeScript:** Separate `tsconfig.json` per directory (server, client), root `tsconfig.json` with project references

## Project Structure

```text
paywall-radar/
├── package.json
├── tsconfig.json              # project references
├── domains.json               # seed list of paywalled domains
├── server/
│   ├── tsconfig.json          # target: Node
│   └── src/
│       ├── index.ts           # entry — starts labeler server, registers routes, starts Jetstream consumer
│       ├── labeler.ts         # @skyware/labeler setup and label emission
│       ├── jetstream.ts       # WebSocket connection, cursor management, reconnection
│       ├── pipeline.ts        # pure function: post → extract links → match domains → LabelAction | null
│       ├── domains.ts         # domain list loading, matching logic
│       ├── api.ts             # Fastify routes for dashboard data (stats, charts, domains)
│       └── db.ts              # SQLite setup (app tables), queries, cursor/stats persistence
├── client/
│   ├── tsconfig.json          # target: browser
│   ├── index.html             # SEO-friendly landing content, React mount point
│   └── src/
│       ├── main.tsx           # React entry
│       ├── App.tsx            # Router (landing + dashboard)
│       ├── api.ts             # fetch client for dashboard API
│       ├── pages/
│       │   ├── Landing.tsx    # Hero, CTA, stats summary
│       │   └── Dashboard.tsx  # Stats cards, charts
│       └── components/
│           ├── StatsCards.tsx
│           ├── VolumeChart.tsx
│           └── TopDomains.tsx
└── shared/
    ├── types.ts               # API response types shared between server and client
    └── schemas.ts             # Zod schemas for Jetstream events, post records, facets, embeds
```

## Implementation Order

### Phase 1: Foundation (first session)

1. **Account setup** — Create Bluesky account, run labeler setup CLI, capture signing key, test with throwaway script
2. **Project scaffolding** — pnpm init, directory structure, tsconfig files, Vite config, Tailwind setup
3. **SQLite schema** — set up database, create tables, seed domains from `domains.json`
4. **Domain matching** — implement the matching engine (wildcard/exact/subdomain logic). Unit test this.
5. **Zod schemas** — define schemas for Jetstream post events, facets, embeds in `shared/schemas.ts`.

### Phase 2: Core Labeling (first session continued)

6. **Pipeline** — implement `processPost(post, domainSet)` pure function: extract links from facets/embeds, match domains, return `LabelAction | null`. Unit test with fixture data.
7. **Jetstream consumer** — WebSocket connection, cursor persistence, reconnection logic. Calls `processPost()` in the message handler.
8. **Wire it together** — Jetstream → pipeline → label emission. Test end-to-end: post a link to a paywalled site from a test account, confirm label appears.

### Phase 3: Server & Deploy (second session)

9. **Dashboard API routes** — register stats, volume-over-time, and top domains endpoints on the labeler's Fastify instance
10. **Static file serving** — serve Vite build output from Fastify
11. **Deploy to Railway** — get the server running, configure volume, set env vars, verify labeler is reachable

### Phase 4: Dashboard (second session continued)

12. **Landing page** — hero, CTA, stats summary with TanStack Query
13. **Dashboard page** — stats cards, Recharts volume chart, top domains chart
14. **Polish** — responsive design, dark mode, error states

## Hard Problems

### 1. Labeler account setup and signing key management

`@skyware/labeler` requires a signing key generated during setup, registered in the DID document. If lost, key rotation requires a PLC operation. The initial setup (CLI, signing key capture, DID service endpoint configuration) is fiddly and poorly documented.

**Approach:** Do this first, locally, before writing any application code. Test label emission with a minimal script. Don't move on until labels appear in Bluesky.

### 2. WebSocket reliability at firehose scale

Jetstream sends 50-100+ events/second (filtered to posts). The process must parse, match, and emit without falling behind. If label emission is slower than ingestion, an unbounded queue builds in memory.

**Approach:** Process synchronously in the message handler. Non-matching posts (vast majority) are a cheap domain lookup — microseconds. Only matching posts hit the expensive path (label signing + DB write). If this becomes a bottleneck, batch label writes — but it almost certainly won't be for MVP.

### 3. Confirming labels reach the network

Labels can be emitted and stored locally but still not appear in users' feeds if the DID document's service endpoint is misconfigured or the server isn't reachable.

**Approach:** After deploying, verify by connecting to your own `subscribeLabels` endpoint externally. Confirm the Bluesky appview can resolve your DID and reach the endpoint. Test with a real post from a test account.

## Dependencies

```text
# Server
@skyware/labeler          # labeler protocol, signing, subscribeLabels endpoint, Fastify server
@libsql/client            # SQLite driver (shared DB with labeler)
ws                        # WebSocket client for Jetstream
zod                       # runtime validation + type derivation for Jetstream events

# Client
react, react-dom
@tanstack/react-router    # type-safe landing + dashboard routing
@tanstack/react-query     # data fetching with polling
recharts                  # charts
tailwindcss               # styling

# Dev
typescript
vite
@vitejs/plugin-react
oxlint                    # linting
# oxfmt                   # formatting
@tanstack/eslint-plugin-query
eslint-plugin-react-hooks
```
