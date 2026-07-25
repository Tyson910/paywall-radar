import { LabelerServer } from "@skyware/labeler";

import { openDatabase } from "./database/connection.js";
import { initializeDatabase } from "./database/initialize.js";
import { recordLabel } from "./database/labels.js";
import { loadCursorState, loadDomainPatterns, saveCursorState } from "./database/state.js";
import { startJetstreamConsumer } from "./jetstream-consumer.js";
import { registerDashboardRoutes } from "./routes.js";

const did = process.env.DID;
const signingKey = process.env.SIGNING_KEY;
const dbPath = process.env.DB_PATH ?? "paywall-radar.db";
const port = Number(process.env.PORT ?? 4100);

async function main() {
  if (!did || !signingKey) {
    throw new Error("DID and SIGNING_KEY environment variables are required");
  }

  const { domainCount } = await initializeDatabase(dbPath);
  console.log(`Database initialized with ${domainCount} domain patterns`);

  const { client, db } = openDatabase(dbPath);
  const [patterns, initialState] = await Promise.all([
    loadDomainPatterns(db),
    loadCursorState(db),
  ]);

  const labeler = new LabelerServer({ did, signingKey, dbPath });
  registerDashboardRoutes(labeler, db);

  const consumer = startJetstreamConsumer({
    initialState,
    patterns,
    handlePost: async (result) => {
      if (!result.action) return;

      await labeler.createLabel({
        uri: result.postUri,
        val: result.action.val,
      });

      await recordLabel(db, {
        postUri: result.postUri,
        authorDid: result.authorDid,
        domain: result.action.domain,
      });
    },
    saveState: (state) => saveCursorState(db, state),
  });

  labeler.start(port, (error, address) => {
    if (error) {
      console.error("Failed to start server", error);
      process.exit(1);
    }
    console.log(`Labeler server listening on ${address}`);
  });

  async function shutdown() {
    console.log("Shutting down...");
    await consumer.stop();
    await new Promise<void>((resolve) => labeler.close(resolve));
    client.close();
  }

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("Fatal error", error);
  process.exit(1);
});
