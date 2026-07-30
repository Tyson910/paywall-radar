import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { WSContext } from "hono/ws";

import { upgradeWebSocket } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { gt } from "drizzle-orm";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import type { AuthService } from "./auth.js";
import type { Database } from "./database/connection.js";
import type { LabelRow } from "./database/models.js";
import type { DomainPattern } from "./domains.js";
import type { LabelStream } from "./label-stream.js";
import type { SignedLabel } from "./labeler.js";

import { createAdminRoutes } from "./admin-routes.js";
import { createAuthRoutes } from "./auth-routes.js";
import { labels } from "./database/models.js";
import { formatLabelForHttp, encodeLabelsFrame } from "./labeler.js";
import { createDashboardRoutes } from "./routes.js";

export interface AppOptions {
  db: Database;
  labelStream: LabelStream;
  clientDir?: string;
  auth?: AuthService;
  domainPatterns?: DomainPattern[];
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

export function createApp({ db, labelStream, clientDir, auth, domainPatterns }: AppOptions): Hono {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
      referrerPolicy: "strict-origin-when-cross-origin",
      strictTransportSecurity: auth?.secureCookies ?? false,
      xFrameOptions: "DENY",
    }),
  );

  if (auth) {
    app.route("/", createAuthRoutes(auth));
    if (domainPatterns) app.route("/api/admin", createAdminRoutes(db, auth, domainPatterns));
  }
  app.route("/api", createDashboardRoutes(db));
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
      let subscriber: WSContext | undefined;

      return {
        onOpen(_event, ws) {
          subscriber = ws;
          labelStream.add(ws);

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
          if (subscriber) {
            labelStream.remove(subscriber);
          }
        },
      };
    }),
  );

  if (clientDir) {
    const root = resolve(clientDir);
    if (existsSync(root)) {
      app.use("/*", serveStatic({ root: clientDir }));
      app.get("/", serveStatic({ root: clientDir, path: "index.html" }));
      app.get("/dashboard", serveStatic({ root: clientDir, path: "index.html" }));
      app.get("/login", serveStatic({ root: clientDir, path: "index.html" }));
      app.get("/admin/*", serveStatic({ root: clientDir, path: "index.html" }));
    } else {
      console.warn(`Static file directory not found: ${root} — skipping static serving`);
    }
  }

  return app;
}
