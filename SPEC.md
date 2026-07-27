# Paywall Radar — Specification

A Bluesky AT Protocol labeler that warns users when posts contain links to paywalled content.

## Overview

Subscribes to the AT Protocol Jetstream WebSocket, watches for `app.bsky.feed.post` events, extracts links from post facets and embeds, checks them against a maintained list of paywalled domains, and emits labels via the AT Protocol labeler protocol. Users subscribe to the labeler in Bluesky settings and see paywall warnings on posts in their native feed.

A public-facing dashboard shows live stats and labeler health.

## Decisions Log

### Identity & Network

- **Account:** Dedicated Bluesky account `@paywall-radar.bsky.social`
- **Domain:** `paywall-radar` domain owned, available for custom handle migration later
- **Setup:** Create account and run `pnpm labeler:setup` to generate signing key, declare labeler service endpoint, and create labeler service record. Confirm labels appear in Bluesky.

### Label Semantics

- **Label value:** Single label `paywall`
- **Behavior:** `inform` — shows a subtle indicator on posts, does not blur or hide
- **Rationale:** The value is in awareness, not censorship. Additional labels (`soft-paywall`, `hard-paywall`) can be added in v2 based on real usage patterns.

### Firehose Ingestion

- **Source:** Official Jetstream WebSocket (`wss://jetstream2.us-east.bsky.network/subscribe` by default)
- **Filter:** `wantedCollections=app.bsky.feed.post` — only receive post create/update events
- **Connection:** Server-side only. The Node.js backend maintains the persistent WebSocket connection. The frontend never touches Jetstream.
- **Cursor:** Persist to SQLite every 5 seconds. Resume from cursor on reconnect. Events available for ~72 hours on Jetstream.
- **Posts scanned counter:** Persisted alongside cursor in the same row/flush cycle.

### Domain List

- **Format:** Typed seed list in `server/src/domains.ts`, synced into SQLite by the database initialization script. Runtime additions/removals possible without redeploy.
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

- **Signing:** Custom label signing using `@atproto/crypto` (Secp256k1 keypair) and `@atproto/lex-cbor` for CBOR encoding. Labels are signed per the AT Protocol label spec (ver, src, uri, val, neg, cts, sig).
- **Endpoints:** Hand-rolled `com.atproto.label.queryLabels` (HTTP) and `com.atproto.label.subscribeLabels` (WebSocket with DAG-CBOR frames) on the Hono server.
- **Setup:** `pnpm labeler:setup` script (`server/src/scripts/setup-labeler.ts`) handles labeler account declaration and signing key generation.
- **Database:** Single SQLite database. The `labels` table stores full signed labels (src, uri, val, neg, cts, cid, exp, sig, domain, author_did). One DB, Drizzle ORM over `@libsql/client`.

### Server Architecture

- **Process model:** Single Node.js process. WebSocket consumer, label emitter, and HTTP server all run in one process.
- **HTTP framework:** Hono with `@hono/node-server`. Dashboard API routes (`/api/*`), labeler XRPC endpoints (`/xrpc/*`), and static file serving are all registered on a single Hono app.
- **Port strategy:** Single port. The Hono server handles ATProto endpoints, dashboard API routes, and serves the client SPA.

### Frontend

- **Framework:** Vite + React SPA (TypeScript)
- **Pages:**
  - `/` — Landing page. Static HTML in `index.html` with hero, tagline, "subscribe to this labeler" CTA. A React island (`LiveStats`) hydrates into a mount point to show live stats. Real HTML content for SEO.
  - `/dashboard` — Lazy-loaded React app. Stats cards, volume-over-time chart, top paywalled domains breakdown.
- **Data fetching:** TanStack Query with polling for stats updates (posts scanned, labels emitted, volume).
- **Charts:** Recharts — line/bar chart for hourly volume (last 24h), horizontal bar chart for top domains.
- **Styling:** Tailwind CSS, dark mode via system preference (`darkMode: 'media'`, `dark:` variants). No manual toggle.
- **Routing:** No client-side router. Landing page is static HTML in `index.html` with a React island for live stats. Dashboard is a lazy-loaded React app mounted at `/dashboard`.
- **Code splitting:** Dashboard chunk is lazy-loaded so the landing page doesn't pull in Recharts. `SuspenseSkeleton` delays fallback rendering by 500ms to avoid flash.
- **API contracts:** Shared Zod schemas and inferred types in `shared/schemas.ts`.

### Live Feed (Post-MVP)

- Scrolling feed of individual recently labeled posts on the dashboard
- Per-item: author handle, matched domain, relative timestamp, link to post on Bluesky
- Deprioritized — real-time aggregate stats are sufficient for MVP

### Data Model (SQLite via Drizzle ORM)

```text
domains
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── pattern     TEXT NOT NULL UNIQUE   -- "nytimes.com", "*.nytimes.com", "cooking.nytimes.com"
└── added_at    TEXT NOT NULL          -- ISO 8601

labels
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── src         TEXT NOT NULL          -- labeler DID
├── uri         TEXT NOT NULL UNIQUE   -- post AT URI
├── val         TEXT NOT NULL          -- label value ("paywall")
├── neg         INTEGER NOT NULL DEFAULT 0  -- boolean, negation flag
├── cts         TEXT NOT NULL          -- ISO 8601 creation timestamp
├── cid         TEXT                   -- optional content CID
├── exp         TEXT                   -- optional expiration
├── sig         BLOB NOT NULL          -- cryptographic signature bytes
├── domain      TEXT NOT NULL          -- matched domain (indexed)
└── author_did  TEXT NOT NULL          -- post author DID

cursor
├── id          INTEGER PRIMARY KEY CHECK (id = 1)  -- single-row table
├── cursor_us   INTEGER NOT NULL       -- Jetstream cursor (Unix microseconds)
└── posts_scanned INTEGER NOT NULL DEFAULT 0
```

