# Paywall Radar

Paywall Radar is an [AT Protocol](https://atproto.com/) labeler for Bluesky. It reads public post events, finds links to known paywalled publications, and publishes an informational `paywall` label.

This repository contains the labeler, its public dashboard, and a small admin interface. The production service runs as a Dockerized Node.js application with SQLite.

## How it works

The server connects to Bluesky's Jetstream event stream and watches new and updated posts. It validates each event, extracts links from post facets and external embeds, and compares their hostnames with a curated domain list. A match creates a signed AT Protocol label that Bluesky clients can show above the post.

The service uses two Jetstream connections for resilience. Cursor state is stored in SQLite so each connection can resume after a restart. Label writes are idempotent, which prevents the two streams from producing duplicate labels.

The same Node.js process serves the AT Protocol label endpoints, dashboard API, React application, and admin routes. The admin interface uses Bluesky OAuth and is restricted to one configured DID.

## What the label means

The label means that a post links to a domain known to publish paywalled content. It does not mean that the linked page was inspected or that every reader will be blocked.

Paywall Radar does not:

- read article content;
- test whether a specific page currently requires payment;
- distinguish hard paywalls from metered or subscriber-only access; or
- resolve shortened URLs.

The domain list is curated, so false positives and missed links are possible.

Paywall Radar is not anti-paywall and does not bypass access controls. The label adds context before a click. It does not hide, blur, or moderate the post.

## Project status

This is a personal project running in production. The source is public so the implementation can be inspected and learned from, but the repository is not offered as a supported platform or a turnkey self-hosting package.

Support and contributions are not provided. The MIT license allows you to study, modify, and run your own fork.

## Running the service

You will need Node.js 22, pnpm 10, a dedicated Bluesky account, and a public HTTPS URL that Bluesky can reach.

Install the dependencies and create a local environment file:

```sh
pnpm install
cp .env.example .env
```

Fill in `.env`, then configure the Bluesky account as a labeler:

```sh
pnpm labeler:setup
```

The setup script authenticates with the account, creates or imports a signing key, updates its DID document, and creates its labeler service record. If it generates a key, save the printed `SIGNING_KEY` in `.env`. The key cannot be recovered.

Set `DID` and `ADMIN_DID` to the dedicated account's DID. Set `PUBLIC_URL` to the service's public origin and use a random value of at least 32 characters for `SESSION_SECRET`. A non-loopback `PUBLIC_URL` also requires an OAuth private key in `OAUTH_PRIVATE_KEY`. See [`.env.example`](.env.example) for the remaining configuration.

Start the development server:

```sh
pnpm dev
```

The database and its seed domain list are initialized at startup. Useful checks are:

```sh
pnpm test
pnpm typecheck
pnpm lint
```

### Important setup warning

Use a dedicated Bluesky account. `pnpm labeler:setup` changes the account's DID document and registers it as a labeler. Do not run it against your primary account just to try the project.

Treat `SIGNING_KEY`, `SESSION_SECRET`, and `OAUTH_PRIVATE_KEY` as secrets. Losing the label signing key requires a DID key rotation. Publishing any of these values requires replacing them.

A local Node.js process is not enough for a working labeler. Its service URL must be publicly reachable over HTTPS so Bluesky can discover it and subscribe to its label stream.

## Data and privacy

Paywall Radar processes public Bluesky post events. It retains the data needed to publish labels, build aggregate dashboard statistics, diagnose failed events, resume event streams, and authenticate the admin account.

Stored data includes post URIs, author DIDs, post text for labeled posts, matched domains, signed label events, cursor state, diagnostic event payloads, and admin authentication records. The project does not currently define a public retention guarantee.

## Why I built it

I kept opening links without realizing they were paywalled. Paywalls help fund publishing. I only wanted a little more context before clicking.

## License

[MIT](LICENSE)
