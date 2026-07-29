import {
  createServer as createHttpServer,
  type RequestListener,
  type ServerOptions,
} from "node:http";

import { serve } from "@hono/node-server";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";

import { startRuntime } from "./runtime.js";

const did = process.env.DID;
const signingKey = process.env.SIGNING_KEY;
const dbPath = process.env.DB_PATH ?? "paywall-radar.db";
const port = Number(process.env.PORT ?? 4100);
const adminDid = process.env.ADMIN_DID;
const sessionSecret = process.env.SESSION_SECRET;
const publicUrl = process.env.PUBLIC_URL ?? `http://127.0.0.1:${port}`;
const oauthPrivateKey = process.env.OAUTH_PRIVATE_KEY;

function isBackendRequest(pathname: string | undefined): boolean {
  return (
    pathname === "/api" ||
    pathname?.startsWith("/api/") === true ||
    pathname === "/oauth" ||
    pathname?.startsWith("/oauth/") === true ||
    pathname === "/.well-known" ||
    pathname?.startsWith("/.well-known/") === true ||
    pathname === "/xrpc" ||
    pathname?.startsWith("/xrpc/") === true
  );
}

async function main() {
  if (!did || !signingKey || !adminDid || !sessionSecret) {
    throw new Error(
      "DID, SIGNING_KEY, ADMIN_DID, and SESSION_SECRET environment variables are required",
    );
  }

  const runtime = await startRuntime({
    did,
    signingKey,
    dbPath,
    adminDid,
    publicUrl,
    sessionSecret,
    ...(oauthPrivateKey ? { oauthPrivateKey } : {}),
  });
  const vite = await createViteServer({
    configFile: "client/vite.config.ts",
    server: {
      middlewareMode: true,
      ws: { port: port + 1 },
    },
    appType: "spa",
  });

  const createDevelopmentServer = ((options: ServerOptions, honoListener: RequestListener) =>
    createHttpServer(options, (request, response) => {
      if (isBackendRequest(request.url)) {
        honoListener(request, response);
        return;
      }

      vite.middlewares(request, response, (error?: unknown) => {
        if (error) {
          console.error("Vite middleware error", error);
          response.statusCode = 500;
          response.end("Development server error");
          return;
        }

        honoListener(request, response);
      });
    })) as typeof createHttpServer;

  const webSocketServer = new WebSocketServer({ noServer: true });
  const server = serve(
    {
      fetch: runtime.app.fetch,
      port,
      createServer: createDevelopmentServer,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      websocket: { server: webSocketServer as any },
    },
    (info) => {
      console.log(`Development server listening on http://localhost:${info.port}`);
    },
  );

  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log("Shutting down development server...");
    server.close();
    await runtime.stop();
    await vite.close();
  }

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("Fatal error", error);
  process.exit(1);
});
