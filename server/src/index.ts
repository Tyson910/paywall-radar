import { serve } from "@hono/node-server";

import { startRuntime } from "./runtime.js";
import { createWebSocketServer } from "./websocket-server.js";

async function main() {
  const runtime = await startRuntime();
  const webSocketServer = createWebSocketServer();
  const server = serve(
    {
      fetch: runtime.app.fetch,
      port: runtime.port,
      websocket: { server: webSocketServer },
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
