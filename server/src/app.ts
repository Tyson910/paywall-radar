import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { WSContext } from "hono/ws";
import type { Logger } from "pino";

import { upgradeWebSocket } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { gt } from "drizzle-orm";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import type { AdminRoutesDeps } from "./admin-routes.js";
import type { AuthService } from "./auth.js";
import type { Database } from "./database/connection.js";
import type { LabelRow } from "./database/models.js";
import type { LabelStream } from "./label-stream.js";
import type { SignedLabel } from "./labeler.js";

import { createAdminRoutes } from "./admin-routes.js";
import { createAuthRoutes } from "./auth-routes.js";
import { labels } from "./database/models.js";
import { formatLabelForHttp, encodeLabelsFrame } from "./labeler.js";
import { log as defaultLog } from "./logger.js";
import { createDashboardRoutes } from "./routes.js";

export interface AppOptions {
  db: Database;
  labelStream: LabelStream;
  clientDir?: string;
  auth?: AuthService;
  adminDeps?: AdminRoutesDeps;
  log?: Logger;
}

function rowToSignedLabel(row: LabelRow): SignedLabel {
  return {
    ver: 1,
    src: row.src,
    uri: row.uri,
    val: row.val,
    cts: row.cts,
    ...(row.neg && { neg: true }),
    ...(row.cid != null && { cid: row.cid }),
    ...(row.exp != null && { exp: row.exp }),
    sig: row.sig,
  };
}

export function createApp({
  db,
  labelStream,
  clientDir,
  auth,
  adminDeps,
  log = defaultLog,
}: AppOptions): Hono {
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
    if (adminDeps) app.route("/api/admin", createAdminRoutes(adminDeps));
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
          log.info(
            { event: "label_stream_opened", cursor: requestedCursor },
            "Label stream opened",
          );

          if (requestedCursor != null) {
            void (async () => {
              try {
                const rows = await db
                  .select()
                  .from(labels)
                  .where(gt(labels.id, requestedCursor))
                  .orderBy(labels.id);

                log.info(
                  {
                    event: "label_stream_replay_started",
                    cursor: requestedCursor,
                    labelCount: rows.length,
                  },
                  "Label stream replay started",
                );

                for (const row of rows) {
                  const frame = encodeLabelsFrame(row.id, rowToSignedLabel(row));
                  ws.send(new Uint8Array(frame) as Uint8Array<ArrayBuffer>);
                }

                log.info(
                  {
                    event: "label_stream_replay_completed",
                    cursor: requestedCursor,
                    labelCount: rows.length,
                    lastSequence: rows.at(-1)?.id,
                  },
                  "Label stream replay completed",
                );
              } catch (error) {
                log.error(
                  { event: "label_stream_replay_failed", cursor: requestedCursor, err: error },
                  "Label stream replay failed",
                );
                ws.close(1011, "label replay failed");
              }
            })();
          }
        },
        onError(event) {
          log.error(
            { event: "label_stream_error", cursor: requestedCursor, websocketEvent: event.type },
            "Label stream error",
          );
        },
        onClose(event) {
          if (subscriber) {
            labelStream.remove(subscriber);
          }
          log.info(
            {
              event: "label_stream_closed",
              cursor: requestedCursor,
              code: event.code,
              reason: event.reason,
              clean: event.wasClean,
            },
            "Label stream closed",
          );
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