Migrations managed by Drizzle Kit (`pnpm db:generate`, `pnpm db:migrate`).

### Deploy

- **Target:** Railway
- **Build:** `tsc` (server) + `vite build` (client)
- **Run:** `node dist/server/index.js`
- **Persistence:** Railway volume for SQLite files
- **Custom domain:** Configure after initial deploy

### Tooling

- **Package manager:** pnpm
- **Linting:** oxlint
- **Formatting:** oxfmt
- **Testing:** vitest
- **ORM:** Drizzle ORM with Drizzle Kit for migrations
- **TypeScript:** Separate `tsconfig.json` per directory (server, client, shared), root `tsconfig.json` with project references

## Project Structure

```text
paywall-radar/
├── package.json
├── tsconfig.json              # project references
├── vitest.config.ts
├── drizzle.config.ts
├── server/
│   ├── tsconfig.json          # target: Node
│   └── src/
│       ├── index.ts           # backend entry: Hono server, XRPC endpoints, Jetstream consumer
│       ├── labeler.ts         # label signing, CBOR frame encoding, HTTP formatting
│       ├── database/
│       │   ├── connection.ts  # database connection setup
│       │   ├── initialize.ts  # migration and seed lifecycle
│       │   ├── labels.ts      # idempotent label recording
│       │   ├── models.ts      # Drizzle table definitions
│       │   ├── state.ts       # cursor and domain pattern loading/saving
│       │   ├── stats.ts       # dashboard snapshot queries
│       │   └── migrations/    # generated SQL migrations
│       ├── domains.ts         # typed domain seed list and matching logic
│       ├── jetstream.ts       # event validation and post-event processing
│       ├── jetstream-consumer.ts  # WebSocket connection, cursor persistence, reconnection
│       ├── pipeline.ts        # pure post-to-label processing
│       ├── routes.ts          # dashboard API routes (Hono)
│       └── scripts/
│           ├── initialize-database.ts
│           └── setup-labeler.ts   # labeler account declaration and key generation
├── client/
│   ├── tsconfig.json          # target: browser
│   ├── vite.config.ts
│   ├── index.html             # SEO-friendly landing content, React mount points
│   └── src/
│       ├── main.tsx           # React entry (live stats island + lazy dashboard)
│       ├── api.ts             # TanStack Query options for dashboard API
│       ├── pages/
│       │   └── Dashboard.tsx  # Stats cards, charts (lazy-loaded)
│       └── components/
│           ├── LiveStats.tsx       # Landing page stats island
│           ├── QueryGuard.tsx      # Error/loading boundary for queries
│           ├── Skeleton.tsx        # Loading skeleton primitives
│           ├── SuspenseSkeleton.tsx # Delayed Suspense fallback
│           ├── StatsCards.tsx
│           ├── VolumeChart.tsx
│           └── TopDomains.tsx
└── shared/
    └── schemas.ts             # Zod schemas and inferred types for API and Jetstream data
```

## Implementation Order

### Phase 1: Foundation (first session)

1. **Account setup** — Create Bluesky account, run labeler setup CLI, capture signing key, test with throwaway script
2. **Project scaffolding** — pnpm init, directory structure, tsconfig files, Vite config, Tailwind setup
3. **SQLite schema** — set up database, create tables, and seed domains with `pnpm db:init`
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

The labeler needs a Secp256k1 signing key registered in the DID document. If lost, key rotation requires a PLC operation. The initial setup (key generation, DID service endpoint declaration, `app.bsky.labeler.service` record creation) is fiddly.

**Approach:** `pnpm labeler:setup` script handles the full flow: generates a signing key, updates the DID document with the labeler service endpoint, and creates the labeler service record. Run once before deploying. Test label emission with a minimal script. Don't move on until labels appear in Bluesky.

### 2. WebSocket reliability at firehose scale

Jetstream sends 50-100+ events/second (filtered to posts). The process must parse, match, and emit without falling behind. If label emission is slower than ingestion, an unbounded queue builds in memory.

**Approach:** Process synchronously in the message handler. Non-matching posts (vast majority) are a cheap domain lookup — microseconds. Only matching posts hit the expensive path (label signing + DB write). If this becomes a bottleneck, batch label writes — but it almost certainly won't be for MVP.

### 3. Confirming labels reach the network

Labels can be emitted and stored locally but still not appear in users' feeds if the DID document's service endpoint is misconfigured or the server isn't reachable.

**Approach:** After deploying, verify by connecting to your own `subscribeLabels` endpoint externally. Confirm the Bluesky appview can resolve your DID and reach the endpoint. Test with a real post from a test account.

## Dependencies

```text
# Server
@atproto/crypto           # Secp256k1 keypair for label signing
@atproto/lex-cbor         # CBOR encoding for label frames
hono                      # HTTP framework
@hono/node-server         # Node.js adapter for Hono (HTTP + WebSocket)
@libsql/client            # SQLite driver
drizzle-orm               # ORM over @libsql/client
ws                        # WebSocket client for Jetstream
zod                       # runtime validation + type derivation for Jetstream events

# Client
react, react-dom
@tanstack/react-query     # data fetching with polling
recharts                  # charts
tailwindcss               # styling

# Dev
typescript
vite
@vitejs/plugin-react
@tailwindcss/vite
drizzle-kit               # migration generation and management
vitest                    # testing
oxlint                    # linting
oxfmt                     # formatting
```
