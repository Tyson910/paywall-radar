import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { WSContext } from "hono/ws";

import { serve, upgradeWebSocket } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { gt } from "drizzle-orm";
import { Hono } from "hono";
import { WebSocketServer } from "ws";

import { openDatabase } from "./database/connection.js";
import { initializeDatabase } from "./database/initialize.js";
import { recordLabel } from "./database/labels.js";
import { labels, type LabelRow } from "./database/models.js";
import { loadCursorState, loadDomainPatterns, saveCursorState } from "./database/state.js";
import { startJetstreamConsumer } from "./jetstream-consumer.js";
import {
  type SignedLabel,
  encodeLabelsFrame,
  formatLabelForHttp,
  loadSigningKey,
  signLabel,
} from "./labeler.js";
import { createDashboardRoutes } from "./routes.js";

const did = process.env.DID;
const signingKey = process.env.SIGNING_KEY;
const dbPath = process.env.DB_PATH ?? "paywall-radar.db";
const clientDir = process.env.CLIENT_DIR ?? "dist/client";
const port = Number(process.env.PORT ?? 4100);

interface LabelEvent {
  seq: number;
  label: SignedLabel;
}

function rowToSignedLabel(row: LabelRow): SignedLabel {
  return {
    ver: 1,
    src: row.src,
    uri: row.uri,
    val: row.val,
    neg: row.neg,
    cts: row.cts,
    ...(row.cid != null && { cid: row.cid }),
    ...(row.exp != null && { exp: row.exp }),
    sig: row.sig,
  };
}

async function main() {
  if (!did || !signingKey) {
    throw new Error("DID and SIGNING_KEY environment variables are required");
  }

  const { domainCount } = await initializeDatabase(dbPath);
  console.log(`Database initialized with ${domainCount} domain patterns`);

  const { client, db } = openDatabase(dbPath);
  const [patterns, initialState] = await Promise.all([loadDomainPatterns(db), loadCursorState(db)]);

  const keypair = await loadSigningKey(signingKey);
  const labelEmitter = new EventEmitter();
  const subscribers = new Set<WSContext>();

  labelEmitter.on("label", (event: LabelEvent) => {
    const frame = encodeLabelsFrame(event.seq, event.label);
    for (const ws of subscribers) {
      ws.send(new Uint8Array(frame) as Uint8Array<ArrayBuffer>);
    }
  });

  const app = new Hono();
  const dashboardRoutes = createDashboardRoutes(db);
  app.route("/api", dashboardRoutes);
  app.get("/xrpc/_health", (c) => c.json({ version: 1 }));
  app.get("/xrpc/com.atproto.label.queryLabels", async (c) => {
    const cursorParam = c.req.query("cursor");
    const limitParam = c.req.query("limit");
    const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 250);
    const afterId = cursorParam ? Number(cursorParam) : 0;

    const rows = await db.select().from(labels).where(gt(labels.id, afterId)).limit(limit);

    const formatted = rows.map((row) => formatLabelForHttp(rowToSignedLabel(row)));
    const lastRow = rows[rows.length - 1];
    const nextCursor = lastRow ? String(lastRow.id) : (cursorParam ?? undefined);

    return c.json({ cursor: nextCursor, labels: formatted });
  });

  app.get(
    "/xrpc/com.atproto.label.subscribeLabels",
    upgradeWebSocket((c) => {
      const cursorParam = c.req.query("cursor");
      const requestedCursor = cursorParam != null ? Number(cursorParam) : undefined;
      let ws: WSContext;

      return {
        onOpen(_evt, wsCtx) {
          ws = wsCtx;
          subscribers.add(ws);

          if (requestedCursor != null) {
            void (async () => {
              const rows = await db
                .select()
                .from(labels)
                .where(gt(labels.id, requestedCursor))
                .orderBy(labels.id);

              for (const row of rows) {
                const frame = encodeLabelsFrame(row.id, rowToSignedLabel(row));
                ws.send(new Uint8Array(frame) as Uint8Array<ArrayBuffer>);
              }
            })();
          }
        },
        onClose() {
          subscribers.delete(ws);
        },
      };
    }),
  );

  const root = resolve(clientDir);
  if (existsSync(root)) {
    app.use("/*", serveStatic({ root: clientDir }));
    app.get("/", serveStatic({ root: clientDir, path: "index.html" }));
    app.get("/dashboard", serveStatic({ root: clientDir, path: "dashboard.html" }));
  } else {
    console.warn(`Static file directory not found: ${root} — skipping static serving`);
  }

  const consumer = startJetstreamConsumer({
    initialState,
    patterns,
    handlePost: async (result) => {
      if (!result.action) return;

      const unsigned = {
        src: did,
        uri: result.postUri,
        val: result.action.val,
        cts: new Date().toISOString(),
      };

      const signed = await signLabel(unsigned, keypair);
      const inserted = await recordLabel(db, {
        ...signed,
        domain: result.action.domain,
        authorDid: result.authorDid,
      });

      if (inserted) {
        labelEmitter.emit("label", { seq: inserted.id, label: signed });
      }
    },
    saveState: (state) => saveCursorState(db, state),
  });

  const wss = new WebSocketServer({ noServer: true });
  const server = serve(
    {
      fetch: app.fetch,
      port,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      websocket: { server: wss as any },
    },
    (info) => {
      console.log(`Labeler server listening on http://localhost:${info.port}`);
    },
  );

  async function shutdown() {
    console.log("Shutting down...");
    await consumer.stop();
    for (const ws of subscribers) {
      ws.close(1001, "server shutting down");
    }
    server.close();
    client.close();
  }

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("Fatal error", error);
  process.exit(1);
});
