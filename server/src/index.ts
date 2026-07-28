import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";

import { startRuntime } from "./runtime.js";

const did = process.env.DID;
const signingKey = process.env.SIGNING_KEY;
const dbPath = process.env.DB_PATH ?? "paywall-radar.db";
const clientDir = process.env.CLIENT_DIR ?? "dist/client";
const port = Number(process.env.PORT ?? 4100);

async function main() {
  if (!did || !signingKey) {
    throw new Error("DID and SIGNING_KEY environment variables are required");
  }

  const runtime = await startRuntime({ did, signingKey, dbPath, clientDir });
  const webSocketServer = new WebSocketServer({ noServer: true });
  const server = serve(
    {
      fetch: runtime.app.fetch,
      port,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      websocket: { server: webSocketServer as any },
    },
    (info) => {
      console.log(`Labeler server listening on http://localhost:${info.port}`);
    },
  );

  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log("Shutting down...");
    server.close();
    await runtime.stop();
  }

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("Fatal error", error);
  process.exit(1);
});
