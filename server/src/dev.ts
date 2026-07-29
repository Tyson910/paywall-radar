import {
  createServer as createHttpServer,
  type RequestListener,
  type ServerOptions,
} from "node:http";

import { serve } from "@hono/node-server";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";

import { startRuntime } from "./runtime.js";

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
  const runtime = await startRuntime();
  const vite = await createViteServer({
    configFile: "client/vite.config.ts",
    server: {
      middlewareMode: true,
      ws: { port: runtime.port + 1 },
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
      port: runtime.port,
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
